import { IrisAPIError, IrisServerError } from "@random-guys/iris";
import { getHTTPErrorCode } from "@random-guys/siber";
import { Channel, Connection, ConsumeMessage } from "amqplib";
import Logger from "bunyan";
import { snakeCaseUpper } from "./string";
import uuid from "uuid/v4";

/**
 * RPCService is a class that encapsulates.
 */
export class RPCService {
  private channel: Channel;
  private namespace: string;

  /**
   * Create an RPC service with the methods namespaced by `namespace`, and
   * the connection for creating the service's channel
   * @param namespace prefix to method queue names
   * @param logger track what' going on from outside
   */
  constructor(namespace: string, private logger: Logger) {
    this.namespace = namespace;
  }

  async init(connection: Connection) {
    this.channel = await connection.createChannel();
    await this.channel.prefetch(1);
  }

  private sendReply<T>(
    msg: ConsumeMessage,
    responseType: "success" | "error",
    body: T
  ) {
    const response = JSON.stringify({ response_type: responseType, body });
    const { replyTo, correlationId } = msg.properties;
    this.channel.sendToQueue(replyTo, Buffer.from(response), {
      correlationId
    });
  }

  /**
   * Shutdown all resources this server is using. Note that it doesn't attempt
   * to wait for outgoing of incoming messages
   */
  async close() {
    if (this.channel) return this.channel.close();
  }

  /**
   * addMethod setups a new consumer for requests on `method`
   * @param method name of the method
   * @param handler What the method actually does.
   */
  async addMethod<T, U>(method: string, handler: (t: T) => Promise<U>) {
    const queueName = snakeCaseUpper(`${this.namespace}_${method}`);
    await this.channel.assertQueue(queueName, {
      durable: true
    });

    this.channel.consume(queueName, async msg => {
      try {
        const request = JSON.parse(msg.content.toString());
        this.logger.info({ req: request });

        const response = await handler(request.body);
        this.sendReply(msg, "success", response);

        this.logger.info({ res: response });
      } catch (err) {
        const errorDesc = processError(err);
        this.sendReply(msg, "error", errorDesc);

        this.logger.info({ err });
      } finally {
        this.channel.ack(msg);
      }
    });
  }
}

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
  async sendRequest(namespace: string, method: string, args: object) {
    const queueObj = await this.channel.assertQueue("", { exclusive: true });
    const correlationId = uuid();

    return new Promise((resolve, reject) => {
      // setup handler first
      this.channel.consume(
        queueObj.queue,
        message => {
          if (message.properties.correlationId === correlationId) {
            const response = JSON.parse(message.content.toString());
            if (response.response_type === "error") {
              reject(new ProxyError(response.body));
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

/**
 * processError tries to replicate siber's error hand.
 * @param err
 */
function processError(err: Error) {
  const code = getHTTPErrorCode(err);

  if (err instanceof IrisAPIError) {
    err["data"] = err.data.data;
    err["message"] = err.data.message;
  }

  if (err instanceof IrisServerError || code === 500) {
    err["original_message"] = err.message;
    err["message"] = "We are having internal issues. Please bear with us";
  }

  err["code"] = code;

  return err;
}
