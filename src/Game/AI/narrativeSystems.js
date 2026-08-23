const SPOTLIGHT_COUNT = 10;

const STRATEGIC_ACTORS = new Set([
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "China",
  "Colombia", "Cuba", "Czech Republic", "Denmark", "Egypt", "Ethiopia", "Finland", "France",
  "Germany", "Greece", "Hungary", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Japan", "Kazakhstan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands",
  "New Zealand", "Nigeria", "North Korea", "Norway", "Pakistan", "Peru", "Philippines", "Poland",
  "Portugal", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
  "Spain", "Sweden", "Switzerland", "Syria", "Taiwan", "Thailand", "Turkey", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Venezuela", "Vietnam",
]);

const AGENDA_ARCHETYPES = [
  {
    id: "regional-primacy",
    objective: (country) => `${country} wants to become the power its region cannot bypass.`,
    method: "Build leverage through neighbors, selective pressure, and visible leadership.",
  },
  {
    id: "alliance-architect",
    objective: (country) => `${country} wants to assemble a durable bloc around shared interests.`,
    method: "Offer practical cooperation first, then turn dependence into alignment.",
  },
  {
    id: "resource-security",
    objective: (country) => `${country} wants secure access to the resources its future depends on.`,
    method: "Pursue suppliers, routes, stockpiles, and favorable long-term agreements.",
  },
  {
    id: "revisionist-settlement",
    objective: (country) => `${country} wants to revise an unfavorable border or political settlement.`,
    method: "Prepare the claim gradually through diplomacy, influence, and calibrated force.",
  },
  {
    id: "economic-sphere",
    objective: (country) => `${country} wants neighboring economies tied to its markets and capital.`,
    method: "Use trade, credit, infrastructure, and standards as strategic instruments.",
  },
  {
    id: "regime-security",
    objective: (country) => `${country}'s leadership wants to make its rule resistant to outside and domestic threats.`,
    method: "Reduce vulnerabilities, cultivate loyal partners, and isolate hostile influence.",
  },
  {
    id: "military-modernization",
    objective: (country) => `${country} wants a decisive military advantage before its rivals can react.`,
    method: "Modernize quietly, test readiness, and seek technologies or bases that alter the balance.",
  },
  {
    id: "maritime-reach",
    objective: (country) => `${country} wants greater control over sea routes, ports, and naval access.`,
    method: "Expand access agreements, maritime capacity, and influence at strategic chokepoints.",
  },
  {
    id: "ideological-influence",
    objective: (country) => `${country} wants governments and movements abroad to adopt its political model.`,
    method: "Support sympathetic institutions, narratives, parties, and diplomatic partners.",
  },
  {
    id: "strategic-autonomy",
    objective: (country) => `${country} wants freedom from dependence on any single great power.`,
    method: "Balance competing partners, diversify supplies, and avoid binding commitments.",
  },
  {
    id: "covert-disruption",
    objective: (country) => `${country} wants to weaken a rival without accepting the costs of open conflict.`,
    method: "Use deniable influence, proxies, intelligence, and economic friction.",
  },
  {
    id: "indispensable-mediator",
    objective: (country) => `${country} wants every major dispute to require its mediation.`,
    method: "Maintain access to opposing camps and trade solutions for influence.",
  },
];

const DOMESTIC_EVENTS = [
  {
    title: "Municipal leaders press for infrastructure repairs",
    description: (country) => `Mayors, commuters, and local business groups across ${country} petition the national government for a funded repair program, warning that failing roads and public transport are beginning to constrain daily life and commerce. They are asking the government to publish priorities and a timetable; no national decision has yet been made.`,
  },
  {
    title: "Households organize over the cost of living",
    description: (country) => `Consumer groups and neighborhood associations in ${country} organize public meetings over household costs. Their petition asks the government for a concrete affordability package while economists warn that rushed controls could create shortages. The demand now awaits a government response.`,
  },
  {
    title: "Workers deliver a national bargaining petition",
    description: (country) => `A coalition of workers in ${country} delivers a petition seeking safer conditions, predictable bargaining rights, and relief for wages that have fallen behind living costs. Employers urge restraint, leaving the government to decide whether and how to intervene.`,
  },
  {
    title: "Students demand a new education settlement",
    description: (country) => `Student and faculty groups in ${country} call for investment in schools, technical training, and research. Their demonstrations remain peaceful, but they want a public commitment from the government before the next budget is settled.`,
  },
  {
    title: "Rural communities send a delegation to the capital",
    description: (country) => `Farmers and rural councils from across ${country} send representatives to the capital with requests for dependable transport, credit, and water policy. They say rural regions are carrying national burdens without receiving comparable investment.`,
  },
  {
    title: "Public health campaign gathers momentum",
    description: (country) => `Doctors, caregivers, and patient advocates in ${country} launch a coordinated campaign for better local access to care and emergency readiness. Their proposal requires national funding and has become a visible test of government priorities.`,
  },
  {
    title: "Veterans ask the government to honor its obligations",
    description: (country) => `Veterans and military families in ${country} request faster benefits, stronger rehabilitation services, and a clear accounting of promised support. Their appeal carries broad public sympathy and now requires a government answer.`,
  },
  {
    title: "Anti-corruption march reaches the capital",
    description: (country) => `Civic organizations in ${country} bring a large anti-corruption petition to the capital, demanding transparent procurement and an independent review of public contracts. The organizers have asked the government to accept specific oversight measures.`,
  },
  {
    title: "Housing groups call for emergency action",
    description: (country) => `Tenant groups, young families, and municipal officials in ${country} ask the national government to address housing supply and rising rents. Competing proposals divide the coalition, but pressure for a visible response is growing.`,
  },
  {
    title: "Regional councils seek a larger voice",
    description: (country) => `Several regional councils in ${country} jointly request more authority over local spending and services. They frame the appeal as practical reform rather than separation, while national institutions debate how much autonomy is safe to grant.`,
  },
  {
    title: "Conservation groups challenge the development program",
    description: (country) => `Scientists, residents, and conservation groups in ${country} ask the government to reconsider projects they believe threaten land and water security. Labor and industry groups defend the jobs involved, forcing a choice between competing public demands.`,
  },
  {
    title: "Civil-defense volunteers request official support",
    description: (country) => `Volunteer emergency networks in ${country} ask for training, communications equipment, and formal coordination with public agencies. Their rapid growth reflects public anxiety, but the government has not yet decided what role they should have.`,
  },
];

