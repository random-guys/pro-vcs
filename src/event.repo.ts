import {
  BaseRepository,
  DuplicateModelError,
  MongooseNamespace,
  Query,
  PaginationQuery,
  PaginationQueryResult
} from '@random-guys/bucket';
import startCase from 'lodash/startCase';
import { SchemaDefinition } from 'mongoose';
import { asObject, EventModel, ObjectState, PayloadModel } from './event.model';
import { EventSchema } from './event.schema';
import { HubProxy } from './hub.proxy';
import { mongoSet } from './object.util';

/**
 * This error is usually thrown when a user tries
 * to perform an operation on a frozen payload
 */
export class InvalidOperation extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * This should only be throw if invariants are not properly
 * enforced, or possible concurrency issues.
 */
export class InconsistentState extends Error {
  constructor() {
    super('The database is in an inconsistent state. Please resolve');
  }
}

export class EventRepository<T extends PayloadModel> {
  readonly internalRepo: BaseRepository<EventModel<T>>;
  readonly name: string;
  private hub: HubProxy<T>;

  /**
   *
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
      EventSchema(schema, exclude)
    );
    this.name = this.internalRepo.name;
    this.hub = new HubProxy(name);
  }

  /**
   * Create a frozen object and notify `pro-hub`
   * @param owner ID of use that can make further changes to this object until approved
   * @param data data to be saved
   */
  async create(owner: string, data: Partial<T>): Promise<T> {
    const newObject = await this.internalRepo.create({
      object_state: ObjectState.created,
      __owner: owner,
      ...data
    });
    this.hub.fireCreate(newObject.id, newObject.object_state, {
      payload: newObject.toObject()
    });
    return newObject.toObject();
  }

  /**
   * Create a stable object directly, bypassing review requests.
   * @param data data to be saved
   */
  async createApproved(data: Partial<T>): Promise<T> {
    const newObject = await this.internalRepo.create({
      object_state: ObjectState.stable,
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
      case ObjectState.created:
      case ObjectState.updated:
        const freshData = await this.inplaceUpdate(user, data, update);
        await this.hub.firePatch(reference, freshData);
        return this.markup(user, freshData);
      case ObjectState.deleted:
        throw new InvalidOperation(
          "Can't update an item up that is to be deleted"
        );
      case ObjectState.stable:
        const newUpdate = await this.newUpdate(user, data, update);
        await this.hub.fireCreate(reference, data.object_state, {
          payload: data.toObject(),
          update
        });
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
      case ObjectState.created:
      case ObjectState.updated:
      case ObjectState.deleted:
        const freshData = await this.inplaceDelete(user, data);
        await this.hub.fireClose(reference);
        return this.markup(user, freshData);
      case ObjectState.stable:
        const deletedData = await this.newDelete(user, data);
        await this.hub.fireCreate(deletedData.id, deletedData.object_state);
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
      case ObjectState.created:
        return this.stabilise(data).then(asObject);
      case ObjectState.updated:
        return this.internalRepo
          .atomicUpdate(
            { _id: reference, object_state: ObjectState.updated },
            { $set: data.__patch }
          )
          .then(asObject);
      case ObjectState.deleted:
        return this.internalRepo
          .destroy({
            _id: reference,
            object_state: ObjectState.deleted
          })
          .then(asObject);
      case ObjectState.stable:
        throw new InvalidOperation('Cannot merge a stable object');
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
      case ObjectState.created:
        return data.remove().then(asObject);
      case ObjectState.updated:
      case ObjectState.deleted:
        return this.stabilise(data).then(asObject);
      case ObjectState.stable:
        throw new InvalidOperation('Cannot reject a stable object');
      default:
        throw new InconsistentState();
    }
  }

  protected stabilise(data: EventModel<T>) {
    return this.internalRepo.atomicUpdate(
      { _id: data.id, object_state: data.object_state },
      {
        $set: {
          object_state: ObjectState.stable,
          __owner: null,
          __patch: null
        }
      }
    );
  }

  protected inplaceUpdate(
    user: string,
    data: EventModel<T>,
    partial: Partial<T>
  ) {
    if (data.__owner !== user) {
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
    }

    return this.internalRepo.atomicUpdate(
      {
        object_state: data.object_state,
        _id: data._id
      },
      {
        $set:
          data.object_state === ObjectState.created
            ? partial
            : {
                __patch: mongoSet(data.__patch, partial)
              }
      }
    );
  }

  protected inplaceDelete(user: string, data: EventModel<T>) {
    if (data.__owner !== user) {
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
    }

    if (data.object_state === ObjectState.created) {
      return data.remove();
    }

    // unfreeze stable version
    return this.stabilise(data);
  }

  protected newUpdate(user: string, data: EventModel<T>, update: Partial<T>) {
    // mark object as frozen
    return this.internalRepo.atomicUpdate(
      {
        _id: data.id,
        object_state: ObjectState.stable
      },
      {
        $set: {
          object_state: ObjectState.updated,
          __owner: user,
          __patch: update
        }
      }
    );
  }

  protected newDelete(user: string, data: EventModel<T>) {
    // mark object as frozen
    return this.internalRepo.atomicUpdate(
      {
        _id: data.id,
        object_state: ObjectState.stable
      },
      {
        $set: {
          object_state: ObjectState.deleted,
          __owner: user
        }
      }
    );
  }

  protected markup(user: string, data: EventModel<T>) {
    if (data.object_state !== ObjectState.stable && data.__owner !== user) {
      data.object_state = ObjectState.frozen;
    }

    if (data.object_state === ObjectState.updated && data.__owner === user) {
      data = mongoSet(data, data.__patch);
    }

    return data.toObject();
  }

  protected allowNew(query: object, allowNew: boolean) {
    if (!allowNew) {
      return {
        ...query,
        object_state: { $ne: ObjectState.created }
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
