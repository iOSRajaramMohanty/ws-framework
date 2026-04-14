import type { Client } from "../client.js";

/**
 * Runs as early as possible for a new connection (before the client is registered and before
 * the framework `connection` event). Use for auth and connection-time rejection.
 */
export type PluginPreConnectionHook = (client: Client) => void | Promise<void>;

/** Runs after a client is registered; before the framework `connection` event. */
export type PluginConnectionHook = (client: Client) => void | Promise<void>;

/** Runs before the framework `disconnect` event and registry removal. */
export type PluginDisconnectHook = (client: Client) => void | Promise<void>;

/**
 * Runs after a wire message is decoded and validated; before application handlers.
 * Not invoked for malformed frames or reserved wire event names.
 */
export type PluginMessageHook = (
  client: Client,
  event: string,
  data: unknown,
) => void | boolean | Promise<void | boolean>;

/** Register lifecycle hooks; order is global registration order (per `use` call order). */
export interface PluginHookRegistry {
  readonly preConnection: (handler: PluginPreConnectionHook) => void;
  readonly connection: (handler: PluginConnectionHook) => void;
  readonly disconnect: (handler: PluginDisconnectHook) => void;
  readonly message: (handler: PluginMessageHook) => void;
}

/** Runnable plugin pipeline; implemented by {@link PluginLifecycleCoordinator}. */
export interface IPluginLifecycleCoordinator extends PluginHookRegistry {
  runPreConnection(client: Client): Promise<void>;
  runConnection(client: Client): Promise<void>;
  runDisconnect(client: Client): Promise<void>;
  /**
   * Runs message hooks in registration order.
   * If any hook returns `false`, the message is cancelled (application handlers will not run).
   */
  runMessage(client: Client, event: string, data: unknown): Promise<boolean>;
}
