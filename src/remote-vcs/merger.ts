import { PayloadModel } from "../objects";
import { RPCRequest } from "../rpc/net";
import { CreateEvent } from "./event-types";

/**
 * RemoteObject is an object that can be merged or rejected.
 */
export interface RemoteObject<T extends PayloadModel> {
  /**
   * onApprove does post-processing after object approval. Like `onReject`,
   * it must call the Repo's `merge` method.
   * @param event the source event
   * @param req RPC request that you can use for interservice requests
   */
  onApprove(
    event: CreateEvent<T>,
    req?: RPCRequest<CreateEvent<T>>
  ): Promise<T>;

  /**
   * onReject cleans up an object when rejected by the remote. Note that
   * implementations must call the Repo's reject method so the object can
   * be transitioned to `stable` state.
   * @param event the source event
   * @param req RPC request that you can use for interservice requests
   */
  onReject(event: CreateEvent<T>, req?: RPCRequest<CreateEvent<T>>): Promise<T>;

  /**
   * onCheck confirms that the object can be approved by confirming business
   * constraints are not being invalidated
   * @param reference reference for this event
   * @param req RPC request that you can use for interservice requests
   */
  onCheck(reference: string, req?: RPCRequest<string>): Promise<CheckResult[]>;
}

/**
 * CheckResult is the result of some constraint validation on an object
 */
export interface CheckResult {
  /**
   * Status of the check
   */
  status: "success" | "error";
  /**
   * Description of check if any
   */
  message?: string;
}