const text = (value) => String(value ?? "").trim();

const hashString = (value) => {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seedText) => {
  let state = hashString(seedText) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (values, random) => {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
};

const gameSeed = (game) => [game?.id, game?.name, game?.startDate, game?.country]
  .map(text)
  .filter(Boolean)
  .join("|") || "open-historia";

const catalogName = (entry) => text(typeof entry === "string" ? entry : entry?.name || entry?.code);

const uniqueNames = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const name = catalogName(value);
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key) || key === "unoccupied") return false;
    seen.add(key);
    return true;
  }).map(catalogName);
};

const buildSpotlightCandidates = (world, game, countryCatalog) => {
  const player = text(game?.country).toLocaleLowerCase();
  const customNames = Object.entries(world?.polityOverrides ?? {}).flatMap(([key, polity]) => [
    polity?.name,
    polity?.code,
    key,
  ]);
  const allNames = uniqueNames([
    ...customNames,
    ...(Array.isArray(countryCatalog) ? countryCatalog : []),
    ...(Array.isArray(world?.ownerCodes) ? world.ownerCodes : []),
    ...Object.values(world?.regionOwnershipOverrides ?? {}),
  ]).filter((name) => name.toLocaleLowerCase() !== player);
  const customKeys = new Set(uniqueNames(customNames).map((name) => name.toLocaleLowerCase()));
  const priority = allNames.filter((name) => customKeys.has(name.toLocaleLowerCase()) || STRATEGIC_ACTORS.has(name));
  return priority.length >= SPOTLIGHT_COUNT ? priority : allNames;
};

const domesticGap = (game, sequence) => 2 + (hashString(`${gameSeed(game)}|domestic|${sequence}`) % 3);

export const ensureNarrativeSystems = ({ world = {}, game = {}, countryCatalog = [] } = {}) => {
  const currentRound = Math.max(1, Math.trunc(Number(game.round) || 1));
  const existingAgendas = Array.isArray(world.hiddenAgendas) ? world.hiddenAgendas : [];
  const existingCountries = new Set(existingAgendas.map((agenda) => text(agenda?.country).toLocaleLowerCase()).filter(Boolean));
  const random = createRandom(`${gameSeed(game)}|spotlight-agendas`);
  const candidates = shuffled(buildSpotlightCandidates(world, game, countryCatalog), random)
    .filter((name) => !existingCountries.has(name.toLocaleLowerCase()));
  const archetypes = shuffled(AGENDA_ARCHETYPES, random);
  const hiddenAgendas = existingAgendas.slice(0, SPOTLIGHT_COUNT).map((agenda) => ({ ...agenda }));

  while (hiddenAgendas.length < SPOTLIGHT_COUNT && candidates.length) {
    const country = candidates.shift();
    const archetype = archetypes[hiddenAgendas.length % archetypes.length];
    hiddenAgendas.push({
      agendaId: archetype.id,
      country,
      lastActiveRound: 0,
      method: archetype.method,
      momentum: 0,
      objective: archetype.objective(country),
      selectedAtRound: currentRound,
    });
  }

  const rawPressure = world.domesticPressure && typeof world.domesticPressure === "object"
    ? world.domesticPressure
    : {};
  const sequence = Math.max(0, Math.trunc(Number(rawPressure.sequence) || 0));
  const nextRound = Number.isFinite(Number(rawPressure.nextRound)) && Number(rawPressure.nextRound) > 0
    ? Math.trunc(Number(rawPressure.nextRound))
    : currentRound + domesticGap(game, sequence);
  const domesticPressure = { nextRound, sequence };
  const changed = JSON.stringify(existingAgendas) !== JSON.stringify(hiddenAgendas)
    || Number(rawPressure.nextRound) !== nextRound
    || Number(rawPressure.sequence) !== sequence;

  return {
    changed,
    world: {
      ...world,
      domesticPressure,
      hiddenAgendas,
    },
  };
};

