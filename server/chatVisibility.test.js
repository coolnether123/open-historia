import assert from "node:assert/strict";
import test from "node:test";

import { chatBelongsToCountry, chatControlledCountries } from "../src/runtime/chatVisibility.js";

test("a chat is visible only to a country that the player represented in it", () => {
  const chat = {
    controlledCountries: ["Canada"],
    countries: [{ code: "MEX", name: "Mexico" }],
    messages: [],
  };

  assert.equal(chatBelongsToCountry(chat, "Canada"), true);
  assert.equal(chatBelongsToCountry(chat, "Mexico"), false);
});

test("multi-country player conversations remain visible to each represented country", () => {
  const chat = { controlledCountries: ["Canada", "United States"] };

  assert.equal(chatBelongsToCountry(chat, "Canada"), true);
  assert.equal(chatBelongsToCountry(chat, "United States"), true);
  assert.equal(chatBelongsToCountry(chat, "Mexico"), false);
});

test("legacy chats infer their controlled country from player messages", () => {
  const chat = {
    controlledCountries: [],
    messages: [
      { role: "user", speaker: "Canada", text: "We propose a summit." },
      { role: "leader", speaker: "Mexico", text: "We will attend." },
    ],
  };

  assert.deepEqual(chatControlledCountries(chat), [{ code: "", name: "Canada" }]);
  assert.equal(chatBelongsToCountry(chat, "Canada"), true);
  assert.equal(chatBelongsToCountry(chat, "Mexico"), false);
});

test("a counterparty does not gain access to the player's saved chat", () => {
  const chat = {
    controlledCountries: ["Canada"],
    countries: [{ code: "MEX", name: "Mexico" }],
    messages: [{ role: "leader", speaker: "Mexico", text: "Welcome." }],
  };

  assert.equal(chatBelongsToCountry(chat, { code: "MEX", name: "Mexico" }), false);
});

test("an old two-sided outreach infers the country that did not speak first", () => {
  const chat = {
    controlledCountries: [],
    countries: [
      { code: "USA", name: "United States" },
      { code: "CAN", name: "Canada" },
    ],
    messages: [{ role: "polity", code: "USA", speaker: "United States", text: "We should talk." }],
  };

  assert.equal(chatBelongsToCountry(chat, { code: "CAN", name: "Canada" }), true);
  assert.equal(chatBelongsToCountry(chat, { code: "USA", name: "United States" }), false);
});
