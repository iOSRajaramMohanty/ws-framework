import type { Client, EventHandler } from "../client.js";
import type { PluginHookRegistry } from "./lifecycle.js";

/**
 * Passed to each plugin from {@link WsServer.use}. Lifecycle hooks run in **registration order**
 * (order of `use` calls × order of `hook.*` calls within each plugin). Hooks run **before** the
 * matching framework event / application handler dispatch.
 */
export interface WsPluginContext {
  readonly on: (event: string, handler: EventHandler) => void;
  readonly emit: (event: string, client: Client, data: unknown) => void;
  /**
   * Send to a connected peer by id. Returns whether the peer was found (socket may still fail silently).
   */
  readonly emitTo: (targetClientId: string, event: string, data: unknown) => boolean;
  readonly broadcast: (event: string, data: unknown) => void;
  /**
   * Broadcast only to clients connected to this server instance.
   * Useful for horizontal scaling adapters (e.g. Redis pub/sub) to avoid re-publishing loops.
   */
  readonly broadcastLocal: (event: string, data: unknown) => void;
  /**
   * Replace how `broadcast()` behaves for this server instance.
   * Intended for adapters (e.g. Redis) to publish-and-fanout across instances.
   *
   * The adapter should call {@link WsPluginContext.broadcastLocal} for remote messages to avoid duplicates.
   */
  readonly setBroadcastAdapter: (adapter: (event: string, data: unknown) => void) => void;
  readonly use: (plugin: WsPlugin) => WsPluginContext;
  /** Ordered lifecycle hooks — plugins must not mutate core; register callbacks only. */
  readonly hook: PluginHookRegistry;
}

export type WsPlugin = (context: WsPluginContext) => void;
