import { IrisAPIError, IrisServerError } from "@random-guys/iris";
import { getHTTPErrorCode } from "@random-guys/siber";
import { Channel, Connection, ConsumeMessage } from "amqplib";
import Logger from "bunyan";
import { snakeCaseUpper } from "../string";
import { RPCRequest } from "./net";

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
  async addMethod<T, U>(
    method: string,
    handler: (t: RPCRequest<T>) => Promise<U>
  ) {
    const queueName = snakeCaseUpper(`${this.namespace}_${method}`);
    await this.channel.assertQueue(queueName, {
      durable: true
    });

    this.channel.consume(queueName, async msg => {
      try {
        const req = JSON.parse(msg.content.toString());
        this.logger.info({ req });

        const response = await handler(req);
        this.sendReply(msg, "success", response);

        this.logger.info({ req, res: response });
      } catch (err) {
        const errorDesc = processError(err);
        this.sendReply(msg, "error", errorDesc);

        this.logger.info({ err });
      } finally {
        this.channel.ack(msg);
      }
    });

    return queueName;
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
