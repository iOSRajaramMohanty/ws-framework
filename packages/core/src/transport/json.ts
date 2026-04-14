import type { IncomingWireMessage } from "../types/transport/wire.js";

const NAMESPACE_SEP = ":";
const MAX_EVENT_LENGTH = 128;
const EVENT_RE = /^[a-zA-Z0-9:_\-.]+$/;

function isValidEventName(event: string): boolean {
  if (event.length === 0 || event.length > MAX_EVENT_LENGTH) return false;
  return EVENT_RE.test(event);
}

export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function asIncomingWireMessage(value: unknown): IncomingWireMessage | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.event !== "string" || !isValidEventName(rec.event)) {
    return undefined;
  }

  // Backwards compatible:
  // - Old wire: { event, data }
  // - Namespaced wire: { namespace, event, data } -> event is rewritten to `${namespace}:${event}`
  const ns = rec.namespace;
  if (typeof ns === "string" && ns.trim().length > 0) {
    const namespace = ns.trim();
    if (namespace.includes(NAMESPACE_SEP) || !isValidEventName(namespace)) {
      return undefined;
    }
    return { event: `${namespace}${NAMESPACE_SEP}${rec.event}`, data: rec.data };
  }

  return { event: rec.event, data: rec.data };
}
