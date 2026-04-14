/** Wire format for inbound messages from clients. */
export interface IncomingWireMessage {
  readonly event: string;
  readonly data?: unknown;
}

/** Wire format for outbound messages to clients (symmetric with inbound). */
export interface OutgoingWireMessage {
  readonly event: string;
  readonly data?: unknown;
}
