# Handover

A mobile-first team progress tracker. Everyone logs timestamped progress (with
photos) on their projects from their phone, and the team gets one table showing
where every project stands, which can be shared straight to WhatsApp.

Built with Next.js (installable PWA), Supabase (Postgres, auth, storage) and
deployable to Vercel. All three have free tiers that cover a 15-person team.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 1 | Login with email code, create/join team via invite link, installable app shell, profile | ✅ Done |
| 2 | Create projects, public/private projects with members | ⏳ Next |
| 3 | Quick logging: text + camera/gallery photos, project timeline | |
| 4 | Dashboard: cards on phone, table on desktop, filters, stale-project highlight | |
| 5 | Share dashboard to WhatsApp as image and as formatted text | |
| 6 | Optional: push reminders, weekly digest, comments, exports, app-store build | |

The database schema and access rules for phases 1–3 are already in place
(`supabase/migrations`).

## Access rules (enforced in the database)

- Everyone in a team sees every **public** project and can post updates on it.
- **Private** projects are visible only to their creator, owner and added members.
- Log timestamps and authors are set by the database and can't be faked.
- Status and % complete change only through a progress update, so every change
  has a timestamped entry. Project settings can be changed by the creator,
  owner or a team admin.

Run `npm run test:db` to check these rules against a local database.

## Run locally

Requires Node 20+ and Docker.

```bash
npm install
npm run db:start              # local Supabase; prints the URL and publishable key
cp .env.example .env.local    # paste API_URL and PUBLISHABLE_KEY from the output
npm run dev                   # http://localhost:3000
```

Login codes sent locally appear in Mailpit at http://127.0.0.1:54324.

## Go live (one-time setup, ~20 minutes)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Link it and push the schema (already done for the live project):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Migration file names match the versions recorded on the live project, so
   `db push` only applies new ones.
3. **Authentication → Email templates**: in both **Magic Link** and **Confirm
   signup**, replace the body with the contents of `supabase/templates/otp.html`
   (it must contain `{{ .Token }}` so people get a code instead of a link).
4. **Authentication → SMTP settings**: connect an email provider (for example
   [Resend](https://resend.com), free for 3,000 emails/month). Supabase's
   built-in email only delivers to your own Supabase account and a few
   emails per hour, so teammates won't receive codes without this.
5. **Authentication → URL configuration**: set Site URL to your Vercel URL.

### 2. Vercel
1. Import this GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Add environment variables from Supabase → Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy. Every push to the main branch redeploys automatically.

### 3. Invite the team
Open the app on your phone, sign in, create your team, then go to **Profile →
WhatsApp** to send the invite link to your team group. Each person taps the
link, signs in with their email code, and adds the app to their home screen.

## Project layout

```
src/
  app/
    login/          email → one-time code sign-in
    onboarding/     set name, create or join a team
    join/[code]/    invite link landing page
    (app)/          signed-in area with bottom tab bar
      page.tsx      dashboard
      projects/     projects
      log/          post an update
      profile/      name, team members, invite link, install app, sign out
    actions.ts      server actions
    manifest.ts     PWA manifest
  components/       UI building blocks
  lib/
    auth.ts         current user / team helpers
    supabase/       browser, server and proxy clients
  proxy.ts          session refresh + sign-in redirect
supabase/
  migrations/       schema, access rules, photo storage
  templates/        login-code email
  tests/            access-rule tests
public/             icons, service worker, offline page
```
