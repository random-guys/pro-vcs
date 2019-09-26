import { ObjectState, PayloadModel } from './event.model';

export interface CreateEvent {
  object_type: string;
  event_type: 'create';
  object_state: ObjectState;
}

export interface PatchEvent {
  object_type: string;
  event_type: 'patch';
  reference: string;
  payload: PayloadModel;
}

export interface CloseEvent {
  object_type: string;
  event_type: 'close';
  reference: string;
}

export interface NewObjectEvent extends CreateEvent {
  object_state: ObjectState.created;
  payload: PayloadModel;
}

export interface UpdateObjectEvent<T extends PayloadModel> extends CreateEvent {
  object_state: ObjectState.updated;
  payload: PayloadModel;
  update: Partial<T>;
}

export interface DeleteObjectEvent extends CreateEvent {
  object_state: ObjectState.deleted;
}
