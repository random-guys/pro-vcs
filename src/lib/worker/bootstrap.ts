import { MongooseNamespace } from '@random-guys/bucket';
import { publisher, subscriber } from '@random-guys/eventbus';
import { ConsumeMessage } from 'amqplib';
import Logger, { createLogger } from "bunyan";
import express, { Request, Response } from 'express';
import Redis, { Redis as RedisType } from "ioredis";
import mongoose from 'mongoose';

export interface WorkerConfig {
  name: string
  amqp_url: string
  health_port: number
  mongodb_url?: string
  redis_url?: string
  postSetup?: (context: Context) => Promise<void>
}

export interface Context {
  logger: Logger
  redis?: RedisType
}

export interface Handler<T> {
  (data: T, context: Context): Promise<void>
}

/**
 * Run a handler in this process using the WorkerConfig passed. A context will
 * be created to give the handler access to resources(logging, redis).
 * @param config worker configuration
 */
export async function createWorker(config: WorkerConfig) {

  let redis: RedisType
  let mongooseCon: MongooseNamespace

  const logger = createLogger({
    name: config.name,
    serializers: {
      err: Logger.stdSerializers.err
    }
  })


  // setup event-bus
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

  // call user's setup code
  if (config.postSetup) {
    await config.postSetup({
      logger, redis
    })
  }

  // create stop function. This adds 20 lines but has to be here due
  // the dependencies
  const stop = async () => {
    try {
      logger.info(`Shutting down ${config.name} worker`)
      await subscriber.close();
      await publisher.close();

      if (mongooseCon)
        await mongooseCon.disconnect()

      if (redis)
        await redis.quit()

      if (httpServer)
        await httpServer.close();

    } catch (err) {
      logger.error(err, `An error occured while stopping ${config.name} worker`);
      process.exit(1);
    }
  }

  process.once('SIGINT', async () => {
    await stop()
  });

  return stop
}

export function createHandler<T>(context: Context, handler: Handler<T>) {
  return async (message: ConsumeMessage) => {
    if (message === null) {
      context.logger.info('Consumer cancelled by server. Exiting process')
      process.exit(1)
    }

    subscriber.acknowledgeMessage(message);
    const data = JSON.parse(message.content.toString());
    await handler(data, context)
  }
}
