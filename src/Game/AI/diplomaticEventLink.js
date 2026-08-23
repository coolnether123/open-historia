export const formatDiplomaticMessageForAI = (playerMessage, linkedEvent = {}) => {
  const title = String(linkedEvent?.linkedEventTitle ?? linkedEvent?.title ?? "").trim();
  if (!title) return playerMessage;

  const date = String(linkedEvent?.linkedEventDate ?? linkedEvent?.date ?? "").trim();
  const description = String(linkedEvent?.linkedEventDescription ?? linkedEvent?.description ?? "").trim();
  const eventContext = [date, title, description].filter(Boolean).join(" | ");
  return `[The player explicitly linked this message to the event: ${eventContext}]\n${playerMessage}`;
};
