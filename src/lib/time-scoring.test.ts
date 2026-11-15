import { describe, expect, it } from "vitest";
import { addDays, dateKeyIn, formatTime, isoWeekday, mondayOf, zonedToUtc } from "./time";
import { estimate1RM, formatDuration, formatPace, formatScore, parseDuration } from "./scoring";

describe("gym time", () => {
  it("finds Mondays and weekdays", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("uses the gym's zone for 'today'", () => {
    // 03:30 UTC on Nov 17 is still Nov 16 in New York.
    expect(dateKeyIn(new Date("2026-11-17T03:30:00Z"), "America/New_York")).toBe("2026-11-16");
  });

  it("converts gym wall-clock times to UTC across DST", () => {
    expect(zonedToUtc("2026-11-16", "17:30", "America/New_York").toISOString()).toBe("2026-11-16T22:30:00.000Z");
    expect(zonedToUtc("2026-07-06", "05:30", "America/New_York").toISOString()).toBe("2026-07-06T09:30:00.000Z");
    expect(zonedToUtc("2026-03-08", "09:00", "America/New_York").toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(formatTime("2026-11-16T22:30:00Z", "America/New_York")).toMatchObject({ time: "5:30", ampm: "PM" });
  });
});

describe("scores", () => {
  it("formats and parses durations", () => {
    expect(formatDuration(822)).toBe("13:42");
    expect(formatDuration(4722)).toBe("1:18:42");
    expect(parseDuration("13:42")).toBe(822);
    expect(parseDuration("1:18:42")).toBe(4722);
    expect(parseDuration("12m 5s")).toBe(725);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("12:75")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });

  it("formats every scoring type", () => {
    expect(formatScore({ scoring: "for_time", time_seconds: 822 })).toBe("13:42");
    expect(formatScore({ scoring: "for_time", capped: true, reps: 120 })).toBe("CAP +120");
    expect(formatScore({ scoring: "amrap", rounds: 5, reps: 12 })).toBe("5 + 12");
    expect(formatScore({ scoring: "emom", reps: 84 })).toBe("84 reps");
    expect(formatScore({ scoring: "max_weight", load_lbs: 265 })).toBe("265 lb");
    expect(formatScore({ scoring: "distance", distance_m: 2150 })).toBe("2.15 km");
    expect(formatScore({ scoring: "calories", calories: 61 })).toBe("61 cal");
  });

  it("computes pace and e1RM", () => {
    expect(formatPace(428, 2000)).toBe("1:47/500m");
    expect(formatPace(1500, 5000, 1000)).toBe("5:00/km");
    expect(estimate1RM(205, 3)).toBe(225.5);
    expect(estimate1RM(225, 1)).toBe(225);
  });
});
