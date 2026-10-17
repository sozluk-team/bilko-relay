import "dotenv/config";
import { createApp } from "./app.js";
import { loadSources } from "./config.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT ?? "31312", 10);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid integer between 1 and 65535");
}

const sources = loadSources(process.env);
const app = createApp({ sources });
const sourceNames = sources.map((source) => source.name).join(", ");

app.listen(PORT, HOST, () => console.log(`Relay service running on http://${HOST}:${PORT} (sources: ${sourceNames})`));
