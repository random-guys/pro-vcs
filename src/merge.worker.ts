import {
  defaultMongoOpts,
  MongooseNamespace,
  secureMongoOpts
} from '@random-guys/bucket';
import { createRequestSerializer } from '@random-guys/express-bunyan';
import Logger, { createLogger } from 'bunyan';
import express from 'express';
import Redis, { Redis as RedisType } from 'ioredis';
import mongoose from 'mongoose';
import { ICanMerge, MergerConfig } from './merge.contract';
import { rootRoute, setupAppRoutes } from './merge.route';

/**
 * Run a handler in this process using the WorkerConfig passed. A context will
 * be created to give the handler access to resources(logging, redis).
 * @param config worker configuration
 */
export async function createWorker(merger: ICanMerge, config: MergerConfig) {
  let redis: RedisType;
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

  // connect to redis if need be
  if (config.redis_url) {
    redis = new Redis(config.redis_url);
    logger.info('🐳  Redis Connected!');
  }

  // call user's setup code
  if (config.postSetup) {
    await config.postSetup({
      logger,
      redis
    });
  }

  // create stop function. This adds 20 lines but has to be here due
  // the dependencies
  const stop = async () => {
    try {
      logger.info(`Shutting down ${config.name} worker`);

      await mongooseCon.disconnect();
      httpServer.close();

      if (redis) await redis.quit();
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
