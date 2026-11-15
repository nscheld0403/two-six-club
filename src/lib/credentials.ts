/**
 * Member credentials.
 *
 * A sign-in code looks like `K7M3Q9-ABCD-EFGH-JKMN-PQRS`:
 *   - the first group is the public member code (6 chars, ~30 bits) that
 *     identifies the account;
 *   - the remaining 16 chars are the secret access key (80 bits of entropy),
 *     used as the Supabase Auth password and never stored by the app.
 *
 * Alphabet: Crockford base32 (no I, L, O, U) so codes are easy to read aloud
 * and type. Parsing is forgiving: case, spaces, dashes, O→0 and I/L→1.
 */
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const MEMBER_CODE_LENGTH = 6;
export const ACCESS_KEY_LENGTH = 16;

// Web Crypto (available in browsers and Node 20+). 256 is a multiple of 32,
// so masking a random byte to 5 bits is unbiased.
function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

export function generateMemberCode(): string {
  return randomString(MEMBER_CODE_LENGTH);
}

export function generateAccessKey(): string {
  return randomString(ACCESS_KEY_LENGTH);
}

export function formatSignInCode(memberCode: string, accessKey: string): string {
  const groups = accessKey.match(/.{1,4}/g) ?? [];
  return [memberCode, ...groups].join("-");
}

export function normalize(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export type ParsedSignInCode = { memberCode: string; accessKey: string };

export function parseSignInCode(input: string): ParsedSignInCode | null {
  const clean = normalize(input);
  if (clean.length !== MEMBER_CODE_LENGTH + ACCESS_KEY_LENGTH) return null;
  for (const ch of clean) if (!ALPHABET.includes(ch)) return null;
  return {
    memberCode: clean.slice(0, MEMBER_CODE_LENGTH),
    accessKey: clean.slice(MEMBER_CODE_LENGTH),
  };
}

/** Internal auth identity. Never shown to members; no mail is ever sent. */
export function memberAuthEmail(memberCode: string, domain: string): string {
  return `${memberCode.toLowerCase()}@${domain}`;
}
