import { ObjectState, PayloadModel } from './event.model';

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

export interface NewObjectEvent {
  object_type: string;
  event_type: 'create';
  object_state: ObjectState.created;
  payload: PayloadModel;
}

export interface UpdateObjectEvent<T extends PayloadModel> {
  object_type: string;
  event_type: 'create';
  object_state: ObjectState.updated;
  payload: PayloadModel;
  update: Partial<T>;
}

export interface DeleteObjectEvent {
  object_type: string;
  event_type: 'create';
  object_state: ObjectState.deleted;
}

export type CreateEvent<T extends PayloadModel> =
  | NewObjectEvent
  | UpdateObjectEvent<T>
  | DeleteObjectEvent;
