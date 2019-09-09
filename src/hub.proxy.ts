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

  async create(reference: string, state: ObjectState, args?: any) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'create',
      object_state: state,
      reference,
      ...args
    });
  }

  async patch(reference: string, payload: T) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'patch',
      reference,
      payload
    });
  }

  async close(reference: string) {
    await publisher.queue(this.queue, {
      object_type: this.name,
      event_type: 'patch',
      reference
    });
  }
}

export interface CreateObject {
  payload: any;
}

export interface UpdateObject {
  stale_payload: any;
  fresh_payload: any;
}

export interface DeleteObject {}