export const isDomesticPressureDue = (world, nextRound) => {
  const scheduledRound = Math.trunc(Number(world?.domesticPressure?.nextRound) || 0);
  return scheduledRound > 0 && Math.trunc(Number(nextRound) || 0) >= scheduledRound;
};

export const buildHiddenAgendaContext = (world) => {
  const agendas = Array.isArray(world?.hiddenAgendas) ? world.hiddenAgendas : [];
  if (!agendas.length) return "";
  const lines = agendas.map((agenda) => `- ${text(agenda.country)}: ${text(agenda.objective)} Method: ${text(agenda.method)}`);
  return [
    "These are private motives for recurring spotlight nations. Never name, quote, or reveal an agenda as hidden information. Let two to four relevant nations take concrete, plausible steps toward them during a normal jump; preserve continuity, and do not force all ten into every turn.",
    ...lines,
  ].join("\n");
};

export const buildSpeakerAgendaContext = (world, speakingAs) => {
  const speaker = text(speakingAs).toLocaleLowerCase();
  const agenda = (Array.isArray(world?.hiddenAgendas) ? world.hiddenAgendas : [])
    .find((entry) => text(entry?.country).toLocaleLowerCase() === speaker);
  if (!agenda) return "";
  return `Private motive for ${text(agenda.country)}: ${text(agenda.objective)} ${text(agenda.method)} Let this shape bargaining, trust, offers, and refusals, but never state or expose it as a hidden agenda.`;
};

export const buildDomesticPressureContext = (world, game) => {
  const nextRound = Math.max(1, Math.trunc(Number(game?.round) || 1)) + 1;
  if (!isDomesticPressureDue(world, nextRound)) return "";
  return `Include exactly one new event with kind "domestic" and playerRelated true in which citizens, workers, local leaders, or civic groups inside ${text(game?.country) || "the player's polity"} make a concrete request or create political pressure. Leave the government's response open for the player. Do not make the event resolve the demand on the player's behalf.`;
};

export const createDomesticPressureEvent = ({ world, game, date, round } = {}) => {
  const sequence = Math.max(0, Math.trunc(Number(world?.domesticPressure?.sequence) || 0));
  const templateIndex = hashString(`${gameSeed(game)}|domestic-event|${sequence}`) % DOMESTIC_EVENTS.length;
  const template = DOMESTIC_EVENTS[templateIndex];
  const country = text(game?.country) || "the country";
  return {
    countries: [{ code: country, name: country }],
    date: text(date || game?.gameDate),
    description: template.description(country),
    id: `domestic-pressure-${Math.max(1, Math.trunc(Number(round) || 1))}-${sequence + 1}`,
    impacts: {},
    importance: sequence > 0 && (sequence + 1) % 3 === 0 ? "major" : "minor",
    kind: "domestic",
    notable: sequence > 0 && (sequence + 1) % 3 === 0,
    playerRelated: true,
    source: "simulation",
    title: template.title,
  };
};

export const advanceNarrativeSystems = ({ world = {}, game = {}, events = [], domesticOccurred = false } = {}) => {
  const round = Math.max(1, Math.trunc(Number(game?.round) || 1));
  const eventText = events.map((event) => `${text(event?.title)} ${text(event?.description)}`.toLocaleLowerCase()).join("\n");
  const hiddenAgendas = (Array.isArray(world.hiddenAgendas) ? world.hiddenAgendas : []).map((agenda) => {
    const active = eventText.includes(text(agenda?.country).toLocaleLowerCase());
    const oldMomentum = Math.max(0, Math.min(100, Math.trunc(Number(agenda?.momentum) || 0)));
    return {
      ...agenda,
      lastActiveRound: active ? round : Math.max(0, Math.trunc(Number(agenda?.lastActiveRound) || 0)),
      momentum: active ? Math.min(100, oldMomentum + 8) : Math.max(0, oldMomentum - 1),
    };
  });

  const pressure = world.domesticPressure && typeof world.domesticPressure === "object"
    ? world.domesticPressure
    : { nextRound: round + domesticGap(game, 0), sequence: 0 };
  const sequence = Math.max(0, Math.trunc(Number(pressure.sequence) || 0)) + (domesticOccurred ? 1 : 0);
  const domesticPressure = domesticOccurred
    ? { sequence, nextRound: round + domesticGap(game, sequence) }
    : { sequence, nextRound: Math.max(round + 1, Math.trunc(Number(pressure.nextRound) || round + 1)) };

  return {
    ...world,
    domesticPressure,
    hiddenAgendas,
  };
};
