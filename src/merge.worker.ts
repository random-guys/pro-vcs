import { MongooseNamespace } from '@random-guys/bucket';
import Logger, { createLogger } from 'bunyan';
import express, { Express, Request, Response } from 'express';
import Redis, { Redis as RedisType } from 'ioredis';
import snakeCase from 'lodash/snakeCase';
import mongoose from 'mongoose';
import { token } from '@random-guys/sp-auth';

export interface ICanMerge {
  onApprove(req: Request, reference: string): Promise<void>;
  onReject(req: Request, reference: string): Promise<void>;
  onCheck(req: Request, reference: string): Promise<Check[]>;
}

export interface Check {
  status: 'success' | 'error';
  cache: boolean;
  message?: string;
}

export interface MergerConfig {
  name: string;
  security_secret: string;
  app_port: number;
  mongodb_url?: string;
  redis_url?: string;
  postSetup?: (context: Context) => Promise<void>;
}

export interface Context {
  logger: Logger;
  redis?: RedisType;
}

export interface Handler<T> {
  (data: T, context: Context): Promise<void>;
}

/**
 * Run a handler in this process using the WorkerConfig passed. A context will
 * be created to give the handler access to resources(logging, redis).
 * @param config worker configuration
 */
export async function createWorker(merger: ICanMerge, config: MergerConfig) {
  let redis: RedisType;
  let mongooseCon: MongooseNamespace;

  const logger = createLogger({
    name: config.name,
    serializers: {
      err: Logger.stdSerializers.err
    }
  });

  const mergerApp = express();
  mergerApp.use(token(config.security_secret, 'SterlingPro'));
  setupAppRoutes(config.name, mergerApp, merger);

  const httpServer = mergerApp.listen(config.app_port);
  logger.info(`🌋 Merger running on port ${config.app_port}`);

  // connect to mongodb if need be
  if (config.mongodb_url) {
    mongooseCon = await mongoose.connect(config.mongodb_url, {
      useNewUrlParser: true,
      useCreateIndex: true
    });
    logger.info('📦  MongoDB Connected!');
  }

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

      if (mongooseCon) await mongooseCon.disconnect();

      if (redis) await redis.quit();

      if (httpServer) httpServer.close();
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

function setupAppRoutes(name: string, mergerApp: Express, merger: ICanMerge) {
  const parent = snakeCase(name);
  mergerApp.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
  });

  mergerApp.get(`/${parent}/:reference/check`, async (req, res) => {
    try {
      const checks = await merger.onCheck(req, req.params.reference);
      jsend(res, 200, checks);
    } catch (err) {
      jsendError(res, err.code || 500, err.message);
    }
  });

  mergerApp.post(`/${parent}/:reference/approve`, async (req, res) => {
    try {
      await merger.onApprove(req, req.params.reference);
      jsend(res, 200, null);
    } catch (err) {
      jsendError(res, err.code || 500, err.message);
    }
  });

  mergerApp.post(`/${parent}/:reference/reject`, async (req, res) => {
    try {
      await merger.onReject(req, req.params.reference);
      jsend(res, 200, null);
    } catch (err) {
      jsendError(res, err.code || 500, err.message);
    }
  });
}

function jsend(res: Response, code: number, data: any) {
  res.status(code).json({ status: 'error', data, code });
}

function jsendError(res: Response, code: number, message: string) {
  res.status(code).json({ status: 'error', data: null, message, code });
}
