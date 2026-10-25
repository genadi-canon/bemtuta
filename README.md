# במטותא · Bematuta

Marketplace that connects people who need a small job done (furniture assembly, small moves, cleaning, sitting) with verified local providers. Pilot: Bat Yam, Hebrew and Russian.

Stack: Next.js 15 (App Router, server actions) + Supabase (Postgres, phone auth, storage, realtime). Notifications through Twilio WhatsApp/SMS when configured.

## Local development

```bash
npm install
npx supabase start            # needs Docker; applies supabase/migrations
cp .env.example .env.local    # fill from `npx supabase status -o env`
npm run dev
```

Test phone numbers (code `123456`, no SMS sent) are in `supabase/config.toml` under `[auth.sms.test_otp]`: 050-0000001, 050-0000002, 050-0000003.

Make yourself an admin:

```sql
update profiles set is_admin = true where id = '<your user id>';
```

Database checks: `npm run test:db` runs `supabase/tests/flow.sql` (task lifecycle and row-level security) against the local database.

## Production

1. Create a Supabase project. Run `npx supabase link` and `npx supabase db push`.
2. In Supabase → Authentication → Phone: enable phone sign-in and connect an SMS provider (Twilio).
3. Create a Vercel project from this repository and set the variables from `.env.example`.
4. `vercel.json` runs `/api/cron` hourly: expires stale tasks and alerts admins about tasks without offers.

## Flow

Customer posts a task → matching approved providers are notified → providers send offers → customer chooses one → the address and chat open for the two of them → either side marks it done → both rate each other.

Payment is outside the app during the pilot.
