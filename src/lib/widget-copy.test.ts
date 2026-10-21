import assert from "node:assert/strict";
import { test } from "node:test";
import { presetMessages } from "./widget-copy.ts";

test("saved preset replies keep the question paired with its answer", () => {
  assert.deepEqual(presetMessages([
    { question: "  Track my order?  ", answer: "  Use your tracking link.  " },
    { question: "Talk to sales?", answer: "We can connect you." },
  ]), [
    { question: "Track my order?", answer: "Use your tracking link." },
    { question: "Talk to sales?", answer: "We can connect you." },
  ]);
});

test("old question-only presets stay editable but have no invented answer", () => {
  assert.deepEqual(presetMessages(["Old question?", null, { question: "", answer: "orphan" }]), [
    { question: "Old question?", answer: "" },
  ]);
});

test("duplicate questions cannot select two different answers", () => {
  assert.deepEqual(presetMessages([
    { question: "Hours?", answer: "Weekdays" },
    { question: "hours?", answer: "Always" },
  ]), [{ question: "Hours?", answer: "Weekdays" }]);
});
