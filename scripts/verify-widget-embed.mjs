import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/widget/embed.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const storageVersion = readFileSync("src/widget/version.ts", "utf8").match(/storage: "([^"]+)"/)?.[1];
assert.ok(storageVersion);

async function boot({ site = "site_demo_001", body = {}, nonce = "", identity, visitorId, name, email } = {}) {
  const values = new Map([["chat-platform:widget-version", storageVersion]]);
  if (identity) values.set("chat-platform:identity", JSON.stringify(identity));
  if (visitorId) values.set("chat-platform:visitor-id", visitorId);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const listeners = new Map();
  const mounts = [];
  const requests = [];
  let bootstrapRequests = 0;
  const errors = [];
  const document = {
    body,
    currentScript: {
      src: "https://support-widget-six.vercel.app/widget/embed.js",
      dataset: { site, ...(name !== undefined && { name }), ...(email !== undefined && { email }) },
      nonce,
    },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    querySelectorAll() { return []; },
  };
  const window = {
    localStorage: storage,
    sessionStorage: storage,
    navigator: { userAgent: "", platform: "" },
    screen: { width: 1200 },
    innerWidth: 1200,
    location: { pathname: "/first", search: "" },
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
  };
  const fetch = async (url, options = {}) => {
    if (url.includes("/presence")) return { ok: true, json: async () => ({ ok: true }) };
    if (url.includes("meta=1")) {
      bootstrapRequests++;
      return { ok: true, json: async () => ({ meta: { widgetSize: "sm" } }) };
    }
    requests.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => options.body.includes('"presetQuestion"')
        ? { question: { id: "q" }, answer: { id: "a" } }
        : { id: "m", author: "visitor", body: "Hi", createdAt: new Date().toISOString() },
    };
  };
  const context = {
    URL, URLSearchParams, AbortController, AbortSignal, DOMException,
    document, window, fetch,
    console: { error: (...parts) => errors.push(parts.join(" ")) },
    require: () => ({ mountChatWidget(options) {
      mounts.push(options);
      return { destroy() {} };
    } }),
  };
  const run = () => vm.runInNewContext(source, context);
  run();
  await new Promise(setImmediate);
  return { document, window, listeners, mounts, requests, bootstrapRequests, errors, run };
}

test("a missing site key never mounts a chat that cannot reach support", async () => {
  const { mounts, errors } = await boot({ site: "" });
  assert.equal(mounts.length, 0);
  assert.match(errors[0], /data-site is required/);
});

test("an async head script waits for the document body", async () => {
  const { document, listeners, mounts } = await boot({ body: null });
  assert.equal(mounts.length, 0);
  document.body = {};
  listeners.get("DOMContentLoaded")?.[0]?.();
  await new Promise(setImmediate);
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].size, "sm");
});

test("the saved site size overrides a stale embed size before the widget mounts", async () => {
  const { mounts, bootstrapRequests } = await boot();
  assert.equal(bootstrapRequests, 1);
  assert.equal(mounts[0].size, "sm");
});

test("the latest snippet wins when scripts run before the body exists", async () => {
  const { document, listeners, mounts, requests, run } = await boot({ body: null });
  document.currentScript.dataset.site = "site_second";
  run();
  document.body = {};
  for (const listener of listeners.get("DOMContentLoaded") ?? []) listener();
  await new Promise(setImmediate);
  assert.equal(mounts.length, 1);
  await mounts[0].transport.send({ id: "m1", body: "Hi" }, new AbortController().signal);
  assert.equal(requests[0].body.site, "site_second");
});

test("host identity, CSP nonce, and current SPA route reach the widget transport", async () => {
  const { window, mounts, requests } = await boot({
    nonce: "host-nonce",
    identity: { name: "Previous visitor", email: "old@example.org" },
    name: "Current visitor",
    email: "new@example.org",
  });
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].styleNonce, "host-nonce");
  const signal = new AbortController().signal;
  await mounts[0].transport.send({ id: "m1", body: "Hi" }, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body.identity)), {
    name: "Current visitor", email: "new@example.org",
  });
  assert.equal(requests[0].url, "https://support-widget-six.vercel.app/api/widget/messages");
  assert.equal(requests[0].body.context.page, "/first");

  window.location.pathname = "/checkout";
  window.location.search = "?step=2";
  await mounts[0].transport.sendPreset("Order status", "q1", signal);
  assert.equal(requests[1].body.context.page, "/checkout?step=2");

  window.chatPlatformIdentify("Another visitor", "another@example.org");
  await mounts[0].transport.send({ id: "m2", body: "Again" }, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[2].body.identity)), {
    name: "Another visitor", email: "another@example.org",
  });
});

test("explicit empty host identity clears a previous visitor on sign-out", async () => {
  const { mounts, requests } = await boot({
    identity: { name: "Previous visitor", email: "old@example.org" },
    visitorId: "previous-visitor-id",
    name: "",
    email: "",
  });
  await mounts[0].transport.send({ id: "m1", body: "Hi" }, new AbortController().signal);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body.identity)), { name: "", email: "" });
  assert.notEqual(requests[0].body.visitor, "previous-visitor-id");
});

test("the same host identity keeps its conversation id", async () => {
  const { mounts, requests } = await boot({
    identity: { name: "Current visitor", email: "current@example.org" },
    visitorId: "current-visitor-id",
    name: "Current visitor",
    email: "current@example.org",
  });
  await mounts[0].transport.send({ id: "m1", body: "Hi" }, new AbortController().signal);
  assert.equal(requests[0].body.visitor, "current-visitor-id");
});

test("a host name alone preserves an email saved in the chat", async () => {
  const { mounts, requests } = await boot({
    identity: { name: "Current visitor", email: "saved@example.org" },
    visitorId: "current-visitor-id",
    name: "Current visitor",
  });
  await mounts[0].transport.send({ id: "m1", body: "Hi" }, new AbortController().signal);
  assert.equal(requests[0].body.visitor, "current-visitor-id");
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body.identity)), {
    name: "Current visitor", email: "saved@example.org",
  });
});
