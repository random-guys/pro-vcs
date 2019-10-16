import { validate, build } from '@random-guys/siber';
import { session } from '@random-guys/sp-auth';
import Logger from 'bunyan';
import express, { Express, Request, Response } from 'express';
import kebabCase from 'lodash/kebabCase';
import { PayloadModel } from './event.model';
import { ICanMerge, MergerConfig } from './merge.contract';
import { isCreateEvent } from './merge.validator';

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

  build(mergerApp, logger, {
    cors: false,
    tracking: true
  });

  // status checks
  mergerApp.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
  });

  mergerApp.get(
    `/${parent}/:reference/check`,
    auth.authCheck,
    async (req, res) => {
      try {
        const checks = await merger.onCheck(req, req.params.reference);
        jsend(req, res, checks);
      } catch (err) {
        jsendError(req, res, err);
      }
    }
  );

  mergerApp.post(
    `/${parent}/:reference/approve`,
    auth.authCheck,
    validate(isCreateEvent),
    async (req, res) => {
      try {
        await merger.onApprove(req, req.params.reference, req.body);
        jsend(req, res, null);
      } catch (err) {
        jsendError(req, res, err);
      }
    }
  );

  mergerApp.post(
    `/${parent}/:reference/reject`,
    auth.authCheck,
    validate(isCreateEvent),
    async (req, res) => {
      try {
        await merger.onReject(req, req.params.reference, req.body);
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
    res.status(200).json({ status: 'success', data, code: 200 });
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
