import Logger from "bunyan";
import { createWorker, Context, Handler, createHandler } from "./bootstrap";
import { subscriber } from "@random-guys/eventbus";
import { slugify } from "../string";

export interface PostApprovalWorkerConfig {
  service: string
  amqp_url: string
  health_port: number
  mongodb_url: string
  redis_url?: string
  setupHandlers(context: Context): Promise<void>
}

export function createPostApprovalWorker(config: PostApprovalWorkerConfig) {
  createWorker({
    name: `${config.service}_post_approval_worker`,
    amqp_url: config.amqp_url,
    health_port: config.health_port,
    mongodb_url: config.mongodb_url,
    redis_url: config.redis_url,
    postSetup: config.setupHandlers
  })
}

export async function onCreateApproved<T>(name: string, context: Context, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'reviews',
    `${eventName}.created`,
    `${eventName.toUpperCase()}_CREATE_QUEUE`,
    createHandler(context, handler)
  );
}

export async function onUpdateApproved<T>(name: string, context: Context, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'reviews',
    `${eventName}.updated`,
    `${eventName.toUpperCase()}_UPDATE_QUEUE`,
    createHandler(context, handler)
  );
}

export async function onDeleteApproved<T>(name: string, context: Context, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'reviews',
    `${eventName}.deleted`,
    `${eventName.toUpperCase()}_DELETE_QUEUE`,
    createHandler(context, handler)
  );
}