import type { Client, WsPlugin } from "../types/index.js";

export interface HeartbeatOptions {
  /** Ping interval in ms (default 30000). */
  intervalMs?: number;
  timeoutMs?: number;
  /**
   * Close code used when terminating dead connections (default 1001).
   * (1001 = Going Away; many stacks use 1008 for policy, 1011 for server error.)
   */
  closeCode?: number;
  /** Close reason (default "Heartbeat timeout"). */
  closeReason?: string;
  /** Optional hook invoked right before sending a ping. */
  onPing?: (client: Client) => void;
  /** Optional hook invoked when a pong is received. */
  onPong?: (client: Client) => void;
  /** Optional hook invoked right before closing a dead connection. */
  onTimeout?: (client: Client) => void;
}

type ClientState = {
  alive: boolean;
  timeout?: NodeJS.Timeout;
  onPong: () => void;
};

/**
 * Heartbeat (ping/pong) plugin.
 *
 * - Sends `ping` on an interval.
 * - Expects `pong` (handled by ws client automatically).
 * - If no pong is received by the next tick, the socket is closed.
 *
 * Minimal overhead: O(connected clients) once per interval.
 */
export function createHeartbeatPlugin(options?: HeartbeatOptions): WsPlugin {
  const intervalMs = options?.intervalMs ?? 30_000;
  const timeoutMs = options?.timeoutMs ?? intervalMs; // ✅ ADD
  const closeCode = options?.closeCode ?? 1001;
  const closeReason = options?.closeReason ?? "Heartbeat timeout";
  const onPing = options?.onPing;
  const onPong = options?.onPong;
  const onTimeout = options?.onTimeout;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid heartbeat intervalMs: expected > 0, got ${String(intervalMs)}`);
  }

  return (ctx) => {
    const clients = new Map<string, Client>();
    const stateById = new Map<string, ClientState>();

    const timer = setInterval(() => {
      for (const [id, client] of clients) {
        const st = stateById.get(id);
        if (!st) continue;

        // Send ping
        try {
          onPing?.(client);
          client.socket.ping();
        } catch {
          continue;
        }
    
        st.alive = false;
    
        // ⏱️ Timeout check (safe)
        if (st.timeout) {
          clearTimeout(st.timeout);
        }

        st.timeout = setTimeout(() => {
          const cur = stateById.get(id);
          if (!cur) return;

          if (!cur.alive) {
            onTimeout?.(client);
            client.socket.close(closeCode, closeReason);
          }
        }, timeoutMs);
      }
    }, intervalMs);
    timer.unref?.();

    ctx.hook.connection((client) => {
      clients.set(client.id, client);

      const st: ClientState = {
        alive: true,
        onPong: () => {
          const cur = stateById.get(client.id);
          if (!cur) return;

          cur.alive = true;
          onPong?.(client);

          if (cur.timeout) {
            clearTimeout(cur.timeout);
            cur.timeout = undefined;
          }
        },
      };
      stateById.set(client.id, st);

      // ws emits 'pong' when peer responds to ping.
      client.socket.on("pong", st.onPong);
    });

    ctx.hook.disconnect((client) => {
      clients.delete(client.id);
    
      const st = stateById.get(client.id);
      if (st) {
        client.socket.off("pong", st.onPong);
    
        if (st.timeout) {
          clearTimeout(st.timeout); // ✅ IMPORTANT
        }
    
        stateById.delete(client.id);
      }
    });
  };
}

