import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createApp } from "../app.js";

const sources = [
  { name: "bilko", token: "bilko-secret", webhookUrl: "https://discord.com/api/webhooks/111/bilko" },
  { name: "cankaya", token: "cankaya-secret", webhookUrl: "https://discord.com/api/webhooks/222/cankaya" },
];

let forwarded;
let forwardImpl;
let server;
let baseUrl;

before(async () => {
  const app = createApp({
    sources,
    forward: (webhookUrl, body) => {
      forwarded.push({ webhookUrl, body });
      return forwardImpl(webhookUrl, body);
    },
    logError: () => {},
  });

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  forwarded = [];
  forwardImpl = async () => 204;
});

const post = (path, token, body = { content: "selam" }) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-relay-token": token } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("her kaynagin token'i kendi webhook'una gider", async () => {
  const bilko = await post("/relay", "bilko-secret", { content: "bilko" });
  const cankaya = await post("/relay", "cankaya-secret", { content: "cankaya" });

  assert.equal(bilko.status, 200);
  assert.deepEqual(await bilko.json(), { ok: true, source: "bilko", status: 204 });
  assert.equal(cankaya.status, 200);
  assert.deepEqual(await cankaya.json(), { ok: true, source: "cankaya", status: 204 });
  assert.deepEqual(forwarded, [
    { webhookUrl: sources[0].webhookUrl, body: { content: "bilko" } },
    { webhookUrl: sources[1].webhookUrl, body: { content: "cankaya" } },
  ]);
});

test("gecersiz veya eksik token reddedilir ve hicbir yere iletilmez", async () => {
  for (const token of [undefined, "", "yanlis", "bilko-secret-ama-uzun"]) {
    const resp = await post("/relay", token);
    assert.equal(resp.status, 403);
    assert.deepEqual(await resp.json(), { error: "Unauthorized" });
  }

  assert.equal(forwarded.length, 0);
});

test("/relay/<kaynak> yalnizca o kaynagin token'i ile calisir", async () => {
  const own = await post("/relay/cankaya", "cankaya-secret");
  assert.equal(own.status, 200);
  assert.equal((await own.json()).source, "cankaya");

  const upper = await post("/relay/Cankaya", "cankaya-secret");
  assert.equal(upper.status, 200);

  const foreign = await post("/relay/bilko", "cankaya-secret");
  assert.equal(foreign.status, 403);

  const unknown = await post("/relay/tfl", "cankaya-secret");
  assert.equal(unknown.status, 403);

  assert.equal(forwarded.length, 2);
  assert.ok(forwarded.every((item) => item.webhookUrl === sources[1].webhookUrl));
});

test("JSON nesnesi olmayan govde 400 doner", async () => {
  const array = await post("/relay", "bilko-secret", [1, 2]);
  assert.equal(array.status, 400);

  const broken = await post("/relay", "bilko-secret", "{bozuk");
  assert.equal(broken.status, 400);
  assert.deepEqual(await broken.json(), { error: "Invalid JSON body" });

  assert.equal(forwarded.length, 0);
});

test("buyuk govde 413 doner", async () => {
  const resp = await post("/relay", "bilko-secret", { content: "x".repeat(40_000) });
  assert.equal(resp.status, 413);
  assert.equal(forwarded.length, 0);
});

test("Discord hatasinin durum kodu istemciye aktarilir", async () => {
  forwardImpl = async () => {
    throw Object.assign(new Error("Request failed with status code 400"), { response: { status: 400 } });
  };

  const rejected = await post("/relay", "bilko-secret");
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: "Discord webhook rejected the request" });

  forwardImpl = async () => {
    throw new Error("connect ECONNREFUSED");
  };

  const unreachable = await post("/relay", "cankaya-secret");
  assert.equal(unreachable.status, 502);
  assert.deepEqual(await unreachable.json(), { error: "Failed to reach Discord webhook" });
});

test("saglik kontrolu token'in hangi kaynaga ait oldugunu soyler", async () => {
  const resp = await fetch(`${baseUrl}/`, { headers: { "x-relay-token": "cankaya-secret" } });
  assert.equal(resp.status, 200);
  assert.deepEqual(await resp.json(), { ok: true, source: "cankaya" });

  const anonymous = await fetch(`${baseUrl}/`);
  assert.equal(anonymous.status, 403);
});
