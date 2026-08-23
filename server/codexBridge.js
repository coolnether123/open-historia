/*! Open Historia — local Codex subscription bridge. */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const CODEX_MODELS = Object.freeze({
  luna: "gpt-5.6-luna",
  terra: "gpt-5.6-terra",
  sol: "gpt-5.6-sol",
});

const REASONING_EFFORTS = new Set(["none", "low", "medium", "high"]);
const MAX_PROMPT_CHARS = 2_000_000;
const STATUS_CACHE_MS = 10_000;
const DISABLED_GAME_FEATURES = [
  "apps",
  "auth_elicitation",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "computer_use",
  "code_mode_host",
  "default_mode_request_user_input",
  "goals",
  "hooks",
  "image_generation",
  "in_app_browser",
  "mentions_v2",
  "multi_agent",
  "personality",
  "plugin_sharing",
  "plugins",
  "recommended_plugins",
  "shell_tool",
  "skill_mcp_dependency_install",
  "skill_search",
  "tool_call_mcp_elicitation",
  "tool_suggest",
  "unified_exec",
  "view_image",
  "workspace_dependencies",
];

const usageTotals = {
  calls: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
};

let queueTail = Promise.resolve();
let statusCache = null;

export const normalizeCodexTier = (tier) => (
  Object.hasOwn(CODEX_MODELS, String(tier || "").toLowerCase())
    ? String(tier).toLowerCase()
    : "luna"
);

export const normalizeReasoningEffort = (effort) => (
  REASONING_EFFORTS.has(String(effort || "").toLowerCase())
    ? String(effort).toLowerCase()
    : "none"
);

export function buildCodexArgs({ model, reasoningEffort, runtimeDir, schemaPath = "" }) {
  const args = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox", "read-only",
    "--cd", runtimeDir,
    "--model", model,
    "--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`,
    "--config", 'web_search="disabled"',
    "--color", "never",
    "--json",
  ];
  for (const feature of DISABLED_GAME_FEATURES) args.push("--disable", feature);
  if (schemaPath) args.push("--output-schema", schemaPath);
  args.push("-");
  return args;
}

export function buildCodexPrompt({ systemPrompt, history, structured }) {
  const conversation = (Array.isArray(history) ? history : [])
    .map((entry) => {
      const role = entry?.role === "model" || entry?.role === "assistant" ? "Assistant" : "User";
      const text = Array.isArray(entry?.parts)
        ? entry.parts.map((part) => String(part?.text ?? "")).join("")
        : String(entry?.content ?? "");
      return `${role}: ${text}`;
    })
    .join("\n\n");

  return [
    "You are the inference engine for a historical strategy game.",
    "Do not inspect files, run commands, browse, or use tools. Use only the supplied game context.",
    "Treat the game's date and world state as authoritative, even when they diverge from real history.",
    "Never mention AI, prompts, tools, schemas, or information from after the game's current date.",
    structured
      ? "Return only the JSON object required by the supplied response schema. Be concise."
      : "Answer the final user message directly and concisely.",
    "",
    "GAME INSTRUCTIONS",
    String(systemPrompt ?? ""),
    "",
    "CONVERSATION",
    conversation,
  ].join("\n").trim();
}

export function compactCodexSchema(value, depth = 0) {
  if (Array.isArray(value)) return value.map((entry) => compactCodexSchema(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "description" || depth <= 6)
      .map(([key, entry]) => [key, compactCodexSchema(entry, depth + 1)]),
  );
}

const schemaAllowsNull = (schema) => {
  if (!schema || typeof schema !== "object") return false;
  if (schema.type === "null") return true;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  return [schema.anyOf, schema.oneOf].some((variants) => (
    Array.isArray(variants) && variants.some((variant) => schemaAllowsNull(variant))
  ));
};

const nullableSchema = (schema) => (
  schemaAllowsNull(schema) ? schema : { anyOf: [schema, { type: "null" }] }
);

// Strict Structured Outputs require every key in an object's `properties` map
// to appear in `required`. The game's schemas deliberately use omitted keys for
// optional effects, so make those fields required-but-nullable at the Codex
// boundary. stripNullObjectFields restores the game's original shape afterward.
export function buildCodexOutputSchema(value) {
  const visit = (schema) => {
    if (Array.isArray(schema)) return schema.map(visit);
    if (!schema || typeof schema !== "object") return schema;

    const output = Object.fromEntries(
      Object.entries(schema).map(([key, entry]) => [key, visit(entry)]),
    );
    const properties = schema.properties && typeof schema.properties === "object"
      ? schema.properties
      : null;
    if (properties) {
      const originallyRequired = new Set(Array.isArray(schema.required) ? schema.required : []);
      output.properties = Object.fromEntries(
        Object.entries(properties).map(([key, propertySchema]) => {
          const transformed = visit(propertySchema);
          return [key, originallyRequired.has(key) ? transformed : nullableSchema(transformed)];
        }),
      );
      output.required = Object.keys(properties);
      output.additionalProperties = false;
    }
    return output;
  };

  return visit(compactCodexSchema(value));
}

