import type { WebSocketServer } from "ws";

/** Payload for the framework `listening` event (no client; server is bound). */
export type ListeningEventData = {
  readonly address: ReturnType<WebSocketServer["address"]>;
};
