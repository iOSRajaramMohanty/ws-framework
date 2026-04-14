import type { RawData } from "ws";
import type { IncomingWireMessage } from "../types/transport/wire.js";
import { asIncomingWireMessage, safeJsonParse } from "./json.js";
import { rawDataByteLength, rawDataToString } from "./raw-data.js";

export type InboundDecodeResult =
  | { readonly ok: true; readonly message: IncomingWireMessage }
  | { readonly ok: false; readonly reason?: "too_large" };

/** Decode one WebSocket text/binary frame into a validated inbound wire message. */
export function decodeInboundFrame(raw: RawData, maxPayloadBytes?: number): InboundDecodeResult {
  if (typeof maxPayloadBytes === "number" && maxPayloadBytes > 0) {
    const len = rawDataByteLength(raw);
    if (len > maxPayloadBytes) {
      return { ok: false, reason: "too_large" };
    }
  }
  const text = rawDataToString(raw);
  const parsed = safeJsonParse(text);
  const msg = asIncomingWireMessage(parsed);
  if (!msg) {
    return { ok: false };
  }
  return { ok: true, message: msg };
}
