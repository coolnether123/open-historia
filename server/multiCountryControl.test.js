import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeActionEntry,
  normalizeChats,
} from "../src/runtime/gameState.js";
import {
  buildActionHistoryText,
  buildChatSummaryText,
  formatActionsForPrompt,
} from "../src/Game/AI/promptContext.js";

test("queued actions retain the country that issued them", () => {
  const action = normalizeActionEntry({
    country: "Canada",
    status: "planned",
    text: "Open Arctic rescue stations.",
    title: "Fund Arctic rescue",
  });

  assert.equal(action.country, "Canada");
  assert.match(buildActionHistoryText([action]), /\[Issued by Canada\]/);
  assert.match(formatActionsForPrompt([action]), /\[Issued by Canada\]/);
});

test("chats retain every country the player has represented", () => {
  const [chat] = normalizeChats([{
    controlledCountries: ["Canada", "United States"],
    countries: [{ code: "MEX", name: "Mexico" }],
    messages: [
      { role: "user", speaker: "Canada", text: "We propose a summit." },
      { role: "leader", speaker: "Mexico", text: "We will attend." },
      { role: "user", speaker: "United States", text: "We will attend too." },
    ],
  }]);

  assert.deepEqual(chat.controlledCountries, ["Canada", "United States"]);
  assert.match(buildChatSummaryText([chat]), /Mexico, Canada, United States/);
});