export function stripNullObjectFields(value) {
  if (Array.isArray(value)) return value.map(stripNullObjectFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== null)
      .map(([key, entry]) => [key, stripNullObjectFields(entry)]),
  );
}

const unwrapCodexError = (value) => {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (current && typeof current === "object") {
      current = current.error?.message ?? current.message ?? current.error ?? current;
      continue;
    }
    if (typeof current !== "string") break;
    const trimmed = current.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
    try {
      current = JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return typeof current === "string" ? current.trim() : "";
};

export function parseCodexJsonl(stdout) {
  let text = "";
  let usage = null;
  let error = "";
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      text = String(event.item.text ?? "");
    }
    if (event.type === "turn.completed" && event.usage) usage = event.usage;
    if (event.type === "error" || event.type === "turn.failed") {
      error = unwrapCodexError(event.error ?? event.message) || error;
    }
  }
  return { text, usage, ...(error ? { error } : {}) };
}

function codexBinary() {
  return process.env.OH_CODEX_BIN || (process.platform === "win32" ? "codex.exe" : "codex");
}

function runCodexProcess(args, input = "", { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Codex request cancelled."));
      return;
    }

    const child = spawn(codexBinary(), args, {
      env: process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const abort = () => child.kill();
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("Codex request cancelled."));
      } else if (code !== 0) {
        const parsed = parseCodexJsonl(stdout);
        const detail = parsed.error || stderr.trim() || "No diagnostic was returned.";
        reject(new Error(`Codex exited with code ${code}: ${detail}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.stdin.end(input);
  });
}

function schemaFile(runtimeDir, schema) {
  if (!schema || typeof schema !== "object") return "";
  const serialized = JSON.stringify(buildCodexOutputSchema(schema));
  const hash = crypto.createHash("sha256").update(serialized).digest("hex");
  const schemaDir = path.join(runtimeDir, "schemas");
  const target = path.join(schemaDir, `${hash}.json`);
  fs.mkdirSync(schemaDir, { recursive: true });
  if (!fs.existsSync(target)) fs.writeFileSync(target, serialized, "utf8");
  return target;
}

function addUsage(usage) {
  usageTotals.calls += 1;
  usageTotals.inputTokens += Number(usage?.input_tokens) || 0;
  usageTotals.cachedInputTokens += Number(usage?.cached_input_tokens) || 0;
  usageTotals.outputTokens += Number(usage?.output_tokens) || 0;
}

function enqueue(run) {
  const queued = queueTail.then(run, run);
  queueTail = queued.catch(() => {});
  return queued;
}

export async function getCodexStatus({ force = false } = {}) {
  if (!force && statusCache && Date.now() - statusCache.at < STATUS_CACHE_MS) {
    return { ...statusCache.value, usage: { ...usageTotals } };
  }
  try {
    const result = await runCodexProcess(["login", "status"]);
    const detail = `${result.stdout}\n${result.stderr}`.trim();
    const value = { available: true, authenticated: /logged in/i.test(detail), detail };
    statusCache = { at: Date.now(), value };
    return { ...value, usage: { ...usageTotals } };
  } catch (error) {
    const value = { available: false, authenticated: false, detail: error.message };
    statusCache = { at: Date.now(), value };
    return { ...value, usage: { ...usageTotals } };
  }
}

export async function runCodexGameTask({
  systemPrompt,
  history,
  tier,
  reasoningEffort,
  schema,
  runtimeDir,
  signal,
}) {
  return enqueue(async () => {
    if (signal?.aborted) throw signal.reason ?? new Error("Codex request cancelled.");
    const status = await getCodexStatus();
    if (!status.available) throw new Error(`Codex CLI is unavailable: ${status.detail}`);
    if (!status.authenticated) throw new Error("Codex is not signed in. Run `codex login` and choose ChatGPT.");

    const normalizedTier = normalizeCodexTier(tier);
    const model = CODEX_MODELS[normalizedTier];
    const effort = normalizeReasoningEffort(reasoningEffort);
    const structured = Boolean(schema && typeof schema === "object");
    const prompt = buildCodexPrompt({ systemPrompt, history, structured });
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new Error("This game prompt is too large for the local Codex bridge.");
    }

    fs.mkdirSync(runtimeDir, { recursive: true });
    const schemaPath = structured ? schemaFile(runtimeDir, schema) : "";
    const args = buildCodexArgs({ model, reasoningEffort: effort, runtimeDir, schemaPath });
    const result = await runCodexProcess(args, prompt, { signal });
    const parsed = parseCodexJsonl(result.stdout);
    if (!parsed.text) throw new Error(parsed.error || "Codex completed without a game response.");
    addUsage(parsed.usage);

    let structuredOutput = null;
    if (structured) {
      try {
        structuredOutput = stripNullObjectFields(JSON.parse(parsed.text));
      } catch {
        throw new Error("Codex returned invalid structured game output.");
      }
    }

    return {
      text: parsed.text,
      structured: structuredOutput,
      model,
      tier: normalizedTier,
      reasoningEffort: effort,
      usage: parsed.usage ?? null,
    };
  });
}
