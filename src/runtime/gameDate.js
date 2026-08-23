// Game dates are calendar dates, not instants. Parsing YYYY-MM-DD with the
// Date constructor treats it as UTC and displays the previous day in western
// time zones, so ISO game dates are formatted explicitly in UTC.
export function formatGameDate(value, locale = []) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/u.exec(text);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}
