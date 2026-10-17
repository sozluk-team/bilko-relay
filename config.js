const allowedWebhookHosts = new Set(["discord.com", "discordapp.com"]);
const sourceNamePattern = /^[a-z0-9][a-z0-9-]*$/;

function requireEnv(env, name) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validateWebhookUrl(value, envName) {
  let webhookUrl;

  try {
    webhookUrl = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid URL`);
  }

  if (webhookUrl.protocol !== "https:" || !allowedWebhookHosts.has(webhookUrl.hostname)) {
    throw new Error(`${envName} must point to an HTTPS Discord webhook`);
  }

  if (!/^\/api\/webhooks\/[^/]+\/[^/]+$/.test(webhookUrl.pathname)) {
    throw new Error(`${envName} must match Discord webhook format`);
  }

  return value;
}

// "cankaya-sozluk" -> "RELAY_CANKAYA_SOZLUK_"
export function sourceEnvPrefix(name) {
  return `RELAY_${name.toUpperCase().replaceAll("-", "_")}_`;
}

function loadLegacySource(env) {
  if (!env.DISCORD_WEBHOOK_URL?.trim() && !env.RELAY_TOKEN?.trim()) {
    throw new Error("Missing required environment variable: RELAY_SOURCES");
  }

  return {
    name: "default",
    token: requireEnv(env, "RELAY_TOKEN"),
    webhookUrl: validateWebhookUrl(requireEnv(env, "DISCORD_WEBHOOK_URL"), "DISCORD_WEBHOOK_URL"),
  };
}

// RELAY_SOURCES=bilko,cankaya ise her kaynak RELAY_<AD>_TOKEN ve
// RELAY_<AD>_WEBHOOK_URL ile tanimlanir. RELAY_SOURCES yoksa eski tek
// webhook'lu kurulum (DISCORD_WEBHOOK_URL + RELAY_TOKEN) "default" kaynagi olur.
export function loadSources(env = process.env) {
  const sourceList = env.RELAY_SOURCES?.trim();

  if (!sourceList) {
    return [loadLegacySource(env)];
  }

  if (env.DISCORD_WEBHOOK_URL?.trim() || env.RELAY_TOKEN?.trim()) {
    throw new Error(
      "RELAY_SOURCES is set; remove DISCORD_WEBHOOK_URL / RELAY_TOKEN and use RELAY_<NAME>_TOKEN / RELAY_<NAME>_WEBHOOK_URL instead",
    );
  }

  const names = sourceList
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error("RELAY_SOURCES must list at least one source name");
  }

  const sources = [];
  const seenTokens = new Map();

  for (const name of names) {
    if (!sourceNamePattern.test(name)) {
      throw new Error(`Invalid source name "${name}": use lowercase letters, digits and dashes`);
    }

    if (sources.some((source) => source.name === name)) {
      throw new Error(`Source "${name}" is listed more than once in RELAY_SOURCES`);
    }

    const prefix = sourceEnvPrefix(name);
    const token = requireEnv(env, `${prefix}TOKEN`);
    const webhookUrl = validateWebhookUrl(requireEnv(env, `${prefix}WEBHOOK_URL`), `${prefix}WEBHOOK_URL`);

    // Kaynak token'dan bulundugu icin iki kaynak ayni token'i paylasamaz.
    if (seenTokens.has(token)) {
      throw new Error(`Sources "${seenTokens.get(token)}" and "${name}" must not share the same token`);
    }

    seenTokens.set(token, name);
    sources.push({ name, token, webhookUrl });
  }

  return sources;
}
