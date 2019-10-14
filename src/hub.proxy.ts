import { publisher } from '@random-guys/eventbus';
import kebabCase from 'lodash/kebabCase';
import { EventModel, ObjectState, PayloadModel } from './event.model';
import {
  DeleteObjectEvent,
  NewObjectEvent,
  UpdateObjectEvent,
  PatchEvent,
  CloseEvent
} from './hub.model';

export class HubProxy<T extends PayloadModel> {
  static queue = 'PROHUB_QUEUE';
  constructor(private name: string) {
    this.name = kebabCase(name);
  }

  async newObjectEvent(newObject: EventModel<T>) {
    const event: NewObjectEvent<T> = {
      event_scope: this.name,
      event_type: 'create.new',
      reference: newObject.id,
      owner: newObject.__owner,
      payload: newObject.toObject()
    };
    return await publisher.queue(HubProxy.queue, event);
  }

  async updateObjectEvent(freshObject: EventModel<T>, update: Partial<T>) {
    const event: UpdateObjectEvent<T> = {
      event_scope: this.name,
      event_type: 'create.update',
      reference: freshObject.id,
      owner: freshObject.__owner,
      payload: freshObject.toObject(),
      update
    };
    return await publisher.queue(HubProxy.queue, event);
  }

  async deleteObjectEvent(objectToDelete: EventModel<T>) {
    const event: DeleteObjectEvent<T> = {
      event_scope: this.name,
      event_type: 'create.delete',
      reference: objectToDelete.id,
      owner: objectToDelete.__owner,
      payload: objectToDelete.toObject()
    };
    return await publisher.queue(HubProxy.queue, event);
  }

  async patch(reference: string, payload: EventModel<T>) {
    const event: PatchEvent<T> = {
      event_scope: this.name,
      event_type: 'patch',
      reference: reference,
      payload: payload.toObject()
    };
    return await publisher.queue(HubProxy.queue, event);
  }

  async close(reference: string) {
    const event: CloseEvent = {
      event_scope: this.name,
      event_type: 'close',
      reference
    };
    return await publisher.queue(HubProxy.queue, event);
  }
}
