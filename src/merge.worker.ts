import {
  defaultMongoOpts,
  MongooseNamespace,
  secureMongoOpts
} from '@random-guys/bucket';
import { createRequestSerializer } from '@random-guys/express-bunyan';
import Logger, { createLogger } from 'bunyan';
import express from 'express';
import mongoose from 'mongoose';
import { PayloadModel } from './event.model';
import { ICanMerge, MergerConfig } from './merge.contract';
import { rootRoute, setupAppRoutes } from './merge.route';

/**
 * Run a handler in this process using the WorkerConfig passed. A context will
 * be created to give the handler access to resources(logging, redis).
 * @param merger implementation of merge actions
 * @param config worker configuration
 */
export async function createWorker<T extends PayloadModel>(
  merger: ICanMerge<T>,
  config: MergerConfig
) {
  let mongooseCon: MongooseNamespace;

  const logger = createLogger({
    name: rootRoute(config.name),
    serializers: {
      err: Logger.stdSerializers.err,
      res: Logger.stdSerializers.res,
      req: createRequestSerializer('password')
    }
  });

  const mergerApp = express();
  setupAppRoutes(config, logger, mergerApp, merger);

  const httpServer = mergerApp.listen(config.app_port);
  logger.info(`🌋 Merger running on port ${config.app_port}`);

  // connect to mongodb if need be
  mongooseCon = await mongoose.connect(
    config.mongodb_url,
    config.secure_db ? secureMongoOpts(config) : defaultMongoOpts
  );
  logger.info('📦  MongoDB Connected!');

  // call user's setup code
  if (config.onStart) {
    await config.onStart(logger);
  }

  // create stop function. This adds 20 lines but has to be here due
  // the dependencies
  const stop = async () => {
    try {
      logger.info(`Shutting down ${config.name} worker`);

      // shutdown mongoose and the server
      await mongooseCon.disconnect();
      httpServer.close();

      // custom shutdown
      if (config.onStop) {
        await config.onStop(logger);
      }
    } catch (err) {
      logger.error(
        err,
        `An error occured while stopping ${config.name} worker`
      );
      process.exit(1);
    }
  };

  process.once('SIGINT', async () => {
    await stop();
  });

  return stop;
}
