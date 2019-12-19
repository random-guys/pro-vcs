import { MongoConfig } from "@random-guys/bucket";
import Logger from "bunyan";

/**
 * Configuration for setting up a merge worker
 */
export interface WorkerConfig extends MongoConfig {
  /**
   * Name of the parent service
   */
  service_name: string;
  /**
   * Whether it should use `bucket`'s `defaultMongoOpts` or `secureMongoOpts`
   */
  secure_db: boolean;
  /**
   * Worker's port
   */
  app_port: number;
  /**
   * Run this after setting up the worker
   */
  onStart?: (logger: Logger) => Promise<void>;
  /**
   * Run this just before quiting
   */
  onStop?: (logger: Logger) => Promise<void>;
}

export interface SubscriptionConfig extends WorkerConfig {
  /**
   * AMQP connection URL
   */
  amqp_url: string;
}

export interface Handler<T> {
  (data: T, logger: Logger): Promise<void>;
}
