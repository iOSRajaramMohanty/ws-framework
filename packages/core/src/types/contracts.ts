import type { Client } from "./client.js";
import type { IEventDispatcher } from "./events/dispatcher.js";
import type { IPluginLifecycleCoordinator } from "./plugin/lifecycle.js";

/** In-memory client index — used by broadcast and future room adapters. */
export interface IClientRegistry {
  readonly size: number;
  add(client: Client): void;
  remove(clientId: string): boolean;
  get(clientId: string): Client | undefined;
  /** All connected clients (snapshot iterator over current map). */
  values(): IterableIterator<Client>;
}

/** Injectable subsystems for tests and advanced composition. */
export interface WsServerDeps {
  readonly clients?: IClientRegistry;
  readonly events?: IEventDispatcher;
  /** Override plugin lifecycle coordinator (tests / custom ordering). */
  readonly lifecycle?: IPluginLifecycleCoordinator;
}
