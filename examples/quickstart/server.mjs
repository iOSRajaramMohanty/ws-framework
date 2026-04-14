/**
 * Minimal demo server for the root `npm run quickstart` script.
 * Imports the built core package from the monorepo.
 */
import { WsServer } from "../../packages/core/dist/index.js";

const port = Number(process.env.PORT) || 8080;

const server = new WsServer({ port });

server.on("ping", (client, data) => {
  server.emit("pong", client, { received: data, ts: Date.now() });
});

server.on("echo", (client, data) => {
  server.emit("echo", client, data);
});

// Quickstart is allowed to log to the terminal
console.log(`Quick start server → ws://localhost:${port}`);
console.log(`Test with: npx wscat -c ws://localhost:${port}`);
console.log(`Send one line: {"event":"ping","data":{"msg":"hello"}}`);
