import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCodexArgs,
  buildCodexOutputSchema,
  buildCodexPrompt,
  compactCodexSchema,
  normalizeCodexTier,
  normalizeReasoningEffort,
  parseCodexJsonl,
  stripNullObjectFields,
} from "./codexBridge.js";

test("Codex tiers and reasoning defaults favor the lowest-token option", () => {
  assert.equal(normalizeCodexTier("sol"), "sol");
  assert.equal(normalizeCodexTier("unknown"), "luna");
  assert.equal(normalizeReasoningEffort("high"), "high");
  assert.equal(normalizeReasoningEffort("unknown"), "none");
});

test("Codex invocation ignores ambient tools and uses an ephemeral read-only run", () => {
  const args = buildCodexArgs({
    model: "gpt-5.6-luna",
    reasoningEffort: "none",
    runtimeDir: "C:\\game-runtime",
  });
  for (const expected of ["--ignore-user-config", "--ignore-rules", "--ephemeral", "read-only", "--json"]) {
    assert.ok(args.includes(expected), expected);
  }
  assert.equal(args.at(-1), "-");
  assert.ok(args.includes('web_search="disabled"'));
  for (const feature of ["shell_tool", "plugins", "multi_agent", "browser_use"]) {
    assert.ok(args.some((value, index) => value === "--disable" && args[index + 1] === feature), feature);
  }
});

test("Codex prompt forbids tools and preserves game roles", () => {
  const prompt = buildCodexPrompt({
    systemPrompt: "Speak as France.",
    history: [{ role: "user", parts: [{ text: "Hello" }] }],
    structured: false,
  });
  assert.match(prompt, /Do not inspect files, run commands, browse, or use tools/);
  assert.match(prompt, /GAME INSTRUCTIONS\nSpeak as France/);
  assert.match(prompt, /CONVERSATION\nUser: Hello/);
});

test("Codex JSONL parser extracts the final response and token usage", () => {
  const output = [
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "first" } }),
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "final" } }),
    JSON.stringify({ type: "turn.completed", usage: { input_tokens: 12, output_tokens: 3 } }),
  ].join("\n");
  assert.deepEqual(parseCodexJsonl(output), {
    text: "final",
    usage: { input_tokens: 12, output_tokens: 3 },
  });
});

test("Codex JSONL parser surfaces the API failure instead of stderr noise", () => {
  const output = [
    JSON.stringify({ type: "error", message: JSON.stringify({ error: { message: "Invalid schema. Missing 'code'." } }) }),
    JSON.stringify({ type: "turn.failed", error: { message: "Invalid schema. Missing 'code'." } }),
  ].join("\n");
  assert.equal(parseCodexJsonl(output).error, "Invalid schema. Missing 'code'.");
});

test("Codex schema compaction keeps constraints while dropping deep repeated prose", () => {
  const schema = {
    type: "object",
    properties: {
      a: {
        type: "object",
        properties: {
          b: {
            type: "object",
            properties: {
              c: {
                type: "object",
                properties: { d: { type: "string", description: "deep prose" } },
              },
            },
          },
        },
      },
    },
    required: ["a"],
  };
  const compacted = compactCodexSchema(schema);
  assert.equal(compacted.required[0], "a");
  assert.equal(compacted.properties.a.properties.b.properties.c.properties.d.type, "string");
  assert.equal(compacted.properties.a.properties.b.properties.c.properties.d.description, undefined);
});

test("Codex output schemas make optional object fields required and nullable", () => {
  const schema = buildCodexOutputSchema({
    type: "object",
    properties: {
      country: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
        },
        required: ["name"],
      },
      note: { type: "string" },
    },
    required: ["country"],
  });

  assert.deepEqual(schema.required, ["country", "note"]);
  assert.deepEqual(schema.properties.country.required, ["code", "name"]);
  assert.equal(schema.properties.country.additionalProperties, false);
  assert.equal(schema.properties.country.properties.name.type, "string");
  assert.deepEqual(schema.properties.country.properties.code.anyOf.at(-1), { type: "null" });
  assert.deepEqual(schema.properties.note.anyOf.at(-1), { type: "null" });
});

test("Codex null placeholders are removed before gameplay validation", () => {
  assert.deepEqual(
    stripNullObjectFields({
      catalyst: null,
      event: { id: null, title: "A new event" },
      countries: [{ code: null, name: "France" }],
    }),
    {
      event: { title: "A new event" },
      countries: [{ name: "France" }],
    },
  );
});
