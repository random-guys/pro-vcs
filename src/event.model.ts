import { Model } from '@random-guys/bucket';
import { Diff } from 'deep-diff';

export enum EventType {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
  approved = 'approved'
}

export type Payload<T> = T | Diff<any>[];

export interface EventModel<T> extends Model {
  frozen: boolean;
  metadata: Metadata;
  payload?: Payload<T>;
}

export interface Metadata {
  reference: string;
  owner: string;
  frozen: boolean;
  eventType: EventType;
}
