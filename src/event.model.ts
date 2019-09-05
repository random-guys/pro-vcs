import { Model } from '@random-guys/bucket';

export enum EventType {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
  approved = 'approved'
}

export type Payload<T> = T | Partial<T>;

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
