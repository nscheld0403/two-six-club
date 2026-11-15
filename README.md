# The Two Six Club

Private, members-only training app for a garage gym: class scheduling, workout
logging, leaderboards and analytics. Built from the approved Garage 26 design
system (matte black, Barlow Condensed + Inter, volt accent).

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Row Level Security) · Vercel.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Design system port, database, registration, sign-in, approval, admin member management | Done |
| 2 | Weekly calendar, workouts, classes, recurring sessions, open gym, duplicate week, RSVPs, attendance | Done |
| 3 | Result logging (all workout types), strength sets, PRs, member history | Done |
| 4 | Leaderboards, analytics dashboard (Recharts) | Done |
| 5 | Deploy, live end-to-end test, polish | In progress |

## How member access works

- Joining asks only for **name, age and sex** (Male / Female / Prefer not to say).
  No email or phone number.
- The server creates a Supabase Auth account and shows the member a one-time
  **sign-in code**, for example `K7M3Q9-ABCD-EFGH-JKMN-PQRS`.
  - The first group is their public member code.
  - The remaining 16 characters are an 80-bit random secret. It is used as the
    Supabase Auth password (stored only as a bcrypt hash) and is never stored
    by the app.
- Sessions persist in secure cookies, so members stay signed in on their device.
- New accounts start as **pending**. Pending members can't see club data
  until the admin approves them.
- **Lost code:** the admin opens the member and chooses *Reset sign-in code*.
  A new code is issued, the old one stops working, and every device is signed out.
- Behind the scenes each account has an internal identity like
  `k7m3q9@members.twosix.invalid`. It is not a mailbox, and no email is ever sent.

## Security

- Row Level Security on every table. Members can read and edit only their own
  profile, and only name, age, sex and privacy settings.
- Database triggers block members from changing role, status or member code.
  The admin can't suspend or demote themselves.
- Status and role changes are written to an audit log that only the admin can read.
- The service-role key is used only in server code, after an admin check.
- Sign-ups are rate-limited per client using a salted IP hash (no raw IPs are stored),
  and there is a bot honeypot field.
- The gym's address is not stored anywhere in the app. Share it with approved
  members privately.
- Search engines are told not to index the app.

## Launch checklist (no command line needed)

1. **Supabase:** create a project, then open **SQL Editor → New query**, paste all of
   `supabase/setup.sql`, and click **Run**. In **Authentication → Sign In / Providers**,
   turn off **Allow new users to sign up**.
2. **Vercel:** import the GitHub repository and add these environment variables,
   copying the values from Supabase **Project Settings → API Keys / Data API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (the secret one)
   - `ADMIN_SETUP_CODE` (a long phrase only you know)
   - `RATE_LIMIT_SALT` (any long random text)
   - `NEXT_PUBLIC_GYM_TIMEZONE` (for example `America/New_York`)

   Then click **Deploy**.
3. **Create your admin account:** open `https://<your-site>/setup`, enter the setup
   code, and save the sign-in code it shows you. The page stops working once an admin exists.

## Setup (developers)

1. **Create a Supabase project** at supabase.com.
2. **Auth settings** (Authentication → Sign In / Providers):
   - Turn **off** "Allow new users to sign up". Accounts are created by the
     server only, so the public key can't be used to create users.
   - Leave the Email provider enabled. Confirmation emails aren't used: the
     server creates accounts as already confirmed.
3. **Apply the migrations** in `supabase/migrations`, in filename order. Either paste
   `supabase/setup.sql` (all migrations combined; regenerate it with
   `scripts/build-setup-sql.sh`) into the SQL editor, or use the Supabase CLI:

   ```bash
   npx supabase link --project-ref YOUR-PROJECT-REF
   ```

   ```bash
   npx supabase db push
   ```

4. **Environment variables:** copy `.env.example` to `.env.local` and fill it in.
   On Vercel, add the same variables in Project → Settings → Environment Variables.
5. **Install and run:**

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

6. **Create your admin account.** It prints your sign-in code once:

   ```bash
   npm run admin:create -- "Your Name" 40
   ```

   Or, if you already joined through the app, promote that account:

   ```bash
   npm run admin:promote -- K7M3Q9
   ```

## Testing

```bash
npm run check
```

This runs the typecheck, lint, unit tests (`vitest`) and the database tests.

The database tests (`npm run test:db`) apply every migration to a throwaway
local Postgres 16 cluster, with a stub of Supabase's `auth` schema. They then
run `supabase/tests/*.sql`, which check Row Level Security and the triggers as
anonymous, pending, active and admin users.

To run the UI smoke test against a production build (requires Playwright):

```bash
npm run build && npx next start -p 3100
```

```bash
node scripts/smoke-ui.mjs
```

## Deploying to Vercel

Import the repository in Vercel, add the environment variables from
`.env.example`, and deploy. No custom build settings are needed.
`NEXT_PUBLIC_GYM_TIMEZONE` controls what "today" means for class times.

## Project layout

```
src/app/(public)     welcome, join, sign-in (no session needed)
src/app/(member)     member app: home, schedule, log, ranks, progress, account
src/app/admin        coach admin (admin only)
src/app/pending      waiting-for-approval / suspended screen
src/components/ui    design-system components (Button, Card, Badge, Field, Segmented…)
src/lib              auth guards, credentials, Supabase clients, validation
src/proxy.ts         session refresh and signed-out redirects
supabase/migrations  schema + RLS, one file per phase
supabase/tests       SQL tests for RLS and triggers
```
