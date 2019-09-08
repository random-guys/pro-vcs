import {
  BaseRepository,
  ModelNotFoundError,
  MongooseNamespace
} from '@random-guys/bucket';
import mapKeys from 'lodash/mapKeys';
import startCase from 'lodash/startCase';
import { EventModel, EventType, PayloadModel } from './event.model';
import { EventSchema } from './event.schema';

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
      metadata: { owner, eventType: EventType.created },
      payload: event
    });
  }

  get(user: string, reference: string) {
    return this.internalRepo.byQuery({
      'metadata.reference': reference
    });
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
      switch (pending.metadata.eventType) {
        case EventType.updated:
          return this.inplaceUpdate(user, pending, update);
        case EventType.deleted:
          throw new InvalidOperation(
            "Can't update an item up that's is to be deleted"
          );
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.eventType) {
      case EventType.created:
        return this.inplaceUpdate(user, stable, update);
      case EventType.approved:
        return this.newUpdate(user, stable, update);
      default:
        throw new InconsistentState();
    }
  }

  async delete(user: string, reference: string) {
    const [stable, pending] = await this.getRelatedEvents(reference);
    if (pending) {
      switch (pending.metadata.eventType) {
        case EventType.updated:
        case EventType.deleted:
          return await pending.remove();
        default:
          throw new InconsistentState();
      }
    }

    switch (stable.metadata.eventType) {
      case EventType.created:
        return await stable.remove();
      case EventType.approved:
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

  protected newUpdate(user: string, stable: EventModel<T>, update: Partial<T>) {
    // mark object as frozen
    this.internalRepo.atomicUpdate(stable._id, {
      $set: { 'metadata.frozen': true }
    });

    // create a new patch to be applied once approved
    return this.internalRepo.create({
      metadata: {
        owner: user,
        reference: stable.id,
        eventType: EventType.updated
      },
      payload: update
    });
  }

  protected newDelete(user: string, stable: EventModel<T>, reference: string) {
    // mark object as frozen
    this.internalRepo.atomicUpdate(stable._id, {
      $set: { 'metadata.frozen': true }
    });

    // create a new event to signify delete
    return this.internalRepo.create({
      metadata: {
        owner: user,
        eventType: EventType.deleted,
        reference
      }
    });
  }

  private payload(data: object) {
    return mapKeys(data, (_v, k) => {
      return `payload.${k}`;
    });
  }
}
