import crypto from "node:crypto";
import express from "express";
import axios from "axios";

export async function postToDiscord(webhookUrl, body) {
  const resp = await axios.post(webhookUrl, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 10_000,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  return resp.status;
}

const hashToken = (token) => crypto.createHash("sha256").update(token, "utf8").digest();

export function createApp({ sources, forward = postToDiscord, logError = console.error }) {
  const tokenTable = sources.map((source) => ({ source, digest: hashToken(source.token) }));

  // Ozetler esit uzunlukta oldugu icin timingSafeEqual token uzunlugunu da
  // sizdirmaz; erken cikilmadigi icin hangi kaynagin eslestigi de anlasilmaz.
  function findSource(providedToken) {
    if (typeof providedToken !== "string" || providedToken === "") {
      return null;
    }

    const providedDigest = hashToken(providedToken);
    let match = null;

    for (const entry of tokenTable) {
      if (crypto.timingSafeEqual(providedDigest, entry.digest)) {
        match = entry.source;
      }
    }

    return match;
  }

  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const source = findSource(req.headers["x-relay-token"]);

    if (!source) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.locals.source = source;
    next();
  });

  app.use(express.json({ limit: "32kb" }));

  async function relay(req, res) {
    const { source } = res.locals;

    // /relay/<kaynak> kullaniliyorsa token o kaynaga ait olmali.
    if (req.params.source !== undefined && req.params.source.toLowerCase() !== source.name) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Request body must be a JSON object" });
    }

    try {
      const status = await forward(source.webhookUrl, req.body);
      res.json({ ok: true, source: source.name, status });
    } catch (err) {
      const status = err.response?.status ?? 502;
      const message = err.response ? "Discord webhook rejected the request" : "Failed to reach Discord webhook";

      logError(`Discord relay error [${source.name}]:`, err.message);
      res.status(status).json({ error: message });
    }
  }

  app.post("/relay", relay);
  app.post("/relay/:source", relay);

  app.get("/", (req, res) => res.json({ ok: true, source: res.locals.source.name }));

  app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large" });
    }

    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    next(err);
  });

  return app;
}
