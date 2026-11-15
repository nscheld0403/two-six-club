import { describe, expect, it } from "vitest";
import { benchmarkProgress, monthBuckets, monthlyActivity, weekStreak, weeklyActivity, weeklyVolume } from "./analytics";

const today = "2026-11-18"; // Wednesday

describe("activity", () => {
  it("counts training days per week once, plus classes", () => {
    const w = weeklyActivity(
      [
        { date: "2026-11-16", kind: "class" },
        { date: "2026-11-16", kind: "result" },
        { date: "2026-11-18", kind: "result" },
        { date: "2026-11-10", kind: "class" },
      ],
      today,
      3,
    );
    expect(w.map((x) => x.key)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(w.map((x) => x.days)).toEqual([0, 1, 2]);
    expect(w.map((x) => x.classes)).toEqual([0, 1, 1]);
  });

  it("buckets months across a year boundary", () => {
    expect(monthBuckets("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthlyActivity([{ date: "2026-01-03", kind: "class" }], "2026-02-10", 2).map((m) => m.classes)).toEqual([1, 0]);
  });

  it("computes week streaks, forgiving an empty current week", () => {
    const ev = (d: string) => ({ date: d, kind: "result" as const });
    expect(weekStreak([ev("2026-11-17"), ev("2026-11-10"), ev("2026-11-03")], today)).toBe(3);
    expect(weekStreak([ev("2026-11-10"), ev("2026-11-03")], today)).toBe(2);
    expect(weekStreak([ev("2026-10-20")], today)).toBe(0);
  });

  it("sums weekly volume", () => {
    const v = weeklyVolume(
      [
        { performed_on: "2026-11-16", volume_lbs: 1000 },
        { performed_on: "2026-11-17", volume_lbs: 500.4 },
      ],
      today,
      2,
    );
    expect(v.map((x) => x.volume)).toEqual([0, 1500]);
  });
});

describe("benchmarks", () => {
  it("finds first, best and latest per benchmark and scaling", () => {
    const p = benchmarkProgress([
      { benchmark_name: "Fran", performed_on: "2026-01-01", score_value: 9999700, rx: true },
      { benchmark_name: "fran", performed_on: "2026-06-01", score_value: 9999750, rx: true },
      { benchmark_name: "Fran", performed_on: "2026-09-01", score_value: 9999740, rx: true },
      { benchmark_name: "Fran", performed_on: "2026-02-01", score_value: 9999600, rx: false },
    ]);
    const rx = p.find((x) => x.rx)!;
    expect(rx.attempts).toBe(3);
    expect(rx.best.performed_on).toBe("2026-06-01");
    expect(rx.latest.performed_on).toBe("2026-09-01");
    expect(rx.improved).toBe(true);
    expect(p.find((x) => !x.rx)!.improved).toBe(false);
  });
});
