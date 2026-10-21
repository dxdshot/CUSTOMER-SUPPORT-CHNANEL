# Customer Support Channel

A customer support dashboard with an embeddable chat widget. It includes an inbox,
visitor history, typing and presence state, preset replies, tags, attachments, email
notifications, read receipts, and conversation ratings.

## Stack

- Next.js 16 and React 19
- Supabase Postgres and Realtime
- TypeScript and Tailwind CSS

## Run locally

Requires Node.js 22, pnpm 10, and a Supabase project.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Add your Supabase values to `.env.local`, then run `supabase/schema.sql` in the Supabase
SQL editor. Open `http://localhost:3000` for the dashboard.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Embed the widget on another page with the site key shown in dashboard settings.

```html
<script
  src="http://localhost:3000/widget/embed.js"
  data-site="your-site-key"
  async
></script>
```

## Checks

```bash
pnpm test
pnpm lint
pnpm verify:widget
pnpm build
```

The included Supabase policies support local demos. Tighten access policies and add agent
authentication before a production deployment.
