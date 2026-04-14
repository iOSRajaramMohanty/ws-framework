export { ClientRegistry } from "./server/client-registry.js";
export { EventDispatcher } from "./server/event-dispatcher.js";
export { WsServer } from "./server/WsServer.js";
export { Namespace } from "./namespaces/namespace.js";
export { loadConfig } from "./config/index.js";
export { createJwtAuthPlugin } from "./auth/jwt-auth-plugin.js";
export { createRateLimitPlugin } from "./rate-limit/rate-limit-plugin.js";
export { createHeartbeatPlugin } from "./heartbeat/heartbeat-plugin.js";
export {
  createPrivateMessagingPlugin,
  DEFAULT_PRIVATE_SEND_EVENT,
  PRIVATE_ERROR_EVENT,
} from "./messaging/private-messaging-plugin.js";
export { PluginLifecycleCoordinator } from "./plugins/plugin-lifecycle.js";
export { WireEnvelopeSender } from "./transport/wire-sender.js";
export type {
  Client,
  DisconnectHandler,
  EventHandler,
  IClientRegistry,
  IEventDispatcher,
  IPluginLifecycleCoordinator,
  IncomingWireMessage,
  ListeningEventData,
  MiddlewareContext,
  MiddlewareFn,
  NextMiddleware,
  OutgoingWireMessage,
  PluginConnectionHook,
  PluginDisconnectHook,
  PluginHookRegistry,
  PluginMessageHook,
  PrivateErrorPayload,
  PrivateSendPayload,
  PrivateMessagingPluginOptions,
  WsLogger,
  WsPlugin,
  WsPluginContext,
  WsServerDeps,
  WsServerOptions,
} from "./types/index.js";
