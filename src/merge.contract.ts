import { MongoConfig } from '@random-guys/bucket';
import Logger from 'bunyan';
import { Request } from 'express';
import { Redis } from 'ioredis';

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
  redis?: Redis;
}
