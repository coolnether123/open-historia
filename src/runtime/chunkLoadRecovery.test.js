/*! Open Historia — stale chunk recovery tests © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// Run: node --test src/runtime/chunkLoadRecovery.test.js

import test from "node:test";
import assert from "node:assert/strict";
import {
  clearStaleChunkReload,
  isChunkLoadError,
  reloadForStaleChunk,
} from "./chunkLoadRecovery.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("recognizes dynamic import and chunk loading failures", () => {
  const errors = [
    new TypeError("Failed to fetch dynamically imported module: /assets/cheats-old.js"),
    new Error("Importing a module script failed"),
    new Error("Loading chunk 14 failed"),
    { reason: new Error("ChunkLoadError") },
  ];

  for (const error of errors) assert.equal(isChunkLoadError(error), true);
  assert.equal(isChunkLoadError(new Error("Game data was invalid")), false);
});

test("reloads once for the same missing chunk", () => {
  const storage = createStorage();
  const error = new Error("Failed to fetch dynamically imported module: /assets/cheats-old.js");
  let reloads = 0;

  assert.equal(reloadForStaleChunk(error, { storage, reload: () => reloads += 1 }), true);
  assert.equal(reloadForStaleChunk(error, { storage, reload: () => reloads += 1 }), false);
  assert.equal(reloads, 1);
});

test("a different stale chunk can trigger a later reload", () => {
  const storage = createStorage();
  let reloads = 0;
  const options = { storage, reload: () => reloads += 1 };

  reloadForStaleChunk(new Error("Loading chunk old-a failed"), options);
  reloadForStaleChunk(new Error("Loading chunk old-b failed"), options);
  assert.equal(reloads, 2);
});

test("manual retry clears the reload guard", () => {
  const storage = createStorage();
  const error = new Error("Loading chunk old-a failed");
  let reloads = 0;
  const options = { storage, reload: () => reloads += 1 };

  reloadForStaleChunk(error, options);
  clearStaleChunkReload(storage);
  reloadForStaleChunk(error, options);
  assert.equal(reloads, 2);
});

