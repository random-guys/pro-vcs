import { publisher } from '@random-guys/eventbus';
import { ObjectState, EventModel, PayloadModel } from './event.model';
import kebabCase from 'lodash/kebabCase';

export class HubProxy<T extends PayloadModel> {
  static queue = 'PROHUB_QUEUE';
  constructor(private name: string) {
    this.name = kebabCase(name);
  }

  async fireCreate(reference: string, state: ObjectState, args?: any) {
    await publisher.queue(HubProxy.queue, {
      object_type: this.name,
      event_type: 'create',
      object_state: state,
      reference,
      ...args
    });
  }

  async firePatch(reference: string, payload: EventModel<T>) {
    await publisher.queue(HubProxy.queue, {
      object_type: this.name,
      event_type: 'patch',
      reference,
      payload
    });
  }

  async fireClose(reference: string) {
    await publisher.queue(HubProxy.queue, {
      object_type: this.name,
      event_type: 'close',
      reference
    });
  }
}
