import { Channel, Connection } from "amqplib";
import Logger from "bunyan";
import { snakeCaseUpper } from "../string";
import { createErrorResponse, createResponse, RPCRequest } from "./net";

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
      const req: RPCRequest<T> = JSON.parse(msg.content.toString());
      this.logger.info({ req });

      try {
        const body = await handler(req);
        const res = createResponse(req, body);
        const response = Buffer.from(JSON.stringify(res));
        this.channel.sendToQueue(msg.properties.replyTo, response, {
          correlationId: req.id
        });

        this.logger.info({ req, res: body });
      } catch (err) {
        const res = createErrorResponse(req, err.message);
        const response = Buffer.from(JSON.stringify(res));
        this.channel.sendToQueue(msg.properties.replyTo, response, {
          correlationId: req.id
        });

        this.logger.info({ err, req, res });
      } finally {
        this.channel.ack(msg);
      }
    });

    return queueName;
  }
}
