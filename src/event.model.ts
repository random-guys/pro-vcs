import { Model } from "@random-guys/bucket";

export enum ObjectState {
  created = "created",
  updated = "updated",
  deleted = "deleted",
  frozen = "frozen",
  stable = "stable"
}

export interface PayloadModel extends Model {
  object_state: ObjectState;
}

export interface EventModel<T extends PayloadModel> extends Model {
  object_state: ObjectState;
  __owner: string;
  __patch?: Partial<T>;
}

export const asObject = <T extends PayloadModel>(x: EventModel<T>): T =>
  x.toObject();
