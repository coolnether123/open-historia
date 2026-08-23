import {
  JSON_URLS,
  loadCountryNames,
  loadRegionCatalog,
  readJson,
} from "./assets.js";
import COUNTRY_NAMES from "./generated/countryNames.js";
import { readWorldState } from "./gameState.js";

// Return the polities that exist in this save, including custom and landless
// actors. The stock catalog fills gaps only when the scenario uses stock map
// geometry; it does not inject modern countries into a custom world.
export const loadPlayablePolities = async () => {
  const world = await readWorldState({ force: true });
  const ownership = world.regionOwnershipOverrides ?? {};
  const polityOverrides = world.polityOverrides ?? {};
  const nameByCode = new Map();

  for (const entry of (await loadCountryNames().catch(() => [])) ?? []) {
    if (entry?.code) nameByCode.set(String(entry.code), entry.name || String(entry.code));
  }
  for (const [code, polity] of Object.entries(polityOverrides)) {
    if (code && polity?.name) nameByCode.set(String(code), polity.name);
  }

  const owners = new Set([
    ...Object.keys(polityOverrides),
    ...Object.values(ownership),
    ...(world.ownerCodes ?? []),
  ].map((value) => String(value ?? "").trim()).filter(Boolean));

  const custom = await readJson(JSON_URLS.regionsGeojson, { defaultValue: null }).catch(() => null);
  if (Array.isArray(custom?.features) && custom.features.length > 0) {
    for (const feature of custom.features) {
      const props = feature?.properties ?? {};
      const id = props.id != null ? String(props.id) : "";
      const gid0 = props.gid0 ? String(props.gid0) : "";
      const owner = ownership[id] ?? props.owner ?? COUNTRY_NAMES[gid0] ?? gid0;
      if (owner) owners.add(String(owner));
    }
  } else {
    for (const region of await loadRegionCatalog().catch(() => [])) {
      const code = region.countryCode ? String(region.countryCode) : "";
      const owner = ownership[region.id] ?? COUNTRY_NAMES[code] ?? code;
      if (owner) owners.add(String(owner));
    }
  }

  return Array.from(owners)
    .filter((code) => code && code.toLowerCase() !== "unclaimed")
    .map((code) => ({ code, name: nameByCode.get(code) || code }))
    .sort((left, right) => left.name.localeCompare(right.name));
};
