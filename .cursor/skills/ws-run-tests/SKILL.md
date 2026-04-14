---
name: ws-run-tests
description: Runs the ws-framework validation workflow: build checks for all workspace packages, then runtime smoke tests for auth, namespaces, rate limiting, payload limits, heartbeat, and Redis broadcast scaling. Use when the user asks to run tests, verify runtime, validate changes, or mentions /ws-run-tests.
---

# ws-run-tests

## What this skill does

This repo does not currently have Jest-based unit/integration tests. “Run tests” means:

- Build TypeScript for all workspace packages
- Run runtime smoke checks using short-lived Node `ws` clients against `examples/basic-server`
- (Optional) validate Redis adapter behavior using a second server instance

## Preconditions

- Node >= 18
- From `ws-framework/` workspace root

## Commands (always run in this order)

### 1) Build all packages

Run:

```bash
npm run build -w @ws-framework/core
npm run build -w @ws-framework/redis-adapter
```

Success criteria:
- Both commands exit 0
- No TypeScript errors

### 2) Start dependencies (only if Redis adapter is enabled)

If `.env` has `REDIS_URL` or the example enables the Redis adapter, ensure Redis is available.

Typical local dev:

```bash
docker run -p 6380:6379 redis
```

### 3) Start server instance A (port 3000)

Run:

```bash
PORT=3000 npx tsx examples/basic-server/index.ts
```

Keep it running.

### 4) Generate a valid JWT for auth tests

Run:

```bash
node examples/basic-server/generate-token.js
```

Save the token string for the client scripts below.

### 5) Runtime smoke checks (Node ws clients)

Use `node -e` with `ws` to run targeted checks. Use short timeouts and close sockets.

#### 5a) Auth reject (invalid token)

```bash
node -e "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:3000?token=badtoken'); ws.on('open',()=>console.log('opened')); ws.on('close',(c,r)=>console.log('close',c,r.toString()));"
```

Expect: close `1008 Unauthorized`.

#### 5b) Namespaces (chat:message roundtrip)

```bash
node -e "const WebSocket=require('ws'); const token=process.env.TOKEN; const ws=new WebSocket('ws://127.0.0.1:3000?token='+token); ws.on('message',m=>{console.log(m.toString()); ws.close();}); ws.on('open',()=>ws.send(JSON.stringify({event:'chat:message',data:'hello'}))); setTimeout(()=>ws.close(),1500);"
```

Expect: receive a `{\"event\":\"chat:message\", ...}` echo/broadcast.

#### 5c) Rate limit (warn + drop)

```bash
node -e "const WebSocket=require('ws'); const token=process.env.TOKEN; const ws=new WebSocket('ws://127.0.0.1:3000?token='+token); let gotWarn=0, gotMsg=0; ws.on('message',m=>{const s=m.toString(); if(s.includes('rate_limit')) gotWarn++; if(s.includes('chat:message')) gotMsg++;}); ws.on('open',()=>{for(let i=0;i<80;i++){ws.send(JSON.stringify({event:'chat:message',data:'spam '+i}))}}); setTimeout(()=>{console.log('msgs_echoed',gotMsg,'rate_limit_warns',gotWarn); ws.close();},1500);"
```

Expect: some messages echoed, and `rate_limit_warns > 0`.

#### 5d) Payload limit (close 1009)

```bash
node -e "const WebSocket=require('ws'); const token=process.env.TOKEN; const ws=new WebSocket('ws://127.0.0.1:3000?token='+token); ws.on('open',()=>{const big='x'.repeat(70000); ws.send(JSON.stringify({event:'chat:message',data:big}));}); ws.on('close',(c,r)=>console.log('close',c,r.toString()));"
```

Expect: close `1009 Message too large` (when `MAX_PAYLOAD` is set below the payload).

#### 5e) Heartbeat timeout (reliable)

Important: testing heartbeat timeout on `ws://127.0.0.1` by “internet offline” toggles is unreliable because localhost may still respond to ping/pong.

Use one of these approaches:

**Approach A (recommended): non-loopback client**
- Start the server bound on your LAN (or ensure it’s reachable from another device).
- Connect from a phone/laptop on the same network to `ws://<your-machine-ip>:3000?...`.
- Disable that device’s network (airplane mode / Wi-Fi off).
- Expect server-side heartbeat `onTimeout` log and a close after `HEARTBEAT_TIMEOUT_MS` following the next ping tick.

**Approach B: kill client process**
- Run a Node ws client, then kill it abruptly without closing the socket.

```bash
node -e "const WebSocket=require('ws'); const token=process.env.TOKEN; const ws=new WebSocket('ws://127.0.0.1:3000?token='+token); ws.on('open',()=>{console.log('open'); setInterval(()=>{},1000);});" &
```

Then kill the background node process (use `ps`/`kill` locally). Expect the server to eventually close the connection after a missed pong.

### 6) Redis cross-instance broadcast (optional but recommended)

Start server instance B:

```bash
PORT=3001 npx tsx examples/basic-server/index.ts
```

Then run:

```bash
node -e "const WebSocket=require('ws'); const token=process.env.TOKEN; const a=new WebSocket('ws://127.0.0.1:3000?token='+token); const b=new WebSocket('ws://127.0.0.1:3001?token='+token); let gotB=false; b.on('message',m=>{const s=m.toString(); if(s.includes('chat:message')){gotB=true; console.log('B got',s);} }); a.on('open',()=>{setTimeout(()=>{a.send(JSON.stringify({event:'chat:message',data:'cross-instance'}));},200);}); setTimeout(()=>{console.log('cross_instance_received_by_B',gotB); a.close(); b.close();},1500);"
```

Expect: `cross_instance_received_by_B true`.

## Reporting format

When asked to “run tests”, report:

- Build results (core + redis-adapter)
- Runtime smoke checks: pass/fail per scenario with the observed close codes / counters
- Any regressions compared to expected behavior (auth 1008, payload 1009, etc.)

