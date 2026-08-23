// Manual smoke/evaluation fixture for the three subscription tiers.
// This makes three real Codex subscription calls; it is intentionally not part
// of `npm test`.
import path from "node:path";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { runCodexGameTask } from "../server/codexBridge.js";
import { DATA_DIR } from "../server/dataDir.js";

const schema = {
  type: "object",
  properties: {
    message: { type: "string" },
    stance: { type: "string", enum: ["accept", "counter", "reject"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["message", "stance", "confidence"],
  additionalProperties: false,
};

const systemPrompt = [
  "You portray the government of Poland in a grounded 1938 strategy simulation.",
  "Germany proposes a renewed non-aggression agreement but asks for rail transit rights.",
  "Respond in character, preserve Polish sovereignty, and avoid modern knowledge or meta-commentary.",
  "The diplomatic message must be one or two sentences and must match the stance field.",
].join(" ");

const results = [];
const requestedTiers = process.argv.slice(2);
const tiers = requestedTiers.length > 0 ? requestedTiers : ["luna", "terra", "sol"];
for (const tier of tiers) {
  const started = performance.now();
  try {
    const result = await runCodexGameTask({
      systemPrompt,
      history: [{ role: "user", parts: [{ text: "What is Poland's answer?" }] }],
      tier,
      reasoningEffort: "none",
      schema,
      runtimeDir: path.join(DATA_DIR, "codex-model-eval"),
    });
    const row = {
      tier,
      model: result.model,
      elapsedMs: Math.round(performance.now() - started),
      usage: result.usage,
      output: result.structured,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    const row = {
      tier,
      elapsedMs: Math.round(performance.now() - started),
      error: error.message,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(DATA_DIR, "codex-model-eval.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);
