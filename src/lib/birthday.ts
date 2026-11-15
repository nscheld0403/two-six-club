/** Birthday helpers. Dates are plain YYYY-MM-DD strings. */

export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

function isLeap(y: number) {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

/** Same rule as the database: Feb 29 birthdays are celebrated on Feb 28 in non-leap years. */
export function isBirthdayOn(birthDate: string | null | undefined, onDate: string): boolean {
  if (!birthDate) return false;
  const [, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  if (bm === m && bd === d) return true;
  return bm === 2 && bd === 29 && m === 2 && d === 28 && !isLeap(y);
}

export function formatBirthday(birthDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${birthDate}T12:00:00Z`),
  );
}
