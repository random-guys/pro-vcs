import { PayloadModel } from "../objects";

/**
 * An event that signifies that the object was just updated
 * in an unstable state
 */
export interface PatchEvent<T extends PayloadModel> {
  /**
   * Event name
   */
  event_type: "patch";
  /**
   * Object reference
   */
  reference: string;
  /**
   * Latest version of the object
   */
  payload: T;
}

/**
 * An event to signify that the object's change or introduction
 * has been cancelled
 */
export interface CloseEvent {
  /**
   * Event name
   */
  event_type: "close";
  /**
   * Object reference
   */
  reference: string;
}

/**
 * Signifies that a new object was just added to the repo.
 */
export interface NewObjectEvent<T extends PayloadModel> {
  /**
   * Event name
   */
  event_type: "create.new";
  /**
   * The namespace of the repo
   */
  namespace: string;
  /**
   * Object reference
   */
  reference: string;
  /**
   * Initiator of the process
   */
  owner: string;
  /**
   * The new object
   */
  payload: T;
}

export interface NewBatchObjectEvent<T extends PayloadModel> {
  /**
   * event name
   */
  event_type: "create.new.batch";
  /**
   * the namespace of the repo
   */
  namespace: string;
  /**
   * object reference
   */
  reference: string;
  /**
   * initiator of the process
   */
  owner: string;
  /**
   * the new objects
   */
  payload: T[];
}

/**
 * Signifies that an update has happened on a pre-exisiting
 * stable object.
 */
export interface UpdateObjectEvent<T extends PayloadModel> {
  /**
   * Event name
   */
  event_type: "create.update";
  /**
   * The namespace of the repo
   */
  namespace: string;
  /**
   * Object reference
   */
  reference: string;
  /**
   * Initiator of the process
   */
  owner: string;
  /**
   * The latest version of the object
   */
  payload: T;
  /**
   * The older version of the object
   */
  previous_version: T;
}

/**
 * Signifies that a user wants to delete a stable object
 */
export interface DeleteObjectEvent<T extends PayloadModel> {
  /**
   * Event name
   */
  event_type: "create.delete";
  /**
   * The namespace of the repo
   */
  namespace: string;
  /**
   * Object reference
   */
  reference: string;
  /**
   * Initiator of the process
   */
  owner: string;
  /**
   * I honestly don't know why I added this.
   */
  payload: T;
}

/**
 * This is any event that leads to the creation of a
 * review request.
 */
export type CreateEvent<T extends PayloadModel> =
  | NewObjectEvent<T>
  | UpdateObjectEvent<T>
  | DeleteObjectEvent<T>;
