# WebSocket Framework

<p align="center">
  <strong>Composable real-time for Node.js — own your stack, scale your way.</strong>
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node 18+" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

**A modular WebSocket toolkit** for teams that want Socket.IO-style ergonomics without a monolithic runtime. It is **TypeScript-first**, **self-hosted**, and **built to extend**: plugins for features, middleware for cross-cutting logic, and adapters when one process is not enough.

---

## Why this project?

| If you care about… | This project aims to… |
|--------------------|------------------------|
| **Control** | Run on your servers, behind your load balancers, with your observability stack — no required vendor cloud. |
| **Growth** | Start with a lean core; add **rooms**, **auth**, **rate limits**, and **Redis-backed broadcast** as separate packages, not forks. |
| **Clarity** | Keep **transport and routing** in core; push opinions into **plugins** and **middleware** you can swap or share. |

The goal is simple: **a small core you can reason about**, and **extension points that stay stable** as your traffic and team grow.

---

## Scalability

Real-time systems rarely stop at one machine. This framework is structured so you can evolve in stages:

1. **Single process** — `WsServer` handles connections, JSON event routing, and in-memory `broadcast` (where you are today with `@ws-framework/core`).
2. **Vertical headroom** — Pluggable logging, clear boundaries, and no `console.log` in core make it easier to profile and harden under load.
3. **Horizontal scale (roadmap)** — **Adapters** (e.g. Redis pub/sub) let every node publish and subscribe so `broadcast` and room semantics can span instances without duplicating business logic in each service.
4. **Production hardening (roadmap)** — Rate limiting, JWT hooks, metrics, and health checks fit as **middleware** and **plugins**, not patches to the engine.

You choose when to adopt each layer. Nothing forces you onto a hosted platform or a single deployment model.

---

## Extensibility

**Extension is a first-class design constraint**, not an afterthought:

- **Plugins** — Register behavior with `server.use(plugin)` so features (rooms, tenancy, custom protocols) ship as **modules**, not edits to `WsServer`.
- **Middleware** — Express-style `(client, data, next)` pipelines run **before** event handlers: validation, auth context, tracing, and error boundaries.
- **Packages** — The repo is a **monorepo** so `core` stays minimal; adapters and optional integrations can live in their own packages with **lean installs** for consumers.

