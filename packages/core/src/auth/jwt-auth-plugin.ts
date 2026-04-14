import type { Client, WsPlugin } from "../types/index.js";
import { jwtVerify } from "jose";

export type AuthMode = "reject" | "block";

export interface JwtAuthPluginOptions<User = unknown> {
  /**
   * Secret for HS256 verification.
   * (For asymmetric JWTs, this plugin can be extended later to accept KeyLike / JWKS.)
   */
  secret: string;

  /** Reject connection (default) or block unauthenticated messages. */
  mode?: AuthMode;

  /** Query parameter names checked for the token (default: ["token", "auth", "jwt"]). */
  queryParams?: readonly string[];

  /** Header checked for bearer token (default: "authorization"). */
  headerName?: string;

  /** Event emitted to the client on auth failure in `block` mode (default: "auth:error"). */
  errorEvent?: string;

  /**
   * Convert verified JWT payload into a user object to attach to the client.
   * Defaults to attaching the raw payload.
   */
  toUser?: (payload: unknown) => User;

  /** Expected issuer claim. */
  issuer?: string | string[];
  /** Expected audience claim. */
  audience?: string | string[];
  /** Clock tolerance in seconds. */
  clockTolerance?: string | number;
  /** Restrict allowed algorithms (default: ["HS256"]). */
  algorithms?: readonly string[];
}

export type AuthenticatedClient<User = unknown> = Client & { user: User };

function getTokenFromQuery(url: string | undefined, keys: readonly string[]): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, "http://localhost");
    for (const key of keys) {
      const v = u.searchParams.get(key);
      if (v && v.trim().length > 0) return v.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function getBearerFromHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const m = raw.match(/^\s*Bearer\s+(.+)\s*$/i);
  return m?.[1]?.trim();
}

/**
 * JWT authentication plugin.
 *
 * Extraction:
 * - Query param (e.g. `ws://host?token=...`) OR
 * - `Authorization: Bearer <token>` header from the upgrade request
 *
 * Attaches `client.user` on success.
 */
export function createJwtAuthPlugin<User = unknown>(
  options: JwtAuthPluginOptions<User>,
): WsPlugin {
  const mode: AuthMode = options.mode ?? "reject";
  const queryParams = options.queryParams ?? ["token", "auth", "jwt"];
  const headerName = (options.headerName ?? "authorization").toLowerCase();
  const errorEvent = options.errorEvent ?? "auth:error";
  const toUser = options.toUser ?? ((p) => p as User);

  const authed = new WeakSet<Client>();
  const key = new TextEncoder().encode(options.secret);
  const algorithms = options.algorithms ?? ["HS256"];

  async function authenticate(client: Client): Promise<boolean> {
    const req = client.request;
    const tokenFromQuery = getTokenFromQuery(req?.url, queryParams);
    const tokenFromHeader = getBearerFromHeader(req?.headers?.[headerName]);
    const token = tokenFromQuery ?? tokenFromHeader;
    if (!token) return false;

    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [...algorithms],
        issuer: options.issuer,
        audience: options.audience,
        clockTolerance: options.clockTolerance,
      });
      (client as AuthenticatedClient<User>).user = toUser(payload);
      authed.add(client);
      return true;
    } catch {
      return false;
    }
  }

  return (ctx) => {
    ctx.hook.preConnection(async (client) => {
      const ok = await authenticate(client);
      if (!ok && mode === "reject") {
        // 1008: Policy Violation (commonly used for auth failures)
        client.socket.close(1008, "Unauthorized");
      }
    });

    if (mode === "block") {
      ctx.hook.message(async (client, _event, _data) => {
        if (authed.has(client)) return;
        const ok = await authenticate(client);
        if (!ok) {
          ctx.emit(errorEvent, client, { code: "unauthorized" });
        }
      });
    }
  };
}

