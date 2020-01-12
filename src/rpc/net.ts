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
