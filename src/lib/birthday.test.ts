import { describe, expect, it } from "vitest";
import { ageOn, isBirthdayOn } from "./birthday";

describe("birthdays", () => {
  it("computes age on a given day", () => {
    expect(ageOn("1990-11-16", "2026-11-15")).toBe(35);
    expect(ageOn("1990-11-16", "2026-11-16")).toBe(36);
    expect(ageOn("2000-02-29", "2027-02-28")).toBe(26);
  });
  it("matches birthdays, with Feb 29 on Feb 28 in non-leap years", () => {
    expect(isBirthdayOn("1990-11-16", "2026-11-16")).toBe(true);
    expect(isBirthdayOn("1990-11-16", "2026-11-17")).toBe(false);
    expect(isBirthdayOn("2000-02-29", "2027-02-28")).toBe(true);
    expect(isBirthdayOn("2000-02-29", "2028-02-28")).toBe(false);
    expect(isBirthdayOn("2000-02-29", "2028-02-29")).toBe(true);
    expect(isBirthdayOn(null, "2026-11-16")).toBe(false);
  });
});
