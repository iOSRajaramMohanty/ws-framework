import type { Client, EventHandler } from "../types/client.js";
import type { IEventDispatcher } from "../types/events/dispatcher.js";
import type { WsLogger } from "../types/logger.js";

type ResolvedLogger = Required<WsLogger>;

/**
 * Routes application events to registered handlers.
 * Isolated from transport so middleware can wrap `dispatch` in the future.
 */
export class EventDispatcher implements IEventDispatcher {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly namespacedHandlers = new Map<string, Map<string, Set<EventHandler>>>();

  constructor(private readonly log: ResolvedLogger) {}

  subscribe(event: string, handler: EventHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  subscribeInNamespace(namespace: string, event: string, handler: EventHandler): void {
    let nsMap = this.namespacedHandlers.get(namespace);
    if (!nsMap) {
      nsMap = new Map();
      this.namespacedHandlers.set(namespace, nsMap);
    }
    let set = nsMap.get(event);
    if (!set) {
      set = new Set();
      nsMap.set(event, set);
    }
    set.add(handler);
  }

  async dispatch(event: string, client: Client | undefined, data: unknown): Promise<void> {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) {
      return;
    }

    for (const fn of set) {
      try {
        await fn(client, data);
      } catch (err) {
        this.log.error("Event handler error", {
          clientId: client?.id,
          event,
          err,
        });
      }
    }
  }

  async dispatchInNamespace(
    namespace: string,
    event: string,
    client: Client | undefined,
    data: unknown,
  ): Promise<void> {
    const nsMap = this.namespacedHandlers.get(namespace);
    const set = nsMap?.get(event);
    if (!set || set.size === 0) {
      return;
    }

    for (const fn of set) {
      try {
        await fn(client, data);
      } catch (err) {
        this.log.error("Event handler error", {
          clientId: client?.id,
          namespace,
          event,
          err,
        });
      }
    }
  }
}
