# Decision log — chat-platform

Why each choice was made, so future sessions don't re-litigate them. Append-only:
add new entries at the bottom, and supersede an old one by referencing its number.

Last updated: 2026-10-20 · Status: Tier-1 depth (D32–D36); audit continuation — profiles, exact-thread presence, live unread, lazy transcripts, incremental polling, replay-safe sends (D37); profile photo in widget replies and viewer status (D38); named typing + per-agent online/offline dots (D39); surface-aware titles + reply-soon status (D40); per-agent away message drives the welcome bubble and idle line (D41); profile hydration, agent visibility, session drafts, and reduced idle work (D42); preset answers (D44); closed-state avatar, neutral preset bubbles, and anchored welcome (D45); dynamic tag registry with live dashboard updates (D46); visitor topic prompt on the first message (D47); right-aligned preset chips and a neutral topic dropdown (D48); live-only header identity and a Support online/offline status (D49); per-site welcome notification toggle (D50); no mandatory visitor identity before chatting (D51); optional email prompt, first-chat CTA, compact panel, maximized status, deferred sound (D52). Seed data is the offline fallback. Migration pending.

---

## D1 — Scope: the 80% support tool, no AI

**Decision.** Build the features 80% of businesses actually need in a support chat:
an embeddable widget (later) plus an agent dashboard with a real-time inbox, canned
replies, visitor context, CSAT, and basic metrics. No AI, no bots, no knowledge base,
no routing rules, no SLA engine.

**Why.** Requested explicitly. Every one of those carries a large product and
maintenance surface, and none of them is what makes the core loop work.

**Consequence.** Effort goes into the pieces support engineers live in all day: a
fast list, a readable thread, and visitor context.

---

## D2 — Dark mode only

**Decision.** One dark palette. `dark` is hard-coded on `<html>` in `src/app/layout.tsx`,
`color-scheme: dark` is set on `:root`, and `globals.css` has no light branch.

**Why.** Requested explicitly ("dark mode also only dark mode"). It is also nearly free:
the dashboard shell and Active Sessions both ship their own dark palettes, so we inherit
tuned values instead of inventing them.

**Consequence.** There is no theme code anywhere to look after. If a light mode is ever
wanted, it means adding a toggle, a second palette, and testing both — a real piece of work,
not a flag flip.

---

## D3 — Stack

**Decision.** Next.js 16 (App Router) + TypeScript + Tailwind 4 + ObsidianUI components.
Supabase (Postgres, Realtime, Auth, Storage) is the planned backend; R2 for files and
Resend for email when they are needed. pnpm, single app at `~/chat-platform`.

**Why.** One language end to end. RSC keeps the dashboard cheap to render. Supabase gives
Postgres, realtime, auth and storage without running a server, which is the shortest path
to a working product. Tailwind keeps the custom inbox styling fast to write.

**Consequence.** Nothing here is a dead end: the inbox talks to plain data shapes, so
swapping mock data for Supabase queries is a data-layer change, not a rewrite.

---

## D4 — Component selection from the ObsidianUI catalogue

