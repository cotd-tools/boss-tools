import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bossCode,
  dateKey,
  effectiveDate,
  nextReset,
  parseDate,
  shiftDate,
  duration,
} from "../src/lib/schedule.ts";

test("preserves the reference cycle, including dates before the anchor", () => {
  // Snapshot of the original 26-day community cycle. Keep this independent of
  // production CYCLE so accidental data changes still fail the regression test.
  const expectedCycle = [
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
  const anchor = new Date("2025-12-15T00:00:00Z");
  for (let offset = -78; offset <= 78; offset++) {
    assert.equal(
      bossCode(shiftDate(anchor, offset)),
      expectedCycle[((offset % 26) + 26) % 26],
    );
  }
});

test("switches exactly at each region’s device-local refresh hour", () => {
  for (const hour of [4, 5]) {
    assert.equal(
      dateKey(effectiveDate(hour, new Date(2026, 0, 1, hour - 1, 59, 59))),
      "2025-12-31",
    );
    assert.equal(
      dateKey(effectiveDate(hour, new Date(2026, 0, 1, hour, 0, 0))),
      "2026-01-01",
    );
    const next = nextReset(hour, new Date(2026, 0, 1, hour, 0, 0));
    assert.equal(next.getDate(), 2);
    assert.equal(next.getHours(), hour);
  }
});

test("refresh remains at local wall-clock hour across daylight-saving changes", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const now = new Date(2026, 2, 7, 5, 0, 0);
    const reset = nextReset(5, now);
    assert.equal(reset.getHours(), 5);
    assert.equal(reset.getDate(), 8);
    assert.equal((reset.getTime() - now.getTime()) / 3_600_000, 23);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("rejects malformed dates and accepts leap days without timezone drift", () => {
  for (const value of ["", "invalid", "2026-02-30", "2026-13-01", "26-1-1"])
    assert.equal(parseDate(value), null);
  assert.equal(dateKey(parseDate("2024-02-29")!), "2024-02-29");
  assert.equal(dateKey(shiftDate(parseDate("2024-02-29")!, 1)), "2024-03-01");
  assert.equal(duration(1000 * (24 * 3600 + 61)), "24:01:01");
  assert.equal(duration(-5), "00:00:00");
});
