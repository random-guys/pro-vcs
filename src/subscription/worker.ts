import {
  defaultMongoOpts,
  MongooseNamespace,
  secureMongoOpts
} from "@random-guys/bucket";
import { subscriber } from "@random-guys/eventbus";
import { ConsumeMessage } from "amqplib";
import Logger, { createLogger } from "bunyan";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { Handler, SubscriptionConfig } from "./contract";

/**
 * Create and run an eventbus subsciptions in a worker, setting on
 * the DB and other related resources needed by such subscriptions.
 * @param config contains all configurations for resources and possible
 * resource setup and teardown operations
 * @param registrar sets up consumers/subscriptions after resouces have
 * been setup
 * @returns async stop function that can be used to shutdown the worker. Note
 * that it also shutsdown the worker on `CTRL-C` signal
 */
export async function withinWorker(
  config: SubscriptionConfig,
  registrar: (logger: Logger) => void
) {
  let mongooseCon: MongooseNamespace;

  const logger = createLogger({
    name: config.worker_name,
    serializers: {
      err: Logger.stdSerializers.err
    }
  });

  await subscriber.init(config.amqp_url);
  const subscriberConnection = subscriber.getConnection();
  subscriberConnection.on("error", (err: any) => {
    logger.error(err);
    process.exit(1);
  });

  // Start simple server for  health check
  const healthApp = express();
  healthApp.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "UP" });
  });

  const httpServer = healthApp.listen(config.app_port);
  logger.info(`🌋 Health check running on port ${config.app_port}`);

  // connect to mongodb
  mongooseCon = await mongoose.connect(
    config.mongodb_url,
    config.secure_db ? secureMongoOpts(config) : defaultMongoOpts
  );
  logger.info("📦  MongoDB Connected!");

  // call user's setup code
  if (config.onStart) {
    await config.onStart(logger);
  }

  // now we can register handlers
  registrar(logger);

  // create stop function. This adds 20 lines but has to be here due
  // the dependencies
  const stop = async () => {
    try {
      logger.info(`Shutting down ${config.worker_name} worker`);

      await subscriber.close();

      await mongooseCon.disconnect();

      httpServer.close();

      // custom exit handler
      if (config.onStop) {
        await config.onStop(logger);
      }
    } catch (err) {
      logger.error(
        err,
        `An error occured while stopping ${config.worker_name} worker`
      );
      process.exit(1);
    }
  };

  process.once("SIGINT", async () => {
    await stop();
  });

  return stop;
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
