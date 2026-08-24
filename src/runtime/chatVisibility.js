const normalizeIdentity = (value) => String(value ?? "").trim().toLocaleLowerCase();

const identityValues = (entry) => {
  if (typeof entry === "string") return [normalizeIdentity(entry)].filter(Boolean);
  return [entry?.name, entry?.code].map(normalizeIdentity).filter(Boolean);
};

export const chatControlledCountries = (chat) => {
  const countries = [];
  const seen = new Set();
  const add = (entry) => {
    const keys = identityValues(entry);
    const key = keys[0];
    if (!key || seen.has(key)) return;
    seen.add(key);
    countries.push(entry);
  };

  (chat?.controlledCountries ?? []).forEach(add);
  (chat?.messages ?? [])
    .filter((message) => ["user", "player"].includes(normalizeIdentity(message?.role)))
    .forEach((message) => add({ code: message?.code || "", name: message?.speaker || "" }));

  // Early generated chats did not record controlledCountries. In a two-sided
  // approach, the country that did not send the opening message was the player.
  if (countries.length === 0) {
    const speakerKeys = new Set(
      (chat?.messages ?? [])
        .filter((message) => !["user", "player"].includes(normalizeIdentity(message?.role)))
        .flatMap((message) => identityValues({ code: message?.code || "", name: message?.speaker || "" })),
    );
    if (speakerKeys.size > 0) {
      const inferred = (chat?.countries ?? [])
        .filter((entry) => !identityValues(entry).some((key) => speakerKeys.has(key)));
      if (inferred.length === 1) add(inferred[0]);
    }
  }
  return countries;
};

export const chatBelongsToCountry = (chat, country) => {
  const activeKeys = new Set(identityValues(country));
  if (activeKeys.size === 0) return false;
  return chatControlledCountries(chat)
    .some((controlled) => identityValues(controlled).some((key) => activeKeys.has(key)));
};
