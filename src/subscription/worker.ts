import { defaultMongoOpts, secureMongoOpts } from "@random-guys/bucket";
import { subscriber } from "@random-guys/eventbus";
import { ConsumeMessage } from "amqplib";
import Logger, { createLogger } from "bunyan";
import express, { Request, Response } from "express";
import mongoose, { Connection as MongooseConnection } from "mongoose";
import { Handler, SubscriptionConfig } from "./contract";

/**
 * Create start and stop functions for a worker, setting up the
 * DB and other related resources needed by subcribers or producers
 * in the worker.
 * @param config contains all configurations for resources and possible
 * resource setup and teardown operations
 * @param registrar sets up consumers/subscriptions after resouces have
 * been setup
 * @returns {[Function, Function]} async start and stop functions that
 * can be used to startup and shutdown the worker. Note that it also
 * shuts down the worker on `CTRL-C` signal
 */
export function withinWorker(config: SubscriptionConfig, registrar: (logger: Logger) => void): [Function, Function] {
  const logger = createLogger({
    name: config.worker_name,
    serializers: {
      err: Logger.stdSerializers.err
    }
  });

  let conn: MongooseConnection;
  let httpServer: any;

  const start = async () => {
    await subscriber.init(config.amqp_url);
    const subscriberCon = subscriber.getConnection();
    subscriberCon.on("error", (err: any) => {
      logger.error(err);
      process.exit(1);
    });

    // Start simple server for  health check
    const healthApp = express();
    healthApp.get("/", (_req: Request, res: Response) => {
      res.status(200).json({ status: "UP" });
    });

    httpServer = healthApp.listen(config.app_port);
    logger.info(`🌋 Health check running on port ${config.app_port}`);

    // connect to mongodb
    conn = await mongoose.createConnection(
      config.mongodb_url,
      config.secure_db ? secureMongoOpts(config) : defaultMongoOpts
    );
    logger.info("📦 MongoDB Connected!");

    // call user's setup code
    if (config.onStart) {
      await config.onStart(logger);
    }

    // now we can register handlers
    registrar(logger);
  };

  // create stop function. This adds 20 lines but has to be here due
  // the dependencies
  const stop = async () => {
    try {
      logger.info(`Shutting down ${config.worker_name} worker`);

      await subscriber.close();
      await conn.close();
      httpServer.close();

      // custom exit handler
      if (config.onStop) {
        await config.onStop(logger);
      }
    } catch (err) {
      logger.error(err, `An error occured while stopping ${config.worker_name} worker`);
      process.exit(1);
    }
  };

  process.once("SIGINT", async () => {
    await stop();
  });

  return [start, stop];
}

/**
 * Create a wrapper around the passed handler to handle parsing.
 * Note that it shutsdown it's host process once
 * the queue is closed
 * @param logger logger for when the queue is about to shutdown
 * @param handler handler to be wrapped.
 */
export function createHandler<T>(logger: Logger, handler: Handler<T>) {
  return async (message: ConsumeMessage) => {
    if (message === null) {
      logger.info("Consumer cancelled by server. Exiting process");
      process.exit(1);
    }

    subscriber.acknowledgeMessage(message);
    const data = JSON.parse(message.content.toString());
    await handler(data, logger);
  };
}
