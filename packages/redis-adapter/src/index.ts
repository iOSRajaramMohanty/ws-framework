import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import type { WsPlugin } from "@ws-framework/core";

export interface RedisAdapterOptions {
  /** Redis connection URL (e.g. `redis://localhost:6379`). */
  url: string;
  /** Pub/sub channel name used for broadcasts. */
  channel?: string;
  /** Optional stable instance id (defaults to random UUID). */
  instanceId?: string;
  /** Optional hook for adapter debug/logging. */
  onDebug?: (msg: string, meta?: Record<string, unknown>) => void;
}

type BroadcastEnvelope = {
  readonly instanceId: string;
  readonly event: string;
  readonly data?: unknown;
};

const DEFAULT_CHANNEL = "ws-framework:broadcast";

function safeParseEnvelope(raw: string): BroadcastEnvelope | undefined {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null || typeof v !== "object") return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o.instanceId !== "string" || o.instanceId.length === 0) return undefined;
    if (typeof o.event !== "string" || o.event.length === 0) return undefined;
    return { instanceId: o.instanceId, event: o.event, data: o.data };
  } catch {
    return undefined;
  }
}

/**
 * Redis pub/sub adapter for horizontal scaling.
 *
 * Behavior:
 * - Local `broadcast()` publishes to Redis and also fans out locally.
 * - All instances subscribe and fan out *locally* for messages from other instances.
 * - Self-published messages are ignored to avoid duplicates.
 */
export function redisAdapter(options: RedisAdapterOptions): WsPlugin {
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const instanceId = options.instanceId ?? randomUUID();
  const debug = options.onDebug;

  return (ctx) => {
    const pub: RedisClientType = createClient({ url: options.url });
    const sub: RedisClientType = createClient({ url: options.url });

    // Best-effort connect: users can observe failures via their own process logs.
    void pub.connect();
    void sub.connect();

    void sub.subscribe(channel, (message) => {
      debug?.("redis:received", { channel });
      const env = safeParseEnvelope(message);
      if (!env) return;
    
      if (env.instanceId === instanceId) return;
    
      ctx.broadcastLocal(env.event, env.data);
    });

    ctx.setBroadcastAdapter((event, data) => {
      debug?.("redis:publish", { channel, event });
      // Fan out locally first for low latency.
      ctx.broadcastLocal(event, data);
    
      const env: BroadcastEnvelope = { instanceId, event, data };
    
      // Publish best-effort; failure should not break local broadcast.
      void pub.publish(channel, JSON.stringify(env));
    });
  };
}

