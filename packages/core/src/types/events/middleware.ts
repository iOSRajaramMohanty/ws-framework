import type { Client } from "../client.js";

/**
 * Context passed to middleware (future pipeline) — event name and payload after JSON decode.
 * Handlers can attach metadata on `state` for downstream middleware.
 */
export interface MiddlewareContext {
  readonly client: Client | undefined;
  readonly event: string;
  readonly data: unknown;
  /** Shared bag for middleware; not serialized over the wire. */
  readonly state: Record<string, unknown>;
}

export type NextMiddleware = () => void | Promise<void>;

/**
 * Express-style middleware signature (reserved for a future `useMiddleware` API).
 */
export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: NextMiddleware,
) => void | Promise<void>;
