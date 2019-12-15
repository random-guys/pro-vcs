import { Model } from "@random-guys/bucket";

export enum ObjectState {
  Created = "created",
  Updated = "updated",
  Deleted = "deleted",
  Frozen = "frozen",
  Stable = "stable"
}

/**
 * `PayloadModel` is the raw version of an object, but that can still track
 * it's state.
 */
export interface PayloadModel {
  id: string;
  _id: string;
  created_at: Date;
  deleted_at: Date;
  updated_at: Date;
  object_state: ObjectState;
}

/**
 * `ObjectModel` is a wrapper around a payload to track the owner of an object
 * and it's patches
 */
export interface ObjectModel<T extends PayloadModel> extends Model {
  object_state: ObjectState;
  __owner: string;
  __patch?: Partial<T>;
}

/**
 * `asObject` extracts the raw payload from an `EventModel`
 * @param x the event model to convert
 */
export const asObject = <T extends PayloadModel>(x: ObjectModel<T>): T =>
  x.toObject();
