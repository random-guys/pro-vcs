import {
  defaultMongoOpts,
  MongooseNamespace,
  secureMongoOpts
} from "@random-guys/bucket";
import {
  createRequestSerializer,
  errSerializer,
  resSerializer,
  build,
  Controller,
  universalErrorHandler,
  validate
} from "@random-guys/siber";
import Logger, { createLogger } from "bunyan";
import express, { Request, Response } from "express";
import { Server } from "http";
import mongoose from "mongoose";
import { PayloadModel } from "./event.model";
import { ICanMerge, Check } from "./merge.contract";
import { WorkerConfig } from "./worker.contract";
import { session } from "@random-guys/sp-auth";
import { isCreateEvent } from "./merge.validator";

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
  private auth: any;

  constructor(private config: MergerConfig) {
    this.logger = createLogger({
      name: `${config.service_name}-merger`,
      serializers: {
        err: errSerializer,
        res: resSerializer,
        req: createRequestSerializer("password")
      }
    });

    build(this.expressApp, this.logger, {
      cors: false, // we don't need CORS
      tracking: true
    });

    this.auth = session({
      secret: this.config.security_secret,
      scheme: this.config.security_scheme
    });
  }

  /**
   * Start the worker and all its resources
   */
  async start<T extends PayloadModel>(merger: ICanMerge<T>) {
    const { app_port, mongodb_url, secure_db, onStart } = this.config;

    // connect to mongodb if need be
    this.dbConn = await mongoose.connect(
      mongodb_url,
      secure_db ? secureMongoOpts(this.config) : defaultMongoOpts
    );
    this.logger.info("📦  MongoDB Connected!");

    // call user's setup code
    if (onStart) {
      await onStart(this.logger);
    }

    // status checks
    this.expressApp.get("/", (_req: Request, res: Response) => {
      res.status(200).json({ status: "UP" });
    });

    // register 404 route handler
    this.expressApp.use((req, res, _next) => {
      res.status(404).send("Whoops! Route doesn't exist.");
      this.logger.info({ req, res });
    });

    this.expressApp.use(universalErrorHandler(this.logger));

    this.httpServer = this.expressApp.listen(app_port);
    this.logger.info(`🌋 Merger running on port ${app_port}`);

    process.once("SIGINT", () => this.stop());
  }

  addMerger<T extends PayloadModel>(route: string, merger: ICanMerge<T>) {
    // we'll use this to handle errors properly
    const dummyController = new Controller<T | Check[]>(this.logger);

    /**
     * Check if an object is valid.
     */
    this.expressApp.get(
      `/${route}/:reference/check`,
      this.auth.authCheck,
      async (req, res) => {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onCheck(req, req.params.reference)
        );
      }
    );

    /**
     * Approve an object
     */
    this.expressApp.post(
      `/${route}/:reference/approve`,
      this.auth.authCheck,
      validate(isCreateEvent),
      async (req, res) => {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onApprove(req, req.params.reference, req.body)
        );
      }
    );

    /**
     * Reject an object
     */
    this.expressApp.post(
      `/${route}/:reference/reject`,
      this.auth.authCheck,
      validate(isCreateEvent),
      async (req, res) => {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onReject(req, req.params.reference, req.body)
        );
      }
    );
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
