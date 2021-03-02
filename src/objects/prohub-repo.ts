import { Connection } from "amqplib";
import Logger from "bunyan";
import { Connection as MongooseConnection, SchemaDefinition } from "mongoose";
import { RemoteClient, RemoteObject } from "../remote-vcs";
import { InconsistentState, InvalidOperation } from "./common";
import { ObjectState, PayloadModel } from "./model";
import { ObjectRepository } from "./repo";
import { ObjectSchema } from "./schema";

/**
 * `ObjectRepository` is base repository for reviewable objects. It tries it's best
 * to mirror `bucket's` `BaseRepository` methods.
 */
export class ProHubRepository<T extends PayloadModel> extends ObjectRepository<T> {
  private client: RemoteClient<T>;

  /**
   * This creates an event repository
   * @param conn This will ensure the same connection is shared
   * @param name name of the repo. Note that this will become kebab case in
   * Mongo DB
   * @param schema ObjectSchema or Mongoose SchemaDefinition for the repo.
   * @param exclude properties to exclude from the serialized payload e.g. password
   */
  constructor(conn: MongooseConnection, name: string, schema: ObjectSchema<T>);
  constructor(conn: MongooseConnection, name: string, schema: SchemaDefinition, exclude: string[]);
  constructor(
    conn: MongooseConnection, name: string, schema: SchemaDefinition | ObjectSchema<T>, exclude: string[] = []
  ) {
    // @ts-ignore TS cannot see base implementation
    super(conn, name, schema, exclude);
    this.client = new RemoteClient(this);
  }

  /**
   * Setup a merger for this repo as well as queue for object events. Note this
   * should be called at most once(we expect you'll use one merger for your repo)
   * else it would throw an error.
   * @param remoteQueue name of the event queue for request events
   * @param connection AMQP connection that drives the underlying comms
   * @param merger implementation of the merger
   * @param logger logger to help track requests to the merger
   */
  initClient(remoteQueue: string, connection: Connection, merger: RemoteObject<T>, logger: Logger) {
    return this.client.init(remoteQueue, connection, merger, logger);
  }

  /**
   * Create a frozen object and notify `pro-hub`
   * @param owner ID of user that can make further changes to this object until approved
   * @param data data to be saved
   */
  async create(owner: string, data: Partial<T>): Promise<T> {
    const newObject = await super.create(owner, data);

    await this.client.newObjectEvent(owner, newObject);
    return newObject;
  }

  /**
   * Just like `create` except it writes directly to MongoDB. Do make sure to set default values
   * validate the types of the values as this bypasses mongoose validation. Although it handles
   * _id and timestamps. Also avoid virtuals if you're going to use this.
   * @param owner ID of user that can make further changes to this object until approved
   * @param data data to be saved. Could be a single value or an array
   */
  async createRaw(owner: string, data: Partial<T>): Promise<T> {
    const rawObject = await super.createRaw(owner, data);

    // notify client
    await this.client.newObjectEvent(owner, rawObject);
    return rawObject;
  }

  async assertExists(query: object): Promise<void> {
    await super.assertExists(query);
  }

  /**
   * Update an object in place if unstable or create a pending update
   * if stable.
   * @param user who wants to make such update
   * @param query MongoDB query object or id string
   * @param update updates to be made
   */
  async update(user: string, query: string | object, update: Partial<T>): Promise<T> {
    const parsedQuery = this.internalRepo.getQuery(query);
    const data = await this.internalRepo.byQuery(parsedQuery);

    switch (data.object_state) {
      case ObjectState.Created:
      case ObjectState.Updated:
        const freshData = await this.inplaceUpdate(user, data, update);
        await this.client.patch(data.id, freshData.toObject());
        return this.markup(user, freshData, true);
      case ObjectState.Deleted:
        throw new InvalidOperation("Can't update an item up that is to be deleted");
      case ObjectState.Stable:
        const newUpdate = await this.newUpdate(user, data, update);
        await this.client.updateObjectEvent(user, data.toObject(), newUpdate.toObject(), update);
        return this.markup(user, newUpdate, true);
      default:
        throw new InconsistentState();
    }
  }

  /**
   * Creates a pending delete for a stable object. Otherwise it just rolls back
   * changes introduced. Fails if the `user` passed is not the object's temporary
   * owner.
   * @param user who wants to do this
   * @param query MongoDB query object or id string
   */
  async delete(user: string, query: string | object): Promise<T> {
    const parsedQuery = super.internalRepo.getQuery(query);
    const data = await super.internalRepo.byQuery(parsedQuery);
    switch (data.object_state) {
      case ObjectState.Created:
      case ObjectState.Updated:
      case ObjectState.Deleted:
        const freshData = await this.inplaceDelete(user, data);
        await this.client.close(data.id);
        return this.markup(user, freshData, true);
      case ObjectState.Stable:
        const deletedData = await this.newDelete(user, data);
        await this.client.deleteObjectEvent(user, deletedData.toObject());
        return this.markup(user, deletedData, true);
      default:
        throw new InconsistentState();
    }
  }
}
