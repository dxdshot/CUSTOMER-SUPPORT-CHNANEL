import assert from "node:assert/strict";

const origin = process.argv[2] ?? "https://support-widget-six.vercel.app";
const cases = [
  ["messages", null],
  ["messages", { site: 42, visitor: "audit", id: "audit", body: "test" }],
  ["messages", { site: "audit", visitor: "audit", id: "audit", body: {} }],
  ["messages", { site: "audit", visitor: "audit", id: "audit", attachment: { url: "javascript:alert(1)" } }],
  ["state", null],
  ["state", { site: "audit", visitor: "audit", action: "unknown" }],
  ["state", { site: "audit", visitor: "audit", action: "csat", value: "invalid" }],
  ["state", { site: "audit", visitor: "audit", action: "typing", value: true }],
];

for (const [route, body] of cases) {
  const response = await fetch(`${origin}/api/widget/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 400, `${route} must reject ${JSON.stringify(body)}`);
  assert.equal(typeof (await response.json()).error, "string");
}
console.log(`${cases.length} invalid requests rejected by the running API.`);
