/**
 * Brand settings. The gym's street address is intentionally NOT part of the
 * app: share it with approved members privately.
 */
export const brand = {
  name: "The Two Six Club",
  wordmark: "TWO SIX",
  mark: "26",
  tagline: "A private strength and conditioning club for friends, family and approved members.",
  disciplines: ["CrossFit", "HYROX", "Strength", "Conditioning"],
  coachName: "the coach",
  /** IANA time zone the gym runs on. Class times and "today" use this. */
  timeZone: process.env.NEXT_PUBLIC_GYM_TIMEZONE || "America/New_York",
} as const;
