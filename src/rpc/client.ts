import { Channel, Connection } from "amqplib";
import uuid from "uuid/v4";
import { snakeCaseUpper } from "../string";

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
  async sendRequest(namespace: string, method: string, args: any) {
    const queueObj = await this.channel.assertQueue("", { exclusive: true });
    const correlationId = uuid();

    return new Promise((resolve, reject) => {
      // setup handler first
      this.channel.consume(
        queueObj.queue,
        message => {
          // closing shop
          if (!message) return;

          if (message.properties.correlationId === correlationId) {
            const response = JSON.parse(message.content.toString());
            if (response.response_type === "error") {
              return reject(new ProxyError(response.body));
            }
            resolve(response.body);
          }
        },
        { noAck: true }
      );

      // finally send the request
      const request = Buffer.from(JSON.stringify(args));
      const methodQueue = snakeCaseUpper(`${namespace}_${method}`);
      this.channel.sendToQueue(methodQueue, request, {
        correlationId,
        replyTo: queueObj.queue
      });
    }).finally(() => {
      return this.channel.deleteQueue(queueObj.queue);
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
