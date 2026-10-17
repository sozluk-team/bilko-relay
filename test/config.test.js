import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSources, sourceEnvPrefix } from "../config.js";

const BILKO_WEBHOOK = "https://discord.com/api/webhooks/111/bilko-token";
const CANKAYA_WEBHOOK = "https://discord.com/api/webhooks/222/cankaya-token";

const multiEnv = (overrides = {}) => ({
  RELAY_SOURCES: "bilko,cankaya",
  RELAY_BILKO_TOKEN: "bilko-secret",
  RELAY_BILKO_WEBHOOK_URL: BILKO_WEBHOOK,
  RELAY_CANKAYA_TOKEN: "cankaya-secret",
  RELAY_CANKAYA_WEBHOOK_URL: CANKAYA_WEBHOOK,
  ...overrides,
});

test("eski tek webhook'lu .env default kaynagi olarak calisir", () => {
  const sources = loadSources({ DISCORD_WEBHOOK_URL: BILKO_WEBHOOK, RELAY_TOKEN: "legacy-secret" });

  assert.deepEqual(sources, [{ name: "default", token: "legacy-secret", webhookUrl: BILKO_WEBHOOK }]);
});

test("eski kurulumda eksik degisken adini soyler", () => {
  assert.throws(() => loadSources({ RELAY_TOKEN: "legacy-secret" }), /DISCORD_WEBHOOK_URL/);
  assert.throws(() => loadSources({}), /RELAY_SOURCES/);
});

test("RELAY_SOURCES ile birden fazla kaynak okunur", () => {
  const sources = loadSources(multiEnv({ RELAY_SOURCES: " Bilko , cankaya ," }));

  assert.deepEqual(sources, [
    { name: "bilko", token: "bilko-secret", webhookUrl: BILKO_WEBHOOK },
    { name: "cankaya", token: "cankaya-secret", webhookUrl: CANKAYA_WEBHOOK },
  ]);
});

test("tireli kaynak adi alt cizgili env onekine donusur", () => {
  assert.equal(sourceEnvPrefix("cankaya-sozluk"), "RELAY_CANKAYA_SOZLUK_");

  const sources = loadSources({
    RELAY_SOURCES: "cankaya-sozluk",
    RELAY_CANKAYA_SOZLUK_TOKEN: "secret",
    RELAY_CANKAYA_SOZLUK_WEBHOOK_URL: CANKAYA_WEBHOOK,
  });

  assert.equal(sources[0].name, "cankaya-sozluk");
});

test("kaynagin eksik ayari hangi degisken oldugunu soyler", () => {
  assert.throws(() => loadSources(multiEnv({ RELAY_CANKAYA_TOKEN: "" })), /RELAY_CANKAYA_TOKEN/);
  assert.throws(() => loadSources(multiEnv({ RELAY_CANKAYA_WEBHOOK_URL: undefined })), /RELAY_CANKAYA_WEBHOOK_URL/);
});

test("Discord disi veya bozuk webhook reddedilir", () => {
  assert.throws(
    () => loadSources(multiEnv({ RELAY_BILKO_WEBHOOK_URL: "http://discord.com/api/webhooks/1/x" })),
    /RELAY_BILKO_WEBHOOK_URL must point to an HTTPS Discord webhook/,
  );
  assert.throws(
    () => loadSources(multiEnv({ RELAY_BILKO_WEBHOOK_URL: "https://evil.example/api/webhooks/1/x" })),
    /HTTPS Discord webhook/,
  );
  assert.throws(
    () => loadSources(multiEnv({ RELAY_BILKO_WEBHOOK_URL: "https://discord.com/api/channels/1" })),
    /Discord webhook format/,
  );
  assert.throws(() => loadSources(multiEnv({ RELAY_BILKO_WEBHOOK_URL: "not a url" })), /valid URL/);
});

test("iki kaynak ayni token'i paylasamaz", () => {
  assert.throws(() => loadSources(multiEnv({ RELAY_CANKAYA_TOKEN: "bilko-secret" })), /must not share the same token/);
});

test("gecersiz veya tekrar eden kaynak adi reddedilir", () => {
  assert.throws(() => loadSources(multiEnv({ RELAY_SOURCES: "bilko,cankaya_sozluk" })), /Invalid source name/);
  assert.throws(() => loadSources(multiEnv({ RELAY_SOURCES: "bilko,BILKO" })), /listed more than once/);
  assert.throws(() => loadSources(multiEnv({ RELAY_SOURCES: " , " })), /at least one source/);
});

test("RELAY_SOURCES ile eski degiskenler birlikte kullanilamaz", () => {
  assert.throws(() => loadSources(multiEnv({ RELAY_TOKEN: "legacy-secret" })), /remove DISCORD_WEBHOOK_URL \/ RELAY_TOKEN/);
});
