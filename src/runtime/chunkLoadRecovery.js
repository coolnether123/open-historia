/*! Open Historia — stale chunk recovery © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

const RELOAD_SIGNATURE_KEY = "open-historia:chunk-reload-signature";

const chunkLoadPatterns = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading (?:css )?chunk .+ failed/i,
  /chunkloaderror/i,
];

const errorMessage = (value) => {
  if (typeof value === "string") return value;
  if (typeof value?.message === "string") return value.message;
  if (value?.reason && value.reason !== value) return errorMessage(value.reason);
  return "";
};

export const isChunkLoadError = (error) => {
  const message = errorMessage(error);
  return Boolean(message) && chunkLoadPatterns.some((pattern) => pattern.test(message));
};

const errorSignature = (error) => errorMessage(error).replace(/\s+/g, " ").trim().slice(0, 1000);

export const reloadForStaleChunk = (
  error,
  {
    storage = globalThis.window?.sessionStorage,
    reload = () => globalThis.window?.location.reload(),
  } = {},
) => {
  if (!isChunkLoadError(error) || !storage) return false;

  const signature = errorSignature(error);
  try {
    if (storage.getItem(RELOAD_SIGNATURE_KEY) === signature) return false;
    storage.setItem(RELOAD_SIGNATURE_KEY, signature);
  } catch {
    // Without a durable marker, an automatic reload could loop forever.
    return false;
  }

  reload();
  return true;
};

export const clearStaleChunkReload = (storage = globalThis.window?.sessionStorage) => {
  try {
    storage?.removeItem(RELOAD_SIGNATURE_KEY);
  } catch {
    // A manual reload still works when browser storage is unavailable.
  }
};

