import { publisher } from "@random-guys/eventbus";
import { Connection } from "amqplib";
import Logger from "bunyan";

import { ObjectRepository, PayloadModel } from "../objects";
import { RPCService } from "../rpc";
import { CloseEvent, DeleteObjectEvent, NewObjectEvent, PatchEvent, UpdateObjectEvent } from "./event-types";
import { CheckResult, FinalRequest, MergeHandler } from "./merger";

export interface AMQPOptions {
  remote_queue: string;
  amqp_connection: Connection;
}

/**
 * ProhubClient manages all interactions between a pro-vcs repo and its
 * prohub. From queueing up repo events to driving the communication
 * with the prohub for approving, rejecting and running checks.
 */
export class ProhubClient<T extends PayloadModel> {
  private server: RPCService;
  private remote: string;

  /**
   * Create a new client for talking to the prohub
   * @param repository repository this client is to manage
   */
  constructor(private repository: ObjectRepository<T>) { }

  /**
   * Setup the RPC server for running the `MergeHandler` of this repo and listeners for repo events
   * @param merger instructions on how to handle final requests(approvals and rejections)
   * @param logger logger for RPC server.
   * @param options options for talking to rabbitmq
   */
  async init(merger: MergeHandler<T>, logger: Logger, options: AMQPOptions) {
    if (this.server) {
      throw new Error("RPC server has already been setup");
    }

    this.remote = options.remote_queue;

    // setup server for handling merger events
    this.server = new RPCService(this.repository.name, logger);
    await this.server.init(options.amqp_connection);
    await this.server.addMethod<FinalRequest, T>("onApprove", req => merger.onApprove(req.body, req));
    await this.server.addMethod<FinalRequest, T>("onReject", req => merger.onReject(req.body, req));
    await this.server.addMethod<string, CheckResult[]>("onCheck", req => merger.onCheck(req.body, req));
  }

  async setupListeners() {
    // setup listeners for repo events
    this.repository.addListener("create", this.onCreate.bind(this));
    this.repository.addListener("update", this.onUpdate.bind(this));
    this.repository.addListener("delete", this.onDelete.bind(this));
    this.repository.addListener("patch", this.onPatch.bind(this));
    this.repository.addListener("undo", this.onUndo.bind(this));
  }

  /**
   * Allow users shutdown the server gracefully
   */
  async shutdown() {
    this.repository.removeAllListeners();
    return this.server.close();
  }

  async onCreate(owner: string, val: T) {
    const event: NewObjectEvent<T> = {
      event_type: "create.new",
      namespace: this.repository.name,
      reference: val.id,
      owner: owner,
      payload: val
    };
    return await publisher.queue(this.remote, event);
  }

  async onUpdate(owner: string, oldVal: T, newVal: T) {
    const event: UpdateObjectEvent<T> = {
      event_type: "create.update",
      namespace: this.repository.name,
      reference: oldVal.id,
      owner: owner,
      payload: newVal,
      previous_version: oldVal
    };
    return await publisher.queue(this.remote, event);
  }

  async onDelete(owner: string, val: T) {
    const event: DeleteObjectEvent<T> = {
      event_type: "create.delete",
      namespace: this.repository.name,
      reference: val.id,
      owner: owner,
      payload: val
    };
    return await publisher.queue(this.remote, event);
  }

  async onPatch(owner: string, _oldVal: T, newVal: T) {
    const event: PatchEvent<T> = {
      event_type: "patch",
      reference: newVal.id,
      payload: newVal
    };
    return await publisher.queue(this.remote, event);
  }

  async onUndo(owner: string, val: T) {
    const event: CloseEvent = { event_type: "close", reference: val.id };
    return await publisher.queue(this.remote, event);
  }
}
