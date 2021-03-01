import {
  PaginationQuery,
  PaginationQueryResult,
  Query
} from "@random-guys/bucket";
import { Connection } from "amqplib";
import Logger from "bunyan";
import { Connection as MongooseConnection, SchemaDefinition } from "mongoose";
import { RemoteClient, RemoteObject } from "../remote-vcs";
import { InconsistentState, InvalidOperation } from "./common";
import { ObjectModel, ObjectState, PayloadModel } from "./model";
import { ObjectRepositoryV2 } from "./repo-v2";
import { ObjectSchema } from "./schema";

/**
 * `ObjectRepository` is base repository for reviewable objects. It tries it's best
 * to mirror `bucket's` `BaseRepository` methods.
 */
export class ProVCSRepository<T extends PayloadModel> extends ObjectRepositoryV2<T> {
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
    conn: MongooseConnection,
    name: string,
    schema: SchemaDefinition | ObjectSchema<T>,
    exclude: string[] = []
  ) {
    if (schema instanceof ObjectSchema) {
      super(conn, name, schema);
    } else {
      super(conn, name, schema, exclude);
    }

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
  async create(owner: string, data: Partial<T>): Promise<ObjectModel<T>> {
    const newObject = await super.create(owner, data);

    await this.client.newObjectEvent(owner, newObject.toObject());
    return newObject;
  }

  /**
   * Create a stable object directly, bypassing review requests.
   * @param data data to be saved
   */
  async createApproved(data: Partial<T>): Promise<T>;
  async createApproved(data: Partial<T>[]): Promise<T[]>;
  async createApproved(data: Partial<T> | Partial<T>[]): Promise<any | any[]> {
    return super.createApproved(data);
  }

  /**
   * Just like `create` except it writes directly to MongoDB. Do make sure to set default values
   * validate the types of the values as this bypasses mongoose validation. Although it handles
   * _id and timestamps. Also avoid virtuals if you're going to use this.
   * @param owner ID of user that can make further changes to this object until approved
   * @param data data to be saved. Could be a single value or an array
   */
  async createRaw(owner: string, data: Partial<T>): Promise<ObjectModel<T>> {
    const rawObject = await super.createRaw(owner, data);

    // notify client
    await this.client.newObjectEvent(owner, rawObject.toObject());

    rawObject.toObject = () => this.schema.toObject(rawObject);
    return rawObject.toObject();
  }

  async assertExists(query: object): Promise<void> {
    await super.assertExists(query);
  }

  /**
   * Get an object based on it's owner. Check out `markup`
   * for more details
   * @param user who's asking
   * @param reference ID of the object
   */
  async get(user: string, reference: string): Promise<T> {
    return await super.get(user, reference);
  }

  /**
   * Search for an object based on a query. Note that this doesn't take
   * into account pending updates.
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param fresh allow mongodb return unstable objects. `false` by default
   * @param throwOnNull Whether to throw a `ModelNotFoundError` error if the document is not found. Defaults to true
   */
  async byQuery(user: string, query: object, fresh = false, throwOnNull = true): Promise<T> {
    return await super.byQuery(user, query, fresh, throwOnNull);
  }

  /**
   * Search for multiple objects based on a query. Note that this doesn't take
   * into account pending updates.
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param fresh allow mongodb return unstable objects. `false` by default
   */
  async all(user: string, query: Query = {}, fresh = false): Promise<T[]> {
    return await super.all(user, query, fresh);
  }

  /**
   * This is like `all`, but it returns paginated results
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param fresh allow mongodb return unstable objects. `false` by default
   */
  async list(user: string, query: PaginationQuery, fresh = false): Promise<PaginationQueryResult<T>> {
    return await super.list(user, query, fresh);
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
   * Update an object without going through the approval process.
   * @param query MongoDB query object or id string
   * @param update update to be applied
   * @param throwOnNull Whether to throw a `ModelNotFoundError` error if the document is not found. Defaults to true
   */
  updateApproved(query: string | object, update: object, throwOnNull = true) {
    return super.updateApproved(query, update, throwOnNull);
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

  /**
   * Permanently deletes a document without the approval process.
   * @param query MongoDB query object or id string
   * @param throwOnNull Whether to throw a `ModelNotFoundError` error if the document is not found. Defaults to true
   */
  deleteApproved(query: string | object, throwOnNull = true) {
    return super.deleteApproved(query, throwOnNull);
  }

  /**
   * Permanently delete multiple documents document without the approval process.
   * @param query MongoDB query object
   */
  truncate(query: object) {
    return super.truncate(query);
  }

  /**
   * Stabilises an object based on its state. Returns the newest state
   * of the object
   * @param reference ID of the object being stabilised
   * @param updates optional updates to add when merging.
   */
  async merge(reference: string, updates?: object): Promise<T> {
    return super.merge(reference, updates);
  }

  /**
   * Pretty much like `merge` except it uses mongodb directly
   * @param reference ID of the object being stabilised
   * @param updates optional mongodb updates parameters.
   */
  async mergeRaw(reference: string, updates = {}): Promise<T> {
    return super.mergeRaw(reference, updates);
  }

  /**
   * Rolls back any unapproved changes on an object
   * @param reference ID of the object being normalized
   * @param updates optional updates to add when merging
   */
  async reject(reference: string, updates?: object): Promise<T> {
    return super.reject(reference, updates);
  }
}
