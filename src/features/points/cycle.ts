const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

export const POINTS_CYCLE_DAYS = 75;
export const POINTS_CYCLE_ANCHOR = new Date("2026-11-16T00:00:00-03:00");
// 30 de janeiro é o último dia de uso; endsAt é exclusivo e aponta para 31/01.
const FIRST_CYCLE_END = new Date("2027-01-31T00:00:00-03:00");

function dateParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as { year: string; month: string; day: string };
}

function monthDefinition(date: Date) {
  const { year, month } = dateParts(date);
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const nextYear = numericMonth === 12 ? numericYear + 1 : numericYear;
  const nextMonth = numericMonth === 12 ? 1 : numericMonth + 1;
  const key = `${year}-${month}`;
  return {
    key,
    year: numericYear,
    month: numericMonth,
    startsAt: new Date(`${key}-01T00:00:00-03:00`),
    endsAt: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`),
  };
}

export function pointsCycleDefinitionForDate(date = new Date()) {
  if (date < POINTS_CYCLE_ANCHOR) return monthDefinition(date);

  let startsAt = new Date(POINTS_CYCLE_ANCHOR);
  let endsAt = new Date(FIRST_CYCLE_END);
  while (date >= endsAt) {
    startsAt = endsAt;
    endsAt = new Date(startsAt.getTime() + POINTS_CYCLE_DAYS * DAY_MS);
  }

  const { year, month, day } = dateParts(startsAt);
  return {
    key: `cycle-${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
    startsAt,
    endsAt,
  };
}

export function pointsCycleLastUseDate(endsAt: Date) {
  return new Date(endsAt.getTime() - 1);
}
