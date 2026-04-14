export type { Client, DisconnectHandler, EventHandler } from "./client.js";
export type {
  IClientRegistry,
  WsServerDeps,
} from "./contracts.js";
export type { IEventDispatcher } from "./events/dispatcher.js";
export type { MiddlewareContext, MiddlewareFn, NextMiddleware } from "./events/middleware.js";
export type { ListeningEventData } from "./framework/listening.js";
export type {
  IPluginLifecycleCoordinator,
  PluginConnectionHook,
  PluginDisconnectHook,
  PluginHookRegistry,
  PluginMessageHook,
} from "./plugin/lifecycle.js";
export type { WsPlugin, WsPluginContext } from "./plugin/context.js";
export type { AuthMode, AuthenticatedClient, JwtAuthPluginOptions } from "../auth/jwt-auth-plugin.js";
export type { RateLimitAction, RateLimitOptions } from "../rate-limit/rate-limit-plugin.js";
export type { HeartbeatOptions } from "../heartbeat/heartbeat-plugin.js";
export type {
  PrivateErrorPayload,
  PrivateMessagingPluginOptions,
  PrivateSendPayload,
} from "./messaging/private.js";
export type { IncomingWireMessage, OutgoingWireMessage } from "./transport/wire.js";
export type { WsLogger } from "./logger.js";
export type { WsServerOptions } from "./options.js";
