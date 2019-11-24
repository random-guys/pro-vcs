import Logger from "bunyan";
import { WorkerConfig } from "./worker.contract";

export interface SubscriptionConfig extends WorkerConfig {
  /**
   * AMQP connection URL
   */
  amqp_url: string;
}

export interface Handler<T> {
  (data: T, logger: Logger): Promise<void>;
}
