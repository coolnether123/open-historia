import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDiplomaticMessageForAI } from "../src/Game/AI/diplomaticEventLink.js";
import { AI_WRITING_QUALITY_DIRECTIVE } from "../src/Game/AI/writingQuality.js";
import { validateGameplayPayload } from "../src/Game/AI/gameplaySchemas.js";
import { normalizeChats, normalizeEventEntry } from "../src/runtime/gameState.js";

test("event normalization preserves associated countries", () => {
  const event = normalizeEventEntry({
    countries: [{ code: "FRA", name: "France" }, "Germany"],
    date: "1940-05-10",
    description: "German forces cross the frontier into France.",
    title: "The western campaign begins",
  });

  assert.deepEqual(event.countries, [
    { code: "FRA", name: "France" },
    { code: "", name: "Germany" },
  ]);
});

test("timeline schemas require explicit country associations", () => {
  const basePayload = {
    clearActions: true,
    events: [{
      date: "1940-05-10",
      description: "German forces cross the frontier into France.",
      title: "The western campaign begins",
    }],
    stopDate: "1940-05-11",
    summary: "The western campaign has begun.",
  };

  assert.equal(validateGameplayPayload("jumpForward", basePayload).valid, false);
  assert.equal(validateGameplayPayload("jumpForward", {
    ...basePayload,
    events: [{ ...basePayload.events[0], countries: [{ name: "France" }, { name: "Germany" }] }],
  }).valid, true);
});

test("linked event metadata survives chat storage and reaches the diplomatic model", () => {
  const [chat] = normalizeChats([{
    countries: [{ code: "FRA", name: "France" }],
    messages: [{
      linkedEventDate: "1940-05-10",
      linkedEventDescription: "German forces cross the frontier into France.",
      linkedEventId: "western-campaign",
      linkedEventTitle: "The western campaign begins",
      role: "user",
      text: "How will you respond?",
    }],
  }]);
  const message = chat.messages[0];

  assert.equal(message.linkedEventId, "western-campaign");
  assert.match(formatDiplomaticMessageForAI(message.text, message), /The western campaign begins/);
  assert.match(formatDiplomaticMessageForAI(message.text, message), /How will you respond\?/);
});

test("the shared writing directive rejects common AI prose habits", () => {
  assert.match(AI_WRITING_QUALITY_DIRECTIVE, /plain, specific language/i);
  assert.match(AI_WRITING_QUALITY_DIRECTIVE, /active voice/i);
  assert.match(AI_WRITING_QUALITY_DIRECTIVE, /Do not use em dashes/i);
  assert.match(AI_WRITING_QUALITY_DIRECTIVE, /Never mention these writing rules/i);
});
