import { publisher } from "@random-guys/eventbus";
import { Connection } from "amqplib";
import Logger from "bunyan";

import { mongoSet } from "../object";
import { ObjectRepository, PayloadModel } from "../objects";
import { RPCService } from "../rpc";
import { CloseEvent, DeleteObjectEvent, NewObjectEvent, PatchEvent, UpdateObjectEvent } from "./event-types";
import { CheckResult, FinalRequest, RemoteObject } from "./merger";

export interface RPCConnectionOptions {
  remote_queue: string;
  amqp_connection: Connection;
}

/**
 * RemoteClient manages all interactions between a pro-vcs repo and its
 * remote. From queueing up request events to driving the communication
 * with the remote for approving, rejecting and running checks.
 */
export class RemoteClient<T extends PayloadModel> {
  private server: RPCService;
  private remote: string;

  /**
   * Create a new client for talking to the VCS's remote
   * @param repository repository this client is to manage
   */
  constructor(private repository: ObjectRepository<T>) {}

  /**
   * Setup the RPC server for running the `RemoteObject` of this repo and listener for repo events
   * @param remoteQueue name of the queue for object events
   * @param connection AMQP connection for the RPC server
   * @param merger Instructions on how to merge, reject and validate
   * @param logger logger for RPC server.
   */
  async init(merger: RemoteObject<T>, logger: Logger, options: RPCConnectionOptions) {
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

  private async onCreate(owner: string, val: T) {
    const event: NewObjectEvent<T> = {
      event_type: "create.new",
      namespace: this.repository.name,
      reference: val.id,
      owner: owner,
      payload: val
    };
    return await publisher.queue(this.remote, event);
  }

  private async onUpdate(owner: string, oldVal: T, newVal: T) {
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

  private async onDelete(owner: string, val: T) {
    const event: DeleteObjectEvent<T> = {
      event_type: "create.delete",
      namespace: this.repository.name,
      reference: val.id,
      owner: owner,
      payload: val
    };
    return await publisher.queue(this.remote, event);
  }

  private async onPatch(reference: string, val: T) {
    const event: PatchEvent<T> = {
      event_type: "patch",
      reference: reference,
      payload: val
    };
    return await publisher.queue(this.remote, event);
  }

  private async onUndo(reference: string) {
    const event: CloseEvent = { event_type: "close", reference };
    return await publisher.queue(this.remote, event);
  }
}
