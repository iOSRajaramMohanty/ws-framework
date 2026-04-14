import type { Client, WsPlugin } from "../types/index.js";

export type RateLimitAction = "drop" | "warn" | "drop_and_warn";

export interface RateLimitOptions {
  /** Max messages per client per interval (default 20). */
  limit?: number;
  /** Interval length in ms (default 1000). */
  intervalMs?: number;
  /** What to do when exceeded (default "drop"). */
  action?: RateLimitAction;
  /** Event emitted to the client when action includes "warn" (default "rate_limit"). */
  warnEvent?: string;
  /**
   * Idle TTL for rate limit state cleanup (default: 5 * intervalMs).
   * Buckets not seen within this duration are removed.
   */
  idleTtlMs?: number;
  /**
   * Sweep interval for cleanup (default: intervalMs). Set to 0 to disable periodic sweeping.
   * Sweeping is a safeguard in case disconnect cleanup is missed.
   */
  sweepIntervalMs?: number;
}

type Bucket = {
  /** Current token count (fractional). */
  count: number;
  /** Last refill timestamp. */
  resetTime: number;
  /** Last time this client was seen. */
  lastSeenMs: number;
};

function nowMs(): number {
  return Date.now();
}

/**
 * In-memory per-client rate limiting implemented as a plugin message hook.
 * O(1) overhead per message; auto-cleanup on disconnect.
 */
export function createRateLimitPlugin(options?: RateLimitOptions): WsPlugin {
  const limit = options?.limit ?? 20;
  const intervalMs = options?.intervalMs ?? 1000;
  const action: RateLimitAction = options?.action ?? "drop";
  const warnEvent = options?.warnEvent ?? "rate_limit";
  const idleTtlMs = options?.idleTtlMs ?? intervalMs * 5;
  const sweepIntervalMs = options?.sweepIntervalMs ?? intervalMs;

  const buckets = new Map<string, Bucket>();
  const capacity = limit;
  // const refillPerMs = capacity / intervalMs;

  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new Error(`Invalid rate limit 'limit': expected > 0, got ${String(limit)}`);
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid rate limit 'intervalMs': expected > 0, got ${String(intervalMs)}`);
  }

  function take(client: Client): { allowed: boolean; remaining: number } {
    const t = nowMs();
    const id = client.id;
  
    let b = buckets.get(id);
  
    if (!b) {
      b = {
        count: 0,
        resetTime: t + intervalMs,
        lastSeenMs: t,
      };
      buckets.set(id, b);
    }
  
    b.lastSeenMs = t;
  
    // 🔁 Reset window
    if (t > b.resetTime) {
      b.count = 0;
      b.resetTime = t + intervalMs;
    }
  
    // 🚨 STRICT LIMIT
    if (b.count >= limit) {
      return { allowed: false, remaining: 0 };
    }
  
    b.count++;
  
    return { allowed: true, remaining: limit - b.count };
  }

  return (ctx) => {
    ctx.hook.disconnect((client) => {
      buckets.delete(client.id);
    });

    if (sweepIntervalMs > 0) {
      const timer = setInterval(() => {
        const cutoff = nowMs() - idleTtlMs;
        for (const [id, b] of buckets) {
          if (b.lastSeenMs < cutoff) {
            buckets.delete(id);
          }
        }
      }, sweepIntervalMs);
      // Don't keep the process alive just for sweeping.
      timer.unref?.();
    }

    ctx.hook.message((client, _event, _data) => {
      const { allowed, remaining } = take(client);
    
      if (allowed) {
        return true; // ✅ explicitly allow
      }
    
      if (action === "warn" || action === "drop_and_warn") {
        ctx.emit(warnEvent, client, {
          code: "rate_limited",
          limit,
          intervalMs,
          remaining,
        });
      }
    
      if (action === "drop" || action === "drop_and_warn") {
        console.log("⚠️ Rate limit exceeded:", client.id);
        return false; // ✅ block
      }
    
      return true; // fallback (for safety)
    });
  };
}