**Decision.** Reviewed all 12 published components (plus the registry's primitives).
Installed **Dashboard Shell** and **Active Sessions**. Everything else in the inbox is
built from the shell's own primitives: `DashboardButton`, `DashboardMenu`,
`DashboardPopover`, `DashboardConfirmDialog`, `DashboardFilterMenu`.

**Rejected, with reasons.**

| Component | Why not |
| --- | --- |
| Analytics Dashboard | A complete GitHub-style engineering analytics app: repositories, PRs, review queues. Wrong domain, ~170KB of source, and its own design system that would fight the shell's palette. |
| Status Bars | An uptime/incident strip for a public status page. No honest home in a support inbox; adding it would be decoration. |
| Art Gallery, Draggable Marquee, Flip Text, Hover Image, Split Showcase, Text reel, v-prism, Discover Button | Marketing and visual-effect components. |

**Consequence.** Only two external components to keep in sync, and the app's own screens
stay visually consistent with the shell because they use the same tokens and buttons.

---

## D5 — One adaptation to Active Sessions: `showActions`

**Decision.** Added a single optional prop (`showActions`, default `true`). When `false`
it hides the per-row "Sign out" button and the bulk "Sign out other sessions" action.

**Why.** The component's data model — device, browser, OS, location, IP, `lastActiveAt`,
the ping animation, relative times, "This device" badge — maps almost 1:1 onto "who is
browsing the site right now". Only the action is wrong: you don't sign a visitor out from
a monitor. Everything else (a11y, focus handling, fold animations, the shared 30s clock,
container-query responsiveness) is untouched, and the default keeps the original behaviour
for its intended use — the agent's own devices.

**Consequence.** `showActions={false}` is the only modification. If we later add a
"Settings → Sessions" page for the agent's devices, it works with no extra changes.

---

## D6 — shadcn-compatible tokens in `globals.css`

**Decision.** Added the standard token set (`--card`, `--muted`, `--muted-foreground`,
`--border`, `--accent`, `--ring`, `--popover`, …) with values mirroring the shell's dark
palette, mapped through Tailwind's `@theme inline`.

**Why.** Components outside the shell (Active Sessions, and any registry primitive we add
later) are styled with shadcn token classes such as `bg-card`, `text-muted-foreground` and
`outline-ring`. Without these tokens they render as unstyled boxes; with them, every
component shares one palette — surface #1a1a1a, border #232323, text #f9fbff, muted #9a9a9a.

**Consequence.** Future ObsidianUI/shadcn components drop in already themed. The shell
keeps using its own `--obsidian-dashboard-shell-*` variables, which are left untouched.

---

## D7 — Mock data as the single seam

**Decision.** `src/lib/mock-data.ts` is the only source of demo data: conversations,
messages, visitors, journey steps, canned responses, tag options, live visitors.
Components receive props shaped like the future database rows.

**Why.** The whole UI can be built and judged before a backend exists, and there is exactly
one file to replace afterwards.

**Details worth keeping.**
- Times are pre-formatted display strings (`"1m"`, `"10:12"`, `day: "Today"`) so server and
  client render identical markup — hydration cannot drift.
- Sorting uses a separate numeric field (`updatedMinutes`), and "now" after sending is a
  label change, not a re-format.
- Avatars are initials on a deterministic gradient (hash of the name), so no remote images
  are fetched and the same person always looks the same.

**Consequence.** When Supabase lands, this file becomes queries plus a mapper; no component
API changes.

---

## D8 — Per-page shells instead of a layout shell

**Decision.** Every route renders `<AppShell>` (in `src/components/app-shell.tsx`) itself,
rather than putting the shell in `app/dashboard/layout.tsx`.

**Why.** The shell owns per-route chrome — title, tabs, filters, toolbar actions — and the
inbox tabs must drive the inbox list's React state. A layout would need a route→config map
and would couple the layout to each page's controls for no gain.

**Trade-off (accepted).** The shell remounts between routes, so the active nav pill fades
in place instead of gliding across (which the docs' layout pattern would give us). Mitigated
by persisting the sidebar width to `localStorage`, so navigation never resizes the sidebar.

**Consequence.** If the chrome ever becomes identical across routes, move the shell into
`app/dashboard/layout.tsx`, pass `linkComponent={Link}` and `activeItemId={pathname}`.

---

## D9 — Layout inside the shell

**Decision.**
- Three panes: conversation list (304px) · thread (flexible) · visitor panel (292px,
  shown from the `@6xl` container width ≈1152px).
- Thread messages and the composer are capped at `max-w-3xl` and centred, so lines stay
  readable on ultrawide screens.
- Below the `md` breakpoint (768px) one pane shows at a time: list → tap a conversation →
  thread, with a back button in the thread header.
- The sidebar's own drawer behaviour (below 672px container width) comes from the shell.

**Why.** A support inbox is scanned, not read linearly; the visitor panel is context, not
primary. Container-query breakpoints are used for the panel so the layout responds to the
shell's width, not the window.

---

## D10 — Reusing the shell's scrollbar and tokens inside panes

**Decision.** Panes carry the `obsidian-dashboard-shell-scroll` class and style with the
shell's CSS variables.

**Why.** The 4px hover-only scrollbar and the palette are already tuned and consistent;
reusing them keeps the whole app reading as one material instead of three stacked ones.

---

## D11 — Deliberately not built yet

- Any AI feature (per D1).
- No database, no auth, no realtime — see `flow.md` for where each one plugs in.
- "+ Add tag" mutates local state only; "New conversation" is a placeholder button.
- Analytics, Canned responses, and Settings are honest empty states naming what will
  live there, so the nav is never a dead link that looks broken.
- Editor-of-widget-pages, teams/roles, email notifications: all pending.

---

## D12 — Accessibility decisions worth preserving

- The composer is IME-safe: Enter sends, Shift+Enter inserts a newline, and composition
  events are ignored (`isComposing`).
- Closing a conversation goes through the shell's confirm dialog (Cancel focused first,
  Escape closes).
- Messages are a semantic `ol`/`li` list with screen-reader-only author labels, so the
  visual bubble alignment is not the only way to tell who said what.
- Every icon-only button has an `aria-label`; the selected conversation sets `aria-current`.
- `prefers-reduced-motion` is honoured by the shell and by Active Sessions' animations.

---

## D13 — Canned responses: a real page, and one in-session store

**Decision.** The canned responses route is a working list + editor: search, tabs
(All / Most used / Unused), create, edit and delete. Its data flows through
`src/lib/canned-store.ts` — a module-level array plus a commit function — which both the
page and the inbox composer read.

**Why.** A stub page next to a composer that already used canned responses was a dead end:
anything created there could never reach the place responses are used. The store is the
smallest thing that makes the feature coherent — the composer reads it on mount, so a
response created a moment ago is in the popover after client-side navigation.

**Why not context or prop drilling.** Each route renders its own shell (D8), so there is no
shared React parent above both pages; context would not survive the route change.

**Trade-offs.**
- Session-only: a reload resets to the seed. That is honest while there is no database,
  and it is exactly the seam Supabase replaces (`canned_responses`).
- Last-write-wins with no conflict handling — correct for one agent, insufficient for a
  team. Realtime arrives with the table.

**Editor decisions.**
- Validation: the shortcut must be `/` + letters/numbers/dashes and unique across
  responses; title and message are required. Save is enabled only when the form is
  complete *and* something changed.
- Deleting is the app's first destructive action, so the trigger is the shell's filled red
  `danger` button and the step is confirmed through the shell's dialog with `tone="danger"`
  — red at both ends of the destructive path.
- A new response is a draft: it is pinned to the top of the list with a "Draft" chip and
  marked in the editor header, and it becomes a saved row when created. Cancelling, or
  selecting another row, discards it. (Refined in D16.)
- A preview column shows the response the way agents actually meet it: as a composer row
  and as a chat bubble. It uses the empty half of the pane honestly, and it catches a
  broken shortcut before it ships.
- Selecting another row while a draft is open discards the draft: the draft is not in the
  list, so clicking a row means "show me that one instead".

---

## D14 — Alignment and density pass

**Decision.** One gutter (16px) for every left edge, a tighter vertical rhythm, and the
readable-width caps left-aligned instead of centred.

**Why.** Everything was close but not equal: tabs sat at 22px, the list search field at
12px, the composer at 12px, the sidebar brand at 12px while its nav icons sat at 20px.
Measured after the pass (1600px window, shell content starting at x=200):

| Element | x |
| --- | --- |
| Header title, tabs pill, filter button, search field edge, row avatar | 216 |
| Sidebar brand text, nav icons, footer content | 16 |

Spacing reductions: header py 14→12, tabs pb 10→8, toolbar p 16→12, list rows py 12→10,
thread header py 12→10, thread body py 16→12, composer p 12→(16,12), panel gaps 20→16,
sidebar footer p 16→12.

**Also.**
- Edits to the vendored shell (D4) stay limited to padding values in that list — no
  structure, behaviour or palette was touched.
- `mx-auto` came off the thread's message column and composer so they begin on the same
  16px line as everything else. The width cap stays, so long lines still don't stretch on
  ultrawide screens.
- The live visitors page was a narrow centred card in a wide void. It is now a list column
  plus a "Right now / Top pages" panel, echoing the inbox's list + detail shape.
- The canned editor does the same: fields left, preview right, so the width is used rather
  than emptied.

---

## D15 — One row of chrome, and two placeholders removed

**Decision.** A page with tabs renders its filters and toolbar actions at the right end of
the tab row; the standalone toolbar row now exists only for pages without tabs. The inbox's
"New conversation" button is gone (a placeholder with no handler), and the live visitors
page lost the "Live" indicator that was holding its toolbar row open.

**Why.** Header + tabs + toolbar meant three stacked rows — roughly 44px of chrome — before
any content, and on the visitors page the toolbar row held a single decorative dot with
empty space behind it. Removing the inbox button alone would not have recovered its row:
the Tag and Sort filters would still have kept it, so they moved up with it.

**Consequence.** The shell needed no new prop — pages keep passing `tabs`, `filters` and
`toolbarActions` exactly as before, and the row wraps on narrow containers so the extras
drop under the tabs instead of squeezing them. "New conversation" comes back when outbound
conversations exist behind a real handler.

---

## D16 — Canned responses: visible drafts, an explicit Cancel, no usage meta

**Decision.** Three refinements to the canned responses page.
1. A draft is pinned to the top of the list with a "Draft" chip and selected like any other
   row, so creating a response changes the whole page rather than only the editor pane.
2. The editor shows **Cancel** beside **Create** while drafting. Cancelling discards the
   draft and returns to the previous selection (and to the list on mobile).
3. The "Used N times · last used X" line under the editor title is gone, and `lastUsed` was
   removed from the data model. Usage is shown only where it earns its place: the list row's
   count ("47 uses" / "Unused").

**Why.** The header meta was noise — the editor already states what it is editing, and
"last used" is not something an agent acts on (that is what most-used sorting is for). The
draft row and the Cancel button answer the same question from both ends: what am I editing,
and how do I back out of it.

**Consequence.** Selecting another row while drafting still discards the draft, but no
longer silently — the draft row disappears in front of you. `usedCount` stays in the model
because it renders; a `lastUsedAt` column can return with the database if it earns a place.

---

## D17 — Canned responses persist, and every surface reads one live store

**Decision.** The canned store is mirrored to `localStorage` and exposed through
`useSyncExternalStore`, so the editor page and the inbox composer both follow a single live
list.

**Why.** This was a real bug: the store was in-memory only, so any reload — and the editor
page reloads for all sorts of reasons — silently reverted the list to the seed. "Whatever I
made or edited doesn't show up in the inbox" was exactly that.

**SSR safety.** The server snapshot is always the seed and the client snapshot is the saved
list, so hydration renders the seed on both sides and the client adopts saved data right
after. No hydration mismatch, no flash of stale rows.

**Consequence.** Responses survive reloads in the browser, which makes the demo behave like
the product. Supabase replaces this module (and its `localStorage` mirror) with the
`canned_responses` table; `usedCount` becomes a counter column.

---

## D18 — Slash commands in the reply box

**Decision.** Typing `/` in the reply box opens the canned list — the same markup, ordering
and store as the Canned button's popover — filtered by whatever follows the slash. Arrow
keys move the highlight, Enter or Tab inserts, Escape dismisses, and the command is replaced
by that response's message.

**Why.** Shortcuts exist to be typed; a mouse trip to the Canned button for a `/refund` the
agent already knows is friction. Reusing the popover's presentation — instead of inventing a
second menu style — keeps one visual language for "here are your canned responses".

**Details.** The menu only opens while the reply box holds nothing but the command, so it
never appears mid-sentence. Enter is deliberately overloaded: it inserts while the menu is
open and sends when it is closed, which is the established trade in chat UIs. The list
scrolls itself to keep the highlighted row visible as you arrow past its height.

---

## D19 — Visitor profile moved into a sheet

**Decision.** The thread header no longer carries `email · location · on /page`. That
context lives in a profile sheet that slides over the panes, opened by clicking the visitor's
avatar or the ⋯ menu's "Open profile". The always-on right panel was deleted — the sheet
replaced it (`visitor-panel.tsx` is gone).

**Why.** Requested, and the header line was the wrong home for four pieces of context: it
competed with the visitor's name and truncated first. The sheet gives the same data room to
breathe — a profile header, then collapsible sections for main information, visitor device,
journey, tags and rating — and it hands roughly 290px back to the thread.

**Consequence.** Visitor context is one click away instead of always visible, and the thread
is much wider. If an agent would rather keep it docked, the same component can render as an
inline pane again — only its wrapper changes, not its content.

---

## D20 — Chrome cleanup: menu, plan card, status pill, icon tiles

**Decision.** The account menu now holds only the signed-in address
(`Dhimant@Devgan.dev`); Profile, Workspace settings and Sign out are gone. The sidebar's
plan card is gone. The header status pill is opt-in per page — the shell no longer defaults
to "Online", so only the inbox shows it (Live visitors and Canned responses pass their own).
Icons in the profile sheet and on empty states lost their background tiles and grew a step.

**Why.** All requested. Each removed thing was decoration without a destination: menu items
with no routes, a plan card with invented numbers, "Online" repeated on pages that say
nothing about presence. The icon tiles made decorative glyphs look like buttons.

**Consequence.** The inbox is the only route claiming presence, which is where it means
something. Those menu items return when the routes behind them exist.

---

## D21 — Canned responses: read-only view, then edit

**Decision.** A saved response opens as a summary — shortcut, title and message as labelled
read-only values, with **Edit** and **Delete** in the header. The form *and* the
"In the composer / In the reply box" preview appear only while editing (or while drafting a
new response). Cancel restores the saved values and returns to the summary.

**Why.** Requested, and it fixes two things at once: a list click can no longer put a
response into a half-edited state by accident, and the preview now means something — it
shows the thing you are about to save rather than restating what you are looking at.

**Consequence.** Editing takes one extra click. The editor state lives in the component,
keyed by response id, so switching rows always lands in the summary view.

**Error presentation.** Empty required fields are flagged by their own red box, not by a
sentence under the form — the "A shortcut, title and message are required." line is gone.
The only remaining inline message is the shortcut's format/duplicate hint, because a border
can't say *why* a value is wrong. Save stays disabled until every box is valid and changed.

---

## D22 — One profile sheet for both surfaces

**Decision.** Active Sessions gained an `onSelect` prop: with `showActions` off, rows become
buttons, and the live visitors page uses it to open the same `VisitorSheet` the inbox uses.
Live visitor ids now match the visitor profiles in `conversations`, and `visitorById`
resolves a row to its full profile. The sheet takes a visitor plus optional tags and rating,
so the Tags and Rating sections render only where that context exists.

**Why.** Requested ("add the same right sheet in the live visitors as well"). The alternative
was a second, visitors-only panel — two components to keep in sync for the same profile.

**Consequence.** One sheet, one look, two entry points. A row is only a button when it has
somewhere to go, so the sign-out mode of the component still renders plain rows.

---

## D23 — No paid-data fields in the profile

**Decision.** The visitor profile no longer carries data that needs a paid lookup: the IP is
gone, and location is stored and shown as a country only, never a city. The sheet header was
trimmed to the avatar badge, the name and a country chip — the email moved into Main
information, where the rest of the identity lives. Live visitor rows show the country only,
and the sidebar no longer prints a second visitor count (the header already says "6 on site").

**Why.** All requested. City-level location and IP geolocation mean a third-party service and
a bill; a country flag plus country name is the honest amount of context a widget can know
for free. The header was also repeating things the body already lists, and the profile now
answers "who is this and where-ish are they" in one line.

**Consequence.** `Visitor` has `country` (name) and `flag` (emoji) instead of `location` and
`ip`; `liveVisitors` entries carry a country string and no IP. If a geolocation provider is
added later, city and IP come back as new fields rather than changing these.

---

## D24 — The embeddable widget

**Decision.** The widget is framework-free TypeScript (no React), rendered into an open
shadow root, exposed as `mountChatWidget(options) → { open, close, reload, destroy }`, with
all I/O behind a three-method transport. Source lives in `src/widget/`, compiled to ES
modules in `public/widget/` by `tsc -p tsconfig.widget.json` — which `pnpm build` runs
before `next build`, so the served module and the dashboard preview can never drift.

**Why no React.** The embed must be small and must not fight the host page. Vanilla DOM plus
a shadow root gives style isolation for free and keeps the payload at ~3.4 KB gzip of logic
plus ~2.3 KB of CSS — far below shipping a React runtime to someone else's site.

**Why a transport interface.** The widget owns presentation, optimistic delivery, retries
and merging; the host owns persistence, auth and realtime:
`load(signal)`, `send({ id, body }, signal)`, optional `subscribe(receive)`. That is what
lets the preview page run it against an in-memory array today and Supabase later without
touching the UI.

**Decisions inside the widget.**
- Optimistic send: the visitor's message appears as "sending" at once, then becomes "sent"
  with the server's message (the server id wins) or "failed" with an inline Retry that
  re-runs the same transmit path.
- Reload merges by id (history wins, local-only messages are kept), so reopening never
  duplicates or drops a message.
- A failed reload keeps an existing conversation on screen; only an empty conversation turns
  into the error state.
- Non-modal `role="dialog"`: the host page stays interactive, but Tab is trapped inside the
  open panel, Escape closes it, focus lands on the close button on open and returns to
  whatever opened it on close.
- The live region sits outside the panel, so send/failure/agent-reply announcements still
  fire while the panel is closed.
- `uid()` falls back when `crypto.randomUUID` is unavailable — a plain `http://` embed would
  otherwise throw at mount and never render.
- `styleNonce` is accepted for hosts with a strict `style-src` CSP.
- IME-safe Enter, send disabled until there is text, autosizing textarea, `dvh` heights,
  reduced-motion support, 480px mobile breakpoint, and artwork marked `alt=""` (decorative).
- Opening waits for the data: while the first load runs the panel stays closed and the
  launcher itself carries the loading state (its artwork pulses); the panel opens when the
  load finishes, success or failure. A reload while the panel is already open shows the
  unboxed artwork pulsing in the body instead of a nested card.
- A reply that lands while the panel is closed increments an unread count and pushes a
  preview card above the launcher: the agent's name plus two lines of the message, at most
  three at a time (the oldest leaves when a fourth arrives), each with its own dismiss button
  and a six-second auto-dismiss. Opening the panel clears the stack and the badge. The badge
  counts every unread message, not just visible cards, and caps at "9+".
- Sound is scoped to exactly that notification moment: Cuelume's `ready` cue played in its
  `press` theme (a click over a deep, ringing note). The widget plays nothing else — no
  per-keystroke or per-open sound. Cuelume arrives through an `onNotify` callback, so the
  widget itself stays dependency-free: the dashboard preview imports it from npm, and the
  one-liner lazily imports the copy that `build:widget` drops beside the widget.
- A global `bind()` with `data-cuelume-*` attributes across the dashboard was tried and then
  removed at the user's request. Sounds stay scoped to the widget notification; the dashboard
  controls are silent.
- Consecutive messages from one author render as a single run: 4px apart, with one timestamp
  on the last bubble and none on the ones before it, so a burst of replies reads as one turn
  instead of a stack of identical times. Sending and failed states still show their own line,
  and each failed message keeps its own Retry.
- Support runs carry the artwork on their **first** bubble — top-aligned, so it sits beside
  the first line instead of drifting down the run — with a 22px spacer on the later messages
  so every support bubble shares the greeting's exact left edge. Visitor messages stay
  right-aligned with no avatar, and sent visitor runs end with a time plus a double-tick
  receipt.
- The header is a short, full-width accent band (58px) with **one row**: artwork + title +
  subtitle on the left, vertically centred with the three-dot button on the right. No home
  mark, no separate maximize button, only the band's bottom corners rounded. The menu holds
  **Maximize / Restore size**, **Restart conversation** (reload) and **Close chat**, drops
  below the header (never over the text), and closes on an outside click, Escape, choosing an
  item, maximizing, or closing the panel. Escape walks menu → restore size → close. The menu is
  a disclosure of plain buttons, not an ARIA `menu`, because there is no arrow-key navigation
  to promise.
- Maximized mode fills the viewport, drops the panel border and radius, hides the launcher and
  notifications, scales up the type, bubbles, avatars and composer, caps the message column at
  720px and replaces the inline identity with the title centred as **plain text** (no icon).
  Closing the panel resets the size, so reopening starts compact.

- A notification's dismiss button overlaps the card's top-right corner like the unread badge,
  fades in on hover, and stays visible on touch devices.
- The panel is deliberately compact — 318px wide, 512px tall at most, 12.5px message text —
  and the header is a full-bleed accent band rather than an inset card, so the space goes to
  the conversation, not the chrome.

**Artwork.** The image is drawn at most ~84px CSS, so a 160px transparent PNG is correct:
23 KB instead of the original 1254px / 1.04 MB export. The full-resolution original moved to
`assets/textbox-full.png` — outside `public/`, so it is kept but never served.

**Known gap.** The preview still runs on an in-memory transport and the one-liner's REST
contract has no backend behind it; delivery receipts, presence and typing indicators arrive
with that backend.

---

## D25 — One-line embed, top-layer pinning, accent colour

**Decision.** `src/widget/embed.ts` compiles to `public/widget/embed.js`, a classic script
(no `type="module"`) that resolves its own URL, dynamically imports the widget beside it, and
mounts it. The whole install is:

```html
<script src="https://YOUR-HOST/widget/embed.js" async
        data-api="https://api.your-host.com" data-color="#2563eb"></script>
```

`data-api`, `data-color`, `data-asset`, `data-title` and `data-subtitle` are all optional.

**Why a classic script.** The requested one-liner has no `type="module"`, and an inline
module would need the host's URL baked into the page. A classic script reads
`document.currentScript.src`, so the module path and artwork URL are relative to wherever it
is hosted and the integrator configures nothing.

**Default transport.** Without `data-api`, messages persist in `sessionStorage` for the tab —
enough for a real demo on any site without pretending to have a backend. With `data-api`, the
bootstrap speaks the documented contract: `GET {api}/messages → WidgetMessage[]` and
`POST {api}/messages { id, body } → WidgetMessage`. That contract is not implemented anywhere
yet; it is the seam for the real backend.

**Top-layer pinning.** The widget's host is a `popover="manual"` element in the top layer.
Plain `position: fixed` is defeated by any `transform`, `filter` or `contain` on an ancestor —
exactly how chat buttons end up scrolling away on sites with smooth-scroll or animation
wrappers. The top layer ignores ancestor transforms, so the widget is always viewport-fixed.
The host itself is a 0×0 fixed box with `overflow: visible`, so it never eats clicks on the
page. Browsers without `showPopover` fall back to plain fixed positioning.

**Accent colour.** `accent` sets `--blue` on the widget root; the header gradient, hover
states and launcher border derive from it with `color-mix`, so any colour reads as one
coherent theme instead of a recoloured button on a blue header.

**Verified.** On a separate origin (a plain HTML page served from another port): mounted via
the one-liner, `:popover-open` true, `--blue` = the requested green, and after scrolling
1000px the launcher measured exactly 24px from the bottom and right edges of the viewport.

---

## D26 — Widget header: menu anchored to the button, home button on the left, centered text

**The three-dot menu “not working” — root cause.** The menu opened correctly all along (it
was exercised with real pointer events in Chromium: preview page, embed, normal and
maximized). What was wrong was *where it opened*: `.menu` was a child of `.header` with
`position:absolute; top:calc(100% + 6px); right:10px`, so it anchored to the **header**,
not to the button. Consequences, measured in the browser:

- Normal panel (318px): the header is ~54px tall with the button 26px inside it, so the
  menu dropped ~20px below the button's bottom edge, and its right edge sat 8px past the
  button's (menu `right:10px` vs header padding 14px). A 172px-wide block floating 20px
  under a 26px button reads as “not attached to the actual button”.
- Maximized: the header is full-width, so `right:10px` pinned the menu to the far right of
  the *screen*, not the button — the button's right edge is 18px in (header padding), so
  the menu hung past it and looked detached — “doesn't open properly on maximise”.

**Fix.** `.menu` now lives inside `.actions` — the 26px div that hugs the ⋯ button and is
already `position:relative` — with `top:calc(100% + 6px); right:0`. It drops 6px under the
button with its right edge flush with the button's, in both states. Verified numerically
via CDP: gap 6.0px, right-edge delta 0.0px — normal, maximized, and on a separate-origin
embed of the rebuilt `public/widget/`.

**Home button on the left.** The header's brand mark is now a real `<button>` (40px, up
from a 34px decorative div) and sits first in the topline in **both** states — previously
the whole identity block (mark + title + subtitle) was hidden when maximized, so the
maximized header had no control on the left at all. Clicking it steps back one level:
maximized → normal panel; normal → the launcher (“home” for the widget). `aria-label`
switches between “Restore size” and “Close chat”. If the product later prefers a no-op
brand mark, that is one line in `widget.ts` to flip.

