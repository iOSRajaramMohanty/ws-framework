import type { Client, EventHandler } from "../types/index.js";
import type { WsServer } from "../server/WsServer.js";
import { validateNamespaceName } from "./validate.js";
import { encodeNamespacedEvent } from "./wire.js";

/**
 * Namespaced facade over {@link WsServer} that reuses the existing event bus by prefixing events.
 * Does not change transport: clients can either send prefixed events (e.g. `chat:message`) or send
 * `{ namespace: "chat", event: "message", data }` (supported by the JSON decoder).
 */
export class Namespace {
  public readonly name: string;

  constructor(
    private readonly server: WsServer,
    namespaceName: string,
  ) {
    this.name = validateNamespaceName(namespaceName);
  }

  on(event: string, handler: EventHandler): void {
    this.server.onInNamespace(this.name, event, handler);
  }

  emit(event: string, client: Client, data: unknown): void {
    // Keep wire backwards compatible: still send a single `event` string.
    // Internally, handlers are isolated without relying on prefixed event keys.
    this.server.emit(encodeNamespacedEvent(this.name, event), client, data);
  }

  broadcast(event: string, data: unknown): void {
    this.server.broadcast(encodeNamespacedEvent(this.name, event), data);
  }
}

