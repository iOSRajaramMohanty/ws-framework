import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";
import type { IncomingMessage } from "node:http";
import { PluginLifecycleCoordinator } from "../plugins/plugin-lifecycle.js";
import { decodeInboundFrame } from "../transport/inbound.js";
import { WireEnvelopeSender } from "../transport/wire-sender.js";
import type { Client, EventHandler, WsServerOptions } from "../types/index.js";
import type { IClientRegistry } from "../types/contracts.js";
import type { IEventDispatcher } from "../types/events/dispatcher.js";
import type { ListeningEventData } from "../types/framework/listening.js";
import type { IPluginLifecycleCoordinator, PluginHookRegistry } from "../types/plugin/lifecycle.js";
import type { WsPlugin, WsPluginContext } from "../types/plugin/context.js";
import type { WsLogger } from "../types/logger.js";
import type { OutgoingWireMessage } from "../types/transport/wire.js";
import { resolveLogger } from "../utils/logger.js";
import { ClientRegistry } from "./client-registry.js";
import { EventDispatcher } from "./event-dispatcher.js";
import { Namespace } from "../namespaces/namespace.js";
import { validateNamespaceName } from "../namespaces/validate.js";

type ResolvedLogger = Required<WsLogger>;

/** Inbound JSON `event` values reserved for framework lifecycle (ignored from wire). */
const RESERVED_WIRE_EVENTS = new Set(["connection", "disconnect", "listening"]);

/**
 * WebSocket application server. Transport is fully encapsulated — use {@link WsServer.on}
 * for `connection`, `disconnect`, `listening`, and app events from client messages.
 */
export class WsServer {
  private readonly transport: WebSocketServer;
  private readonly clients: IClientRegistry;
  private readonly events: IEventDispatcher;
  private readonly wire: WireEnvelopeSender;
  private readonly log: ResolvedLogger;
  private readonly lifecycle: IPluginLifecycleCoordinator;
  /** Narrow hook surface for plugins (no access to `run*` internals). */
  private readonly pluginHookRegistry: PluginHookRegistry;
  private readonly namespaces = new Map<string, Namespace>();
  private broadcastAdapter: (event: string, data: unknown) => void;
  private readonly maxPayloadBytes?: number;

  constructor(options?: WsServerOptions) {
    const { logger, deps, maxPayloadBytes, ...wsOptions } = options ?? {};
    this.log = resolveLogger(logger);
    this.maxPayloadBytes = maxPayloadBytes;

    this.clients = deps?.clients ?? new ClientRegistry();
    this.events = deps?.events ?? new EventDispatcher(this.log);
    this.wire = new WireEnvelopeSender(this.log);
    this.lifecycle = deps?.lifecycle ?? new PluginLifecycleCoordinator(this.log);
    this.broadcastAdapter = (event, data) => this.broadcastLocal(event, data);
    this.pluginHookRegistry = {
      preConnection: (h) => this.lifecycle.preConnection(h),
      connection: (h) => this.lifecycle.connection(h),
      disconnect: (h) => this.lifecycle.disconnect(h),
      message: (h) => this.lifecycle.message(h),
    };

    this.transport = new WebSocketServer(wsOptions);
    this.transport.on("connection", (socket, req) => this.acceptConnection(socket, req));
    this.transport.on("error", (err) => {
      this.log.error("WebSocketServer error", { err });
    });
    this.transport.on("listening", () => {
      const payload: ListeningEventData = { address: this.transport.address() };
      void this.events.dispatch("listening", undefined, payload);
    });
  }

  on(event: string, handler: EventHandler): void {
    this.events.subscribe(event, handler);
  }

  /** Subscribe within a namespace without encoding it into the handler key. */
  onInNamespace(namespace: string, event: string, handler: EventHandler): void {
    if (this.events.subscribeInNamespace) {
      this.events.subscribeInNamespace(namespace, event, handler);
      return;
    }
    // Fallback for custom event dispatchers that don't implement namespaces:
    // keep behavior via prefixed event string on the core event bus.
    this.on(`${namespace}:${event}`, handler);
  }

  /**
   * Retrieve (and cache) a namespace facade.
   * Namespaces isolate handler registration by prefixing events internally (e.g. `chat:message`).
   */
  of(namespaceName: string): Namespace {
    const key = validateNamespaceName(namespaceName);
    const existing = this.namespaces.get(key);
    if (existing) {
      return existing;
    }
    const ns = new Namespace(this, key);
    this.namespaces.set(key, ns);
    return ns;
  }

