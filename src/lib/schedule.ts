import northAmericanZones from "./north-american-zones.json" with { type: "json" };

export const DAY = 86_400_000;
const BASE_DATE = Date.UTC(2025, 11, 15);
// Community cycle from the original Boss点位速查.html; no new game data inferred.
export const CYCLE = [
  "23211211",
  "14344644",
  "13311111",
  "31133333",
  "33111311",
  "11333133",
  "34144544",
  "23211211",
  "23211211",
  "32122522",
  "14344644",
  "21233233",
  "34144544",
  "32122522",
  "24244444",
  "11333133",
  "32122522",
  "21233233",
  "33111311",
  "23211211",
  "32122522",
  "32122522",
  "23211211",
  "23211211",
  "21233233",
  "23211211",
];
export const REGIONS = {
  other: { name: "其他地区服", hour: 4 },
  us_ca: { name: "北美服", hour: 5 },
} as const;
export type RegionKey = keyof typeof REGIONS;

export function guessRegion(): RegionKey {
  return northAmericanZones.includes(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
    ? "us_ca"
    : "other";
}

export function bossCode(date: Date): string {
  const delta = Math.round((date.getTime() - BASE_DATE) / DAY);
  return CYCLE[((delta % CYCLE.length) + CYCLE.length) % CYCLE.length]!;
}

export function effectiveDate(hour: number, now = new Date()): Date {
  const midnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(midnight - (now.getHours() < hour ? DAY : 0));
}

export function nextReset(hour: number, now = new Date()): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value
    ? date
    : null;
}
export function shiftDate(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
