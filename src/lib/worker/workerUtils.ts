import Logger from "bunyan";
import { createWorker, Dependencies } from "./bootstrap";

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