  /**
   * Register a plugin. Plugins receive a {@link WsPluginContext} with `hook` for lifecycle
   * and `on` / `emit` / `broadcast` / nested `use`. Chainable.
   */
  use(plugin: WsPlugin): this {
    plugin(this.createPluginContext());
    return this;
  }

  emit(event: string, client: Client, data: unknown): void {
    const envelope: OutgoingWireMessage = { event, data };
    this.wire.send(client, envelope);
  }

  /**
   * Send an application event to exactly one connected client by id.
   * @returns `true` if the id was online; `false` if no such client.
   */
  emitTo(targetClientId: string, event: string, data: unknown): boolean {
    const target = this.clients.get(targetClientId);
    if (!target) {
      return false;
    }
    this.emit(event, target, data);
    return true;
  }

  broadcast(event: string, data: unknown): void {
    this.broadcastAdapter(event, data);
  }

  private broadcastLocal(event: string, data: unknown): void {
    const envelope: OutgoingWireMessage = { event, data };
    this.wire.broadcast(this.clients, envelope);
  }

  private createPluginContext(): WsPluginContext {
    const ctx: WsPluginContext = {
      on: (event, handler) => this.on(event, handler),
      emit: (event, client, data) => this.emit(event, client, data),
      emitTo: (targetId, event, data) => this.emitTo(targetId, event, data),
      broadcast: (event, data) => this.broadcast(event, data),
      broadcastLocal: (event, data) => this.broadcastLocal(event, data),
      setBroadcastAdapter: (adapter) => {
        this.broadcastAdapter = adapter;
      },
      use: (p) => {
        this.use(p);
        return ctx;
      },
      hook: this.pluginHookRegistry,
    };
    return ctx;
  }

  private acceptConnection(socket: WebSocket, request?: IncomingMessage): void {
    const id = randomUUID();
    const client: Client = { id, socket, request };

    // Give plugins a chance to reject early (auth, allowlist, etc) before registration/events.
    void (async () => {
      try {
        await this.lifecycle.runPreConnection(client);
      } catch (err) {
        this.log.error("Pre-connection pipeline error", { clientId: client.id, err });
      }

      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      this.clients.add(client);

      socket.on("message", (data) => {
        void this.onSocketMessage(client, data);
      });

      socket.on("close", () => {
        void this.onSocketClosed(client);
      });

      socket.on("error", (err) => {
        this.log.warn("Client socket error", { clientId: id, err });
      });

      try {
        await this.lifecycle.runConnection(client);
        await this.events.dispatch("connection", client, undefined);
      } catch (err) {
        this.log.error("Connection pipeline error", { clientId: client.id, err });
      }
    })();
  }

  private async onSocketClosed(client: Client): Promise<void> {
    try {
      await this.lifecycle.runDisconnect(client);
      await this.events.dispatch("disconnect", client, undefined);
    } catch (err) {
      this.log.error("Disconnect pipeline error", { clientId: client.id, err });
    }
    this.clients.remove(client.id);
  }

  private async onSocketMessage(client: Client, raw: RawData): Promise<void> {
    const decoded = decodeInboundFrame(raw, this.maxPayloadBytes);
    if (!decoded.ok) {
      if (decoded.reason === "too_large") {
        client.socket.close(1009, "Message too large");
        return;
      }
      this.log.debug("Ignoring non-conforming message", { clientId: client.id });
      return;
    }

    const { event, data } = decoded.message;
    if (RESERVED_WIRE_EVENTS.has(event)) {
      this.log.debug("Ignoring reserved event name from wire", { clientId: client.id, event });
      return;
    }

    try {
      const shouldContinue = await this.lifecycle.runMessage(client, event, data);
      if (!shouldContinue) {
        return;
      }
      // Always dispatch the raw wire event string (backwards compatible).
      await this.events.dispatch(event, client, data);

      // Additionally dispatch to namespace-aware handlers when possible.
      // - If wire sent `{ namespace, event }`, json decoder rewrites `event` to `${namespace}:${event}` already,
      //   so we also derive namespace from that string to avoid widening transport types.
      // - If a client sends a prefixed event (e.g. `chat:message`) we also route it here.
      const dispatchInNamespace = this.events.dispatchInNamespace;
      if (dispatchInNamespace) {
        const idx = event.indexOf(":");
        if (idx > 0 && idx < event.length - 1) {
          await dispatchInNamespace.call(
            this.events,
            event.slice(0, idx),
            event.slice(idx + 1),
            client,
            data,
          );
        }
      }
    } catch (err) {
      this.log.error("Message pipeline error", { clientId: client.id, event, err });
    }
  }
}
