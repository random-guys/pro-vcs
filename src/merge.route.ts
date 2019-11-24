import { build, Controller, validate } from "@random-guys/siber";
import { session } from "@random-guys/sp-auth";
import Logger from "bunyan";
import { Express, Request, Response } from "express";
import kebabCase from "lodash/kebabCase";
import { PayloadModel } from "./event.model";
import { Check, ICanMerge, MergerConfig } from "./merge.contract";
import { isCreateEvent } from "./merge.validator";

export function setupAppRoutes<T extends PayloadModel>(
  config: MergerConfig,
  logger: Logger,
  mergerApp: Express,
  merger: ICanMerge<T>
) {
  const parent = rootRoute(config.name);
  const auth = session({
    secret: config.security_secret,
    scheme: config.security_scheme
  });

  // we'll use this to handle errors properly
  const dummyController = new Controller<T | Check[]>(logger);

  build(mergerApp, logger, {
    cors: false, // we don't need CORS
    tracking: true
  });

  // status checks
  mergerApp.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "UP" });
  });

  /**
   * Check if an object is valid.
   */
  mergerApp.get(
    `/${parent}/:reference/check`,
    auth.authCheck,
    async (req, res) => {
      try {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onCheck(req, req.params.reference)
        );
      } catch (err) {
        dummyController.handleError(req, res, err);
      }
    }
  );

  /**
   * Approve an object
   */
  mergerApp.post(
    `/${parent}/:reference/approve`,
    auth.authCheck,
    validate(isCreateEvent),
    async (req, res) => {
      try {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onApprove(req, req.params.reference, req.body)
        );
      } catch (err) {
        dummyController.handleError(req, res, err);
      }
    }
  );

  /**
   * Reject an object
   */
  mergerApp.post(
    `/${parent}/:reference/reject`,
    auth.authCheck,
    validate(isCreateEvent),
    async (req, res) => {
      try {
        dummyController.handleSuccess(
          req,
          res,
          await merger.onReject(req, req.params.reference, req.body)
        );
      } catch (err) {
        dummyController.handleError(req, res, err);
      }
    }
  );

  // register 404 route handler
  mergerApp.use((req, res, _next) => {
    res.status(404).send("Whoops! Route doesn't exist.");
    logger.info({ req, res });
  });
}

export function rootRoute(name: string) {
  return kebabCase(name);
}
