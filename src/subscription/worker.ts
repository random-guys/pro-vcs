import { subscriber } from "@random-guys/eventbus";
import { Connection, ConsumeMessage } from "amqplib";
import Logger, { createLogger } from "bunyan";
import { EventEmitter } from "events";
import express, { Request, Response } from "express";
import { AsyncEmitter } from "./emitter";

/**
 * Defines what an event handler is expected to look like.
 */
export interface Handler<T> {
  (data: T, logger: Logger): Promise<void>;
}
export type Runner = (command: "start" | "stop") => Promise<void>;
export type EventRegistrar = (event: string, handler: (log: Logger) => Promise<void>) => void;

/**
 * Createa a command runner to start/stop the worker(with kubernetes health checks)
 * and an event register function to help track when the worker starts and when it
 * dies.
 * @param name name of the worker service
 * @param port port to run the health server on
 * @param subConn connection used by the subscriber
 * @param registrar function that defines what queues and exchanges to listen to
 */
export function worker(
  name: string,
  port: number,
  subConn: Connection,
  registrar: (logger: Logger) => Promise<void>
): [Runner, EventRegistrar] {
  const logger = createLogger({
    name,
    serializers: {
      err: Logger.stdSerializers.err
    }
  });

  const events = new AsyncEmitter();

  let httpServer: any;

  const runner = async (command: string) => {
    switch (command) {
      case "start":
        // ensure to link it with provider immediately
        subConn.on("error", (err: any) => {
          logger.error(err);
          process.exit(1);
        });

        // Start simple server for  health check
        const healthApp = express();
        healthApp.get("/", (_req: Request, res: Response) => {
          res.status(200).json({ status: "UP" });
        });
        httpServer = healthApp.listen(port);
        logger.info(`🌋 Health check running on port ${port}`);

        await events.emitSync("start");

        return registrar(logger);
      case "stop":
        logger.info(`Shutting down ${name} worker`);
        httpServer.close();

        await events.emitSync("stop");

        process.exit(0);
      default:
        throw new Error("Command not supported");
    }
  };

  events.on("error", (event, err) => {
    logger.error(err, `Error when running handler for "${event}" event`);
  });

  const eventRegistrar = (event: "start" | "stop", handler: (log: Logger) => Promise<void>) => {
    events.once(event, () => handler(logger));
  };

  process.once("SIGINT", async () => {
    await runner("stop");
  });

  return [runner, eventRegistrar];
}

/**
 * Create a wrapper around the passed handler to handle parsing.
 * Note that it shutsdown it's host process once
 * the queue is closed
 * @param logger logger for when the queue is about to shutdown
 * @param handler handler to be wrapped.
 */
export function createHandler<T>(logger: Logger, handler: Handler<T>) {
  return async (message: ConsumeMessage) => {
    if (message === null) {
      logger.info("Consumer cancelled by server. Exiting process");
      process.exit(1);
    }

    subscriber.acknowledgeMessage(message);
    const data = JSON.parse(message.content.toString());
    await handler(data, logger);
  };
}
