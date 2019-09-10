import { publisher } from '@random-guys/eventbus';
import { ObjectState, PayloadModel } from './event.model';

export class HubProxy<T extends PayloadModel> {
  private queue = 'PROHUB_QUEUE';
  constructor(private name: string) {
    const conn = publisher.getConnection();
    if (!conn) {
      throw Error('RabbitMQ not online');
    }
  }

  async fireCreate(reference: string, state: ObjectState, args?: any) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'create',
      object_state: state,
      reference,
      ...args
    });
  }

  async firePatch(reference: string, payload: T) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'patch',
      reference,
      payload
    });
  }

  async fireClose(reference: string) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'close',
      reference
    });
  }
}
