import { describe, expect, it } from "vitest";
import {
  ALPHABET,
  formatSignInCode,
  generateAccessKey,
  generateMemberCode,
  memberAuthEmail,
  parseSignInCode,
} from "./credentials";
import { registrationSchema } from "./validation";

describe("credentials", () => {
  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateMemberCode();
      const key = generateAccessKey();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(key).toHaveLength(16);
      for (const ch of key) expect(ALPHABET).toContain(ch);
    }
  });

  it("does not repeat keys", () => {
    const seen = new Set(Array.from({ length: 5000 }, generateAccessKey));
    expect(seen.size).toBe(5000);
  });

  it("round-trips a formatted sign-in code", () => {
    const code = generateMemberCode();
    const key = generateAccessKey();
    const formatted = formatSignInCode(code, key);
    expect(formatted).toMatch(/^[0-9A-Z]{6}(-[0-9A-Z]{4}){4}$/);
    expect(parseSignInCode(formatted)).toEqual({ memberCode: code, accessKey: key });
  });

  it("parses forgiving input", () => {
    expect(parseSignInCode(" k7m3q9 abcd efgh jkmn pqrs ")).toEqual({
      memberCode: "K7M3Q9",
      accessKey: "ABCDEFGHJKMNPQRS",
    });
    // O -> 0, I/L -> 1
    expect(parseSignInCode("K7M3Q9-OOOO-IIII-LLLL-2222")?.accessKey).toBe("0000111111112222");
  });

  it("rejects malformed codes", () => {
    expect(parseSignInCode("")).toBeNull();
    expect(parseSignInCode("K7M3Q9-ABCD")).toBeNull();
    expect(parseSignInCode("K7M3Q9-ABCD-EFGH-JKMN-PQRU")).toBeNull(); // U not allowed
    expect(parseSignInCode("K7M3Q9-ABCD-EFGH-JKMN-PQRS-XXXX")).toBeNull();
  });

  it("derives a stable internal identity", () => {
    expect(memberAuthEmail("K7M3Q9", "members.example.invalid")).toBe("k7m3q9@members.example.invalid");
  });
});

describe("registration validation", () => {
  it("accepts a minimal valid registration", () => {
    const r = registrationSchema.parse({ displayName: "  Alex   Rivera ", age: "34", sex: "undisclosed" });
    expect(r).toEqual({ displayName: "Alex Rivera", age: 34, sex: "undisclosed" });
  });

  it("rejects bad input", () => {
    expect(registrationSchema.safeParse({ displayName: "", age: 30, sex: "male" }).success).toBe(false);
    expect(registrationSchema.safeParse({ displayName: "A", age: 9, sex: "male" }).success).toBe(false);
    expect(registrationSchema.safeParse({ displayName: "A", age: 30, sex: "other" }).success).toBe(false);
    expect(registrationSchema.safeParse({ displayName: "A", age: 30.5, sex: "male" }).success).toBe(false);
    const empty = registrationSchema.safeParse({ displayName: "A", age: "", sex: "male" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe("Enter your age");
    expect(registrationSchema.safeParse({ displayName: "A", age: "abc", sex: "male" }).success).toBe(false);
  });
});
