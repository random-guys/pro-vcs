import {
  BaseRepository,
  ModelNotFoundError,
  MongooseNamespace,
  Query,
  DuplicateModelError
} from '@random-guys/bucket';
import mapKeys from 'lodash/mapKeys';
import startCase from 'lodash/startCase';
import { EventModel, ObjectState, PayloadModel } from './event.model';
import { EventSchema } from './event.schema';
import { mongoSet } from './object.util';
import { HubProxy } from './hub.proxy';
import { SchemaDefinition } from 'mongoose';

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

  async create(owner: string, event: Partial<T>): Promise<T> {
    const newObject = await this.internalRepo.create({
      metadata: { owner, object_state: ObjectState.created },
      payload: event
    });
    this.hub.fireCreate(newObject.id, newObject.object_state, {
      payload: newObject.payload
    });
    return newObject.toObject();
  }

  async assertExists(query: object): Promise<void> {
    const element = await this.internalRepo.byQuery(
      this.payload(query),
      null,
      false
    );
    if (element) {
      throw new DuplicateModelError(
        `The ${startCase(this.internalRepo.name)} already exists`
      );
    }
  }

  async get(user: string, reference: string): Promise<T> {
    const maybePending = await this.internalRepo.byQuery({
      'metadata.reference': reference,
      $nor: [
        { 'metadata.owner': user, 'metadata.object_state': ObjectState.frozen }
      ]
    });

    return this.onCreate(user, maybePending).toObject();
  }

  async byQuery(user: string, query: any): Promise<T> {
    const maybePending = await this.internalRepo.byQuery(
      this.getQuery(user, query)
    );

    return this.onCreate(user, maybePending).toObject();
  }

  async all(user: string, query: Query = {}, allowNew = true): Promise<T[]> {
    query.conditions = this.getQuery(user, query.conditions, allowNew);
    const maybes = await this.internalRepo.all(query);
    return maybes.map(e => this.onCreate(user, e).toObject());
  }

  protected getRelatedEvents(reference: string) {
    return new Promise<EventModel<T>[]>((resolve, reject) => {
      this.internalRepo.model
        .find({ 'metadata.reference': reference })
        .sort('created_at')
        .exec((err, vals) => {
          // proxy error
          if (err) return reject(err);

          // make sure model exists
          if (!vals || vals.length === 0) {
            return reject(
              new ModelNotFoundError(
                `There's no such ${startCase(this.internalRepo.name)}`
              )
            );
          }

          // watchout for more than 2 objects
          if (vals.length > 2) {
            return reject(new InconsistentState());
          }
          resolve(vals);
        });
    });
  }

  async update(
    user: string,
    reference: string,
    update: Partial<T>
  ): Promise<T> {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.object_state) {
        case ObjectState.updated:
          const patch = await this.inplaceUpdate(user, pending, update);
          await this.hub.firePatch(reference, patch.payload);
          return patch.toObject();
        case ObjectState.deleted:
          throw new InvalidOperation(
            "Can't update an item up that is to be deleted"
          );
        default:
          throw new InconsistentState();
      }
    }

    let patch: EventModel<T>;
    switch (stable.metadata.object_state) {
      case ObjectState.created:
        patch = await this.inplaceUpdate(user, stable, update);
        await this.hub.firePatch(reference, patch.payload);
        return patch.toObject();
      case ObjectState.stable:
        patch = await this.newUpdate(user, stable, update);
        await this.hub.fireCreate(reference, patch.object_state, {
          stale_payload: stable.payload,
          fresh_payload: patch.payload
        });
        return patch.toObject();
      default:
        throw new InconsistentState();
    }
  }

  async delete(user: string, reference: string): Promise<T> {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.object_state) {
        case ObjectState.updated:
        case ObjectState.deleted:
          const cleaned = await this.inplaceDelete(user, pending, stable._id);
          await this.hub.fireClose(cleaned.id);
          return cleaned.toObject();
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.object_state) {
      case ObjectState.created:
        const cleaned = await this.inplaceDelete(user, stable);
        await this.hub.fireClose(cleaned.id);
        return cleaned.toObject();
      case ObjectState.stable:
        const pendingDelete = await this.newDelete(user, stable, reference);
        await this.hub.fireCreate(pendingDelete.id, pendingDelete.object_state);
        return pendingDelete.toObject();
      default:
        throw new InconsistentState();
    }
  }

  async merge(reference: string): Promise<T | void> {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.object_state) {
        case ObjectState.updated:
          await stable.remove();
          return (await this.stabilise(pending._id)).toObject();
        case ObjectState.deleted:
          return this.clean(reference);
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.object_state) {
      case ObjectState.created:
        return (await this.stabilise(stable._id)).toObject();
      case ObjectState.stable:
        return stable.toObject();
      default:
        throw new InconsistentState();
    }
  }

  async reject(reference: string): Promise<T> {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.object_state) {
        case ObjectState.updated:
        case ObjectState.deleted:
          await pending.remove();
          return (await this.stabilise(stable._id)).toObject();
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.object_state) {
      case ObjectState.created:
        return (await stable.remove()).toObject();
      case ObjectState.stable:
        return stable.toObject();
      default:
        throw new InconsistentState();
    }
  }

  protected stabilise(id: string) {
    return this.internalRepo.atomicUpdate(id, {
      $set: {
        'metadata.object_state': ObjectState.stable,
        'metadata.owner': null
      }
    });
  }

  protected async clean(reference: string) {
    await this.internalRepo.model
      .deleteMany({ 'metadata.reference': reference })
      .exec();
  }

  protected inplaceUpdate(
    user: string,
    oldUpdate: EventModel<T>,
    newUpdate: Partial<T>
  ) {
    if (oldUpdate.metadata.owner !== user) {
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
    }
    return this.internalRepo.atomicUpdate(
      oldUpdate._id,
      this.payload(newUpdate)
    );
  }

  protected inplaceDelete(
    user: string,
    pending: EventModel<T>,
    stableId?: string
  ) {
    if (pending.metadata.owner !== user) {
      throw new InvalidOperation(
        `Can't update an unapproved ${startCase(this.internalRepo.name)}`
      );
    }

    if (stableId) {
      // unfreeze stable version
      this.internalRepo.atomicUpdate(stableId, {
        $set: {
          'metadata.object_state': ObjectState.stable,
          'metadata.owner': null
        }
      });
    }

    // cleanup pending version
    return pending.remove();
  }

  protected newUpdate(user: string, stable: EventModel<T>, update: Partial<T>) {
    // mark object as frozen
    this.internalRepo.atomicUpdate(stable._id, {
      $set: {
        'metadata.object_state': ObjectState.frozen,
        'metadata.owner': user
      }
    });

    // create a new patch to be applied once approved
    return this.internalRepo.create({
      metadata: {
        owner: user,
        reference: stable.id,
        object_state: ObjectState.updated
      },
      payload: mongoSet(stable.payload, update)
    });
  }

  protected newDelete(user: string, stable: EventModel<T>, reference: string) {
    // mark object as frozen
    this.internalRepo.atomicUpdate(stable._id, {
      $set: {
        'metadata.object_state': ObjectState.frozen,
        'metadata.owner': user
      }
    });

    // create a new event to signify delete
    return this.internalRepo.create({
      metadata: {
        owner: user,
        object_state: ObjectState.deleted,
        reference
      },
      payload: stable.payload
    });
  }

  protected onCreate(user: string, maybePending: EventModel<T>) {
    if (
      maybePending.metadata.object_state === ObjectState.created &&
      maybePending.metadata.owner !== user
    ) {
      maybePending.metadata.object_state = ObjectState.frozen;
    }
    return maybePending;
  }

  protected getQuery(user: string, query: any, allowNew = true) {
    const orQuery = [
      {
        'metadata.owner': user,
        'metadata.object_state': { $ne: ObjectState.frozen }
      },
      {
        'metadata.owner': { $ne: user },
        'metadata.object_state': ObjectState.frozen
      },
      {
        'metadata.object_state': ObjectState.stable
      }
    ];
    if (allowNew) {
      orQuery.push({ 'metadata.object_state': ObjectState.created });
    }
    return {
      ...this.payload(query),
      $or: orQuery
    };
  }

  protected payload(data: object) {
    return mapKeys(data, (_v, k) => {
      return `payload.${k}`;
    });
  }
}
