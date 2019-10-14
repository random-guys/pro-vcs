import { ObjectState, PayloadModel } from './event.model';

export interface PatchEvent<T extends PayloadModel> {
  event_scope: string;
  event_type: 'patch';
  reference: string;
  payload: T;
}

export interface CloseEvent {
  event_scope: string;
  event_type: 'close';
  reference: string;
}

export interface NewObjectEvent<T extends PayloadModel> {
  event_scope: string;
  event_type: 'create';
  object_state: ObjectState.created;
  owner: string;
  payload: T;
}

export interface UpdateObjectEvent<T extends PayloadModel> {
  event_scope: string;
  event_type: 'create';
  object_state: ObjectState.updated;
  owner: string;
  payload: T;
  update: Partial<T>;
}

export interface DeleteObjectEvent {
  event_scope: string;
  event_type: 'create';
  object_state: ObjectState.deleted;
  owner: string;
}

export type CreateEvent<T extends PayloadModel> =
  | NewObjectEvent<T>
  | UpdateObjectEvent<T>
  | DeleteObjectEvent;
