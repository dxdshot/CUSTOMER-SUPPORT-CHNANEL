import assert from "node:assert/strict";
import { test } from "node:test";
import { failMessage, receiveMessage } from "./message-state.ts";
import type { Message } from "./mock-data";

const reply: Message = {
  id: "agent-reply",
  author: "agent",
  body: "I can help with this.",
  at: "10:00",
  createdAt: "2026-10-20T10:00:00.000Z",
  day: "Today",
  read: false,
};

test("a teammate reply appears in the conversation", () => {
  assert.deepEqual(receiveMessage([], reply), [{ ...reply, delivery: "sent" }]);
});

test("a failed send stays in the transcript for retry", () => {
  const messages = failMessage([{ ...reply, delivery: "sending" }], reply.id);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].delivery, "failed");
  assert.equal(messages[0].body, reply.body);
});

test("a failed HTTP response cannot undo a realtime confirmation", () => {
  const confirmed = receiveMessage([{ ...reply, delivery: "sending" }], reply);
  assert.equal(failMessage(confirmed, reply.id)[0].delivery, "sent");
});

test("a delayed realtime acknowledgement recovers a failed send", () => {
  const messages = receiveMessage([{ ...reply, delivery: "failed" }], reply);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].delivery, "sent");
});

test("a send response and realtime echo produce one confirmed message in either order", () => {
  const optimistic = { ...reply, at: "09:59" };
  for (const acknowledgements of [[reply, { ...reply }], [{ ...reply }, reply]]) {
    const messages = acknowledgements.reduce(receiveMessage, [optimistic]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].at, "10:00");
  }
});

test("a late acknowledgement does not undo a read receipt", () => {
  const messages = receiveMessage([{ ...reply, read: true }], reply);
  assert.equal(messages[0].read, true);
});

test("repeated visitor delivery produces one bubble", () => {
  const visitor: Message = { ...reply, author: "visitor" };
  assert.equal(receiveMessage(receiveMessage([], visitor), visitor).length, 1);
});

test("out-of-order delivery preserves transcript chronology", () => {
  const earlier = { ...reply, id: "earlier", createdAt: "2026-10-20T09:59:00.000Z" };
  assert.deepEqual(receiveMessage([reply], earlier).map((message) => message.id), ["earlier", "agent-reply"]);
});
