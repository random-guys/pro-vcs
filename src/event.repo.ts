import { BaseRepository, MongooseNamespace } from '@random-guys/bucket';
import { EventModel } from './event.model';
import { EventSchema } from './event.schema';

export class EventRepository<T> {
  protected readonly internalRepo: BaseRepository<EventModel<T>>;
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
      metadata: { owner, action: 'create' },
      payload: event
    });
  }

  get(user: string, reference: string) {
    return this.internalRepo.byQuery({
      'metadata.reference': reference
    });
  }
}
