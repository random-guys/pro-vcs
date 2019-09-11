import { Model } from '@random-guys/bucket';

export enum ObjectState {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
  frozen = 'frozen',
  stable = 'stable'
}

export interface PayloadModel {
  id: string;
  created_at: Date;
  updated_at: Date;
  object_state: ObjectState;
}

export interface EventModel<T extends PayloadModel> extends Model {
  object_state: ObjectState;
  metadata: Metadata;
  payload: T;
}

export interface Metadata {
  reference: string;
  owner?: string;
  objectState: ObjectState;
}
