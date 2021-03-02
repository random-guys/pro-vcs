import {
  BaseRepository,
  DuplicateModelError,
  PaginationQuery,
  PaginationQueryResult,
  Query
} from "@random-guys/bucket";
import startCase from "lodash/startCase";
import { Collection, Connection as MongooseConnection, SchemaDefinition } from "mongoose";
import uuid from "uuid/v4";
import { mongoSet } from "../object";
import { InconsistentState, InvalidOperation } from "./common";
import { asObject, ObjectModel, ObjectState, PayloadModel } from "./model";
import { ObjectSchema } from "./schema";

/**
 * `ObjectRepository` is base repository for reviewable objects. It tries it's best
 * to mirror `bucket's` `BaseRepository` methods.
 */
export class ObjectRepository<T extends PayloadModel> {
  readonly internalRepo: BaseRepository<ObjectModel<T>>;
  readonly name: string;
  private collection: Collection;
  private schema: ObjectSchema<T>;

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
    this.schema = schema instanceof ObjectSchema ? schema : new ObjectSchema(schema, exclude);
    this.internalRepo = new BaseRepository(conn, name, this.schema.mongooseSchema);
    this.name = this.internalRepo.name;
    this.collection = this.internalRepo.model.collection;
  }

  /**
   * Create a frozen object and notify `pro-hub`
   * @param owner ID of user that can make further changes to this object until approved
   * @param data data to be saved
   */
  async create(owner: string, data: Partial<T>): Promise<T> {
    return (
      await this.internalRepo.create({
        object_state: ObjectState.Created,
        __owner: owner,
        ...data
      }))
      .toObject();
  }

  /**
   * Create a stable object directly, bypassing review requests.
   * @param data data to be saved
   */
  async createApproved(data: Partial<T>): Promise<T>;
  async createApproved(data: Partial<T>[]): Promise<T[]>;
  async createApproved(data: Partial<T> | Partial<T>[]): Promise<any | any[]> {
    if (Array.isArray(data)) {
      const payloads: Partial<T>[] = data.map(x => ({ object_state: ObjectState.Stable, ...x }));
      // @ts-ignore bad typescript
      const objects: ObjectModel<T>[] = await this.internalRepo.create(payloads);
      return objects.map(asObject);
    } else {
      return this.internalRepo.create({ ...data, object_state: ObjectState.Stable });
    }
  }

  /**
   * Just like `create` except it writes directly to MongoDB. Do make sure to set default values
   * validate the types of the values as this bypasses mongoose validation. Although it handles
   * _id and timestamps. Also avoid virtuals if you're going to use this.
   * @param owner ID of user that can make further changes to this object until approved
   * @param data data to be saved. Could be a single value or an array
   */
  async createRaw(owner: string, data: Partial<T>): Promise<T> {
    const id = uuid();
    const withDefaults = {
      _id: id,
      id: id,
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
      __owner: owner,
      object_state: ObjectState.Created
    };

    const result = await this.collection.insertOne(withDefaults);
    const rawObject = await this.collection.findOne({ _id: result.insertedId });

    return rawObject;
  }

  async assertExists(query: object): Promise<void> {
    const element = await this.internalRepo.byQuery(query, null, false);
    if (element) {
      throw new DuplicateModelError(`The ${startCase(this.internalRepo.name)} already exists`);
    }
  }

  /**
   * Get an object based on it's owner. Check out `markup`
   * for more details
   * @param user who's asking
   * @param reference ID of the object
   */
  async get(user: string, reference: string): Promise<T> {
    const maybePending = await this.internalRepo.byID(reference);
    return this.markup(user, maybePending, true);
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
    const maybePending = await this.internalRepo.byQuery(this.allowNew(query, fresh), null, throwOnNull);

    if (!maybePending) return null;

    return this.markup(user, maybePending, fresh);
  }

  /**
   * Search for multiple objects based on a query. Note that this doesn't take
   * into account pending updates.
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param fresh allow mongodb return unstable objects. `false` by default
   */
  async all(user: string, query: Query = {}, fresh = false): Promise<T[]> {
    query.conditions = this.allowNew(query.conditions, fresh);
    const maybes = await this.internalRepo.all(query);
    return maybes.map(e => this.markup(user, e, fresh));
  }

  /**
   * This is like `all`, but it returns paginated results
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param fresh allow mongodb return unstable objects. `false` by default
   */
  async list(user: string, query: PaginationQuery, fresh = false): Promise<PaginationQueryResult<T>> {
    query.conditions = this.allowNew(query.conditions, fresh);
    const paginatedResults = await this.internalRepo.list(query);
    return {
      ...paginatedResults,
      result: paginatedResults.result.map(e => this.markup(user, e, fresh))
    };
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
        return this.markup(user, freshData, true);
      case ObjectState.Deleted:
        throw new InvalidOperation("Can't update an item up that is to be deleted");
      case ObjectState.Stable:
        const newUpdate = await this.newUpdate(user, data, update);
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
    return this.internalRepo.atomicUpdate(query, update, throwOnNull).then(asObject);
  }

  /**
   * Creates a pending delete for a stable object. Otherwise it just rolls back
   * changes introduced. Fails if the `user` passed is not the object's temporary
   * owner.
   * @param user who wants to do this
   * @param query MongoDB query object or id string
   */
  async delete(user: string, query: string | object): Promise<T> {
    const parsedQuery = this.internalRepo.getQuery(query);
    const data = await this.internalRepo.byQuery(parsedQuery);
    switch (data.object_state) {
      case ObjectState.Created:
      case ObjectState.Updated:
      case ObjectState.Deleted:
        const freshData = await this.inplaceDelete(user, data);
        return this.markup(user, freshData, true);
      case ObjectState.Stable:
        const deletedData = await this.newDelete(user, data);
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
    return this.internalRepo.destroy(query, throwOnNull).then(asObject);
  }

  /**
   * Permanently delete multiple documents document without the approval process.
   * @param query MongoDB query object
   */
  truncate(query: object) {
    return this.internalRepo.truncate(query);
  }

  /**
   * Stabilises an object based on its state. Returns the newest state
   * of the object
   * @param reference ID of the object being stabilised
   * @param updates optional updates to add when merging.
   */
  async merge(reference: string, updates?: object): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
        return this.stabilise(data, updates).then(asObject);
      case ObjectState.Updated:
        return await this.stabiliseUpdate(data, updates).then(asObject);
      case ObjectState.Deleted:
        return this.internalRepo
          .destroy({
            _id: reference,
            object_state: ObjectState.Deleted
          })
          .then(asObject);
      case ObjectState.Stable:
        throw new InvalidOperation("Cannot merge a stable object");
      default:
        throw new InconsistentState();
    }
  }

  /**
   * Pretty much like `merge` except it uses mongodb directly
   * @param reference ID of the object being stabilised
   * @param updates optional mongodb updates parameters.
   */
  async mergeRaw(reference: string, updates = {}): Promise<T> {
    const data = await this.internalRepo.byID(reference);

    const updateQuery = { _id: data.id, object_state: data.object_state };

    if (data.object_state === ObjectState.Stable) {
      throw new InvalidOperation("Cannot merge a stable object");
    }

    if (data.object_state === ObjectState.Deleted) {
      return this.internalRepo.destroy(updateQuery).then(asObject);
    }

    updates["$set"] = {
      ...updates["$set"],
      object_state: ObjectState.Stable,
      __owner: null,
      __patch: null
    };

    if (data.object_state === ObjectState.Updated) {
      updates["$set"] = { ...data.__patch, ...updates["$set"] };
    }

    const result = await this.collection.findOneAndUpdate(updateQuery, updates, { returnOriginal: false });

    if (result.ok != 1) {
      throw new InconsistentState();
    }

    return this.schema.toObject(result.value);
  }

  /**
   * Rolls back any unapproved changes on an object
   * @param reference ID of the object being normalized
   * @param updates optional updates to add when merging
   */
  async reject(reference: string, updates?: object): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
        return data.remove().then(asObject);
      case ObjectState.Updated:
      case ObjectState.Deleted:
        return this.stabilise(data, updates).then(asObject);
      case ObjectState.Stable:
        throw new InvalidOperation("Cannot reject a stable object");
      default:
        throw new InconsistentState();
    }
  }

  protected stabilise(data: ObjectModel<T>, updates?: object) {
    return this.internalRepo.atomicUpdate(
      { _id: data.id, object_state: data.object_state },
      {
        $set: {
          ...updates,
          object_state: ObjectState.Stable,
          __owner: null,
          __patch: null
        }
      }
    );
  }

  protected stabiliseUpdate(data: ObjectModel<T>, updates?: object) {
    return this.internalRepo.atomicUpdate(
      { _id: data.id, object_state: data.object_state },
      {
        $set: {
          ...data.__patch,
          ...updates,
          object_state: ObjectState.Stable,
          __owner: null,
          __patch: null
        }
      }
    );
  }

  protected inplaceUpdate(user: string, data: ObjectModel<T>, partial: Partial<T>) {
    if (data.__owner !== user) {
      throw new InvalidOperation(`Can't update an unapproved ${startCase(this.internalRepo.name)}`);
    }
    const { object_state, ...cleanPartial } = partial;

    return this.internalRepo.atomicUpdate(
      {
        object_state: data.object_state,
        _id: data._id
      },
      {
        $set:
          data.object_state === ObjectState.Created
            ? cleanPartial
            : {
              __patch: mongoSet(data.__patch, cleanPartial)
            }
      }
    );
  }

  protected inplaceDelete(user: string, data: ObjectModel<T>) {
    if (data.__owner !== user) {
      throw new InvalidOperation(`Can't update an unapproved ${startCase(this.internalRepo.name)}`);
    }

    if (data.object_state === ObjectState.Created) {
      return data.remove();
    }

    // unfreeze stable version
    return this.stabilise(data);
  }

  protected newUpdate(user: string, data: ObjectModel<T>, update: Partial<T>) {
    const { object_state, ...cleanUpdate } = update;
    // mark object as frozen
    return this.internalRepo.atomicUpdate(
      {
        _id: data.id,
        object_state: ObjectState.Stable
      },
      {
        $set: {
          object_state: ObjectState.Updated,
          __owner: user,
          __patch: cleanUpdate
        }
      }
    );
  }

  protected newDelete(user: string, data: ObjectModel<T>) {
    // mark object as frozen
    return this.internalRepo.atomicUpdate(
      {
        _id: data.id,
        object_state: ObjectState.Stable
      },
      {
        $set: {
          object_state: ObjectState.Deleted,
          __owner: user
        }
      }
    );
  }

  protected markup(user: string, data: ObjectModel<T>, fresh: boolean) {
    if (!fresh) {
      return data.toObject();
    }

    if (data.object_state !== ObjectState.Stable && data.__owner !== user) {
      data.object_state = ObjectState.Frozen;
    }

    if (data.object_state === ObjectState.Updated && data.__owner === user) {
      data = mongoSet(data, data.__patch);
    }

    return data.toObject();
  }

  protected allowNew(query: object, allowNew: boolean) {
    if (!allowNew) {
      return {
        ...query,
        object_state: { $ne: ObjectState.Created }
      };
    }
    return query;
  }

  queryPathHelper(path: string, value: any) {
    return {
      $or: [{ [path]: value }, { [`__patch.${path}`]: value }]
    };
  }
}
