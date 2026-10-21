import assert from "node:assert/strict";
import test from "node:test";
import { conversationStatus } from "./mock-data.ts";

test("database and realtime statuses stay within the inbox model", () => {
  for (const status of ["open", "pending", "closed"] as const) {
    assert.equal(conversationStatus(status), status);
  }
  assert.equal(conversationStatus("unexpected"), "open");
  assert.equal(conversationStatus(null, "pending"), "pending");
});
