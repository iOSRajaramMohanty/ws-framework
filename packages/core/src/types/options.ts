import type { WebSocketServer } from "ws";
import type { WsServerDeps } from "./contracts.js";
import type { WsLogger } from "./logger.js";

export type WsServerOptions = ConstructorParameters<typeof WebSocketServer>[0] & {
  /** Pluggable logger; defaults to no-op (no console). */
  logger?: WsLogger;
  /** Override subsystems (registry, event dispatcher, plugin lifecycle). */
  deps?: WsServerDeps;
  /**
   * Max inbound message payload bytes (checked before JSON parsing).
   * Oversized frames are rejected with close code 1009.
   */
  maxPayloadBytes?: number;
};
