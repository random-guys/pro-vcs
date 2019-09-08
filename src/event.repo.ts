import {
  BaseRepository,
  ModelNotFoundError,
  MongooseNamespace,
  Query
} from '@random-guys/bucket';
import mapKeys from 'lodash/mapKeys';
import startCase from 'lodash/startCase';
import { EventModel, ObjectState, PayloadModel } from './event.model';
import { EventSchema } from './event.schema';
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
  constructor(
    mongoose: MongooseNamespace,
    name: string,
    exclude: string[] = []
  ) {
    this.internalRepo = new BaseRepository(
      mongoose,
      name,
      EventSchema(exclude)
    );
  }

  create(owner: string, event: Partial<T>) {
    return this.internalRepo.create({
      metadata: { owner, objectState: ObjectState.created },
      payload: event
    });
  }

  async get(user: string, reference: string) {
    const maybePending = await this.internalRepo.byQuery({
      'metadata.reference': reference,
      $nor: [
        { 'metadata.owner': user, 'metadata.objectState': ObjectState.frozen }
      ]
    });

    return this.onCreate(user, maybePending);
  }

  async byQuery(user: string, query: any) {
    const maybePending = await this.internalRepo.byQuery(
      this.getQuery(user, query)
    );

    return this.onCreate(user, maybePending);
  }

  async all(user: string, query: Query) {
    query.conditions = this.getQuery(user, query.conditions);
    const maybes = await this.internalRepo.all(query);
    return maybes.map(e => this.onCreate(user, e));
  }

  protected getRelatedEvents(reference: string) {
    return new Promise<EventModel<T>[]>((resolve, reject) => {
      this.internalRepo.model
        .find({ 'metadata.reference': reference })
        .sort('created_at')
        .exec((err, vals) => {
          if (err) return reject(err);
          if (!vals)
            return reject(
              new ModelNotFoundError(
                `There's no such ${startCase(this.inplaceUpdate.name)}`
              )
            );
          resolve(vals);
        });
    });
  }

  async update(user: string, reference: string, update: Partial<T>) {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.objectState) {
        case ObjectState.updated:
          return this.inplaceUpdate(user, pending, update);
        case ObjectState.deleted:
          throw new InvalidOperation(
            "Can't update an item up that's is to be deleted"
          );
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.objectState) {
      case ObjectState.created:
        return this.inplaceUpdate(user, stable, update);
      case ObjectState.stable:
        return this.newUpdate(user, stable, update);
      default:
        throw new InconsistentState();
    }
  }

  async delete(user: string, reference: string) {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.objectState) {
        case ObjectState.updated:
        case ObjectState.deleted:
          return await this.inplaceDelete(user, pending, stable._id);
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.objectState) {
      case ObjectState.created:
        return await this.inplaceDelete(user, stable);
      case ObjectState.stable:
        return await this.newDelete(user, stable, reference);
      default:
        throw new InconsistentState();
    }
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
          'metadata.objectState': ObjectState.stable,
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
        'metadata.objectState': ObjectState.frozen,
        'metadata.owner': user
      }
    });

    // create a new patch to be applied once approved
    return this.internalRepo.create({
      metadata: {
        owner: user,
        reference: stable.id,
        objectState: ObjectState.updated
      },
      payload: mongoSet(stable.payload, update)
    });
  }

  protected newDelete(user: string, stable: EventModel<T>, reference: string) {
    // mark object as frozen
    this.internalRepo.atomicUpdate(stable._id, {
      $set: {
        'metadata.objectState': ObjectState.frozen,
        'metadata.owner': user
      }
    });

    // create a new event to signify delete
    return this.internalRepo.create({
      metadata: {
        owner: user,
        objectState: ObjectState.deleted,
        reference
      },
      payload: stable.payload
    });
  }

  protected onCreate(user: string, maybePending: EventModel<T>) {
    if (
      maybePending.metadata.objectState === ObjectState.created &&
      maybePending.metadata.owner !== user
    ) {
      maybePending.metadata.objectState = ObjectState.frozen;
    }
    return maybePending;
  }

  protected getQuery(user: string, query: any) {
    return {
      ...this.payload(query),
      $nor: [
        {
          'metadata.owner': user,
          'metadata.objectState': ObjectState.frozen
        }
      ]
    };
  }

  protected payload(data: object) {
    return mapKeys(data, (_v, k) => {
      return `payload.${k}`;
    });
  }
}
