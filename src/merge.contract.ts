import { Request } from "express";
import { PayloadModel } from "./objects";
import { CreateEvent } from "./remote-vcs";

export interface ICanMerge<T extends PayloadModel> {
  /**
   * This is called when all required approvals for an object have
   * been collected.
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onApprove(req: Request, reference: string, event: CreateEvent<T>): Promise<T>;

  /**
   * This is called when a single reject is sent, as long as `onApprove`
   * has not been called
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onReject(req: Request, reference: string, event: CreateEvent<T>): Promise<T>;

  /**
   * This is called to ensure the viability of approval i.e. if the
   * returned list contains any `status === 'error'`, the object
   * can't be approved
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onCheck(req: Request, reference: string): Promise<Check[]>;
}

/**
 * Describes a validation that has been done on an object
 */
export interface Check {
  /**
   * Status of the check
   */
  status: "success" | "error";
  /**
   * Save this check for later
   */
  cache: boolean;
  /**
   * Description of check if any
   */
  message?: string;
}
