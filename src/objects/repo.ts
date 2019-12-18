import {
  BaseRepository,
  DuplicateModelError,
  MongooseNamespace,
  PaginationQuery,
  PaginationQueryResult,
  Query
} from "@random-guys/bucket";
import startCase from "lodash/startCase";
import { SchemaDefinition } from "mongoose";
import { RemoteClient } from "../remote-vcs/service";
import { mongoSet } from "../object.util";
import { asObject, ObjectModel, ObjectState, PayloadModel } from "./model";
import { ObjectSchema } from "./schema";

/**
 * `InvalidOperation` is usually thrown when a user tries
 * to perform an operation on a frozen payload
 */
export class InvalidOperation extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * `InconsistentState` should only be thrown if invariants are not properly
 * enforced, or possible concurrency issues.
 */
export class InconsistentState extends Error {
  constructor() {
    super("The database is in an inconsistent state. Please resolve");
  }
}

/**
 * `ObjectRepository` is base repository for reviewable objects. It tries it's best
 * to mirror `bucket's` `BaseRepository` methods.
 */
export class ObjectRepository<T extends PayloadModel> {
  readonly internalRepo: BaseRepository<ObjectModel<T>>;
  readonly name: string;
  private hub: RemoteClient<T>;

  /**
   * This creates an event re
   * @param mongoose This will ensure the same connection is shared
   * @param name name of the repo. Note that this will become kebab case in
   * Mongo DB
   * @param schema Mongoose schema for the repo.
   * @param exclude properties to exclude from the serialized payload e.g. password
   */
  constructor(
    mongoose: MongooseNamespace,
    name: string,
    schema: SchemaDefinition,
    exclude: string[] = []
  ) {
    this.internalRepo = new BaseRepository(
      mongoose,
      name,
      ObjectSchema(schema, exclude)
    );
    this.name = this.internalRepo.name;
    this.hub = new RemoteClient();
  }

  /**
   * Create a frozen object and notify `pro-hub`
   * @param owner ID of use that can make further changes to this object until approved
   * @param data data to be saved
   */
  async create(owner: string, data: Partial<T>): Promise<T> {
    const newObject = await this.internalRepo.create({
      object_state: ObjectState.Created,
      __owner: owner,
      ...data
    });
    await this.hub.newObjectEvent(newObject);
    return newObject.toObject();
  }

  /**
   * Create a stable object directly, bypassing review requests.
   * @param data data to be saved
   */
  async createApproved(data: Partial<T>): Promise<T> {
    const newObject = await this.internalRepo.create({
      object_state: ObjectState.Stable,
      ...data
    });
    return newObject.toObject();
  }

  async assertExists(query: object): Promise<void> {
    const element = await this.internalRepo.byQuery(query, null, false);
    if (element) {
      throw new DuplicateModelError(
        `The ${startCase(this.internalRepo.name)} already exists`
      );
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
    return this.markup(user, maybePending);
  }

  /**
   * Search for an object based on a query. Note that this doesn't take
   * into account pending updates.
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param allowNew allow mongodb return newly created objects. `false` by default
   */
  async byQuery(user: string, query: object, allowNew = false): Promise<T> {
    const maybePending = await this.internalRepo.byQuery(
      this.allowNew(query, allowNew)
    );
    return this.markup(user, maybePending);
  }

  /**
   * Search for multiple objects based on a query. Note that this doesn't take
   * into account pending updates.
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param allowNew allow mongodb return newly created objects. `false` by default
   */
  async all(user: string, query: Query = {}, allowNew = false): Promise<T[]> {
    query.conditions = this.allowNew(query.conditions, allowNew);
    const maybes = await this.internalRepo.all(query);
    return maybes.map(e => this.markup(user, e));
  }

  /**
   * This is like `all`, but it returns paginated results
   * @param user who's asking. Use everyone if it's not important
   * @param query mongo query to use for search
   * @param allowNew allow mongodb return newly created objects. `false` by default
   */
  async list(
    user: string,
    query: PaginationQuery,
    allowNew = false
  ): Promise<PaginationQueryResult<T>> {
    query.conditions = this.allowNew(query.conditions, allowNew);
    const paginatedResults = await this.internalRepo.list(query);
    return {
      ...paginatedResults,
      result: paginatedResults.result.map(e => this.markup(user, e))
    };
  }

  /**
   * Update an object in place if unstable or create a pending update
   * if stable.
   * @param user who wants to make such update
   * @param reference ID of object to be updated
   * @param update updates to be made
   */
  async update(
    user: string,
    reference: string,
    update: Partial<T>
  ): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
      case ObjectState.Updated:
        const freshData = await this.inplaceUpdate(user, data, update);
        await this.hub.patch(reference, freshData);
        return this.markup(user, freshData);
      case ObjectState.Deleted:
        throw new InvalidOperation(
          "Can't update an item up that is to be deleted"
        );
      case ObjectState.Stable:
        const newUpdate = await this.newUpdate(user, data, update);
        await this.hub.updateObjectEvent(newUpdate, update);
        return this.markup(user, newUpdate);
      default:
        throw new InconsistentState();
    }
  }

  /**
   * Creates a pending delete for a stable object. Otherwise it just rolls back
   * changes introduced. Fails if the `user` passed is not the object's temporary
   * owner.
   * @param user who wants to do this
   * @param reference ID of object to be deleted
   */
  async delete(user: string, reference: string): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
      case ObjectState.Updated:
      case ObjectState.Deleted:
        const freshData = await this.inplaceDelete(user, data);
        await this.hub.close(reference);
        return this.markup(user, freshData);
      case ObjectState.Stable:
        const deletedData = await this.newDelete(user, data);
        await this.hub.deleteObjectEvent(deletedData);
        return this.markup(user, deletedData);
      default:
        throw new InconsistentState();
    }
  }

  /**
   * Stabilises an object based on its state. Returns the newest state
   * of the object
   * @param reference ID of the object being stabilised
   */
  async merge(reference: string): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
        return this.stabilise(data).then(asObject);
      case ObjectState.Updated:
        return this.internalRepo
          .atomicUpdate(
            { _id: reference, object_state: ObjectState.Updated },
            { $set: data.__patch }
          )
          .then(asObject);
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
   * Rolls back any unapproved changes on an object
   * @param reference ID of the object being normalized
   */
  async reject(reference: string): Promise<T> {
    const data = await this.internalRepo.byID(reference);
    switch (data.object_state) {
      case ObjectState.Created:
        return data.remove().then(asObject);
      case ObjectState.Updated:
      case ObjectState.Deleted:
        return this.stabilise(data).then(asObject);
      case ObjectState.Stable:
        throw new InvalidOperation("Cannot reject a stable object");
      default:
        throw new InconsistentState();
    }
  }

  protected stabilise(data: ObjectModel<T>) {
    return this.internalRepo.atomicUpdate(
      { _id: data.id, object_state: data.object_state },
      {
        $set: {
          object_state: ObjectState.Stable,
          __owner: null,
          __patch: null
        }
      }
    );
  }

  protected inplaceUpdate(
    user: string,
    data: ObjectModel<T>,
    partial: Partial<T>
  ) {
    if (data.__owner !== user) {
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
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
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
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

  protected markup(user: string, data: ObjectModel<T>) {
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