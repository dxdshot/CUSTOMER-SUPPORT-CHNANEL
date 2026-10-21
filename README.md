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
SQL editor. Open the dashboard at the address printed by `pnpm dev`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_WIDGET_ORIGIN=https://support-widget-six.vercel.app
```

Copy the install snippet from the dashboard's Widget page, or use the deployed host
with your site key. The script loads its API and artwork from the same HTTPS host.

```html
<script
  src="https://support-widget-six.vercel.app/widget/embed.js"
  data-site="your-site-key"
  data-color="#2563eb"
  async
></script>
```

For a site with a strict Content Security Policy, allow this host in `script-src`
and `connect-src`. The widget uses the script's `nonce` for its injected stylesheet;
allow that nonce in `style-src` too. Set `NEXT_PUBLIC_WIDGET_ORIGIN` at build time if
the widget moves to another HTTPS domain.

## Checks

```bash
pnpm test
pnpm lint
pnpm verify:widget
pnpm build
```

The included Supabase policies support local demos. Tighten access policies and add agent
authentication before a production deployment.
