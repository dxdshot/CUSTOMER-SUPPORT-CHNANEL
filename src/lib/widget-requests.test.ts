import assert from "node:assert/strict";
import { test } from "node:test";
import { widgetMessageRequest, widgetStateRequest } from "./widget-requests.ts";

const owner = { site: "site_demo_001", visitor: "visitor-test" };
const message = { ...owner, id: "message-test", body: "Hello" };

test("non-object JSON and wrong field types are rejected without throwing", () => {
  for (const input of [null, false, 4, "hello", [], { ...message, site: 4 }, { ...message, body: {} }]) {
    assert.equal(widgetMessageRequest.safeParse(input).success, false);
    assert.equal(widgetStateRequest.safeParse(input).success, false);
  }
});

test("text and attachment-only messages are accepted, blank messages are rejected", () => {
  assert.equal(widgetMessageRequest.safeParse(message).success, true);
  assert.equal(widgetMessageRequest.safeParse({ ...message, body: "  " }).success, false);
  const result = widgetMessageRequest.safeParse({ ...message, body: "", attachment: { url: "https://example.com/file.png", type: "image" } });
  assert.equal(result.success, true);
});

test("unsafe attachment schemes and oversized text are rejected", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/file", "/relative"])
    assert.equal(widgetMessageRequest.safeParse({ ...message, attachment: { url } }).success, false);
  assert.equal(widgetMessageRequest.safeParse({ ...message, body: "a".repeat(20_001) }).success, false);
});

test("each state action validates its own fields", () => {
  for (const action of ["read", "new"])
    assert.equal(widgetStateRequest.safeParse({ ...owner, action }).success, true);
  for (const input of [
    { action: "unknown" }, { action: "csat", value: "great" },
    { action: "typing", value: true }, { action: "identify", name: " " },
    { action: "tag", value: " " }, { action: "tag", value: "a".repeat(41) },
  ]) assert.equal(widgetStateRequest.safeParse({ ...owner, ...input }).success, false);
  for (const input of [
    { action: "csat", value: "good" }, { action: "typing", value: "false" },
    { action: "identify", name: "Ada" }, { action: "tag", value: "Billing" },
  ]) assert.equal(widgetStateRequest.safeParse({ ...owner, ...input }).success, true);
});
