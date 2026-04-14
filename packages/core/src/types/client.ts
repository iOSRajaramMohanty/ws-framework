import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";

export interface Client {
  readonly id: string;
  readonly socket: WebSocket;
  /**
   * Upgrade request for the WebSocket connection (headers, url, etc).
   * Useful for auth and other connection-time inspection.
   */
  readonly request?: IncomingMessage;
}

/**
 * Handlers for app wire events receive a defined `client`.
 * Framework events: `connection` / `disconnect` pass `client`; `listening` passes `client` as `undefined`.
 */
export type EventHandler = (
  client: Client | undefined,
  data: unknown,
) => void | Promise<void>;

/** @deprecated Use `on("disconnect", handler)` — same signature when `client` is defined. */
export type DisconnectHandler = (client: Client) => void | Promise<void>;
