import { publisher } from "@random-guys/eventbus";
import { Connection } from "amqplib";
import Logger from "bunyan";
import { ObjectModel, ObjectRepository, PayloadModel } from "../objects";
import { RPCService } from "../rpc";
import {
  CloseEvent,
  DeleteObjectEvent,
  NewObjectEvent,
  PatchEvent,
  UpdateObjectEvent
} from "./event-types";
import { RemoteObject } from "./merger";

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

    await this.server.addMethod("onApprove", merger.onApprove.bind(merger));
    await this.server.addMethod("onReject", merger.onReject.bind(merger));
    await this.server.addMethod("onCheck", merger.onCheck.bind(merger));
  }

  async newObjectEvent(newObject: ObjectModel<T>) {
    const event: NewObjectEvent<T> = {
      event_type: "create.new",
      namespace: this.repository.name,
      reference: newObject.id,
      owner: newObject.__owner,
      payload: newObject.toObject()
    };
    return await publisher.queue(this.remote, event);
  }

  async updateObjectEvent(freshObject: ObjectModel<T>, update: Partial<T>) {
    const event: UpdateObjectEvent<T> = {
      event_type: "create.update",
      namespace: this.repository.name,
      reference: freshObject.id,
      owner: freshObject.__owner,
      payload: freshObject.toObject(),
      update
    };
    return await publisher.queue(this.remote, event);
  }

  async deleteObjectEvent(objectToDelete: ObjectModel<T>) {
    const event: DeleteObjectEvent<T> = {
      event_type: "create.delete",
      namespace: this.repository.name,
      reference: objectToDelete.id,
      owner: objectToDelete.__owner,
      payload: objectToDelete.toObject()
    };
    return await publisher.queue(this.remote, event);
  }

  async patch(reference: string, payload: ObjectModel<T>) {
    const event: PatchEvent<T> = {
      event_type: "patch",
      reference: reference,
      payload: payload.toObject()
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
