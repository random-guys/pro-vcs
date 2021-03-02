import { publisher } from "@random-guys/eventbus";
import { Connection } from "amqplib";
import Logger from "bunyan";
import { mongoSet } from "../object";
import { PayloadModel } from "../objects";
import { ProHubRepository } from "../objects/prohub-repo";
import { RPCService } from "../rpc";
import {
  CloseEvent,
  DeleteObjectEvent,
  NewObjectEvent,
  PatchEvent,
  UpdateObjectEvent
} from "./event-types";
import { CheckResult, FinalRequest, RemoteObject } from "./merger";

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
  constructor(private repository: ProHubRepository<T>) { }

  /**
   * Setup the RPC server for running the `RemoteObject` of
   * this repo
   * @param remoteQueue name of the queue for object events
   * @param connection AMQP connection for the RPC server
   * @param merger Instructions on how to merge, reject and validate
   * @param logger logger for RPC server.
   */
  async init(
    remoteQueue: string,
    connection: Connection,
    merger: RemoteObject<T>,
    logger: Logger
  ) {
    if (this.server) {
      throw new Error("RPC server has already been setup");
    }

    this.remote = remoteQueue;

    this.server = new RPCService(this.repository.name, logger);
    await this.server.init(connection);

    await this.server.addMethod<FinalRequest, T>("onApprove", req =>
      merger.onApprove(req.body, req)
    );
    await this.server.addMethod<FinalRequest, T>("onReject", req =>
      merger.onReject(req.body, req)
    );
    await this.server.addMethod<string, CheckResult[]>("onCheck", req =>
      merger.onCheck(req.body, req)
    );
  }

  /**
   * Allow users shutdown the server gracefully
   */
  async shutdownClient() {
    return this.server.close();
  }

  async newObjectEvent(owner: string, object: T) {
    const event: NewObjectEvent<T> = {
      event_type: "create.new",
      namespace: this.repository.name,
      reference: object.id,
      owner: owner,
      payload: object
    };
    return await publisher.queue(this.remote, event);
  }

  async updateObjectEvent(owner: string, oldPayload: T, update: Partial<T>, patch: any) {
    const freshPayload = mongoSet(oldPayload, patch);

    const event: UpdateObjectEvent<T> = {
      event_type: "create.update",
      namespace: this.repository.name,
      reference: oldPayload.id,
      owner: owner,
      payload: freshPayload,
      previous_version: oldPayload
    };
    return await publisher.queue(this.remote, event);
  }

  async deleteObjectEvent(owner: string, objectToDelete: T) {
    const event: DeleteObjectEvent<T> = {
      event_type: "create.delete",
      namespace: this.repository.name,
      reference: objectToDelete.id,
      owner: owner,
      payload: objectToDelete
    };
    return await publisher.queue(this.remote, event);
  }

  async patch(reference: string, payload: T) {
    const event: PatchEvent<T> = {
      event_type: "patch",
      reference: reference,
      payload: payload
    };
    return await publisher.queue(this.remote, event);
  }

  async close(reference: string) {
    const event: CloseEvent = {
      event_type: "close",
      reference
    };
    return await publisher.queue(this.remote, event);
  }
}
