import { ObjectState, PayloadModel } from './event.model';

export interface CreateEvent {
  object_type: string;
  event_type: 'create';
  object_state: ObjectState;
}

export interface PatchEvent<T extends PayloadModel = any> {
  object_type: string;
  event_type: 'patch';
  reference: string;
  payload: T;
}

export interface CloseEvent {
  object_type: string;
  event_type: 'close';
  reference: string;
}

export interface NewObjectEvent<T extends PayloadModel = any>
  extends CreateEvent {
  object_state: ObjectState.created;
  payload: T;
}

export interface UpdateObjectEvent<T extends PayloadModel = any>
  extends CreateEvent {
  object_state: ObjectState.updated;
  stale_model: T;
  fresh_model: T;
}

export interface DeleteObjectEvent extends CreateEvent {
  object_state: ObjectState.deleted;
}
