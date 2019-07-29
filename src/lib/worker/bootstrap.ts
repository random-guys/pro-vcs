import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { subscriber, publisher } from '@random-guys/eventbus';
import Logger from "bunyan"
import Redis, { Redis as RedisType } from "ioredis"
import { MongooseNamespace } from '@random-guys/bucket';
import { ConsumeMessage } from 'amqplib';

export interface WorkerConfig {
  name: string
  amqp_url: string
  health_port: number
  mongodb_url?: string
  redis_url?: string
  postSetup?: (deps: Dependencies) => Promise<void>
}

export interface Dependencies {
  logger: Logger
  redis?: RedisType
}

export interface Handler<T> {
  (data: T, dependencies: Dependencies): Promise<void>
}

/**
 * 
 * @param config 
 * @param parentLogger 
 */
export async function createWorker(parentLogger: Logger, config: WorkerConfig) {

  let redis: RedisType
  let mongooseCon: MongooseNamespace

  const logger = parentLogger.child({
    infra_source: `${config.name}_worker`
  })

  // this is default on all workers
  await subscriber.init(config.amqp_url)
  await publisher.init(config.amqp_url)

  const subscriberConnection = subscriber.getConnection();
  subscriberConnection.on('error', (err: any) => {
    logger.error(err)
    process.exit(1)
  });

  // Start simple server for  health check
  const healthApp = express()
  healthApp.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' })
  });
  const httpServer = await healthApp.listen(config.health_port)
  logger.info(`🌋 Health check running on port ${config.health_port}`)


  // connect to mongodb if need be
  if (config.mongodb_url) {
    mongooseCon = await mongoose.connect(config.mongodb_url, {
      useNewUrlParser: true,
      useCreateIndex: true
    })
    logger.info('📦  MongoDB Connected!')
  }

  // connect to redis if need be
  if (config.redis_url) {
    redis = new Redis(config.redis_url)
    logger.info('🐳  Redis Connected!')
  }

  // call user's code
  await config.postSetup({
    logger, redis
  })

  const stop = async () => {
    try {
      await subscriber.close();
      await publisher.close();

      if (mongooseCon)
        await mongooseCon.disconnect()

      if (redis)
        await redis.quit()

      if (httpServer)
        await httpServer.close();

    } catch (err) {
      logger.error(err, 'An error occured while stopping Transaction worker');
      process.exit(1);
    }
  }

  process.once('SIGINT', async () => {
    await stop()
  });

  return stop
}

export function createHandler<T>(deps: Dependencies, handler: Handler<T>) {
  return async (message: ConsumeMessage) => {
    if (message === null) {
      deps.logger.info('Consumer cancelled by server. Exiting process')
      process.exit(1)
    }

    subscriber.acknowledgeMessage(message);
    const data = JSON.parse(message.content.toString());
    await handler(data, deps)
  }
}