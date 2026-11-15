#!/usr/bin/env node
// Creates the administrator account, or promotes an existing member.
//
//   npm run admin:create -- "Your Name" 40
//   npm run admin:promote -- K7M3Q9
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { createClient } from "@supabase/supabase-js";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b & 31]).join("");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const domain = process.env.NEXT_PUBLIC_MEMBER_EMAIL_DOMAIN || "members.twosix.invalid";
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [mode, ...args] = process.argv.slice(2);

if (mode === "promote") {
  const code = (args[0] ?? "").toUpperCase();
  const { data, error } = await admin
    .from("profiles")
    .update({ role: "admin", status: "active" })
    .eq("member_code", code)
    .select("display_name")
    .maybeSingle();
  if (error || !data) {
    console.error("No member with that code.", error?.message ?? "");
    process.exit(1);
  }
  console.log(`${data.display_name} is now the administrator.`);
  process.exit(0);
}

if (mode === "create") {
  const name = (args[0] ?? "").trim();
  const age = Number(args[1]);
  if (!name || !Number.isInteger(age) || age < 13 || age > 100) {
    console.error('Usage: npm run admin:create -- "Your Name" <age>');
    process.exit(1);
  }
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) > 0 && !args.includes("--force")) {
    console.error("An administrator already exists. Pass --force to create another.");
    process.exit(1);
  }
  const memberCode = rand(6);
  const accessKey = rand(16);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${memberCode.toLowerCase()}@${domain}`,
    password: accessKey,
    email_confirm: true,
    app_metadata: { member_code: memberCode },
  });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id,
    member_code: memberCode,
    display_name: name,
    age,
    sex: "undisclosed",
    role: "admin",
    status: "active",
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(pErr.message);
    process.exit(1);
  }
  const signIn = [memberCode, ...accessKey.match(/.{4}/g)].join("-");
  console.log("\nAdministrator created. Your sign-in code (shown once, save it now):\n");
  console.log(`   ${signIn}\n`);
  process.exit(0);
}

console.error('Usage:\n  npm run admin:create -- "Your Name" <age>\n  npm run admin:promote -- <MEMBER_CODE>');
process.exit(1);