**Centered text.** Title + subtitle are one absolutely-centered block in the normal header
(`top/left:50%, translate(-50%,-50%)`, `max-width:70%`, centered; measured center delta
0.0px against the panel at 1600px and 390px). The maximized header's title — an existing
separate element — was also made explicitly centered (`top:50%` + full `translate`), since
it previously relied on static-position placement. In maximized the centered title is the
visible one; the two-line block hides.

**Bigger purple part (normal).** Header vertical padding 10→13px, the home button 34→40px,
and the centered two-line block make the normal header ~66px tall instead of ~54px. The
maximized header keeps its 12/18px padding — it is already the full viewport. The maximized
topline switched from `justify-content:flex-end` to `space-between` so the now-visible home
button stays on the left instead of being pushed against the ⋯.

**Housekeeping.** The `.identity` wrapper is gone from the DOM and CSS; `.identity-text` is
the centered block, `.header-art` is the button. The tab-trap picks the home button up
automatically (it queries buttons inside the panel). `pnpm build:widget` was rerun, so the
served `public/widget/` and the dashboard preview are the same build.

---

## D27 — Widget ↔ dashboard live connection (Supabase, install keys)

**Decision.** The widget and the dashboard now share one Supabase backend instead of
each running its own fake. The install snippet carries a `data-site` key, the widget
talks HTTP to Next API routes, and the dashboard reads the same Postgres tables live
with Realtime. Supersedes the D24 "Known gap" (no backend) and the D25 note that the
REST contract "is not implemented anywhere yet" — both are implemented now.

**How a message travels.** Visitor types → `embed.js` apiTransport POSTs to
`POST /api/widget/messages` with `{ site, visitor, id, body }` → the route validates
the site key against `sites`, upserts the open conversation, upserts the message by its
client-generated `id` (a retried send returns the same row instead of duplicating, which
is exactly what `widget.ts` transmit() needs), bumps `last_message`/`updated_at` → the
dashboard inbox receives it instantly via a Postgres Changes subscription → an agent
reply inserts directly via `supabase-js` → the visitor's widget picks it up on its
~2.5s polling subscribe within one interval.

**Why the widget polls instead of using supabase-js.** `embed.js` compiles from
dependency-free `tsc` output to a plain ES module with no bundler. Shipping the
Supabase client inside it would need a bundler and bloat every customer page. Polling
`GET /api/widget/messages?site=&visitor=` with a seen-by-id diff keeps the embed
small, uses the `subscribe(receive)` hook `widget.ts` already wires (no `widget.ts`
changes were needed), and is fast enough for chat (~2.5s). The dashboard, which already
bundles npm deps, uses Postgres Changes for true instant delivery the other way.

**Why API routes instead of direct Supabase from the widget.** The routes hold the
service-role key server-side and validate the site key; the browser never sees either.
They also own the find-or-create conversation logic, so the widget stays a dumb
transport — same separation D24 set up (widget owns presentation, host owns
persistence).

**Schema (`supabase/schema.sql`, run once in the SQL editor).**
`sites(id, name, site_key unique)` + one seeded demo site (`site_demo_001`);
`conversations(id, site_id, visitor_id, status, last_message, created_at, updated_at)`
with indexes on `(site_id, updated_at)` and `(site_id, visitor_id)`;
`messages(id TEXT pk` — client-generated ids double as dedup keys —,
`conversation_id` cascade, `author` check visitor/agent, `body`, `created_at)`.
RLS is on with permissive demo policies (anon read on all three); the file says to
tighten them the moment auth lands. `messages` and `conversations` are added to the
`supabase_realtime` publication.

**Anonymous visitors.** No login: `embed.ts` keeps a stable id in
`localStorage["chat-platform:visitor-id"]` (survives tabs and reloads, unlike the old
tab-scoped sessionStorage messages), with a `Date.now()+random` fallback for private
mode. The same `(site, visitor)` pair always resolves to one open conversation.

**Dashboard data layer (`src/lib/conversations.ts` + `src/lib/supabase.ts`).**
`getSupabase()` returns null without env vars, and every caller falls back to the
seed data — the dashboard behaves exactly like before with no backend configured.
With env, `fetchConversations(siteKey)` maps DB rows into the existing
`Conversation`/`Message` types (mock-data.ts types are untouched, per its own header
comment), `sendAgentMessage` inserts directly via the anon client, and
`subscribeInbox` opens one `inbox` channel for message INSERTs (merged by id, same
pattern as `widget.ts` reload) plus conversation UPDATEs.
`InboxView` keeps its optimistic `patchSelected` layer: agent sends render instantly,
then the saved row (real id + timestamp) swaps in; a failed status change rolls back.

**Install snippet generator.** `/dashboard/widget` now leads with a snippet builder
(site key + accent colour + copy button) producing
`<script src="{origin}/widget/embed.js" data-site data-api="{origin}/api/widget" data-color>`.
Same app serves widget files and the API, so origin is all it needs — nothing new to
deploy. The live preview stays below the snippet (preview uses the in-memory
transport, a real page uses the snippet). The stale `cr-2` canned snippet in
mock-data.ts was fixed to this shape. `data-api` defaults to `/api/widget` on the
script's own origin, so it only needs setting for split hosting; `data-site` missing
falls back to the old tab-local transport with a console warning instead of failing.

**Deliberately out.** Auth (still fake "You"), presence/typing realtime, attachments,
canned-responses backend, analytics/settings pages, multi-site switcher in the inbox
(`DEMO_SITE_KEY` is hard-wired; the per-site query shape is ready for a `<select>`
later). Canned store, typing flag, VisitorSheet untouched.

**To go live.** Create one Supabase project, run `supabase/schema.sql` once, set
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + (server-only)
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (gitignored). Then the six checks:
widget message lands in the DB → appears in the inbox instantly → agent reply reaches
the widget in ~3s → a second site key streams separately → reloads persist on both
sides → no `data-site` still works tab-local.

---

## D28 — Visitor context in the profile sheet + no mock flash + live fixes

**Decision.** The profile sheet now shows real visitor data (browser, OS, device,
timezone, current page, country + flag, page journey) captured from the browser on
every message — instead of the blanks the first live version shipped. The inbox also
starts empty with a loading state instead of flashing seed rows for a second. Three
smaller live bugs found during verification are fixed in the same pass: new-visitor
messages that never appeared without a reload, agent replies that never saved, and
widget POSTs blocked by missing CORS/preflight.

**Why context flows widget → API → conversation row.** The widget already knows the
browser (UA, touch points, screen, `Intl` timezone, current path) for free — no login,
no paid lookup. `embed.ts` sniffs it once per page view and sends it as `context`
with every POST; the API route stores it on the conversation (refresh on every
contact, fill blanks only) and appends a `{ id, label, path, at }` journey step capped
at 20. Country comes from the platform header (`x-vercel-ip-country` → flag emoji
computed server-side), blank elsewhere — same country-only rule as D23, nothing that
needs a paid geolocation lookup. `src/lib/conversations.ts` maps the columns into the
existing `Visitor` type (device validated against the union, journey passed through),
so `VisitorSheet` needed no prop changes — only conditional rendering so empty rows
hide instead of showing blank lines.

**Why the sheet hides blanks.** Old conversations (created before this change) have
NULL context columns. Rendering every row unconditionally showed empty flag chips,
blank device sections and an empty journey timeline. Every section/row is now
conditional on having data, so old rows degrade to name + first-seen + email fallback
instead of blank lines.

**Why the inbox starts empty.** `InboxView` seeded `useState` with the mock
conversations, then replaced them when Supabase answered — the seed rows were visible
for ~a second on every load. Now it starts as `[]` with a `loaded` flag: live rows or
the seed fallback fill in once, and both panes show "Loading conversations…" until
then. Same flash class of bug as the avatar pulse: never render placeholder content
that will be replaced.

**Fix 1 — new visitors never appeared without reload.** `mergeMessage` only mapped
over known conversations, so the first message from a new browser was dropped by the
inbox (it existed in the DB but not in state). Now an unknown `conversationId`
triggers `fetchConversationById` and prepends the full row — same merge-by-id idea,
extended to unknown ids.

**Fix 2 — agent replies never saved.** The demo RLS only granted anon SELECT. Agent
sends via the anon client (no auth yet) hit 401 and silently returned null — the
optimistic bubble stayed but nothing persisted and the widget never got the reply.
`schema.sql` now adds anon INSERT on messages + conversations and UPDATE on
conversations ("tighten when auth lands" still applies). Re-run the file or the six
`drop/create policy` lines to apply.

**Fix 3 — widget POST blocked cross-origin.** `next.config.ts` only CORS-opened
`/widget/*` (the ES modules). The API routes needed the same treatment plus an
explicit `OPTIONS` handler returning 204 with `Allow-Origin/Methods/Headers`, or the
personal site's POST preflight fails. Both added; dev server restart required.

**Notification sound.** New visitor messages play the same Cuelume `ready` cue in the
`press` theme the widget preview uses — lazy `import("cuelume")` in the merge path,
silent catch. Dashboard controls stay silent per D24.

**Files.** `supabase/schema.sql` (9 context columns + `journey jsonb`, migration
`alter table … add column if not exists` lines for existing installs),
`src/widget/embed.ts` (context sniff + `context` in POST body),
`src/app/api/widget/messages/route.ts` (parse/store context, country from header,
journey append, OPTIONS 204), `src/lib/conversations.ts` (DbConversation columns,
`CONVERSATION_COLUMNS`, mapper), `src/components/inbox/inbox-view.tsx` (empty start +
loaded flag, unknown-id fetch, sound), `src/components/inbox/conversation-list.tsx`
(loading prop), `src/components/inbox/visitor-sheet.tsx` (conditional rows),
`next.config.ts` (API CORS headers). `pnpm build:widget` rerun — confirmed the built
`embed.js` carries the context code.

---

## D29 — Agent-echo dedup, solid header dots, module pre-warm, subtitle-free header

**Decision.** Four small fixes from live testing on the personal site: the inbox no
longer double-renders your own agent reply, the header ⋯ dots are solid instead of
hollow, the embed pre-warms the widget module on page load, and the header subtitle
is gone — "Chat with support" sits alone on one centered line.

**Fix 1 — own reply flashed twice then collapsed to one.** `send()` renders the
optimistic bubble and swaps in the saved row, but the realtime INSERT of that same
agent message also arrived via `mergeMessage` as a second bubble — then vanished when
the swap ran. `mergeMessage` now returns early for `author === "agent"`: visitor
messages still merge live, your own sends rely on the optimistic-then-saved path only.

**Fix 2 — hollow ⋯ dots.** The `more` icon drew three `r=1.6` circles with the shared
`fill="none" stroke="currentColor"` wrapper, so at 16px they read as thin rings that
flashed dark before paint. They are now `r=1.9` with explicit `fill="currentColor"
stroke="none"` — solid dots at every size, independent of the wrapper.

**Fix 3 — module pre-warm.** The ⋯ SVG lives in `widget.js` and its paint in
`styles.js`, both fetched on first open — so the button sat unstyled until both chunks
arrived. `embed.ts` now fires a fire-and-forget `import(widget.js)` on window load
(or immediately if the page already loaded), warming the HTTP cache while the visitor
reads. The later mount import then resolves near-instantly. Measured on the personal
site: `embed.js` itself ~4ms; first conversation GET ~450ms dominates, not the module.

