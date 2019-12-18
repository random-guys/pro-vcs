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

  /**
   * Create a new client for talking to the VCS's remote
   * @param repository repository this client is to manage
   * @param remote queue of the remote service
   * @param logger
   */
  constructor(
    private repository: ObjectRepository<T>,
    private remote: string,
    logger: Logger
  ) {
    this.server = new RPCService(repository.name, logger);
  }

  /**
   * Setup the RPC server for running the `RemoteObject` of
   * this repo
   * @param connection AMQP connection for the RPC server
   * @param remoteObj Instructions on how to merge, reject and validate
   */
  init(connection: Connection, remoteObj: RemoteObject<T>) {
    this.server.init(connection);

    this.server.addMethod("onApprove", remoteObj.onApprove.bind(remoteObj));
    this.server.addMethod("onReject", remoteObj.onReject.bind(remoteObj));
    this.server.addMethod("onCheck", remoteObj.onCheck.bind(remoteObj));
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
