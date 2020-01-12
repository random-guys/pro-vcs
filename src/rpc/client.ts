import { Channel, Connection } from "amqplib";
import { snakeCaseUpper } from "../string";
import { createRequest, RPCResponse } from "./net";

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
   * sendRequest sends the arg to a Queue, for the method under the given
   * namespace.
   * @param namespace group for methods
   * @param method specific method to call
   * @param args arguments for the method.
   */
  async sendRequest<T>(
    namespace: string,
    method: string,
    args: any
  ): Promise<T> {
    const queueObj = await this.channel.assertQueue("", { exclusive: true });
    const req = createRequest(namespace, method, args);

    return new Promise<T>((resolve, reject) => {
      // setup handler first
      this.channel.consume(
        queueObj.queue,
        message => {
          // closing shop
          if (!message) return;

          if (message.properties.correlationId === req.id) {
            const res: RPCResponse<T> = JSON.parse(message.content.toString());
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
      const methodQueue = snakeCaseUpper(`${namespace}_${method}`);
      this.channel.sendToQueue(methodQueue, request, {
        correlationId: req.id,
        replyTo: queueObj.queue
      });
    }).finally(() => {
      this.channel.deleteQueue(queueObj.queue);
    });
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
