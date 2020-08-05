import { RequestContract } from "@random-guys/iris";
import { Channel, Connection } from "amqplib";
import { snakeCaseUpper } from "../string";
import { createRequest, fromRequest, RPCRequest, RPCResponse } from "./net";

export class RPCClient {
  private channel: Channel;

  async init(connection: Connection) {
    this.channel = await connection.createChannel();
  }

  /**
   * Shutdown all resources this client is using. Note that it doesn't attempt
   * to wait for outgoing of incoming messages
   */
  async close() {
    if (this.channel) return this.channel.close();
  }

  /**
   * sendRequest sends an RPC request based on how it's defined
   * @param req generated `RPCRequest`
   */
  async sendRequest<T, U>(req: RPCRequest<T>): Promise<U> {
    const queueObj = await this.channel.assertQueue("", { exclusive: true });

    return new Promise<U>((resolve, reject) => {
      // setup handler first
      this.channel.consume(
        queueObj.queue,
        message => {
          // closing shop
          if (!message) return;

          if (message.properties.correlationId === req.id) {
            const res: RPCResponse<U> = JSON.parse(message.content.toString());
            if (res.status === "error") {
              return reject(new Error(res.message));
            }
            resolve(res.body);
          }
        },
        { noAck: true }
      );

      // finally send the request
      const request = Buffer.from(JSON.stringify(req));
      const methodQueue = snakeCaseUpper(`${req.namespace}_${req.method}`);
      this.channel.sendToQueue(methodQueue, request, {
        correlationId: req.id,
        replyTo: queueObj.queue
      });
    }).finally(() => {
      this.channel.deleteQueue(queueObj.queue);
    });
  }

  /**
   * call sends the arg to a Queue, for the method under the given
   * namespace.
   * @param namespace group for methods
   * @param method specific method to call
   * @param args arguments for the method.
   */
  async call<T, U>(namespace: string, method: string, args: T) {
    return this.sendRequest<T, U>(createRequest(namespace, method, args));
  }

  /**
   * callWith sends the arg to a Queue, for the method under the given
   * namespace, using the passed request to help track it.
   * @param req request to use to for distributed tracing
   * @param namespace group for methods
   * @param method specific method to call
   * @param args arguments for the method.
   */
  async callWith<T, U>(req: RequestContract, namespace: string, method: string, args: T): Promise<U> {
    return this.sendRequest(fromRequest(req, namespace, method, args));
  }
}

/**
 * ProxyError's primary job is to convert an error object to an
 * exception
 */
export class ProxyError extends Error {
  constructor(error: any) {
    super("");
    Object.assign(this, error);
  }
}
