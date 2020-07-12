import { EventEmitter } from "events";

/**
 * EventEmitter class for asynchronous handlers.
 */
export class AsyncEmitter extends EventEmitter {
  /**
   * Basically the same as `emit` only making sure that the asynchronous handlers
   * complete before moving to another handler. It emits `"error"` events if the handler
   * fails.
   * @param eventName name of the event to emit
   * @param args arguments to pass to handlers
   */
  async emitSync(eventName: string, ...args: any[]): Promise<boolean> {
    const listeners = this.rawListeners(eventName);
    if (listeners.length === 0) {
      return false;
    }

    for (const l of listeners) {
      try {
        await l(...args);
      } catch (err) {
        this.emit("error", eventName, err);
      }
    }

    return true;
  }
}
