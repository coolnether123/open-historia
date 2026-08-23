import { readGameData, writeGameData } from "./gameState.js";

export const PLAYER_COUNTRY_CHANGED_EVENT = "oh:player-country-changed";

export const switchPlayerCountry = async (country) => {
  const nextCountry = String(country ?? "").trim();
  if (!nextCountry) throw new Error("Choose a country first.");

  const current = await readGameData({ force: true });
  const game = await writeGameData({ ...current, country: nextCountry });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLAYER_COUNTRY_CHANGED_EVENT, {
      detail: { country: nextCountry, game },
    }));
  }
  return game;
};
