import { config as dotenvConfig } from "dotenv";

export interface WsFrameworkConfig {
  readonly port: number;
  /** Optional: used by @ws-framework/redis-adapter (pub/sub scaling). */
  readonly redisUrl?: string;
  /** Optional: recommended to pass into `new WsServer({ maxPayloadBytes })`. */
  readonly maxPayloadBytes?: number;
  /** Optional: used by createRateLimitPlugin (inbound rate limiting). */
  readonly rateLimit?: {
    readonly max: number;
    readonly intervalMs: number;
  };
  /** Optional: used by createHeartbeatPlugin (ping/pong dead connection detection). */
  readonly heartbeat?: {
    readonly intervalMs: number;
    readonly timeoutMs: number;
  };
}

let loaded = false;

function loadDotEnvOnce(): void {
  if (loaded) return;
  dotenvConfig();
  loaded = true;
}

function parsePort(value: string | undefined): number {
  if (!value || value.trim().length === 0) return 3000;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid PORT: expected integer 1..65535, got '${value}'.`);
  }
  return n;
}

function parsePositiveInt(name: string, value: string | undefined): number | undefined {
  if (!value || value.trim().length === 0) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: expected positive integer, got '${value}'.`);
  }
  return n;
}

function parseRateLimitSpec(raw: string | undefined): { max: number; intervalMs: number } | undefined {
  if (!raw || raw.trim().length === 0) return undefined;
  const v = raw.trim();
  const m = v.match(/^(\d+)\s*[:/]\s*(\d+)$/);
  if (!m) {
    throw new Error(`Invalid RATE_LIMIT: expected '<max>/<intervalMs>' (e.g. '20/1000'), got '${raw}'.`);
  }
  const max = Number(m[1]);
  const intervalMs = Number(m[2]);
  if (!Number.isInteger(max) || max <= 0 || !Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid RATE_LIMIT: expected positive integers, got '${raw}'.`);
  }
  return { max, intervalMs };
}

/**
 * Loads config from `.env` + `process.env`.
 * Throws on invalid values (fail fast).
 */
export function loadConfig(): WsFrameworkConfig {
  loadDotEnvOnce();
  const port = parsePort(process.env.PORT);
  const redisUrl = process.env.REDIS_URL?.trim();
  const maxPayloadBytes = parsePositiveInt(
    "MAX_PAYLOAD",
    process.env.MAX_PAYLOAD ?? process.env.MAX_PAYLOAD_BYTES,
  );

  const rateLimit =
    parseRateLimitSpec(process.env.RATE_LIMIT) ??
    (() => {
      const rateLimitMax = parsePositiveInt("RATE_LIMIT_MAX", process.env.RATE_LIMIT_MAX);
      const rateLimitIntervalMs = parsePositiveInt(
        "RATE_LIMIT_INTERVAL_MS",
        process.env.RATE_LIMIT_INTERVAL_MS,
      );
      return rateLimitMax && rateLimitIntervalMs
        ? { max: rateLimitMax, intervalMs: rateLimitIntervalMs }
        : undefined;
    })();

  const heartbeatIntervalMs = parsePositiveInt(
    "HEARTBEAT_INTERVAL",
    process.env.HEARTBEAT_INTERVAL ?? process.env.HEARTBEAT_INTERVAL_MS,
  );
  const heartbeatTimeoutMs = parsePositiveInt(
    "HEARTBEAT_TIMEOUT_MS",
    process.env.HEARTBEAT_TIMEOUT_MS,
  );
  const heartbeat =
    heartbeatIntervalMs && heartbeatTimeoutMs
      ? { intervalMs: heartbeatIntervalMs, timeoutMs: heartbeatTimeoutMs }
      : undefined;
  return {
    port,
    redisUrl: redisUrl && redisUrl.length > 0 ? redisUrl : undefined,
    maxPayloadBytes,
    rateLimit,
    heartbeat,
  };
}

