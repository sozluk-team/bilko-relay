import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import axios from "axios";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT ?? "31312", 10);
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const RELAY_TOKEN = process.env.RELAY_TOKEN;

if (!DISCORD_WEBHOOK_URL) {
  throw new Error("Missing required environment variable: DISCORD_WEBHOOK_URL");
}

if (!RELAY_TOKEN) {
  throw new Error("Missing required environment variable: RELAY_TOKEN");
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid integer between 1 and 65535");
}

let webhookUrl;

try {
  webhookUrl = new URL(DISCORD_WEBHOOK_URL);
} catch {
  throw new Error("DISCORD_WEBHOOK_URL must be a valid URL");
}

const allowedWebhookHosts = new Set(["discord.com", "discordapp.com"]);

if (webhookUrl.protocol !== "https:" || !allowedWebhookHosts.has(webhookUrl.hostname)) {
  throw new Error("DISCORD_WEBHOOK_URL must point to an HTTPS Discord webhook");
}

if (!/^\/api\/webhooks\/[^/]+\/[^/]+$/.test(webhookUrl.pathname)) {
  throw new Error("DISCORD_WEBHOOK_URL must match Discord webhook format");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  const providedToken = req.headers["x-relay-token"];
  const providedBuffer = Buffer.from(typeof providedToken === "string" ? providedToken : "", "utf8");
  const expectedBuffer = Buffer.from(RELAY_TOKEN, "utf8");
  const isAuthorized =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!isAuthorized) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
});

app.post("/relay", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" });
  }

  try {
    const resp = await axios.post(DISCORD_WEBHOOK_URL, req.body, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    res.json({ ok: true, status: resp.status });
  } catch (err) {
    const status = err.response?.status ?? 502;
    const message = err.response ? "Discord webhook rejected the request" : "Failed to reach Discord webhook";

    console.error("Discord relay error:", err.message);
    res.status(status).json({ error: message });
  }
});

app.get("/", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  next(err);
});

app.listen(PORT, HOST, () => console.log(`Relay service running on http://${HOST}:${PORT}`));
