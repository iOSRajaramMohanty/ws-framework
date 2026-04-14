/**
 * Example chat room: join with a nickname, broadcast messages, presence on join/leave.
 * Serves a small web UI from ./public and attaches WebSocket to the same HTTP server.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WsServer } from "../../packages/core/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const port = Number(process.env.PORT) || 3000;

/** @type {Map<string, { nickname: string }>} */
const sessions = new Map();

function sanitizeNickname(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim().slice(0, 32);
  if (s.length === 0) {
    return null;
  }
  return s;
}

function sanitizeText(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim().slice(0, 2000);
  if (s.length === 0) {
    return null;
  }
  return s;
}

function otherNicknames(excludeId) {
  const list = [];
  for (const [id, v] of sessions) {
    if (id !== excludeId) {
      list.push(v.nickname);
    }
  }
  return list;
}

const httpServer = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  const url = req.url?.split("?")[0] ?? "/";
  if (url === "/" || url === "/index.html") {
    const file = path.join(publicDir, "index.html");
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.statusCode = 500;
        res.end("Server error");
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(buf);
    });
    return;
  }
  res.statusCode = 404;
  res.end("Not found");
});

const chat = new WsServer({ server: httpServer });

chat.on("chat_join", (client, data) => {
  if (!client) {
    return;
  }
  if (sessions.has(client.id)) {
    chat.emit("chat_error", client, { code: "already_joined", message: "Already in the room" });
    return;
  }
  const nickname = sanitizeNickname(
    data && typeof data === "object" && data !== null && "nickname" in data
      ? /** @type {{ nickname?: unknown }} */ (data).nickname
      : undefined,
  );
  if (!nickname) {
    chat.emit("chat_error", client, { code: "bad_nickname", message: "Provide a nickname (1–32 chars)" });
    return;
  }
  sessions.set(client.id, { nickname });
  chat.emit("chat_welcome", client, {
    nickname,
    online: otherNicknames(client.id),
  });
  chat.broadcast("chat_presence", { kind: "joined", nickname });
});

chat.on("chat_message", (client, data) => {
  if (!client) {
    return;
  }
  const session = sessions.get(client.id);
  if (!session) {
    chat.emit("chat_error", client, { code: "not_joined", message: 'Send chat_join with a nickname first' });
    return;
  }
  const text = sanitizeText(
    data && typeof data === "object" && data !== null && "text" in data
      ? /** @type {{ text?: unknown }} */ (data).text
      : undefined,
  );
  if (!text) {
    chat.emit("chat_error", client, { code: "bad_message", message: "Message must be non-empty text" });
    return;
  }
  chat.broadcast("chat_message", {
    from: session.nickname,
    text,
    at: new Date().toISOString(),
  });
});

chat.on("disconnect", (client) => {
  if (!client) {
    return;
  }
  const session = sessions.get(client.id);
  if (!session) {
    return;
  }
  sessions.delete(client.id);
  chat.broadcast("chat_presence", { kind: "left", nickname: session.nickname });
});

httpServer.listen(port, () => {
  console.log(`Chat demo → http://localhost:${port}`);
  console.log(`WebSocket on the same port (open the page in two browsers).`);
});
