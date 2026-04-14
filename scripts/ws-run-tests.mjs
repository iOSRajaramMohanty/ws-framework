import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import net from "node:net";

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...options });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function runCapture(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}\n${err}`));
    });
  });
}

async function pickPort(preferred) {
  // Try preferred first; if in use, fall back to ephemeral.
  const tryListen = (p) =>
    new Promise((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(undefined));
      s.listen(p, "127.0.0.1", () => {
        const addr = s.address();
        const chosen = typeof addr === "object" && addr ? addr.port : p;
        s.close(() => resolve(chosen));
      });
    });

  const preferredOk = await tryListen(preferred);
  if (preferredOk) return preferredOk;
  const ephemeral = await tryListen(0);
  if (!ephemeral) throw new Error("Failed to find a free TCP port.");
  return ephemeral;
}

async function startServer(port, env) {
  const p = spawn(
    "npx",
    ["tsx", "examples/basic-server/index.ts"],
    { env: { ...process.env, PORT: String(port), ...env }, stdio: ["ignore", "pipe", "pipe"] },
  );

  let ready = false;
  let exited = false;
  let exitCode = 0;
  const onData = (chunk) => {
    const s = chunk.toString();
    process.stdout.write(s);
    if (s.includes("✅ Server listening")) ready = true;
  };
  p.stdout.on("data", onData);
  p.stderr.on("data", (d) => process.stderr.write(d.toString()));
  p.on("exit", (code) => {
    exited = true;
    exitCode = code ?? 0;
  });

  // Wait up to ~5s for readiness.
  for (let i = 0; i < 50; i++) {
    if (ready) return p;
    if (exited) {
      throw new Error(`Server on port ${port} exited early (${exitCode}).`);
    }
    await sleep(100);
  }
  p.kill("SIGTERM");
  throw new Error(`Server on port ${port} did not become ready.`);
}

async function runNodeWsCheck(name, token, code, portA, portB) {
  process.stdout.write(`\n--- ${name} ---\n`);
  const out = await runCapture("node", ["-e", code], {
    env: { ...process.env, TOKEN: token, PORT_A: String(portA), PORT_B: String(portB ?? "") },
  });
  process.stdout.write(out + "\n");
  return out;
}

function summarize(label, ok, details = "") {
  const status = ok ? "PASS" : "FAIL";
  process.stdout.write(`${status} - ${label}${details ? ` (${details})` : ""}\n`);
  return ok;
}

let serverA;
let serverB;

try {
  // 1) Build
  await run("npm", ["run", "build", "-w", "@ws-framework/core"]);
  await run("npm", ["run", "build", "-w", "@ws-framework/redis-adapter"]);

  // 2) Token
  const token = await runCapture("node", ["examples/basic-server/generate-token.js"]);
  if (!token) throw new Error("Failed to generate JWT token.");

  // 3) Start server A (and B if REDIS_URL exists)
  const hasRedis = Boolean(process.env.REDIS_URL);
  // Always choose ephemeral ports to avoid conflicts with dev servers already running.
  const portA = await pickPort(0);
  const portB = hasRedis ? await pickPort(0) : undefined;

  process.stdout.write(`\nUsing ports: A=${portA}${portB ? ` B=${portB}` : ""}\n`);

  serverA = await startServer(portA);
  if (hasRedis) {
    serverB = await startServer(portB);
  }

  // 4) Checks
  const authReject = await runNodeWsCheck(
    "auth reject",
    token,
    "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:'+process.env.PORT_A+'?token=badtoken'); ws.on('close',(c,r)=>console.log('close',c,r.toString()));",
    portA,
    portB,
  );

  const namespaceRoundtrip = await runNodeWsCheck(
    "namespaces roundtrip",
    token,
    "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:'+process.env.PORT_A+'?token='+process.env.TOKEN); ws.on('message',m=>{console.log(m.toString()); ws.close();}); ws.on('open',()=>setTimeout(()=>ws.send(JSON.stringify({event:'chat:message',data:'hello'})),200)); setTimeout(()=>ws.close(),1500);",
    portA,
    portB,
  );

  const rateLimit = await runNodeWsCheck(
    "rate limit",
    token,
    "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:'+process.env.PORT_A+'?token='+process.env.TOKEN); let gotWarn=0, gotMsg=0; ws.on('message',m=>{const s=m.toString(); if(s.includes('rate_limit')) gotWarn++; if(s.includes('chat:message')) gotMsg++;}); ws.on('open',()=>{for(let i=0;i<80;i++){ws.send(JSON.stringify({event:'chat:message',data:'spam '+i}))}}); setTimeout(()=>{console.log('msgs_echoed',gotMsg,'rate_limit_warns',gotWarn); ws.close();},1500);",
    portA,
    portB,
  );

  const payloadLimit = await runNodeWsCheck(
    "payload limit",
    token,
    "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:'+process.env.PORT_A+'?token='+process.env.TOKEN); ws.on('open',()=>{const big='x'.repeat(70000); ws.send(JSON.stringify({event:'chat:message',data:big}));}); ws.on('close',(c,r)=>console.log('close',c,r.toString()));",
    portA,
    portB,
  );

  let redisScalingOut = "";
  if (hasRedis) {
    redisScalingOut = await runNodeWsCheck(
      "redis cross-instance",
      token,
      "const WebSocket=require('ws'); const a=new WebSocket('ws://127.0.0.1:'+process.env.PORT_A+'?token='+process.env.TOKEN); const b=new WebSocket('ws://127.0.0.1:'+process.env.PORT_B+'?token='+process.env.TOKEN); let got=false; b.on('message',m=>{if(m.toString().includes('chat:message')){got=true; console.log('B got',m.toString());}}); a.on('open',()=>setTimeout(()=>a.send(JSON.stringify({event:'chat:message',data:'cross-instance'})),200)); setTimeout(()=>{console.log('cross_instance_received_by_B',got); a.close(); b.close();},1500);",
      portA,
      portB,
    );
  }

  // 5) Summary
  process.stdout.write("\n=== SUMMARY ===\n");
  const ok1 = summarize("auth reject closes 1008", authReject.includes("close 1008"), authReject);
  const ok2 = summarize("namespaces chat:message returns", namespaceRoundtrip.includes("\"event\":\"chat:message\""));
  const ok3 = summarize("rate limit warns", rateLimit.includes("rate_limit_warns"));
  const ok4 = summarize("payload limit closes 1009", payloadLimit.includes("close 1009"), payloadLimit);
  const ok5 = hasRedis
    ? summarize("redis cross-instance ok", redisScalingOut.includes("cross_instance_received_by_B true"))
    : true;

  const allOk = ok1 && ok2 && ok3 && ok4 && ok5;
  process.stdout.write(allOk ? "\nALL CHECKS PASSED\n" : "\nSOME CHECKS FAILED\n");
  process.exitCode = allOk ? 0 : 1;
} finally {
  if (serverA) serverA.kill("SIGTERM");
  if (serverB) serverB.kill("SIGTERM");
  // Give processes a moment to exit.
  await sleep(250);
}

