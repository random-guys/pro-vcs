import {
  defaultMongoOpts,
  MongooseNamespace,
  secureMongoOpts
} from "@random-guys/bucket";
import {
  createRequestSerializer,
  errSerializer,
  resSerializer
} from "@random-guys/siber";
import Logger, { createLogger } from "bunyan";
import express from "express";
import { Server } from "http";
import mongoose from "mongoose";
import { WorkerConfig } from "./worker.contract";
import { ICanMerge } from "./merge.contract";
import { PayloadModel } from "./event.model";
import { setupAppRoutes } from "./merge.route";

/**
 * Configuration for setting up a merge worker
 */
export interface MergerConfig extends WorkerConfig {
  /**
   * Secret used for authentication of the merge routes
   */
  security_secret: string;
  /**
   * Scheme used for authentication of the merge routes
   */
  security_scheme: string;
}

export class MergeWorker {
  private logger: Logger;
  private expressApp = express();
  private httpServer: Server;
  private dbConn: MongooseNamespace;

  constructor(private config: MergerConfig) {
    this.logger = createLogger({
      name: `${config.service_name}-merger`,
      serializers: {
        err: errSerializer,
        res: resSerializer,
        req: createRequestSerializer("password")
      }
    });
  }

  /**
   * Start the worker and all its resources
   */
  async start<T extends PayloadModel>(merger: ICanMerge<T>) {
    const { app_port, mongodb_url, secure_db, onStart } = this.config;
    this.httpServer = this.expressApp.listen(app_port);
    this.logger.info(`🌋 Merger running on port ${app_port}`);

    // connect to mongodb if need be
    this.dbConn = await mongoose.connect(
      mongodb_url,
      secure_db ? secureMongoOpts(this.config) : defaultMongoOpts
    );
    this.logger.info("📦  MongoDB Connected!");

    setupAppRoutes(this.config, this.logger, this.expressApp, merger);

    // call user's setup code
    if (onStart) {
      await onStart(this.logger);
    }

    process.once("SIGINT", () => this.stop());
  }

  /**
   * Gracefully shutdown the worker
   */
  async stop() {
    const { service_name, onStop } = this.config;
    this.logger.info(`Shutting down ${service_name} merger`);
    try {
      await this.dbConn.disconnect();
      this.httpServer.close();

      // custom shutdown
      if (onStop) {
        await onStop(this.logger);
      }
    } catch (err) {
      this.logger.error(
        err,
        `An error occured while stopping ${service_name} worker`
      );
      process.exit(1);
    }
  }
}