**Fix 4 — subtitle removed, title locked to one line.** The header's two-line centered
block ("Chat with support" + "Leave a message. We'll get back to you.") wrapped to
three lines in the 318px panel and fought the avatar/⋯ buttons for space. `widget.ts`
now only renders a `<p class="subtitle">` when `options.subtitle` is explicitly
passed — the default embed sends none, so no subtitle exists — and `.title` carries
`white-space: nowrap`. Verified: title measures exactly 1 line, no subtitle node.

**Also fixed in this pass.** Dev server was stale (old PID dead, new `next-server`
holding :3000 without the CORS changes) — killed and restarted so the OPTIONS 204
actually serves; verified preflight returns 204 with the right headers. Personal-site
script dropped the `data-color="#ff8c1a"` override back to the default blue.

**Files.** `src/components/inbox/inbox-view.tsx` (agent-echo guard + comment),
`src/widget/widget.ts` (solid dots, conditional subtitle),
`src/widget/styles.ts` (title nowrap), `src/widget/embed.ts` (load-time pre-warm),
personal site snippet (no data-color). `pnpm build:widget` rerun; tsc + eslint clean.

---

## D30 — Artwork-robust open: no ghost boxes, no pop-in, every edge covered

**Decision.** The widget can no longer paint an empty box that fills in later — in
normal, maximized, cold-cache, broken-image, or missing-URL states. Artwork loads
through a three-layer system (preload → placeholder → fallback), and every edge case
around it is handled explicitly.

**The bug, precisely.** `reveal()` unhid the panel the moment messages arrived, but
each `<img class="art">` fetched its PNG on its own timeline. First paint therefore
showed the layout with empty image boxes — header avatar circle, greeting avatar,
launcher — and the PNG popped in a beat later ("box comes then artwork comes"). In
maximized the same header rendered full-width, so the same empty circle read as a
"ghost box". Warm-cache testing masked it: only a cold load (fresh browser, empty
cache) showed the race.

**Layer 1 — preload at two levels.** `embed.ts` now warms artwork at script parse
time, not window load: a `<link rel="preload" as="image">` hint plus a `new Image()`
fetch fire the moment the snippet runs, so bytes are usually in cache before mount.
`widget.ts` fires a second preload at mount that primes the module-level `artCache`
on success. Either layer succeeding means first `art()` renders a direct `<img>`
from cache.

**Layer 2 — placeholder, never empty.** `art()` consults `artCache` first. Cache hit
→ direct `<img>`. Miss → a `<span class="art art-pending">` holder on the exact
footprint: solid `var(--blue)` circle, invisible `<img>` inside loading the real
bytes. On `load` the holder swaps for the real image (cache marked *before* the
swap — otherwise the swap builds another holder in an endless loop). Nothing empty
ever paints; worst case is a solid blue circle for ~a frame.

**Layer 3 — fallback glyph.** Empty `assetUrl` → glyph immediately, no network.
`error` on any image → `replaceWith(artFallback())`, a chat SVG on the same
footprint. Listener attaches before `src` so even a cached failure swaps. `close()`
rebuilds launcher art fresh, so a transient failure retries instead of sticking on
the glyph. The loading screen's `loading-art` got a solid blue bg too, so the pulse
never plays on an empty box.

**Edge cases, each covered.**
- *Broken URL / 404 artwork*: error → fallback glyph, chat still fully works.
- *Missing `data-asset` / empty string*: trimmed check, glyph immediately, zero
  requests. (The dashboard preview passes its own path, unaffected.)
- *Slow/hung image*: 1500ms mount-preload timeout + placeholder swap on decode —
  chat never waits on art; the holder covers the wait.
- *Cached-error loop*: `once: true` listeners + cache-mark-before-swap ordering.
- *`new Image()` throwing* (exotic CSP): try/catch resolves the prime, holder path
  still swaps or falls back.
- *Remount / second widget on the page*: `artCache` is module-level, shared by
  every mount — art decoded by one instance renders direct in all others.
- *Maximized*: same header, same code path — the ghost there was the same empty
  `header-art` circle; the solid-blue bg + placeholder + cache fix it identically.
  (Also fixed: `header-art` bg was a translucent tint that read as a dark ring
  pre-decode; now solid `var(--blue)`.)
- *Long custom titles*: `.title` also carries `overflow: hidden; text-overflow:
  ellipsis` with the D29 nowrap, so a long `data-title` truncates instead of
  pushing the ⋯ button off the header.
- *Header pending sizing*: `.header-art .art-pending` is pinned to the same
  74% footprint as the image, so the placeholder never stretches the circle.

**Deliberately not done.** Waiting to unhide the panel until art decodes — tried,
reverted. It killed the loading spinner feedback (panel stayed hidden with only the
launcher pulsing). The placeholder approach keeps instant feedback AND no ghosts.

**Verification.** Cold-cache timeline on the personal site: `embed.js` ~13ms,
`widget.js` ~9ms, `textbox-160.png` ~5ms, first conversation GET ~400ms (the real
wait, unchanged); zero `.art-pending` nodes and zero fallbacks after open, all
`<img>` `complete` with width. Maximized cold frame: header avatar, greeting
avatar and ⋯ all painted with art, no empty circles.

**Files.** `src/widget/widget.ts` (module-level `artCache`, mount preload priming
it, cache-first `art()` with holder swap, guarded preload), `src/widget/styles.ts`
(`.art-pending` solid circle, pending sizing in header, loading-art bg, title
ellipsis), `src/widget/embed.ts` (parse-time `<link>` + Image preload for art,
module warm on load). `pnpm build:widget` rerun — confirmed `art-pending`,
`artCache` and preload markers in the built output; tsc + eslint clean.

---

## D32 — Tier-1 depth: receipts, history, identity, typing, presence, files, CSAT

**Decision.** Ship Crisp's basic loop, not its platform: real read receipts, past
chats + new conversation, true unread, two-way typing, online/away presence with
working hours, visitor identity, attachments, and CSAT. No auth, AI, knowledge base,
or extra channels. Built as small additions to the existing seam — no new services.

**Read receipts — timestamps, not flags.** `conversations.agent_last_read_at` and
`visitor_last_read_at` are the whole model. The widget marks read (POST `state`
`read`) on reveal and when an agent message arrives; the dashboard marks read when a
thread is viewed. Visitor messages render one tick until `createdAt <=
agent_last_read_at`, then two. Agent messages light up for the dashboard when
`createdAt <= visitor_last_read_at`. One comparison per message, zero extra table.

**True unread.** Mapper counts visitor messages newer than `agent_last_read_at`
instead of counting all visitor messages. Opening a thread zeroes the badge locally
and writes the timestamp; the realtime conversation UPDATE then refetches the row, so
the badge stays cleared across reloads. Local reset happens on selection (never
`setState` inside an effect — the lint rule is right).

**Past chats + new conversation.** `GET /api/widget/conversations` returns the last
20 summaries (open + closed). The widget's header gained a history button; history
lists summaries and clicking one loads that transcript through the existing `load`
route with `?conversation=`. While viewing history the composer hides. "New
conversation" (history and closed states) POSTs `state` `new`: the open thread is
closed, a fresh row is created carrying identity + device context, so the visitor is
never re-asked who they are. A visitor message after a closed chat also auto-creates
a fresh conversation — history stays intact.

**Typing — one tiny table.** `typing(conversation_id pk, visitor_typing_at,
agent_typing_at)` with anon-all RLS and realtime enabled. Visitor input is throttled
to one POST per 2s and cleared after 3s idle; the API upserts the timestamp. The
dashboard subscribes to `typing` via Postgres Changes and shows "X is typing…" for
4.5s per ping. Agent typing writes `agent_typing_at` from the thread (2s throttle);
the widget reads it in its poll meta and shows "Support is typing…" for 5s. One row
per conversation, no event log.

**Presence + hours.** `sites` gained `timezone`, `hours_start`, `hours_end`,
`away_message`, `agent_online_at`. The dashboard writes a heartbeat every 30s; the
widget treats the agent as online when the heartbeat is <120s old AND the local hour
(falling back to 24h if the timezone is odd) is inside working hours. Otherwise the
status line shows the away message. Composer stays enabled either way — async-first.

**Visitor identity.** Pre-chat inline form (name required, email optional) appears
before the first message when the conversation has no name/email; the transport
`identify` action stores it in localStorage and on the row, and every send carries it,
so the inbox row reads "Dhimant Devgan" instead of "Visitor 3f9a…". Host apps can call
`window.chatPlatformIdentify(name, email)`; `data-name`/`data-email` on the script
seed it too. New conversations copy the identity forward.

**Attachments.** Public `chat-attachments` bucket with anon insert/select policies.
Widget uploads through `POST /api/widget/upload` (service role, 10MB cap); the
dashboard uploads directly with the anon client (same cap, client-side). Messages
gained `attachment_url/name/size/type`; both threads render images inline (max 180px)
and other files as a download chip. Empty body + attachment is a valid message; the
bubble hides when there is no text.

**CSAT.** Closing a conversation flips the widget meta to `closed`: the composer is
replaced by "How did we do?" + 👍/👎 (POST `state` `csat`), then "Thanks for the
feedback." plus "Start new conversation". The dashboard profile sheet already had a
CSAT section — the mapper now feeds it `csat` from the row. Ratings are one column
plus an optional comment column.

**Transport shape.** The widget transport grew optional capabilities (`meta`,
`markRead`, `setTyping`, `rate`, `startConversation`, `history`, `upload`,
`identify`). `load`/`send` stay compatible with the local demo, and the UI hides
history/attach when the transport lacks them — the session-storage fallback still
works with zero backend. Poll metadata rides the same 2.5s GET (`{messages, meta}`),
so no extra interval was added; one-shot `meta` is fetched after reload/history open.

**Edge cases covered.** History open clears the previous transcript before load;
closed transcripts are read-only with CSAT + new-chat; a closed conversation's
composer is removed (not just disabled); duplicate CSAT is prevented (`csat_actions`
hides after rating); identity form never blocks a closed thread; attachment-only
messages render; 10MB cap both sides; `art` fallbacks unchanged; typing timers are
cleared on destroy; header title max-width now accounts for two right-side buttons.

**Verification status.** `tsc` (app + widget) and eslint clean apart from one
pre-existing `conversation-thread` effect error and one expected `<img>` warning for
user-uploaded images. `pnpm build:widget` rerun. Runtime checks are blocked until the
D32 SQL runs: read tick flips after opening the inbox; history lists and reopens a
closed chat; new conversation creates a fresh row; typing shows both ways; Online
follows the heartbeat; identity replaces the visitor hash; image/file attachments
round-trip; CSAT lands on the conversation and in the profile sheet.

**Files.** `supabase/schema.sql` (D32 migration block), `src/app/api/widget/messages`
(meta, identity, attachments, closed→new), `state` (read/typing/csat/new/identify),
`conversations` (history), `upload` (storage); `src/widget/{types,embed,widget,styles}.ts`
(optional transport capabilities, meta application, ticks, status, history view,
identity form, CSAT, attach chip, typing throttle, styles); `src/lib/mock-data.ts`
(attachment URL), `src/lib/conversations.ts` (read timestamps, unread derivation,
message receipts/attachments, markAgentRead/setAgentTyping/heartbeat/subscribeTyping);
`src/components/inbox/{inbox-view,conversation-thread}.tsx` (read effect, typing,
heartbeat, uploads, attachment rendering, onTyping).

---

## D33 — History redesign, instant opens, transparent loader

**Decision.** Rework the past-chats surface to the reference pattern (flat rows, no
cards), move history onto the left brand button, rename the panel to "Your
conversation", make first open and history instant, and remove the blue disc behind
the loading artwork.

**History rows.** No boxes: each conversation is a full-width transparent row —
30px avatar with the artwork, "You, 17/10/2026" (en-GB date), the last message as a
muted one-line preview, and a chevron. The old bordered cards and the header title
are gone. A single rounded "Start new conversation" pill sits at the bottom of the
list (our blue, our font), disabled while a new thread is being created.

**Left icon is history.** The separate clock button was removed. The brand mark on
the left now opens past chats and returns to the chat when already in history; its
`aria-label` flips between "Past conversations" and "Back to chat". With the local
demo transport (no history API) the brand keeps its old close/restore behaviour.
Only one right-side button remains: maximize/minimize.

**Title.** The default panel title is "Your conversation" instead of "Chat with
support" (still overridable with `data-title`).

**Instant opens.**
- Embed caches the meta that arrives with each GET (`{messages, meta}`), so
  `reload()` no longer fires a second request for read/typing/presence state — one
  round trip per open instead of two.
- The widget prefetches the conversation ~300ms after mount while the visitor reads,
  so the first open usually reveals immediately (the launcher only pulses if they
  open before it finishes).
- History is prefetched at the same time and cached for 30s; opening history renders
  the cached list immediately and refreshes in the background only when stale.
- New conversation is guarded (`startingNew`) against double clicks, invalidates the
  history cache, and a failed "new" call keeps the current transcript and announces
  the failure instead of clearing the panel.

**Loader.** `.loading-art` no longer paints a `var(--blue)` disc — only the artwork
pulses (as originally intended). The panel background still covers the area.

**Files.** `src/widget/widget.ts` (flat history rows, left-icon toggle, title
default, prefetch/caches, guarded startNew), `src/widget/styles.ts` (history rows +
pill, loading art without background), `src/widget/embed.ts` (meta cache, truthful
startConversation). `pnpm build:widget` rerun; widget tsc + eslint clean. Verified in
the browser: title "Your conversation", one action button, brand label "Past
conversations", transparent loader. History list rendering awaits the D32 migration.

