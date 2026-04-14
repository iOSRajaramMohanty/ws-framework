import type { WsPlugin } from "../types/plugin/context.js";
import type { PrivateMessagingPluginOptions, PrivateSendPayload } from "../types/messaging/private.js";

const DEFAULT_INBOUND = "private_send";
const ERROR_EVENT = "private_error";

function isPrivateSendPayload(data: unknown): data is PrivateSendPayload {
  if (data === null || typeof data !== "object") {
    return false;
  }
  const o = data as Record<string, unknown>;
  return typeof o.to === "string" && o.to.length > 0 && typeof o.event === "string" && o.event.length > 0;
}

/**
 * Routes inbound `{ event: inboundEvent, data: { to, event, data? } }` to a single peer via
 * {@link WsPluginContext.emitTo}. Does not modify core classes — install with `server.use(createPrivateMessagingPlugin())`.
 */
export function createPrivateMessagingPlugin(
  options?: PrivateMessagingPluginOptions,
): WsPlugin {
  const inboundEvent = options?.inboundEvent ?? DEFAULT_INBOUND;
  const denySelf = options?.denySelf ?? true;
  const notifyOffline = options?.notifyOffline ?? true;
  const notifyInvalid = options?.notifyInvalid ?? true;

  return (ctx) => {
    ctx.on(inboundEvent, (sender, data) => {
      if (!sender) {
        return;
      }

      if (!isPrivateSendPayload(data)) {
        if (notifyInvalid) {
          ctx.emit(ERROR_EVENT, sender, { code: "invalid_payload" });
        }
        return;
      }

      if (denySelf && data.to === sender.id) {
        ctx.emit(ERROR_EVENT, sender, { code: "deny_self" });
        return;
      }

      const delivered = ctx.emitTo(data.to, data.event, data.data);
      if (!delivered && notifyOffline) {
        ctx.emit(ERROR_EVENT, sender, { code: "peer_offline", to: data.to });
      }
    });
  };
}

export { ERROR_EVENT as PRIVATE_ERROR_EVENT, DEFAULT_INBOUND as DEFAULT_PRIVATE_SEND_EVENT };
