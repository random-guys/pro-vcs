import {
  defaultMongoOpts,
  MongoConfig,
  MongooseNamespace,
  secureMongoOpts
} from '@random-guys/bucket';
import Logger, { createLogger } from 'bunyan';
import {
  logRequests,
  logResponse,
  logError,
  createRequestSerializer
} from '@random-guys/express-bunyan';
import express, { Express, Request, Response } from 'express';
import Redis, { Redis as RedisType } from 'ioredis';
import kebabCase from 'lodash/kebabCase';
import mongoose from 'mongoose';
import { tokenOnly } from '@random-guys/sp-auth';

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

export interface MergerConfig extends MongoConfig {
  name: string;
  security_secret: string;
  security_scheme: string;
  secure_db: boolean;
  app_port: number;
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

function setupAppRoutes(
  config: MergerConfig,
  logger: Logger,
  mergerApp: Express,
  merger: ICanMerge
) {
  const parent = rootRoute(config.name);
  const authToken = tokenOnly(config.security_secret, config.security_scheme);

  // basic middleware
  mergerApp.use(express.json());
  mergerApp.use(express.urlencoded({ extended: false }));

  // log all requests
  mergerApp.use(logRequests(logger));

  // status checks
  mergerApp.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
  });

  mergerApp.get(`/${parent}/:reference/check`, authToken, async (req, res) => {
    try {
      const checks = await merger.onCheck(req, req.params.reference);
      jsend(req, res, checks);
    } catch (err) {
      jsendError(req, res, err);
    }
  });

  mergerApp.post(
    `/${parent}/:reference/approve`,
    authToken,
    async (req, res) => {
      try {
        await merger.onApprove(req, req.params.reference);
        jsend(req, res, null);
      } catch (err) {
        jsendError(req, res, err);
      }
    }
  );

  mergerApp.post(
    `/${parent}/:reference/reject`,
    authToken,
    async (req, res) => {
      try {
        await merger.onReject(req, req.params.reference);
        jsend(req, res, null);
      } catch (err) {
        jsendError(req, res, err);
      }
    }
  );

  // register 404 route handler
  mergerApp.use((req, res, _next) => {
    res.status(404).send("Whoops! Route doesn't exist.");
    logResponse(logger, req, res);
  });

  function jsend(req: Request, res: Response, data: any) {
    res.status(200).json({ status: 'error', data, code: 200 });
    logResponse(logger, req, res);
  }

  function jsendError(req: Request, res: Response, err: Error) {
    const code = err['code'] || 500;
    res.status(code).json({
      status: 'error',
      data: null,
      message: err.message,
      code
    });
    logError(logger, err, req, res);
  }
}

export function rootRoute(name: string) {
  return kebabCase(name);
}
