import { Model } from '@random-guys/bucket';

export enum EventType {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
  approved = 'approved'
}

export enum Stage {
  stable = 'stable',
  frozen = 'frozen',
  staged = 'staged',
  removed = 'removed'
}

export type Payload<T extends PayloadModel> = T | Partial<T>;

export interface PayloadModel {
  id: string;
  created_at: Date;
  updated_at: Date;
  stage: Stage;
}

export interface EventModel<T extends PayloadModel> extends Model {
  frozen: boolean;
  metadata: Metadata;
  payload?: Payload<T>;
}

export interface Metadata {
  reference: string;
  owner?: string;
  frozen: boolean;
  stage: Stage;
  eventType: EventType;
}
