import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "https://support-widget-six.vercel.app");
const site = process.argv[3] ?? "site_demo_001";
const origin = "https://embed-check.example";
assert.equal(base.protocol, "https:", "the deployed widget must use HTTPS");

const request = (path, options = {}) => fetch(new URL(path, base), {
  ...options,
  headers: { Origin: origin, ...options.headers },
});
const allowCrossOrigin = (response, path) => {
  assert.equal(response.headers.get("access-control-allow-origin"), "*", `${path} must allow public embeds`);
};

for (const path of [
  "/widget/embed.js",
  "/widget/widget.js",
  "/widget/styles.js",
  "/widget/cuelume/index.js",
  "/widget/textbox-160.png",
]) {
  const response = await request(path, { method: "HEAD" });
  assert.equal(response.status, 200, `${path} must be published`);
  allowCrossOrigin(response, path);
  if (path.endsWith(".js")) {
    assert.match(response.headers.get("content-type") ?? "", /javascript/, `${path} needs a JavaScript MIME type`);
  }
}

for (const [path, method] of [
  ["/api/widget/messages", "POST"],
  ["/api/widget/state", "POST"],
  ["/api/widget/upload", "POST"],
]) {
  const response = await request(path, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(response.status, 204, `${path} must accept browser preflight`);
  allowCrossOrigin(response, path);
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /content-type/i);
}

const metaPath = `/api/widget/messages?site=${encodeURIComponent(site)}&visitor=embed-contract-check&meta=1`;
const response = await request(metaPath);
assert.equal(response.status, 200, "the configured site must load through the public API");
allowCrossOrigin(response, metaPath);
const payload = await response.json();
assert.ok(Array.isArray(payload.messages));
assert.ok(payload.meta && typeof payload.meta === "object");

console.log(`Deployed widget assets, browser preflight, and read-only site metadata passed at ${base.origin}.`);
