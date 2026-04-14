/**
 * Inbound wire payload for {@link createPrivateMessagingPlugin} (default event: `private_send`).
 * Client sends one envelope; server delivers `event` + `data` only to the peer with id `to`.
 */
export interface PrivateSendPayload {
  readonly to: string;
  readonly event: string;
  readonly data?: unknown;
}

/** Optional error envelope emitted to the sender when delivery fails or payload is invalid. */
export interface PrivateErrorPayload {
  readonly code: "invalid_payload" | "deny_self" | "peer_offline";
  readonly to?: string;
}

/** Options for {@link createPrivateMessagingPlugin}. */
export interface PrivateMessagingPluginOptions {
  /** Wire event clients use to initiate a DM (default `private_send`). */
  inboundEvent?: string;
  /** Reject `to === sender.id` (default `true`). */
  denySelf?: boolean;
  /** Notify sender with `private_error` when peer is offline (default `true`). */
  notifyOffline?: boolean;
  /** Notify sender on invalid payload (default `true`). */
  notifyInvalid?: boolean;
}
