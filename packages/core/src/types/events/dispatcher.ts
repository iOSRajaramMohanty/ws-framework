import type { Client, EventHandler } from "../client.js";

/** Application + framework event subscription and dispatch. */
export interface IEventDispatcher {
  subscribe(event: string, handler: EventHandler): void;
  dispatch(event: string, client: Client | undefined, data: unknown): Promise<void>;

  /**
   * Optional namespace-aware APIs. Core will use these when present to avoid encoding namespaces
   * into event strings internally.
   *
   * Custom dispatchers that don't implement namespaces remain fully compatible.
   */
  subscribeInNamespace?(
    namespace: string,
    event: string,
    handler: EventHandler,
  ): void;
  dispatchInNamespace?(
    namespace: string,
    event: string,
    client: Client | undefined,
    data: unknown,
  ): Promise<void>;
}
