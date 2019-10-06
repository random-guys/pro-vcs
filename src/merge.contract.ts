import { MongoConfig } from '@random-guys/bucket';
import Logger from 'bunyan';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { CreateEvent } from './hub.model';
import { PayloadModel } from './event.model';

export interface ICanMerge<T extends PayloadModel> {
  /**
   * This is called when all required approvals for an object have
   * been collected.
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onApprove(
    req: Request,
    reference: string,
    event: CreateEvent<T>
  ): Promise<void>;

  /**
   * This is called when a single reject is sent, as long as `onApprove`
   * has not been called
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onReject(
    req: Request,
    reference: string,
    event: CreateEvent<T>
  ): Promise<void>;

  /**
   * This is called to ensure the viability of approval i.e. if the
   * returned list contains any `status === 'error'`, the object
   * can't be approved
   * @param req express request for flexibility
   * @param reference reference for this event
   * @param event event itself
   */
  onCheck(req: Request, reference: string): Promise<Check[]>;
}

/**
 * Describes a validation that has been done on an object
 */
export interface Check {
  /**
   * Status of the check
   */
  status: 'success' | 'error';
  /**
   * Save this check for later
   */
  cache: boolean;
  /**
   * Description of check if any
   */
  message?: string;
}

/**
 * Configuration for setting up a merge worker
 */
export interface MergerConfig extends MongoConfig {
  /**
   * Name of the repo this worker is supposed to manage
   */
  name: string;
  /**
   * Secret used for authentication of the merge routes
   */
  security_secret: string;
  /**
   * Scheme used for authentication of the merge routes
   */
  security_scheme: string;
  /**
   * Whether it should use `bucket`'s `defaultMongoOpts` or `secureMongoOpts`
   */
  secure_db: boolean;
  /**
   * Merge worker's port
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
