import {
  BaseRepository,
  DuplicateModelError,
  MongooseNamespace,
  Query
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
  private hub: HubProxy<T>;
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
    this.hub = new HubProxy(name);
  }

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

  async get(user: string, reference: string): Promise<T> {
    const maybePending = await this.internalRepo.byID(reference);
    return this.markup(user, maybePending);
  }

  async byQuery(user: string, query: object): Promise<T> {
    const maybePending = await this.internalRepo.byQuery(query);
    return this.markup(user, maybePending);
  }

  async all(user: string, query: Query = {}, allowNew = true): Promise<T[]> {
    if (!allowNew) {
      query.conditions = {
        ...query.conditions,
        object_state: { $ne: ObjectState.created }
      };
    }
    const maybes = await this.internalRepo.all(query);
    return maybes.map(e => this.markup(user, e));
  }

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

  async merge(reference: string): Promise<T | void> {
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

  queryPathHelper(path: string, value: any) {
    return {
      $or: [{ [path]: value }, { [`__patch.${path}`]: value }]
    };
  }
}