---

## D34 — Centered ended state, optimistic CSAT, 1.2s live poll

**Decision.** When a conversation ends, the whole panel center becomes the end/CSAT
state (not a composer-area strip); CSAT feedback is optimistic; the widget polls meta
every 1.2s and can fetch immediately (`pollNow`), so inbox actions (close, read,
typing) surface fast. The away message no longer prints in the header — "Away" only.

**Ended state.** A dedicated `endedView` (title, "How did we do?", thumbs, "Start new
conversation" pill) is centered in the body with `justify-content:center`, replacing
the transcript and composer. The old bottom `closedBox` is gone. The state only
applies to the visitor's **latest** conversation: `WidgetMeta.latestConversationId`
is now returned alongside `conversationId`; opening a past transcript keeps the
transcript visible (composer hidden) instead of swapping in the end screen. Polling
meta is ignored while viewing a past chat so it cannot overwrite that transcript's
state, and opening a past chat does not mark the current one read.

**Instant CSAT.** Clicking 👍/👎 sets `meta.csat` and re-renders before the request
fires; the write is background and only reverts on failure. Verified in the harness:
"Thanks for the feedback." appears in the same tick as the click (previously it waited
on the network round trip).

**Latency.** Poll interval 2500ms → 1200ms. `transport.pollNow()` is called on reveal,
after CSAT, after starting a new conversation, and on `visibilitychange` (when the
panel is open and the tab becomes visible) — so closing a chat in the inbox reflects
in the widget within ~1.2s or immediately on focus. The embed also caches meta from
the load response (D33), so reload remains one round trip. Sending a message
invalidates the history cache so the preview updates.

**Header.** Status line is "Online" or "Away" only; `away_message` is no longer
rendered there (it stays in the DB for future use). History pill gained breathing
room from the bottom edge (`margin: 4px auto 6px`) and the ended pill sits with
`margin-top: 6px` under the CSAT row. Full history rows are explicit
`cursor:pointer` buttons.

**Edge cases.** Double new-conversation clicks stay guarded; returning from a past
transcript reloads the live conversation; a failed new-conversation keeps the current
transcript; polling pauses are eliminated by the visibility refresh; the ended screen
only appears for the latest closed conversation.

**Files.** `src/widget/widget.ts` (ended view, viewingPast/latest id, optimistic rate,
pollNow calls, visibility listener, away label, history invalidation),
`src/widget/types.ts` + `src/widget/embed.ts` (latestConversationId, pollNow, 1.2s
poll), `src/app/api/widget/messages/route.ts` (latestConversationId in meta),
`src/widget/styles.ts` (centered `.ended`, removed `.closed`, pill spacing, cursor).
`pnpm build:widget` rerun; tsc + eslint clean. Harness-verified: centered ended state,
instant CSAT, flat history rows with preview and bottom pill.

---

## D35 — Notification dedup, sticky CSAT, fast sends, local inbox patches

**Decision.** Fix the repeated notification/sound loop, keep the CSAT "thanks" state
from flashing back, match the widget typing indicator to the inbox, and cut the
round trips that made sends and receives feel slow.

**Endless notifications (root cause).** The embed's poll used
`fetchState()` which adds every message id to `seen` *before* the loop, then the loop
delivered every agent message unconditionally. Every 1.2s poll re-delivered the whole
agent history → repeated preview cards, repeated sound. Fix: snapshot `before =
new Set(seen)` prior to the fetch, deliver only ids missing from that snapshot, and
suppress the first poll (`primed`) so existing history never fires. Agent history is
now announced exactly once, even across close/reopen.

**CSAT flash.** Clicking 👍/👎 rendered "Thanks", then a poll already in flight
returned `csat: null` from the server and flipped it back. `adoptMeta()` now carries an
optimistic `csatPending` value over any meta that hasn't echoed it yet (5s cap), and
clears once the server confirms. Verified in the harness: clicking shows "Thanks for
the feedback." and a deliberately stale meta push keeps it.

**Typing indicator.** The widget now renders the inbox pattern: a message bubble with
three bouncing dots plus "Support is typing…", replacing the character-based dots.

**Long words.** Dashboard bubbles gained `break-words` + `overflow-wrap:anywhere`;
the widget bubble gained `word-break:break-word`. Unbroken strings wrap inside the
bubble instead of spilling past it.

**Latency — query round trips.**
- New `src/lib/widget-admin.ts`: one service client + a 5s site cache shared by the
  messages/state/conversations/upload routes. The 800ms poll no longer queries
  `sites` every tick.
- SQL trigger `messages_touch_conversation` updates `last_message`/`updated_at` on
  insert, so neither the widget API nor `sendAgentMessage` performs that second
  write anymore. A visitor send is now: cached site → latest conversation → context
  update → message upsert.
- Dashboard caches the site id (`siteIdFor`) and applies conversation UPDATE
  payloads locally instead of refetching all conversations (which cost 2 queries and
  caused the unread badge to appear then clear a beat later).
- `markAgentRead` writes are debounced per conversation (2s), stopping write churn
  while messages arrive.

**Latency — polling.** The poll uses `setTimeout` scheduling and `setOpen()`:
800ms while the panel is open (plus an immediate fetch on reveal), 2000ms when
closed so background notifications still arrive promptly. Tab focus still triggers
`pollNow()`.

**Edge cases covered.** Past-transcript meta is still ignored by polls; ended state
only for the latest conversation; new-conversation guard unchanged; the trigger is
idempotent on retried upserts (after-insert only, preview already updated); read
badges update from realtime payloads without a refetch; typing row hidden when the
conversation ended or history is open.

**Verification.** Harness checks: typing row shows 3 dots with the inbox-style bubble
and label; CSAT stays "Thanks" after a stale poll; long unbroken text wraps inside
the bubble. `tsc` (app + widget), eslint (same pre-existing thread error + one img
warning), and `pnpm build:widget` clean. Live verification still needs the SQL
migration (D32 columns + D35 trigger).

**Migration is re-runnable.** The first run aborted at
`alter publication supabase_realtime add table typing` with 42710 ("already a
member"), which skipped the storage policies and trigger below it. The schema file
now guards publication membership in a `DO` block that checks
`pg_publication_tables` before adding `messages`, `conversations`, and `typing`;
everything else was already `if not exists` / drop-and-create. Re-running the whole
file is safe and completes the skipped storage + trigger statements.

**Files.** `src/widget/embed.ts` (delivery dedup, dynamic poll, setOpen),
`src/widget/types.ts` (`setOpen`), `src/widget/widget.ts` (sticky CSAT, typing
bubble, setOpen calls), `src/widget/styles.ts` (typing bubble, word-break),
`src/app/api/widget/*` + `src/lib/widget-admin.ts` (cached site/client, fewer writes),
`src/lib/conversations.ts` (trigger-aware sends, site cache, realtime patch payload,
createdAt), `src/lib/mock-data.ts` (`createdAt`), `src/components/inbox/*` (local
patch, debounced read, word wrap), `supabase/schema.sql` (trigger, idempotent
publication adds).

---

## D36 — Instant loader on new conversation, lower history pill

**Decision.** Clicking "Start new conversation" now leaves the ended/history screen
immediately and shows the loading artwork while the request runs; the history pill
sits closer to the bottom edge.

**Why.** The click previously left the old screen visible until `startConversation`
and `reload` finished (two round trips), which read as "nothing happened". Now
`startNew()` clears messages/meta, sets `state = "loading"` and renders before
awaiting the API. If the call fails, the prior view/messages/meta are restored and
the error is announced in the live region rather than leaving an empty panel.

**Pill position.** `.history-new` margin changed from `4px auto 6px` to
`4px auto 0`; the body's 14px bottom padding remains the breathing room. Verified in
the harness: pill bottom gap 14px, loader visible in the click tick, history hidden.

**Files.** `src/widget/widget.ts` (`startNew`), `src/widget/styles.ts`
(`.history-new`). `pnpm build:widget` rerun; widget tsc clean.

---

## D37 — Agent profiles, exact-thread presence, live unread, cost cuts, integrity

**Decision.** Continue the audit with the missing identity and presence layers,
replace fake counts, cut the two biggest data costs, and close the message/state
integrity holes. No auth yet; the RLS posture is unchanged and documented as open.

**Agent profiles.** A stable id lives in `localStorage`; the name/avatar mirror to
`agents` when Supabase is configured. Every agent message snapshots
`messages.agent_name`, so the widget shows the real sender ("Dhimant") instead of a
hard-coded "Support" and no join is needed. Settings is now a real page (name, avatar
upload, timezone, working hours, away message); the avatar is a file picker that
uploads PNG/JPG (≤2 MB) to `chat-attachments/avatars/` and stores the public URL — no
URL field. The side menu shows the profile. The profile is local-first (each browser
has its own), which is honest until auth exists.

**Exact-thread presence.** `conversation_viewers` records `(conversation_id,
viewer_id, name, last_seen_at)`, upserted by the dashboard every 15s only while the
thread is selected and the tab is visible; switching threads or hiding the tab
deletes the row. The thread header lists the other viewers; the widget meta returns
the names seen in the last 30s and the status line shows "<name> is here" / "N agents
here". This is independent of the site heartbeat, typing, and read receipts.

**Live unread and notifications.** `conversations.unread_count` is maintained by the
message trigger (visitor +1, agent 0) and zeroed by mark-read. The app shell reads
the real total and the unread conversations for its popover, updating on
conversation changes — the old seed `totalUnread` and fake notifications are gone.
The fake live-visitors page is now an honest "presence is next" empty state and its
dead mock exports were removed.

**Cost reductions.**
- `fetchConversations` selects conversation rows only (no message query); the
  transcript loads via `fetchConversationById` when a thread opens, showing
  "Loading messages…" and merging any realtime message that landed meanwhile. This
  removes the unbounded all-messages payload from the inbox's first load.
- The widget sends an `after` cursor with polls; the API returns only newer messages.
  Full history is fetched on open/history; the cursor resets on thread switch.
- Widget routes share a 5s site cache/one service client.
- The message trigger owns preview, timestamp, and unread, so sends make no
  follow-up conversation write.

**Integrity.**
- Widget message ids are insert-only: a replay returns the original visitor row;
  an id belonging to another author or conversation returns 409 instead of
  overwriting/moving data.
- State actions accept the conversation id the widget is showing; history actions
  can no longer touch the latest thread. The embed tracks the active conversation.
- Uploads require `site` + `visitor`, validate the site key, and namespace the
  storage path by site id.
- Added the missing anon UPDATE policy on `sites`; the presence heartbeat and
  Settings save depended on it.

**Verification.** `pnpm test` 12/12, TypeScript (app + widget), and the production
build pass. Lint has zero errors and three expected `img` warnings. No browser calls
were made, per the token-limit request; multi-agent and migration runtime checks
remain open. Auth/RLS stays the primary open audit item.

**Files.** `supabase/schema.sql` (agents, viewers, unread/assignment columns, site
update policy), `src/lib/agent-profile.ts`, `src/app/dashboard/settings/page.tsx`,
`src/components/app-shell.tsx`, `src/components/inbox/*`, `src/lib/conversations.ts`,
`src/lib/mock-data.ts`, `src/app/api/widget/{messages,state,upload}`, `src/widget/{embed,types,widget}.ts`,
`src/app/dashboard/visitors/page.tsx`, `audit/plan.md`, `audit/decisions.tsv`.

---

## D38 — Agent photo in the widget reply bubbles and viewer status

**Decision.** Show the agent's actual profile photo in the conversation, not the brand
artwork, and attach it to exact-thread presence. The uploaded avatar URL is snapshotted
onto `messages.agent_avatar` when the agent sends, so each reply keeps the photo that
was current at send time. Widget agent runs render `<img class="avatar-img">` inside the
22px avatar slot (full-bleed, rounded) and fall back to the artwork when no photo is set.

**Viewer status.** `conversation_viewers.avatar_url` rides the existing heartbeat; the
widget meta returns `agentsViewing: {name, avatar}[]`. The header subtitle now renders
the first viewer's photo (or an initial if they have no photo) to the left of
"<name> is here". The dashboard viewer chip does the same.

**Migration.**
```sql
alter table messages add column if not exists agent_avatar text;
alter table conversation_viewers add column if not exists avatar_url text;
```

Widget compiled; app + widget TypeScript, production build pass; lint has zero errors.

**Files.** `supabase/schema.sql`, `src/lib/conversations.ts`,
`src/components/inbox/{inbox-view,conversation-thread}.tsx`,
`src/app/api/widget/messages/route.ts`, `src/widget/{types,embed,widget,styles}.ts`.

---

## D39 — Named typing, agent presence dots, live status

**Decision.** Make the visitor-facing identity truthful at all times: the typing line
names the agent and shows their photo, and every agent photo carries an online/offline
dot. Presence is per agent, not implied by the site heartbeat.

**Heartbeat.** The dashboard shell upserts the local profile into `agents` every 30s
(`last_seen_at`). The widget API treats `last_seen_at` within 90s as online. Closing
every dashboard tab lets the row age out, so dots turn grey without a manual write.

**Typing.** `typing` now stores the writer's `agent_id/name/avatar` alongside
`agent_typing_at`. The widget prints "<name> is typing…" with that photo and a green dot
in both the header subtitle and the typing row. Rows without identity (old clients) fall
back to "Support is typing…" with no photo. Typing still expires on the existing 5s TTL.

**Status dots.** Every agent reply avatar has a 6px dot: green when the author's agent id
is in `onlineAgents` (or the name matches for pre-D39 rows), grey otherwise. The header
uses the typing agent, then an exact-thread viewer, then the last agent who replied, then
brand artwork; the dot follows the same rule (viewers/typing are online). Past
transcripts are pinned to their conversation by the transport, so their dots keep
updating instead of being frozen or fed the latest thread's presence.

**Edge cases handled.** No identity in the typing row; broken/blocked avatar URLs fall
back to an initial (header/typing) or artwork (bubbles); messages without `agent_id`
fall back to name matching; deleted/renamed agents age to grey; multiple agents show
independent dots; typing expiry restores the viewer/last-agent/site status; hidden tabs
keep enough heartbeat cadence inside the 90s window; viewer presence still overrides
site hours because the agent is demonstrably present.

**Migration.**
```sql
alter table agents add column if not exists last_seen_at timestamptz;
alter table messages add column if not exists agent_id text;
alter table typing add column if not exists agent_id text;
alter table typing add column if not exists agent_name text;
alter table typing add column if not exists agent_avatar text;
alter table conversation_viewers add column if not exists agent_id text;
```

Widget compiled; app + widget TypeScript, production build, tests pass; lint has zero
errors.

**Files.** `supabase/schema.sql`, `src/lib/{agent-profile,conversations}.ts`,
`src/components/{app-shell.tsx,inbox/inbox-view.tsx}`, `src/app/api/widget/messages/route.ts`,
`src/widget/{types,embed,widget,styles}.ts`.

---

## D40 — Honest header titles, reply-soon status, visible welcome bubble

**Decision.** Each surface names itself, the no-agent state asks for patience instead of
claiming presence, and the welcome message is a real, configurable bubble that cannot be
scrolled out of sight.

**Titles.** The panel title is computed every render: no messages → "Chat with support";
a live or past conversation with messages → "Your conversation"; history → "Your
conversations". `data-title` still overrides all three. The history view hides the
presence subtitle entirely; the live chat shows typing/viewer status.

**Status line.** With no typing agent and no exact-thread viewer, the subtitle reads "We'll
reply as soon as possible" — never "Online" or "Away". The photo and green/grey dot still
reflect the last replying agent's actual heartbeat. The line is single-line with ellipsis
so long names cannot wrap the header.

**Welcome bubble.** `sites.welcome_message` (default "Hi! How can we help?") is editable in
Settings and returned in the widget meta. It renders as the newest bubble while the
conversation has no agent reply, so it is visible even after the visitor sends messages;
the first real agent reply removes it. It is suppressed in history, past transcripts,
ended/CSAT views, and when the message is blank (fallback text applies).

**Edge cases.** No meta yet → title stays "Chat with support" and no subtitle; visitor-only
threads keep the welcome visible; agent replies replace it without layout traps; a custom
`data-title` wins on every surface; empty/whitespace welcome falls back; past chats never
inject the current welcome; title updates live when entering/leaving history.

**Migration.**
```sql
alter table sites add column if not exists welcome_message text default 'Hi! How can we help?';
```

Widget compiled; app + widget TypeScript, production build, tests pass; lint has zero
errors.

**Files.** `supabase/schema.sql`, `src/lib/widget-admin.ts`,
`src/app/api/widget/messages/route.ts`, `src/app/dashboard/settings/page.tsx`,
`src/widget/{types,embed,widget,styles}.ts`.

---

## D41 — Away message belongs to the agent (supersedes D40's site welcome field)

**Decision.** D40 added a site-wide `welcome_message`; that was wrong. Each agent already
has an away message, so that single field now drives both the idle header line and the
welcome bubble. The site-level welcome experiment is retired.

**Storage and sync.** `AgentProfile` gains `awayMessage` (localStorage), mirrored to
`agents.away_message` on save and on the 30s dashboard heartbeat. Settings edits it under
the agent profile — there is no separate welcome field and no site away field in the UI.
`agents.away_message` is current, so changes show without resending a reply.

**Widget.** The GET resolves the away line by `conversations.last_agent_id` (the agent who
replied last), falling back to the most recently active agent, then `sites.away_message`,
then "We'll reply as soon as possible". The header uses it whenever nobody is typing or
viewing, and the welcome bubble shows it at the newest position until the first agent
reply. Both are one-line/ellipsized.

**Trigger.** `touch_conversation()` now also records `last_agent_id` from agent messages;
a backfill fills existing rows.

**Edge cases.** No agents yet → site fallback; last agent not in the recent list → most
recent active agent; blank away → default sentence; away edits propagate via heartbeat;
past/history/ended views still suppress the bubble; welcome disappears on the first real
reply.

**Migration.**
```sql
alter table agents add column if not exists away_message text;
alter table conversations add column if not exists last_agent_id text;

create or replace function public.touch_conversation() returns trigger
language plpgsql as $$
begin
  update conversations
     set last_message = coalesce(nullif(new.body, ''), new.attachment_name, 'Attachment'),
         updated_at = new.created_at,
         unread_count = case when new.author = 'visitor' then coalesce(unread_count, 0) + 1 else 0 end,
         last_agent_id = case when new.author = 'agent' then new.agent_id else last_agent_id end
   where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_touch_conversation on messages;
create trigger messages_touch_conversation after insert on messages
  for each row execute function touch_conversation();

update conversations c set last_agent_id = (
  select m.agent_id from messages m
  where m.conversation_id = c.id and m.author = 'agent'
  order by m.created_at desc limit 1
);

-- Optional, only if the D40 experiment was applied:
-- alter table sites drop column if exists welcome_message;
```

App + widget TypeScript, production build, tests pass; lint has zero errors.

**Files.** `supabase/schema.sql`, `src/lib/{agent-profile,conversations,widget-admin}.ts`,
`src/app/api/widget/messages/route.ts`, `src/app/dashboard/settings/page.tsx`,
`src/widget/{types,embed,widget}.ts`.

---

## D31 — One-line identity header: title · subtitle, sized to fit

**Superseded.** The inline subtitle was later removed at the user's request; the
header is title-only and centered (see D29 and the D32 work). The measurement notes
below stay for reference only.

**Decision.** The header identity is one centered row on a single line:
"Chat with support · Here to help" — title 13.5px, `·` separator, subtitle 10.5px,
baseline-aligned. A new short default ("Here to help") replaces the retired
"Leave a message. We'll get back to you." D29 had dropped the subtitle entirely
because the two-line stack wrapped in the 318px panel; the requirement is the
subtitle back **inline with the title**, not above it.

**Why the sizes are what they are.** The 318px panel leaves ~202px between the
40px brand button and the 26px ⋯ button for a centered block
(2 × (145 − 40 − 4)). At the old 17px, the title alone runs ~152px — no room for
any subtitle — so the row was measured and sized in-browser, not eyeballed:
title 13.5px = 114px, "Here to help" at 10.5px = 71px → 192.4px total, both
unclipped. "We're here to help" measured 94.6px and pushed the row past the cap,
ellipsizing the title — rejected on measurement, not taste.

**Overflow guard.** `.identity-text` carries `max-width: 202px; overflow: hidden`;
`.title` keeps nowrap + ellipsis + `min-width: 0` (flex shrink), `.subtitle` is
`flex-shrink: 0` — a long custom `data-title` truncates instead of colliding with
the buttons. The `@media(max-width:480px)` title override was removed so the row
keeps identical proportions at every width.

**Subtitle contract.** Default "Here to help"; `data-subtitle` overrides; a
whitespace-only value renders none. This supersedes D29's opt-in-only behavior
(embed sites now show the subtitle without passing anything).

**Verification (CDP, measured).** Embed (4321): title 114 / subtitle 71.4,
clearances 7.8 / 21.8px. Dashboard preview: 112.3 / 67.2, clearances 10.8 / 24.8.
Mobile 390px (panel 366): 114 / 71.4, clearances 33.8 / 47.8. All three:
centered (delta 0.0), one baseline-shared line (top delta 3px), nothing clipped.
Screenshots `21/23/24` in the session's widget-test folder.

**Files.** `src/widget/widget.ts` (default subtitle), `src/widget/styles.ts`
(`.identity-text` row + cap, `.title` 13.5px, `.subtitle` inline + `·` ::before,
mobile override removed). `pnpm build:widget` rerun; widget tsc clean, repo lint
unchanged (same 2 pre-existing app-shell / conversation-thread errors).

---

## D42 — Profile hydration, intentional inbox additions, and low-cost widget updates

**Decision.** Preserve the existing dashboard design. Fix the profile mismatch at its
state boundary, then make only small inbox improvements that support agents can use
without adding a new subsystem: per-conversation reply drafts, notification deep links,
and a profile edit action in the account menu.

**Profile root cause.** Settings copied the server snapshot of `useAgentProfile()` into
three `useState` values during hydration. The top-right menu read the hydrated profile
directly, so it could show an avatar while Settings still showed the server fallback.
Settings now treats locally edited values as a `Partial<AgentProfile>` overlay on the
live profile. An unchanged field always follows the profile store, while an edited field
remains untouched until Save. The profile store also listens for `storage` changes from
other tabs. Saving still writes localStorage first and upserts `agents` in the background.

**Widget profile visibility.** The widget API now includes online agents' avatars in
`onlineAgents`. Before a first reply, the header can use the most recently active agent
as its identity; after a reply it continues to prefer the typing agent, exact-thread
viewer, then the replying agent. This makes the configured agent profile visible in the
widget as well as the dashboard account control.

**Performance choices.**
- Opening a dashboard transcript now fetches its conversation row and messages in parallel.
- The shell resolves the site id once, debounces bursts of realtime conversation events by
  250ms, and skips notification reloads when neither unread count nor preview changed.
- Widget polling is 2 seconds while open and 15 seconds while closed. Hidden documents do
  not poll. Returning to a visible document refreshes immediately. One abortable request
  runs at a time, and unsubscription cancels it.
- Widget mount no longer fetches the conversation history or past-chat list in the
  background. It loads on an explicit open or history action.
- A presence-only poll no longer rebuilds every message DOM node. The renderer keeps the
  current transcript when both the message array and transcript state are unchanged.

This supersedes D30's eager artwork preload and D35's 800ms open / 2s closed polling
cadence. The artwork fallback remains intact; only its duplicate preloads were removed.

**Intercom-inspired features kept deliberately small.** Reply drafts remain in a
module-level map keyed by conversation id, so moving between threads does not lose a
partially written reply during the current dashboard session. Clicking a notification
opens that conversation via `?conversation=<id>`, including on narrow layouts. The
account menu links to Settings. Saved drafts, note modes, macros, and workflow actions
are outside this change because they require durable storage or new domain rules.

**Verification.** Added `scripts/verify-runtime-regressions.mjs`. It verifies profile
hydration, preservation of unsaved edits, profile persistence, no eager widget fetch,
poll coalescing, hidden-tab suspension, visibility refresh, and abort cleanup. `pnpm
test` passed 12 tests. App and widget TypeScript checks, `pnpm build:widget`, and the
production build passed. Lint has zero errors and four existing `img` warnings. Runtime
timings and visual behavior remain unmeasured because browser automation was excluded.

**Principles used.** Fix Root Causes changed the profile repair from a display fallback to
the stale Settings state boundary. Laziness Protocol limited the Intercom-inspired work to
drafts and direct navigation. Experience First kept the existing interface intact.

**Files.** `src/lib/agent-profile.ts`, `src/app/dashboard/settings/page.tsx`,
`src/components/{app-shell.tsx,inbox/inbox-view.tsx,inbox/conversation-thread.tsx}`,
`src/lib/conversations.ts`, `src/app/api/widget/messages/route.ts`,
`src/widget/{embed,types,widget}.ts`, and `scripts/verify-runtime-regressions.mjs`.

---

## D43 — Separate visitor welcome from agent away text; make new chats deterministic

**Decision.** Keep the current widget and dashboard design. The agent's away message is
presence text in the header only. A separate site-wide welcome message appears in an
empty conversation. Settings also stores up to six suggested questions; visitors tap a
question to fill the composer, then choose whether to send it. This adds a useful
first-contact path without loading another UI library or increasing the closed widget's
work.

**Root causes.** The widget reused `awayMessage` in both the header and empty-chat
bubble, so an agent's personal status looked like a universal greeting. Settings also
saved the agent locally, launched a database write without waiting, and announced success
even if that write failed. Site copy had no Settings field. Starting a new conversation
cleared state but then reset the active conversation to null and reloaded, allowing the
old poll and latest-conversation lookup to put the visitor back on the old thread.

**Changes.**
- Added `sites.welcome_message` and `sites.preset_messages` in both the schema and an
  idempotent migration. Applied that migration to the linked Chatplatform Supabase
  project on 2026-10-20. The API returns sanitized copy with the conversation metadata.
- Settings reads and saves site copy and the agent profile, waits for both writes, and
  reports a sync failure instead of claiming success. A one-second site cache and the
  existing two-second open-widget poll make saved copy visible shortly after Save. The
  dashboard widget preview reads the same copy and agent profile when mounted.
- The new-conversation POST returns the created id to the widget. The widget keeps the
  old view available for rollback on failure, shows a loading state, then immediately
  renders the new empty chat using that id. A ten-second POST timeout prevents an
  indefinite spinner. Conversation versioning discards responses from old polls.
- Header presence prefers the displayed agent's actual online status. Unchanged header
  identity and status keep their DOM nodes across polls, avoiding repeated avatar loads.
  Suggested questions render only in an empty live chat and disappear after a message.

**Verification.** The runtime regression script now checks awaited profile saving,
stale-poll rejection after a conversation switch, and use of the server-created id.
Twelve unit tests, app and widget TypeScript, widget build, and lint pass (lint retains
four non-failing image warnings). No browser automation was used at the user's request.
The production build also passes. The existing demo-wide anonymous RLS
policies remain a separate release blocker for a public multi-tenant launch.

**Files.** `src/app/dashboard/{settings,widget}/page.tsx`,
`src/app/api/widget/messages/route.ts`, `src/lib/{agent-profile,widget-admin,widget-copy}.ts`,
`src/widget/{embed,types,widget,styles}.ts`, `supabase/schema.sql`,
`supabase/migrations/20261020_widget_copy.sql`, and
`scripts/verify-runtime-regressions.mjs`.

---

## D44 — Preset questions have persistent widget answers

**Decision.** A preset is a `{ question, answer }` pair. Settings edits both fields and
requires a unique question and a nonempty answer. Old question-only values remain
editable in Settings but do not appear as answerable suggestions until completed.

**Visitor behavior.** Tapping a preset sends its question as a visitor message on the
right. The saved answer is inserted as an automated reply on the left, with the widget
artwork and the same neutral bubble color as a human agent reply. It is not attributed to
a human agent. The pair is stored in the transcript, so it survives reloads and appears
in the dashboard. A failed request leaves the question available to retry.

**Persistence and edge cases.** The existing widget message endpoint validates the
question against the site's current saved presets and inserts both messages in one
database statement. Stable IDs make retries replay-safe. `messages.is_automated`
distinguishes the widget answer from a human reply. The conversation trigger preserves
the team's unread count and last human agent when that answer is inserted. Rendering
splits runs when a widget answer and human reply are adjacent, so the human photo does
not inherit the widget icon. The idempotent column and trigger migration was applied
to the linked Chatplatform Supabase project on 2026-10-20.

**Verification.** TypeScript, widget build, lint, the runtime transport regression
script, and 15 unit tests pass. Lint has four existing non-failing image warnings.
No browser automation was used, as requested. Public launch still requires replacing
the existing anonymous demo policies with access control.

**Files.** `src/lib/{widget-copy,widget-requests}.ts`,
`src/app/dashboard/{settings,widget}/page.tsx`, `src/app/api/widget/messages/route.ts`,
`src/widget/{embed,types,widget,styles}.ts`, `supabase/schema.sql`,
`supabase/migrations/20261020_preset_replies.sql`, and regression tests.


---

## D45 — Closed-state agent avatar, neutral preset replies, anchored welcome

**Decision.** The closed conversation screen keeps a human anchor, automated preset
answers look like normal support messages, and the welcome stops moving with the thread.

**Closed screen.** When the current conversation is closed, the centered end/CSAT view
shows the last human agent's avatar above "Conversation ended". It uses their photo,
falls back to their initial if the photo fails or is absent, and falls back to the widget
artwork when no human has replied. The avatar only rebuilds when that agent identity
changes, so reopening or rating the conversation does not reload the image.

**Preset replies.** Automated preset answers keep the widget artwork in the avatar slot
but use the same neutral bubble color as a human support message. The visitor question
stays the right-hand accent bubble. This keeps the distinction (artwork, no agent
attribution) without making the answer look like a visitor message.

**Welcome placement.** The welcome bubble is now the first message in the live transcript
instead of the newest one. It remains at the top while the visitor types and the thread
grows; it is still suppressed in history, past transcripts, and the ended/CSAT view.
Presets stay below the transcript and still disappear after the first message.

**Verification.** Widget TypeScript, widget build, app TypeScript, unit tests, and lint
pass (lint retains four non-failing image warnings). The preset route check passes against
the current dev server; the earlier 500 came from verifying against a stale production
build, which is rebuilt before release.

**Files.** `src/widget/widget.ts`, `src/widget/styles.ts`, `decision.md`, `flow.md`.

---

## D46 — No prebuilt tags: one live registry per site

**Decision.** Delete the hardcoded `tagOptions` list and make tags rows in a new
`tags` table. The inbox's Tag filter, the visitor sheet's add-tag choices, and newly
created tags all read that one table. A tag added in one dashboard tab reaches every open
tab through Realtime, and assigning it updates the conversation row optimistically and
then through the existing `conversations` Realtime UPDATE.

**Schema.** `tags(id uuid pk, site_id → sites on delete cascade, name text, created_at)`.
`name` is trimmed by a check constraint and capped at 40 characters. A unique index on
`(site_id, lower(name))` makes "Billing" and "billing" the same tag. RLS follows the
existing demo posture (anon all) and the table joins `supabase_realtime`. The migration
backfills names already present in `conversations.tags` with `DISTINCT ON (site_id,
lower(name))`, so existing assignments stay filterable; it does not seed the old
Billing/Bug/Integration/Feature request/Priority list. `supabase/schema.sql` creates the
table but seeds nothing.

**Data layer.** `src/lib/tags.ts` owns `cleanTagName`, `fetchTags`, `createTag`, and
`useTags`. `cleanTagName` collapses inner whitespace, trims, and caps by code point (so an
emoji is never sliced in half). `createTag` inserts; on `23505` it re-reads the site's tags
and returns the canonical existing spelling instead of surfacing a duplicate error.
`useTags(siteKey)` loads once and refetches on any `tags` INSERT/DELETE/UPDATE.

**Dashboard.** Settings owns tag creation: `/dashboard/settings` gained a Tags section
that lists the current registry, validates and inserts a new tag, and refreshes
`useTags` immediately. `src/app/dashboard/page.tsx` derives the filter options from the
same hook and passes the list to `InboxView` → `VisitorSheet`. The sheet only assigns
existing unassigned tags and links to Settings when there is nothing left to add; it
never creates a tag implicitly. The filter value is derived (`activeTag`) rather than
reset in an effect, so a deleted tag can never leave the inbox filtered by an option the
menu no longer shows.

**Edge cases handled.**
- Empty, whitespace-only, and over-40-character names are rejected or normalized.
- Duplicate names differing only by case resolve to one row, including two tabs racing;
  Settings shows the canonical spelling and an "already exists" notice.
- A tag that is already on the conversation is skipped case-insensitively; the sheet also
  hides it from the choices.
- Assigning an existing tag from the sheet optimistically paints the chip; a failed
  conversation update rolls the chip back while leaving the registry row intact.
- Without Supabase the Settings section says "Connect Supabase to create tags." and the
  filter shows only "All tags" — no fake local list returns.
- If the tags migration has not run, reads return no tags and Settings reports the failed
  insert; the rest of the dashboard and widget keep working.
- Legacy conversation tags are backfilled, so they survive the removal of the static list.
- Tag names render with `textContent`, so names cannot inject markup.

**Files.** `supabase/schema.sql`, `supabase/migrations/20261020_tags_and_topics.sql`,
`src/lib/{tags,conversations}.ts`, `src/app/dashboard/{page,settings/page}.tsx`,
`src/components/inbox/{inbox-view,visitor-sheet}.tsx`, `src/lib/mock-data.ts`.

---

## D47 — Ask "What best describes your problem?" once, then tag the thread

**Decision.** After the first normal visitor message in an untagged conversation, the
widget API inserts one automated agent message — "What best describes your problem?" —
and returns the site's tags in meta. The widget replaces that message with a neutral,
untinted question card containing a dropdown of those tags; choosing one adds it to
`conversations.tags` through a new `state` action. The ask is skipped when the site has
no tags, when the conversation is already tagged, and for preset sends (the preset answer
already resolves a known question).

**Why a persisted message.** The question has to survive a reload, appear in the
dashboard transcript, and be idempotent across retries. A stable id
(`topic-ask-<conversation-id>`) plus `upsert(..., ignoreDuplicates)` gives exactly one
row per conversation even when two sends race. The replay path also calls the same helper,
so a response lost after the visitor insert cannot strand a conversation without the
prompt.

**Inbox integrity.** The automated rows must not become the inbox preview. The
`touch_conversation()` trigger detects the shared `is_automated and id like
'topic-ask-%'` namespace — which covers both the question (`topic-ask-<id>`) and the
confirmation (`topic-ask-ack-<id>`) — and leaves `last_message` and `updated_at` on the
visitor's own message. `unread_count` and `last_agent_id` already ignored automated rows
(D44). Sharing the namespace means an installation that already ran the first migration
needs no second trigger update.

**Widget.** `WidgetMeta` gains `topicOptions` (site tags) and `conversationTags` (the
thread's current tags); the transport gains an optional `selectTopic(tag)`. The prompt
card renders only when all of these hold: the panel is on the live latest chat, the
thread has the ask message, the conversation has no tags, the site has tags, identity is
complete, and the transport can persist the choice. The persisted ask bubble is hidden in
the widget and replaced, in its transcript position, by a neutral card with the question,
a one-line helper, and a dashboard-style dropdown; there is no timestamp and no amber
tint. Choosing a topic removes the card and inserts the confirmation bubble in the same
render — no blank gap while the request runs — then optimistically adds the tag to meta.
Failure removes both the optimistic tag and the optimistic confirmation and brings the
card back. A successful write calls `pollNow()`, and the poll replaces the local
confirmation with the server's saved row by id. Starting a new conversation clears
`conversationTags` in the optimistic meta so a previous chat's tag cannot suppress the next
prompt. The dashboard keeps the persisted ask row but hides its timestamp/ticks — it is a
prompt, not a reply.

**Confirmation.** A successful selection also upserts one automated
`topic-ask-ack-<conversation>` message: "Thanks — we'll get back to you as soon as
possible." The same ignore-duplicates upsert makes re-selection and retries safe. The
widget inserts that message optimistically in the same frame as the selection, so the
card is replaced instantly; `pollNow()` then reconciles the local copy with the saved row
by id. It is a transcript message, not a temporary toast, so it survives reloads and the
dashboard sees what the visitor was told. The `topic-ask-` prefix keeps the inbox trigger
treating it as transcript-only.

**Server-side checks.** `POST /api/widget/state { action: "tag", value }` verifies the
name belongs to the site before writing, appends it only if absent, and returns 409 when
the tag disappeared between the poll and the tap. The write is a read-modify-write of the
array; the widget only offers one choice, so concurrent visitor selections cannot occur
there, and an agent tagging the same thread at the same moment loses only the redundant
write.

**Edge cases handled.** No tags configured; preset-only chats; repeat messages before the
visitor chooses; retries and concurrent first sends; conversations tagged by an agent
before the next message; closed conversations (the next message creates a new row and a new
ask); history, past transcripts, and ended/CSAT views (the prompt card is hidden); tags
removed between poll and click (409 + revert); duplicate selection and replayed state calls
(idempotent tag + exactly one confirmation); failed network write (revert + retry
possible); old conversations (the ask appears on their next visitor message); `data-site`
missing (local transport has no selectTopic, so no dropdown).

**Verification.** App and widget TypeScript pass, the widget bundle builds, 15 unit tests
pass (including the new `tag` state-action validation), and changed-file lint is clean.
No browser automation was run.

**Files.** `src/app/api/widget/{messages,state}/route.ts`, `src/lib/{widget-admin,
widget-requests}.ts`, `src/widget/{types,embed,widget}.ts`,
`supabase/schema.sql`, `supabase/migrations/20261020_tags_and_topics.sql`.

---

## D48 — Preset chips right-aligned; tag chips tinted; topic prompt is a card

**Decision.** `.presets` uses `justify-content: flex-end` for the preset questions, so
they hug the right edge instead of starting at the left. In maximized mode the container
is capped to the same 720px message/composer column (`max-width: 720px; margin: 12px auto
0`) before right-aligning. The topic prompt is no longer a chip row: it is a neutral card
rendered in the ask message's transcript position, with the question, a one-line helper,
and a dropdown that mirrors the inbox's Tag filter menu — a bordered trigger with the
current label and a chevron, plus a floating option list with hover states. The menu is
positioned with fixed viewport coordinates and ported into the panel, so it paints above
the composer and is clamped inside the panel bounds instead of being clipped by the
transcript's scroll area; it always opens above the trigger, with its max-height capped to
the room above, and closes on outside click, scroll, resize, or Escape. The widget is
framework-free, so this is a small DOM/CSS equivalent of the dashboard's
`DashboardFilterMenu`, not the React component itself.

**Why.** The preset chips are actions on the visitor's side of the conversation, and the
right edge is where the visitor's own bubbles and send control already live. The topic
prompt is a one-time routing choice, not a row of quick actions; a card with a dropdown
reads as a form, scales to many tags, gives the question room, and matches the dropdown
language agents already use in the inbox.

**Colour.** Dashboard tag chips are amber — `#f59e0b` at 14% over the muted/control
background, a 35–45% amber border, and `text-amber-300`/`#fcd34d` text — in the inbox rows,
the profile sheet, and the Settings list. The topic prompt card is deliberately neutral:
no amber tint, no timestamp, no presence styling. Preset question chips keep the neutral
control colour and blue hover. Structure and typography distinguish the prompt; the tag
chips keep the colour signal elsewhere.

**Files.** `src/widget/{styles,widget}.ts`, `src/components/inbox/{conversation-list,
visitor-sheet,conversation-thread}.tsx`, `src/app/dashboard/settings/page.tsx`.

---

## D49 — Widget header identity is live-only

**Decision.** The widget header shows a specific agent's avatar and name only when that
exact conversation has a live signal: an agent typing in it, or a `conversation_viewers`
row for it. With nobody there, it shows the brand textbox artwork plus a support-wide
status — "Support is online" when at least one agent heartbeat is fresh
(`onlineAgents.length > 0`), otherwise "Support is offline" — with a green or grey dot.
The previous fallbacks to the last replying agent and any online agent's identity are
removed from the header.

**Why.** The header could show an agent photo and name while nobody was viewing the
thread, because `lead` fell back to `lastAgent` and then `meta.onlineAgents[0]`. The site
heartbeat means "a dashboard tab is open", not "this conversation is being watched";
showing an identity from that was misleading. Exact-thread presence and typing are the
only signals that justify naming an individual. When nobody is there, the online/offline
line answers the visitor's actual question ("will someone see this?") without inventing
attendance.

**Still shown elsewhere.** Message bubbles keep their per-agent online/offline dots, the
ended/CSAT screen keeps the last human agent's avatar, and the dashboard presence list is
unchanged. The away message no longer fills the header; the welcome bubble still uses the
site welcome copy.

**Edge cases.** Typing wins over a viewer; multiple viewers show "N agents here" with the
first viewer's photo; closing the thread deletes the viewer row and the next poll drops the
identity; hiding the dashboard tab clears the viewer; a stale viewer ages out after 30s;
the 5s typing TTL restores the support-wide line; a viewer/typing agent without a photo
falls back to an initial, not the brand artwork; no meta still renders no header line; with
meta and no viewer/typer, the brand artwork is always present and the dot is green only
when at least one agent is online.

**Files.** `src/widget/widget.ts`, `decision.md`, `flow.md`.

---

## D50 — Per-site welcome notification toggle

**Decision.** Settings has a single "Welcome notification" switch directly under the
welcome message. It stores `sites.welcome_notify` (default false). When enabled, the widget
fetches a meta-only response at mount while the panel is still closed and shows the same
notice card and badge as an unread reply — **without a sound** and with the generic preview
"You have an unread notification." (never the welcome copy). Opening the panel clears the
notice as usual. It fires **once per visitor/browser**, not once per page load.

**Why.** The welcome message was only visible after opening the widget. The toggle lets a
site draw attention to it without exposing the welcome copy in the closed-state
notification and without inventing an unread message. The per-visitor localStorage flag
prevents the alert from becoming a nudge on every page load. The meta-only fetch
(`GET /messages?...&meta=1`) keeps this from loading the transcript on every page view,
preserving the lazy-load work from D42.

**Details.**
- The switch is just the name + control, no helper text. It saves immediately on toggle
  (optimistic write, rollback + notice on failure), independent of the Save button.
- `WidgetMeta.welcomeNotify` and `WidgetMeta.welcomeMessage` drive the decision.
- The widget calls the new optional `transport.initialMeta` once at mount. The embed
  implements it as a meta-only GET; the local demo transport has no method, so it does
  nothing.
- `pushWelcomeNotice()` checks `welcomeStorageKey` (`chat-platform:welcome-notified:<site>`)
  before showing, writes it when it shows, creates one notice card ("Support" + the
  generic unread line), auto-dismisses after six seconds, plays the existing notification
  sound via `onNotify`, and never increments the unread count.
- Opening the widget marks the same key as seen when the setting is on, so someone who
  opens the chat before the meta resolves does not get a delayed welcome alert later.
- It is skipped if the panel is open, being opened, the setting is off, the welcome
  message is blank, the response arrives after the widget is destroyed, or the key is
  already set.

**Clean remount.** `src/widget/version.ts` holds a widget version. The embed's plain-script
copy must stay in sync (it cannot import an ES module). On a version change, the embed
clears the widget's local data once — `chat-platform:identity`, `chat-platform:visitor-id`,
all `chat-platform:welcome-notified:*` keys, and the tab-local demo messages — then writes
`chat-platform:widget-version`. The next load is a new visitor with the welcome alert armed.
The embed's `widget.js` import is versioned, and the dashboard's generated snippet now
includes `embed.js?v=<version>`, so a re-paste/hard reload cannot serve the old module.

**Edge cases.** No conversation yet; no `data-site`; migration missing (the setting reads
false and the notification does not run); welcome message cleared after the toggle was
enabled; panel opened while the meta fetch is in flight; widget destroyed before the
response; notice stack already at the three-card cap; localStorage blocked (the in-memory
flag limits it to once per mount); version bump re-arms the alert once.

**Migration.**
```sql
alter table sites
  add column if not exists welcome_notify boolean not null default false;
```

**Files.** `supabase/schema.sql`, `supabase/migrations/20261020_welcome_notify.sql`,
`src/app/dashboard/settings/page.tsx`, `src/app/api/widget/messages/route.ts`,
`src/lib/widget-admin.ts`, `src/widget/{types,embed,widget,version}.ts`,
`src/app/dashboard/widget/page.tsx`.

---

## D51 — No mandatory visitor identity before chatting

**Decision.** Removed the pre-chat name/email form and the gate that hid the composer
until a name was entered. The composer, preset questions, and topic prompt are available
immediately. Name and email are optional: hosts can still set `data-name` / `data-email`
on the embed or call `window.chatPlatformIdentify(name, email)`; the next message carries
that identity and the dashboard row gets the name. With no identity, the dashboard shows
"Visitor <id>".

**Why.** Requested. The form was friction before the first message, and the conversation
does not need a name to be useful — the first message is the context. The host already
has optional identity hooks, so the visible gate added nothing that the attributes cannot.

**Supersedes.** The mandatory pre-chat identity flow described in D32. The transport
`identify` action and the `data-name` / `data-email` attributes remain for host
compatibility; they just no longer have a form in the widget.

**Edge cases.** Existing conversations keep the names already stored; host-provided
identity still reaches the POST through `readIdentity`; no identity fields exist in the
widget DOM; the visitor sheet falls back to "Visitor <id>" until a host identifies the
visitor; old pre-chat identity CSS was removed; presets/topic prompt and the composer are
not gated by `identified`.

**Files.** `src/widget/widget.ts`, `src/widget/styles.ts`, `decision.md`, `flow.md`.

---

## D52 — Optional email bar, first-chat CTA, compact panel, maximized status, deferred sound

**Decision.** Five refinements to the post-identity widget:
1. An optional email-only bar sits above the composer while `visitorEmail` is empty.
   It has an email input, Save, and dismiss; it never blocks sending. Saving calls
   `transport.identifyEmail(email)`, which preserves any host-supplied name, and the
   server's `identify` action now patches only the fields that were provided.
2. An empty live chat shows a centered "Start chat" button; clicking it focuses the
   composer. It disappears after the first message.
3. The compact panel is 300 × up to 480 (was 318 × 512); mobile height caps at 520.
4. Maximized mode keeps the centered title and now shows the status line beneath it
   (online/offline/agent name), instead of hiding the whole identity block.
5. Notification sound follows the browser autoplay policy: if the audio context is
   suspended, the first `pointerdown`/`keydown` plays it. If the visitor has already
   interacted (`navigator.userActivation.hasBeenActive`), it plays immediately.

**Why.** Requested. The email ask is useful but optional, the first-chat CTA makes the
empty state actionable, the smaller panel takes less page space, the maximized header
was missing the presence line, and the sound was silently blocked before a gesture.

**Details.**
- `WidgetMeta.visitorEmail` comes from the latest conversation. The email bar hides once
  the email is saved, the meta reports one, or the visitor dismisses it for this mount.
- `identifyEmail` saves the local identity with the existing name plus the new email and
  posts `{ action: "identify", email }`. The API only writes provided fields, so an
  email-only save never clears a host-provided name.
- The bar is neutral, uses the existing surface/strong tokens, and is capped to the
  composer column when maximized.
- "Start chat" is a real button in the empty live transcript; it only moves focus to the
  composer (no empty conversation is created).
- The sound uses an AudioContext state probe plus user-activation check; deferred sounds
  are coalesced to one pending play.

**Clean reset.** `WIDGET_VERSION` is now `2026-10-20.4`; the embed's self-replace/version
storage reset clears the old visitor, identity, welcome flag, and tab demo messages, then
mounts one fresh instance. Re-paste the versioned snippet to guarantee the new embed loads.

**Files.** `src/widget/{widget,styles,types,embed,version}.ts`,
`src/app/api/widget/{messages,state}/route.ts`,
`src/app/dashboard/widget/page.tsx`, `decision.md`, `flow.md`.

---

## D53 — Widget asset releases do not erase visitor state

**Decision.** Widget asset releases and local-storage compatibility now have separate
versions. Updating the script or module cache no longer clears a visitor id, identity,
conversation, or welcome-notification state. The generated install snippet and the
dynamic `widget.js` import use the asset release. Only an incompatible persisted-data
change advances the storage version.

**Widget behavior.** Preset chips keep sending the saved question/answer pair. The email
ask stays a compact notification pill above the composer and opens the full card only on
click. The header and Start chat button share one `--accent-fill` token, so they always
use the exact same accent treatment.

**Dashboard behavior.** Primary buttons now use explicit light and dark accent tokens.
All dashboard button variants get the same short press-scale feedback.

**Why.** The D44 and D52 behavior was present in source, but reusing one version for
both caching and persisted data made a visual release either remain on the old module URL
or require deleting valid visitor state. Separate versions remove that tradeoff.

**Files.** `src/widget/{embed,styles,version}.ts`,
`src/app/dashboard/widget/page.tsx`, `src/components/block/{dashboard-shell.tsx,dashboard-shell.css}`,
`decision.md`, `flow.md`.

---

## D54 — Post-message email prompt and one centered maximized identity

**Decision.** The optional email prompt appears only after the first visitor message is
accepted. Its collapsed state is a compact accent-tinted control instead of a yellow bar.
In maximized mode it is centered at a 420px maximum width, while the expanded card is
centered at 520px.

**Header.** Maximized mode now uses the same title and status container as compact mode.
The duplicate title node and its vertical offset are gone, so the conversation title,
agent presence, and online state share one centered stack.

**Release.** Widget assets advance to `2026-10-21.2`; storage compatibility stays at
`2026-10-20.5`, so the new presentation loads without clearing visitor state.

**Files.** `src/widget/{widget,styles,embed,version}.ts`,
`scripts/verify-widget-release.mjs`, `decision.md`, `flow.md`.

---

## D55 — Persistent manual-message notification prompt

**Decision.** The email notification prompt requires a successfully sent manual visitor
message. A preset question and its `preset-<message id>` automated answer never make the
prompt eligible. Skip only collapses the email card back to its trigger; the prompt stays
available until a valid email is submitted or returned by conversation metadata.

**Presentation.** The trigger uses the site accent and centers its label. In maximized
mode the trigger and expanded card match the
720px composer width and connect directly to the smaller one-row composer. An empty footer
wrapper is hidden in history, ended, and past-conversation states, removing the dark strip.

**Release.** Widget assets advance to `2026-10-21.3`; storage compatibility stays at
`2026-10-20.5`.

**Files.** `src/widget/{widget,styles,embed,version}.ts`,
`scripts/verify-widget-release.mjs`, `decision.md`, `flow.md`.

---

## D56 — Production embed uses its deployed host and a real support connection

**Evidence.** The deployed host at `https://support-widget-six.vercel.app` serves the
widget modules with JavaScript MIME types and cross-origin headers. Its widget API accepts
browser preflight requests and returns site metadata across origins. Those responses
passed the read-only deployed check before this change.

**Decision.** The dashboard's install snippet uses that HTTPS host by default. Set
`NEXT_PUBLIC_WIDGET_ORIGIN` at build time to move the widget to another host. The API and
artwork resolve from the script URL, so the snippet needs no separate API setting. The
README no longer offers a development-server URL as an install snippet. Integration
scripts take an explicit API host or use the deployed host.

**Embed behavior.** A missing `data-site` stops before mounting; visitors cannot send a
message that only exists in their tab. An async script waits for `<body>` before mounting.
If snippets run twice, the latest one owns the widget. Supplied `data-name` and
`data-email` take precedence over old stored identity, including empty values after
sign-out. When a nonempty stored identity changes, a new visitor ID starts a separate
conversation; the same identity keeps its conversation. An omitted host field keeps a
previously saved field unless an explicit account switch clears it. `chatPlatformIdentify` can
update identity later. Each sent message reads
the current page path, including after SPA navigation.
The script's CSP nonce, or `data-style-nonce`, passes to the widget stylesheet.

**Limits.** A host's Content Security Policy must allow the widget host in `script-src`
and `connect-src`, and must allow the stylesheet nonce in `style-src`. No external script
can run on a page whose policy forbids it.

**Release and proof.** Asset release `2026-10-22.1` loads the new bootstrap without
clearing compatible visitor state. The embed regression check failed before the fixes
for missing site, early mount, stale identity, stale SPA page, and a shared-browser
account switch. It now passes and runs
inside `pnpm verify:widget`. `pnpm verify:deployed-widget` checks published assets,
preflight, and read-only metadata without sending a visitor message. The release style
check now asserts the current shared solid accent instead of an obsolete gradient.

**Files.** `src/widget/{embed,version}.ts`, `src/app/dashboard/widget/page.tsx`,
`scripts/verify-{widget-embed,deployed-widget,widget-release,runtime-regressions,widget-requests,preset-route}.mjs`,
`package.json`, `.env.example`, `README.md`, `decision.md`, and `flow.md`.
