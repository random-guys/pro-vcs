import Logger from "bunyan";
import { createWorker, Dependencies, Handler, createHandler } from "./bootstrap";
import { subscriber } from "@random-guys/eventbus";
import { slugify } from "../string";

export interface PostApprovalWorkerConfig {
  service: string
  amqp_url: string
  health_port: number
  mongodb_url: string
  redis_url?: string
  setupHandlers(deps: Dependencies): Promise<void>
}

export function createPostApprovalWorker(logger: Logger, config: PostApprovalWorkerConfig) {
  createWorker(logger, {
    name: `${config.service}_post_approval_worker`,
    amqp_url: config.amqp_url,
    health_port: config.health_port,
    mongodb_url: config.mongodb_url,
    redis_url: config.redis_url,
    postSetup: config.setupHandlers
  })
}

export async function onCreateApproved<T>(name: string, deps: Dependencies, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'approvals',
    `${eventName}.created`,
    `${eventName.toUpperCase()}_CREATE_QUEUE`,
    createHandler(deps, handler)
  );
}

export async function onUpdateApproved<T>(name: string, deps: Dependencies, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'approvals',
    `${eventName}.updated`,
    `${eventName.toUpperCase()}_UPDATE_QUEUE`,
    createHandler(deps, handler)
  );
}

export async function onDeleteApproved<T>(name: string, deps: Dependencies, handler: Handler<T>) {
  const eventName = slugify(name)
  await subscriber.on(
    'approvals',
    `${eventName}.deleted`,
    `${eventName.toUpperCase()}_DELETE_QUEUE`,
    createHandler(deps, handler)
  );
}