import { loadConfig, WsServer, type PrivateSendPayload, createRateLimitPlugin, createHeartbeatPlugin } from "../../packages/core/dist/index.js";
import { redisAdapter } from "../../packages/redis-adapter/dist/index.js"; // ✅ ADD THIS
import { createJwtAuthPlugin } from "../../packages/core/dist/auth/jwt-auth-plugin.js";

console.log("🚀 Bootstrapping server...");

const cfg = loadConfig();
console.log("CONFIG:", cfg);

const server = new WsServer({ port: cfg.port, maxPayloadBytes: cfg.maxPayloadBytes });

// ✅ 1. AUTH FIRST
server.use(
  createJwtAuthPlugin({
    secret: "your-secret-key",
  })
);

// ✅ 2. RATE LIMIT
server.use(
  createRateLimitPlugin({
    limit: cfg.rateLimit?.max ?? 20,
    intervalMs: cfg.rateLimit?.intervalMs ?? 1000,
    action: "drop_and_warn",
  })
);

// ✅ 3. HEARTBEAT
server.use(
  createHeartbeatPlugin({
    intervalMs: cfg.heartbeat?.intervalMs ?? 30_000,
    timeoutMs: cfg.heartbeat?.timeoutMs ?? 10_000,
    onPing: (client) => console.log("💓 ping ->", (client as any).user?.id ?? client.id),
    onPong: (client) => console.log("💚 pong <-", (client as any).user?.id ?? client.id),
    onTimeout: (client) => console.log("💀 heartbeat timeout", (client as any).user?.id ?? client.id),
  })
);

// ✅ 4. REDIS (optional)
if (cfg.redisUrl) {
  server.use(
    redisAdapter({
      url: cfg.redisUrl,
    }),
  );
}

// Namespaces isolate handlers by prefixing events internally (e.g. `chat:message`).
const chat = server.of("chat");
const notifications = server.of("notifications");


server.on("listening", (_client, data) => {
  console.log("✅ Server listening:", data);
});

server.on("connection", (client) => {
  if (!client) return;
  console.log("User:", (client as any).user);
  console.log("✅ Client connected:", client.id);
});

server.on("disconnect", (client) => {
  if (!client) return;
  console.log("❌ Client disconnected:", client.id);
});

server.on("test:event", (client, data) => {
  if (!client) return;

  console.log("📩 Received:", data);

  server.broadcast("test:event", {
    message: data,
    from: client.id,
  });
});

server.on("test:private", (client, data) => {
  if (!client) return;

  const payload = data as PrivateSendPayload; // ✅ use existing type

  const { to, event, data: messageData } = payload;

  console.log(`Sending private message to ${to}`);

  server.emitTo(to, event, {
    data: messageData,
    from: client.id,
  });
});

chat.on("message", (client, data) => {
  if (!client) return;
  console.log("💬 chat:message", data);
  chat.broadcast("message", {
    message: data,
    from: client.id,
  });
});


notifications.on("alert", (client, data) => {
  if (!client) return;

  console.log("[notifications] alert:", data);

  notifications.broadcast("alert", data);
});