import uuid from "uuid/v4";
import { RequestContract } from "@random-guys/iris";

/**
 * Data that adds metadata to a normal RPC request for better
 * tracking
 */
export interface RPCRequest<T> extends RequestContract {
  /**
   * namespace of the method being called
   */
  namespace: string;
  /**
   * the method being called
   */
  method: string;
  /**
   * date the request is being made
   */
  date: Date;
  /**
   * method argument being sent over the wire
   */
  body: T;
}

/**
 * RPCResponse helps link a request to it's response. It also provides
 * the format for sending errors over the wire. Notice the lack of error
 * types? All errors are seen as semantic errors.
 */
export interface RPCResponse<T> {
  /**
   * indicates whether the method call failed or succeeded
   */
  status: "ok" | "error";
  /**
   * ID of the RPC request that lead to this response
   */
  request_id: string;
  /**
   * date the response is being returned...more like time :)
   */
  date: Date;
  /**
   * data being returned to the caller
   */
  body?: T;
  /**
   * message in case the status of the request is `error`
   */
  message?: string;
}

/**
 * Create an RPC request from scratch
 * @param namespace namespace of the method being called
 * @param method the method being called
 * @param args method argument to be sent over the wire
 */
export function createRequest<T>(
  namespace: string,
  method: string,
  args: T
): RPCRequest<T> {
  return {
    namespace,
    method,
    date: new Date(),
    id: uuid(),
    body: args
  };
}

/**
 * Create an RPC request from an existing express request.
 * @param req request to use as base for the RPC request
 * @param namespace namespace of the method being called
 * @param method the method being called
 * @param args method argument to be sent over the wire
 */
export function fromRequest<T>(
  req: RequestContract,
  namespace: string,
  method: string,
  args: T
): RPCRequest<T> {
  return {
    namespace,
    method,
    date: new Date(),
    id: req.id,
    headers: {
      authorization: req?.headers?.authorization
    },
    body: args
  };
}

/**
 * Create a response object from it's source request.
 * @param req request that lead to such response
 * @param body data to be returned to caller if any
 */
export function createResponse<T, U>(
  req: RPCRequest<T>,
  body?: U
): RPCResponse<U> {
  return {
    body,
    status: "ok",
    request_id: req.id,
    date: new Date()
  };
}

/**
 * Create a response object from a failed request.
 * @param req request that lead to such response
 * @param body data to be returned to caller if any
 */
export function createErrorResponse<T, U>(
  req: RPCRequest<T>,
  message: string
): RPCResponse<U> {
  return {
    message,
    status: "error",
    request_id: req.id,
    date: new Date()
  };
}