> **Today:** the **core server**, **event API**, and **broadcast** are implemented.  
> **Next:** middleware pipeline, then adapters — see [Roadmap](#roadmap).

---

## Features at a glance

| | |
|---|--|
| **Lean core** | `WsServer` on [`ws`](https://github.com/websockets/ws), typed clients, `{ event, data }` JSON envelopes |
| **Composable** | Plugins + middleware (planned) keep domain logic out of the engine |
| **Scale-ready** | Adapter-shaped design for multi-node pub/sub when you need it |
| **Operator-friendly** | Injected logger; path to metrics, auth, and limits without rewriting core |
| **OSS-friendly** | MIT, clear module layout, room for community-owned plugins and adapters |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Your application                         │
│  (HTTP, auth, domain logic, metrics, tracing)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  WsServer (core)                                             │
│  Client registry · event bus · emit / broadcast · logger    │
└───────────┬─────────────────────────────┬──────────────────┘
            │                             │
            ▼                             ▼
   ┌────────────────┐            ┌──────────────────┐
   │ Plugins        │            │ Adapters         │
   │ features, hooks│            │ Redis / Kafka …  │
   └────────────────┘            └──────────────────┘
```

- **Core** = transport + addressing + one consistent wire format.
- **Plugins** = optional capabilities, maintained independently.
- **Adapters** = shared infrastructure when you scale beyond one Node process.

### Deployment topology (scaled-out)

Typical path when you run **multiple WebSocket processes** and sync **broadcast** (or rooms) through **Redis** — connections stay on the node that accepted them; pub/sub shares events across nodes.

```text
                    ┌─────────────────┐
                    │     Client      │
                    │  (browser/app)  │
                    └────────┬────────┘
                             │ WebSocket
                             ▼
                    ┌─────────────────┐
                    │ Load balancer   │
                    │ (L7 sticky or   │
                    │  IP hash, etc.) │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌────────────┐    ┌────────────┐    ┌────────────┐
    │ WS server  │    │ WS server  │    │ WS server  │
    │  Node A    │    │  Node B    │    │  Node C    │
    └──────┬─────┘    └──────┬─────┘    └──────┬─────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │ pub/sub (adapter)
                             ▼
                    ┌─────────────────┐
                    │     Redis       │
                    │  (shared state, │
                    │   fan-out)      │
                    └─────────────────┘
```

---

## Installation

**Requirements:** Node.js **18+**, npm 7+ (workspaces) or pnpm/yarn.

```bash
git clone https://github.com/your-org/ws-framework.git
cd ws-framework
npm install
npm run build
```

**Consume from this monorepo** (npm workspaces):

```json
{
  "dependencies": {
    "@ws-framework/core": "workspace:*"
  }
}
```

**Or from npm** (once published):

```bash
npm install @ws-framework/core
```

---

## Quick start (under 5 minutes)

Run a real WebSocket server from this repo with four steps.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) **18+**
- [Git](https://git-scm.com/)

### 2. Clone and install

```bash
git clone https://github.com/your-org/ws-framework.git
cd ws-framework
npm install
```

### 3. Build and run the demo

```bash
npm run quickstart
```

This builds `@ws-framework/core` and starts `examples/quickstart/server.mjs` on **port 8080** (override with `PORT=3000` if you like). You should see a line like:

```text
Quick start server → ws://localhost:8080
```

### 4. Send a test message (optional)

In a **second terminal**, use [wscat](https://www.npmjs.com/package/wscat) to open a client:

```bash
npx wscat -c ws://localhost:8080
```

Paste **one line** at the `>` prompt and press Enter:

```json
{"event":"ping","data":{"msg":"hello"}}
```

The demo replies with a **`pong`** event echoing your payload and a timestamp. You can also send `{"event":"echo","data":{...}}` for a simple echo.

---

### Wire format

All messages are **JSON text** frames:

| Direction | Shape |
|-----------|--------|
| Client → server | `{ "event": "<name>", "data": <any> }` |
| Server → client | `{ "event": "<name>", "data": <any> }` |

**Reserved wire names:** `connection`, `disconnect`, and `listening` are ignored if sent from clients (they are emitted only by the framework).

**Framework events** (subscribe with `server.on(...)`): `connection` (new `Client`), `disconnect` (socket closed), `listening` (server bound; `data` includes `address`). Application handlers receive a defined `client` except for `listening`, where `client` is `undefined`.

---

### Use in your own project (TypeScript)

```typescript
import { WsServer } from "@ws-framework/core";

const server = new WsServer({ port: 8080 });

server.on("hello", (client, data) => {
  server.emit("hello", client, { echoed: data });
});

server.on("broadcast-demo", (_client, data) => {
  server.broadcast("announcement", data);
});

// Optional: inject a logger (core does not use console by default)
new WsServer({
  port: 8080,
  logger: {
    error: (msg, meta) => console.error(msg, meta),
    warn: (msg, meta) => console.warn(msg, meta),
  },
});
```

---

## Example: chat room

A small **multi-user chat** ships with the repo: HTTP serves a browser UI on the same port as the WebSocket, and the server uses **`on`**, **`broadcast`**, and **`on("disconnect", …)`** for join, messages, and leave notifications.

### Run it

```bash
npm install
npm run example:chat
```

Open **http://localhost:3000** (or set `PORT`). Enter a nickname and join. Open the same URL in **another browser or tab**, join with a different name, and send messages — everyone receives **`chat_message`** events. Closing a tab broadcasts a **`chat_presence`** “left” event to the room.

### What it demonstrates

| Piece | Role |
|--------|------|
| **`http.Server` + `WsServer({ server })`** | One process; WebSocket upgrades share the HTTP port (typical production pattern). |
| **`chat_join` / `chat_message`** | App events over the `{ event, data }` wire format. |
| **`broadcast`** | Fan-out chat lines and presence to every connected client. |
| **`on("disconnect", …)`** | Clean up session state and notify others when a socket closes. |

### Source layout

```text
examples/chat/
├── server.mjs          # HTTP static file + chat handlers
└── public/
    └── index.html      # Minimal client (vanilla JS + WebSocket)
```

This example is intentionally small — no database, no auth — so you can read it in one sitting and adapt it to your stack.

---

## Repository layout

```text
ws-framework/
├── package.json                 # Workspace root (`npm run quickstart`, `npm run example:chat`)
├── examples/
│   ├── quickstart/
│   │   └── server.mjs           # Ping/pong CLI demo
│   └── chat/
│       ├── server.mjs           # Chat + static UI
│       └── public/index.html
├── packages/
│   └── core/
│       ├── package.json         # @ws-framework/core
│       └── src/
│           ├── index.ts         # Public exports
│           ├── server/          # WsServer orchestration, registry, dispatcher
│           ├── transport/       # Wire decode/encode, raw frames, JSON envelopes
│           ├── plugins/         # PluginLifecycleCoordinator
│           ├── messaging/       # Private messaging plugin (createPrivateMessagingPlugin)
│           ├── types/           # Grouped: client, contracts, events/, plugin/, transport/, messaging/, framework/
│           └── utils/           # Logger resolver
└── README.md
```

Future packages (e.g. `adapter-redis`, shared middleware) can sit under `packages/` without inflating the default bundle.

---

## Plugin system

Plugins are functions that receive a **`WsPluginContext`**: **`on`**, **`emit`**, **`emitTo`**, **`broadcast`**, nested **`use`**, and **`hook`** for lifecycle. Core `WsServer` code paths are fixed — plugins only register callbacks.

**`WsServer`** also exposes **`emitTo(targetClientId, event, data)`** (returns whether the peer was online) for the same one-to-one send path plugins use.

**Lifecycle hooks** (run **before** the matching framework / app dispatch, in registration order):

1. **`hook.connection`** — after the client is in the registry, before the framework `connection` event.
2. **`hook.disconnect`** — before the framework `disconnect` event and before the client is removed.
3. **`hook.message`** — after a wire message is decoded (non-reserved), before `on("<event>", …)` handlers.

**Order:** `use(A)` runs before `use(B)`; within each plugin, `hook.connection(fn1)` before `hook.connection(fn2)`; nested `use` registers hooks in the order those plugins run.

```typescript
import { WsServer, type WsPlugin } from "@ws-framework/core";

const pingPlugin: WsPlugin = (ctx) => {
  ctx.hook.connection((client) => {
    console.debug("plugin saw connection", client.id);
  });
  ctx.on("ping", (client, data) => {
    if (!client) return;
    ctx.emit("pong", client, { received: data });
  });
};

const server = new WsServer({ port: 8080 }).use(pingPlugin);
```

**Design goals:** composable registration, stable `WsPluginContext` + `PluginHookRegistry`, domain logic stays out of transport internals.

### Private messaging (plugin)

Use **`createPrivateMessagingPlugin()`** so clients send a single envelope on the wire event **`private_send`** (configurable) with payload **`{ to, event, data? }`**. The server delivers **`event` / `data`** only to the peer with id **`to`**. The sender may receive **`private_error`** with **`{ code: "invalid_payload" | "deny_self" | "peer_offline", to? }`** when validation fails or the peer is offline (both behaviors are configurable).

```typescript
import { WsServer, createPrivateMessagingPlugin } from "@ws-framework/core";

const server = new WsServer({ port: 8080 }).use(createPrivateMessagingPlugin());
```

---

## Namespaces

Namespaces let you isolate event handling by **prefixing** events internally while keeping the wire format backwards compatible.

- **Server API**: `server.of("chat")`
- **Handlers**: `namespace.on("message", ...)` registers for `chat:message`
- **Wire options**:
  - Send a prefixed event directly: `{ "event": "chat:message", "data": ... }`
  - Or send `{ "namespace": "chat", "event": "message", "data": ... }` (the decoder rewrites it to `chat:message`)

```typescript
import { WsServer } from "@ws-framework/core";

const server = new WsServer({ port: 8080 });
const chat = server.of("chat");

chat.on("message", (client, data) => {
  if (!client) return;
  chat.broadcast("message", { from: client.id, text: data });
});
```

---

## Redis adapter (horizontal scaling)

Use Redis pub/sub to sync `broadcast()` across multiple Node processes.

```typescript
import { WsServer } from "@ws-framework/core";
import { redisAdapter } from "@ws-framework/redis-adapter";

const server = new WsServer({ port: 8080 }).use(
  redisAdapter({ url: "redis://localhost:6379" }),
);
```

**Behavior**
- Local `broadcast()` publishes to Redis and also fans out locally.
- All instances subscribe and fan out locally for messages from other instances.
- Self-published messages are ignored to avoid duplicates.

---

## JWT auth (plugin)

Use `createJwtAuthPlugin` to authenticate connections using a JWT from either:
- Query params (e.g. `ws://host:8080?token=...`)
- Upgrade headers (`Authorization: Bearer ...`)

```typescript
import { WsServer, createJwtAuthPlugin } from "@ws-framework/core";

const server = new WsServer({ port: 8080 }).use(
  createJwtAuthPlugin({
    secret: process.env.JWT_SECRET ?? "dev-secret",
    mode: "reject", // or "block"
    // issuer: "your-issuer",
    // audience: "your-audience",
  }),
);
```

On success, the plugin attaches `client.user` (defaults to the verified JWT payload).

---

## Rate limiting (plugin)

Limit inbound messages per client (in-memory, per process). This is designed to be **extendable** later (e.g. Redis-backed counters).

```typescript
import { WsServer, createRateLimitPlugin } from "@ws-framework/core";

const server = new WsServer({ port: 8080 }).use(
  createRateLimitPlugin({
    limit: 20,
    intervalMs: 1000,
    action: "drop_and_warn", // "drop" | "warn" | "drop_and_warn"
    warnEvent: "rate_limit",
  }),
);
```

---

## Heartbeat (plugin)

Detect dead connections using a ping/pong heartbeat and close inactive sockets automatically.

```typescript
import { WsServer, createHeartbeatPlugin } from "@ws-framework/core";

const server = new WsServer({ port: 8080 }).use(
  createHeartbeatPlugin({ intervalMs: 30_000 }),
);
```

---

## Production hardening knobs (env)

`loadConfig()` supports these environment variables (aliases included):

- **`MAX_PAYLOAD`** (bytes): max inbound payload size (close 1009). Alias: `MAX_PAYLOAD_BYTES`.
- **`HEARTBEAT_INTERVAL`** (ms): alias for `HEARTBEAT_INTERVAL_MS`.
- **`RATE_LIMIT`**: `<max>/<intervalMs>` (e.g. `20/1000`). Or use `RATE_LIMIT_MAX` + `RATE_LIMIT_INTERVAL_MS`.

Pass `cfg.maxPayloadBytes` into `WsServer`:

```typescript
import { loadConfig, WsServer } from "@ws-framework/core";

const cfg = loadConfig();
const server = new WsServer({ port: cfg.port, maxPayloadBytes: cfg.maxPayloadBytes });
```

---

## Middleware (planned API)

Middleware mirrors familiar **Express-style** chaining — async-friendly, ordered, and ideal for auth and validation:

```typescript
// Illustrative — not yet in core
server.useMiddleware(async (client, data, next) => {
  await next();
});
```

**Design goals:** run before `on(event, …)` handlers; centralized error handling; compose with plugins.

---

## Roadmap

| Phase | Focus |
|-------|--------|
| **MVP** | Core server, lifecycle, event bus, broadcast, TypeScript · **plugins (`use`)** · **middleware API** |
| **Real-time** | Rooms, targeted emit, namespaces, validation hooks |
| **Scaling** | Redis (or similar) adapter, pub/sub, multi-node broadcast, sticky sessions where needed |
| **Production** | Rate limiting, JWT, structured logging, metrics, health checks |
| **DX** | CLI, config presets, examples |
| **Advanced** | Multi-tenant patterns, ops dashboards, Kubernetes-oriented docs |

**Current status:** core + monorepo layout are in place; plugin/middleware/adapter work tracks the rows above.

---

## Contributing

We **want** your ideas, plugins, docs, and bug reports. This is a **community-shaped** project: the core should stay small; the ecosystem can grow around it.

**How to help**

1. **Star & watch** the repo if this matches how you build real-time systems.
2. **Open an issue** for bugs, design questions, or adapter proposals — especially before large API changes.
3. **Submit PRs** from a fork; use branches like `feat/…` or `fix/…`.
4. **Keep changes focused** and match the existing layout (`server` / `types` / `utils`).
5. Run **`npm run build`** at the repo root before opening a PR.

**Good first contributions:** documentation, examples, tests, typings, and small fixes. **Larger work** (plugins API, Redis adapter): discuss in an issue first so we align on interfaces.

Please follow the [Contributor Covenant](https://www.contributor-covenant.org/) spirit: be respectful, assume good intent, and disagree on technical merit.

---

## License

MIT — see below. Replace the copyright line with your name or organization when you ship a fork or published package.

For GitHub’s license badge and API, add a `LICENSE` file at the repo root with the same text.

```
MIT License

Copyright (c) ws-framework contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Tip: add a root `LICENSE` file with the same text so GitHub can detect it automatically.
