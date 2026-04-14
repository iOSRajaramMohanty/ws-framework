import { WebSocket } from "ws";
import type { Client } from "../types/client.js";
import type { IClientRegistry } from "../types/contracts.js";
import type { WsLogger } from "../types/logger.js";
import type { OutgoingWireMessage } from "../types/transport/wire.js";

type ResolvedLogger = Required<WsLogger>;

/** Encodes outbound JSON envelopes and sends on the wire — single place for serialization policy. */
export class WireEnvelopeSender {
  constructor(private readonly log: ResolvedLogger) {}

  send(client: Client, envelope: OutgoingWireMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    let payload: string;
    try {
      payload = JSON.stringify(envelope);
    } catch (err) {
      this.log.error("Failed to serialize outbound message", { clientId: client.id, err });
      return;
    }
    try {
      client.socket.send(payload);
    } catch (err) {
      this.log.warn("Failed to send to client", { clientId: client.id, err });
    }
  }

  broadcast(registry: IClientRegistry, envelope: OutgoingWireMessage): void {
    for (const client of registry.values()) {
      this.send(client, envelope);
    }
  }
}
