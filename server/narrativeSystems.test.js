import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceNarrativeSystems,
  buildDomesticPressureContext,
  buildHiddenAgendaContext,
  buildSpeakerAgendaContext,
  createDomesticPressureEvent,
  ensureNarrativeSystems,
  isDomesticPressureDue,
} from "../src/Game/AI/narrativeSystems.js";

const countryCatalog = [
  "Argentina", "Australia", "Brazil", "Canada", "China", "Egypt", "France", "Germany",
  "India", "Iran", "Italy", "Japan", "Mexico", "Nigeria", "Poland", "Russia", "South Africa",
  "South Korea", "Spain", "Turkey", "Ukraine", "United Kingdom", "United States", "Vietnam",
].map((name) => ({ code: name, name }));

const game = {
  country: "Canada",
  gameDate: "2016-01-01",
  id: "modern-day-session",
  name: "Modern Day Session",
  round: 1,
  startDate: "2016-01-01",
};

test("hidden agendas select ten unique non-player countries and remain stable", () => {
  const first = ensureNarrativeSystems({ countryCatalog, game, world: {} });
  const second = ensureNarrativeSystems({ countryCatalog, game, world: first.world });

  assert.equal(first.world.hiddenAgendas.length, 10);
  assert.equal(new Set(first.world.hiddenAgendas.map((agenda) => agenda.country)).size, 10);
  assert.equal(first.world.hiddenAgendas.some((agenda) => agenda.country === game.country), false);
  assert.deepEqual(second.world.hiddenAgendas, first.world.hiddenAgendas);
  assert.equal(second.changed, false);
});

test("agenda prompts expose all motives only to the simulation and one motive to its speaker", () => {
  const { world } = ensureNarrativeSystems({ countryCatalog, game, world: {} });
  const simulationContext = buildHiddenAgendaContext(world);
  const speaker = world.hiddenAgendas[0].country;
  const speakerContext = buildSpeakerAgendaContext(world, speaker);
  const unrelatedContext = buildSpeakerAgendaContext(world, "Canada");

  for (const agenda of world.hiddenAgendas) assert.match(simulationContext, new RegExp(agenda.country));
  assert.match(speakerContext, new RegExp(speaker));
  assert.equal(unrelatedContext, "");
});

test("domestic pressure becomes due, creates an open request, and reschedules", () => {
  const initialized = ensureNarrativeSystems({ countryCatalog, game, world: {} }).world;
  const dueRound = initialized.domesticPressure.nextRound;
  const dueGame = { ...game, round: dueRound - 1 };

  assert.equal(isDomesticPressureDue(initialized, dueRound), true);
  assert.match(buildDomesticPressureContext(initialized, dueGame), /Leave the government's response open/);

  const event = createDomesticPressureEvent({
    date: "2016-02-01",
    game: dueGame,
    round: dueRound,
    world: initialized,
  });
  assert.equal(event.kind, "domestic");
  assert.equal(event.playerRelated, true);
  assert.match(event.description, /Canada/);
  assert.match(event.description, /government|national/i);

  const advanced = advanceNarrativeSystems({
    domesticOccurred: true,
    events: [event],
    game: { ...dueGame, round: dueRound },
    world: initialized,
  });
  assert.equal(advanced.domesticPressure.sequence, 1);
  assert.ok(advanced.domesticPressure.nextRound >= dueRound + 2);
  assert.ok(advanced.domesticPressure.nextRound <= dueRound + 4);
});

test("spotlight momentum records nations that act in fresh events", () => {
  const initialized = ensureNarrativeSystems({ countryCatalog, game, world: {} }).world;
  const actor = initialized.hiddenAgendas[0].country;
  const advanced = advanceNarrativeSystems({
    events: [{ title: `${actor} opens regional talks`, description: "Delegates present a concrete proposal." }],
    game: { ...game, round: 2 },
    world: initialized,
  });
  const agenda = advanced.hiddenAgendas.find((entry) => entry.country === actor);

  assert.equal(agenda.lastActiveRound, 2);
  assert.equal(agenda.momentum, 8);
});
