# How chat-platform flows

The map of the app as it is today, and where the pieces that don't exist yet will attach.

Last updated: 2026-10-20 · Supabase loop (D27–D28); header/art fixes (D29–D30); Tier-1 (D32–D36); audit continuation — profiles, exact-thread presence, live unread, lazy transcripts, incremental polling, replay-safe sends (D37); agent photo in widget replies + viewer status (D38); named typing + per-agent online/offline dots (D39); surface-aware titles + reply-soon status (D40); per-agent away header text (D41, corrected by D43); profile hydration, drafts, and low-cost widget updates (D42); site-wide welcome, suggested questions, and deterministic new chats (D43); paired preset replies (D44); closed-state avatar, neutral preset bubbles, and anchored welcome (D45); dynamic tag registry (D46); visitor topic prompt (D47); right-aligned preset chips and a neutral topic dropdown (D48); live-only header identity and a Support online/offline status (D49); per-site welcome notification toggle (D50); no mandatory visitor identity (D51); optional email bar, first-chat CTA, compact panel, maximized status, deferred sound (D52). Seed data is the offline fallback when env is missing.

---

## 0. Today in one line

Next.js App Router renders a dark support dashboard. The widget and the inbox share one
Supabase backend (D27): the embed posts through Next API routes, the dashboard reads the
same tables live over Realtime, and seed data is the offline fallback when env is missing.
Install keys (`data-site`) keep one site's stream separate from another's. Every visitor
message also carries browser context (device, browser, OS, timezone, page) that lands on
the conversation row and feeds the profile sheet; country comes from the platform header,
never a paid lookup (D28). The widget also has the full basic support loop: read receipts,
past chats, new conversations, identity, typing, presence, attachments and CSAT (D32).
Agents have local-first profiles whose names appear on replies in both surfaces, and
exact-thread presence shows who has a conversation open (D37).

---

## 1. Routing

```
browser
  │
  ├─ /                              → redirect → /dashboard
  │
  ├─ /dashboard                 InboxPage           → AppShell → InboxView
  ├─ /dashboard/visitors        VisitorsPage        → AppShell → ComingSoon
  ├─ /dashboard/widget          WidgetPage          → AppShell → live widget preview
  ├─ /dashboard/analytics       stub page           → AppShell → ComingSoon
  ├─ /dashboard/canned-responses CannedResponsesPage → AppShell → list + editor
  └─ /dashboard/settings        SettingsPage        → AppShell → Agent profile + visitor copy
```

- All routes are statically prerendered; everything interactive is client-side.
- Nav items carry `href`s and the shell renders them through `next/link`
  (`linkComponent={Link}`), with `activeItemId={pathname}` — so the active pill follows the
  real URL and deep links / refreshes land correctly.

---

## 2. Chrome vs content

`AppShell` (client) owns the route-level chrome:

| Owned by AppShell | Supplied by each page |
| --- | --- |
| brand, nav sections, nav badges | `title`, `status` |
| notifications popover, account menu | `tabs` (inbox, canned) |
| sidebar width (persisted to `localStorage`) | `filters` (inbox) |
| — | `toolbarActions` |
| — | `children` (the page's own content) |

The status pill is opt-in: the shell renders it only when a page passes `status`, so the
inbox claims "Online" and the stub routes claim nothing (D20).

This split is why D8 chose per-page shells: the tabs are page state that must drive the
page's list, so they live where that state lives.

Filters and toolbar actions ride on the tab row when a page has tabs (D15), so a tabbed page
renders one row of chrome: `[ tabs … filters · actions ]`. A page without tabs keeps the
standalone row, and a page with neither has only the header above its content.

---

## 3. Inbox data flow (today)

```
Supabase (sites / conversations) ── fetchConversations(siteKey)  → rows only, no messages
        │                                              │
        │  (no env → seedConversations from            ▼
        │   mock-data.ts, exactly like before)   InboxView            state: items[] · selectedId · viewers · loaded
        │                                              │
        │                                              │  filter(tab, tag, query) + sort + row.unread_count
        │                                              ├─────────────► ConversationList   rows · status · unread · typing
        │                                              ├─────────────► ConversationThread loads its transcript on select
        │                                              │                  (fetchConversationById + "Loading messages…")
        │                                              └─────────────► VisitorSheet       context rows, blanks hidden
        │
        ├─ subscribeInbox: messages INSERT → merge by id; conversations UPDATE → local patch
        ├─ subscribeTyping: typing → "typing…" for 4.5s
        ├─ subscribeViewers: conversation_viewers → thread header shows other agents (D37)
        └─ heartbeat(): sites.agent_online_at every 30s; conversation_viewers ping every 15s
```

- Read receipts (D32): viewing a thread writes `agent_last_read_at` and zeroes the local
  badge; agent messages show bright ticks once `createdAt <= visitor_last_read_at`.
  Unread counts are derived from the timestamp, never from a message flag.
- The attachment button uploads to the `chat-attachments` bucket with the anon client,
  then sends the message with `attachment_*` columns; images render inline.

- `items` starts as `[]` — never seeded with mocks. Seeding useState with seed rows is
  what flashed fake conversations for a second; now both panes show
  "Loading conversations…" until the live rows (or the seed fallback) arrive once (D28).

- `items` is the only stateful copy of conversations; the list, thread and profile sheet all
  derive from it plus the current selection.
- `tab`, `sort` and `tag` live in `InboxPage` because they are rendered by the shell's tabs
  and filter menus; they arrive in `InboxView` as props. `query` and `selectedId` live in
  `InboxView` because they belong to the list pane.
- Reply drafts live in a small module-level map keyed by conversation id. Switching threads
  keeps the current session's draft without introducing persistence or server writes (D42).
- A notification links to `/dashboard?conversation=<id>`. `InboxView` selects that row and
  opens the thread pane, including on narrow layouts (D42).
- If the current selection is filtered out, the thread falls back to the first visible
  conversation — the list and the open thread never disagree.

---

## 4. Sending a reply, step by step (today)

```
composer (Enter, or the send button)
   │  onSend(body, attachment?)
   ▼
InboxView patches the one conversation in state (optimistic, same as before):
   messages   += { author: "agent", name: "You", at: <clock>, day: "Today", read: false,
                   attachment? }
   lastMessage = body || attachment.name
   updatedLabel = "now"   ·  updatedMinutes = 0   ·  unread = 0   ·  typing = false
   │
   ├─► sendAgentMessage(conversationId, id, body, attachment, profile.name)
   │   → INSERT with agent_name; trigger updates last_message/updated_at/unread (D37)
   │   └─► saved row swaps in for the optimistic one (real id + timestamp)
   │   └─► the visitor's widget poll picks it up on its next 2s open-panel tick
   │
   ├─► typing: each keystroke calls onTyping → typing.agent_typing_at (2s throttle, D32)
   ├─► attachment: picked file uploads to chat-attachments, then rides the message
   ├─► read: opening the thread writes agent_last_read_at → visitor sees blue ticks
   │
   └─► status changes persist via updateConversation(); a failure rolls the patch back
   └─► re-render → thread shows the new bubble, list preview updates,
       row re-sorts to the top ("it's alive"), textarea clears and re-measures
```

The same patch-one-conversation pattern powers **assign to me**, **mark as pending**,
**close / reopen** (through the shell's confirm dialog) and **add tag**.

Typing `/` in the reply box opens the canned list filtered by what follows the slash; Enter
or Tab drops the matching message in place of the command (D18).

---

## 5. Live visitors page (today)

The route currently shows a `ComingSoon` state. Visitor details remain available from
conversations in the inbox.

### Widget header

```
[artwork] Chat with support              [⋯]
          Leave a message. We’ll get back to you.
```

One row: the identity block (artwork, title, subtitle) is vertically centred with the
three-dot button — no home mark, no separate maximize button. The menu drops below the header
(never over the title) and closes on an outside click, Escape, choosing an item, maximizing,
or closing the panel. Escape walks menu → restore → close. Maximized mode fills the viewport,
scales the type/bubbles/composer up, hides the launcher, notifications and inline identity,
and centres the title as plain text.

---

## 6. Canned responses flow (today)

```
src/lib/canned-store.ts          ← seeded from mock-data.cannedResponses
   │  getCannedResponses() · saveCannedResponses() · useCannedResponseStore()
   ├──────────► /dashboard/canned-responses → ResponseList + ResponseEditor
   └──────────► inbox composer → the "Canned" popover and the reply box's "/" command
```

- The store is a module-level array with a commit function, mirrored to `localStorage` and
  exposed through `useSyncExternalStore` (D17). It exists because each route renders its own
  shell (decision D8), so there is no shared React parent above the page and the composer —
  without it, a response you create would never reach the place responses are used.
- The server always renders the seed and the client adopts the saved list after hydration,
  so persistence never causes a hydration mismatch. Supabase replaces the whole module with a
  `canned_responses` table.
- Both the Canned button and the reply box's `/` command read the same live store (D18).
- The page keeps the inbox's shape: chrome state (tab, query) in the page, list on the
  left, editor on the right, one pane at a time below `md`.
- Editing rules live in the editor: the shortcut must be `/` + letters/numbers/dashes and
  unique, title and message are required, and Save turns on only when the form is complete
  and changed. Empty fields show a red border; the only inline message is the shortcut's
  format/duplicate hint.
- A draft is pinned to the top of the list with a "Draft" chip, and the editor offers Cancel
  beside Create, so the whole page reflects what is being written (D16). Cancelling, or
  selecting another row, discards it.
- Usage shows only in the list row ("47 uses" / "Unused"); the editor header carries just the
  title.
- A saved response opens as a read-only summary; the form and the composer/reply-box preview
  appear only in editing (D21). State lives in the editor and is keyed by response id, so
  switching rows always lands back in the summary.
- Deleting goes through the shell's confirm dialog with `tone="danger"`.

## 7. Widget (the embeddable one)

A framework-free chat widget in vanilla TypeScript, compiled to ES modules in
`public/widget/`. The dashboard preview at `/dashboard/widget` mounts the *same source*, so
what you see is what ships.

### Mount lifecycle

```
mountChatWidget({ target, assetUrl, transport, title?, subtitle?, fontUrl?, styleNonce? })
  ├─ reuse: an existing handle for the same target is returned (WeakMap)
  ├─ host div → attachShadow({ mode: "open" })
  ├─ <style> from src/widget/styles.ts (optional nonce for strict CSP)
  ├─ build DOM: panel (role=dialog, non-modal) + launcher + live region
  ├─ listeners: launcher toggle · home · ⋯ menu · Escape · Tab trap · input autosize · submit · retry
  ├─ render() → idle (artwork via cache-first art(), never an empty box, D30)
  └─ append to target → return { open, close, reload, destroy }

destroy() → abort in-flight load/send, unsubscribe, delete the font face, remove the host
```

### Artwork rendering (D30)

```
art()
  ├─ empty assetUrl → chat-glyph fallback immediately, zero requests
  ├─ URL in decode cache → direct <img> from browser cache, no flash
  └─ otherwise → solid-blue placeholder holder on the exact footprint
       ├─ load → mark cached FIRST (else the swap loops) → swap in real image
       └─ error → chat-glyph fallback on the same footprint
```

Rules: listeners attach before `src` (cached failures still swap); the mount
preload has a 1500ms timeout so a hung image never matters; `close()` rebuilds
launcher art fresh so transient failures retry; the decode cache is module-level
(shared by every mount on the page); long titles truncate with ellipsis instead
of pushing the ⋯ button. A panel that waits for art to unhide was tried and
reverted — it killed the loading-spinner feedback; placeholders keep instant
feedback AND no ghosts.

### Header

```
┌ [logo] ───── centered title (one line) ───── [maximize] ┐
```

- The brand mark is a 40px button on the **left in both states**. With a history-capable
  transport it opens **past conversations** and returns to the chat when already in
  history ("Past conversations" / "Back to chat"); with the local demo transport it
  keeps the old close/restore behaviour (D33).
- The title is centered on one line (`white-space: nowrap` + ellipsis); the block caps at
  `calc(100% - 132px)` so a long `data-title` never collides with the right button.
  Default title: **"Your conversation"** (D33).
- One right-side button: **maximize/minimize** (corner-bracket icons). The old ⋯ menu and
  the separate clock button are gone (D29, D33).
- The subtitle slot carries **presence**: "Online" or "Away" (no away-message text),
  replaced by "Support is typing…" while the agent types (D32, D34).
- Solid brand disc, solid dots, fixed stacking (`header z-index:5`) — see D29/D30.

### Tier-1 support features (D32–D34)

```
read receipts   one tick sent → two blue ticks when createdAt ≤ agent_last_read_at
                dashboard agent messages light up when createdAt ≤ visitor_last_read_at
unread          conversations.unread_count (trigger +1 visitor, 0 agent/read) (D37)
history         left brand button → flat rows (avatar, "You, date", lastMessage,
                chevron), bottom "Start new conversation" pill; no cards (D33)
                cached 30s + prefetched at mount, so opening is instant (D33)
profile         agent name/avatar/away message in localStorage → agents table + 30s
                last_seen_at heartbeat; agent_id/name/avatar snapshotted on messages (D37–D39/D41)
presence dots   green = agent heartbeat <90s; grey = offline; on reply avatars,
                typing row, header avatar; header picks typing → viewer → last agent (D39)
viewers         conversation_viewers heartbeat while a thread is open + visible;
                dashboard header lists other agents; widget shows the viewer's photo
                left of "<name> is here" (D37/D38)
typing          typing row + header say "<name> is typing…" with the writer's photo;
                falls back to "Support is typing…" when identity is missing (D39)
title           no messages → "Chat with support"; conversation → "Your conversation";
                history → "Your conversations"; data-title wins (D40)
idle status     no typing/viewer → the last replying agent's away message (one line);
                photo dot still reflects their heartbeat (D40/D41)
welcome         first message in the live transcript, anchored at the top as the thread
                grows; hidden in history/past/ended; edited in Settings (D43/D45)
presets         up to six site-wide question/answer pairs appear in an empty live chat;
                a tap sends the question and inserts its saved automated answer (D44)
ended view      last human agent's photo (initial, then widget artwork fallback) above
                the CSAT prompt; avatar refreshes only when the agent changes (D45)
new chat        state {action:"new"} → close open row, create fresh row with identity
                guarded against double clicks; failure keeps the current transcript
                click → immediate loader, then server-created id opens blank chat;
                stale old-thread polls are discarded; 10s timeout restores view (D43)
history pill    centered, 14px above the bottom edge (D36)
ended           latest closed conversation → centered end view (title, CSAT,
                start-new pill); past transcripts stay readable (D34)
presence        dashboard heartbeat sites.agent_online_at every 30s
                widget online = heartbeat <120s AND local hour inside working hours
typing          input → setTyping(true) throttled 2s, cleared after 3s idle
                dashboard writes typing.agent_typing_at (2s throttle, 5s TTL)
                visitor typing streams to the dashboard over Postgres Changes (4.5s TTL)
                widget renders the inbox pattern: bubble + 3 bouncing dots (D35)
identity        optional host identity: data-name/data-email seed it;
                window.chatPlatformIdentify(name,email); no pre-chat form (D51)
attachments     file → POST /upload (widget) or storage.upload (dashboard)
                message carries attachment_url/name/size/type; images render inline
CSAT            latest closed → centered 👍/👎 (optimistic: thanks in the same tick)
                → state {action:"csat"}; profile sheet reads the same column
loader          artwork only — no blue disc behind the pulsing PNG (D33)
poll            2s while the panel is open, 15s when closed; hidden tabs stop polling,
                visible tabs refresh immediately; one abortable request runs at a time;
                delivery is deduped and polls send an `after` cursor (D35/D37/D42)
sends           site cached 1s; trigger maintains last_message/updated_at/unread;
                replay-safe ids; state actions target the on-screen conversation (D37)
inbox load      conversation rows only; transcripts load on selection (D37)
```

**Open latency.** The GET returns `{messages, meta}` and the embed caches that meta, so a
reload costs one round trip. The widget does not prefetch conversation history or past
chats on mount. It loads only after the visitor opens the panel or requests history,
which removes idle network work (D42). Closing a chat in the inbox reaches the widget on
the next 2-second open-panel poll, with an immediate refresh when the document becomes
visible. Dashboard conversation UPDATEs are applied from the realtime payload locally —
no refetch (D35/D42).

**Ended vs past.** `meta.latestConversationId` distinguishes the live thread from a
history transcript: the centered end screen only shows for the latest closed chat, and
polling meta is ignored while reading a past transcript so it cannot overwrite it
(D34).

Edge rules: history open clears the previous transcript; a closed transcript is
read-only (CSAT + new chat, no composer); a visitor message after a closed chat creates
a new conversation automatically; an attachment-only message is valid (bubble hidden);
10MB cap both sides; identity is copied into new conversations; local demo hides
history/attach when the transport lacks them.


### State machine

```
idle ──open/reload──► loading ──ok──► ready
                        │              │
                        └───fail──► error ──"Try again"──► loading

ready  → list visible, composer enabled
error  → "Couldn’t load your conversation." + Try again
```

Only state changes call `render()`, which rebuilds the message list, toggles
loading/error/list visibility and disables the composer outside `ready`. Same-author runs are
grouped (4px apart) with a single timestamp on the last bubble of the run; support runs show
the artwork, top-aligned, on their **first** bubble with a 22px spacer after it, so every
support bubble lines up with the greeting.

Opening is gated on the load: `open()` while `idle`/`loading` only records the intent and
starts the load — the panel stays closed and the launcher's artwork pulses. When the load
settles, `reveal()` opens the panel (a failure opens it too, so Try again is reachable).
`close()` clears that intent, so a pending open never pops up later.

### Message flows

```
visitor submits
  ├─ optimistic entry with uid(), delivery "sending" → render
  ├─ transport.send({ id, body }, signal)
  │    ├─ accepted → replace the local entry with the server message ("sent" + time)
  │    └─ rejected → "failed" → inline "Not sent. Retry" re-runs transmit
  └─ input cleared and refocused

agent replies outside the widget
  └─ transport.subscribe(receive) → insert "sent", sort by createdAt,
      announce in the live region (even while the panel is closed)
      └─ panel closed? → unread badge (top-right of the launcher) + a preview card
         (authorName + 2 lines). Up to 3 cards, oldest dropped when a 4th arrives,
         each with its own × and a 6s auto-dismiss; opening the panel clears the stack

open without history
  └─ transport.load(signal) → merge by id (history wins), keep local-only, sort by createdAt

reload() fails with an existing conversation
  └─ keeps the messages on screen instead of swapping them for the error state
```

### Transport contract

```ts
type WidgetTransport = {
  load: (signal: AbortSignal) => Promise<WidgetMessage[]>;
  send: (message: { id: string; body: string }, signal: AbortSignal) => Promise<WidgetMessage>;
  subscribe?: (receive: (message: WidgetMessage) => void) => () => void;
};
```

The widget owns presentation, optimistic delivery, retries and merge; the host owns
persistence, auth and realtime. The preview implements it with an in-memory array plus a
fake 1.8s delay for the loading state (the "Preview loading" button).

### Build pipeline

```
src/widget/*.ts ── tsc -p tsconfig.widget.json ──► public/widget/
   widget.ts                                        widget.js (+ widget.d.ts)
   styles.ts                                        styles.js
   types.ts                                         types.js
```

`pnpm build` runs `build:widget` before `next build`. The output is ES modules
(`widget.js` imports `./styles.js`) plus the classic `embed.js` bootstrap.

### Embedding

**One line, from anywhere:**

```html
<script src="https://YOUR-HOST/widget/embed.js" async
        data-site="site_demo_001" data-api="https://YOUR-HOST/api/widget"
        data-color="#2563eb"></script>
```

| Attribute | Effect |
| --- | --- |
| `data-site` | install key from the dashboard; picks the site's stream. Missing → tab-local demo with a console warning (never fails) |
| `data-api` | backend base URL, defaults to `/api/widget` on the script's own origin; only set it for split hosting |
| `data-color` | accent for launcher, header, send button and visitor bubbles |
| `data-asset` | artwork URL (defaults to `textbox-160.png` next to the script) |
| `data-title` / `data-subtitle` | panel copy |
| `data-name` / `data-email` | optional visitor identity; names the dashboard row (D51) |

Widget endpoints (D32): `GET /messages` returns `{messages, meta}`; `POST /messages`
sends (identity + attachment); `POST /state` covers `read · typing · csat · new ·
identify`; `GET /conversations` lists past chats; `POST /upload` stores attachments.
Host apps can call `window.chatPlatformIdentify(name, email)` before sending.

`embed.js` is a classic script: it reads `document.currentScript.src`, imports `widget.js`
from the same directory and mounts it. With `data-site` it uses the live transport
(`GET /api/widget/messages?site=&visitor=`, `POST /api/widget/messages { site, visitor, id, body, context }`,
plus a dynamic polling `subscribe` (2s open / 15s closed, hidden tabs paused, deduped by
id) — no
supabase-js ships in the embed,
by design, D27); without it, messages persist in `sessionStorage` for the tab.

The visitor id lives in `localStorage["chat-platform:visitor-id"]` (stable across tabs
and reloads), so one browser always resumes one open conversation per site. Message
ids are client-generated and upserted server-side, so a retried send never duplicates.

**Module pre-warm (D29).** `embed.js` fires a fire-and-forget `import(widget.js)` on
window load, warming the HTTP cache while the visitor reads — so the header SVG and
its paint are ready before the first open instead of racing it. Measured: `embed.js`
itself ~4ms; the first conversation GET (~450ms) dominates, not the module.

**Artwork loading (D42).** The snippet no longer adds a parse-time preload hint or a
second image preload at mount. The launcher requests its artwork through the normal
widget render path and retains the existing artwork fallback behavior. This avoids
duplicate eager work before a visitor asks to chat.

**Visitor context (D28).** The embed sniffs browser/OS/device/timezone/page once per
page view and sends it as `context` with every POST. The API stores it on the
conversation (refresh on contact, fill blanks only), appends a journey step
(`{ id, label, path, at }`, capped at 20), and derives country + flag emoji from the
`x-vercel-ip-country` header — blank elsewhere, never a paid lookup (D23). The
dashboard maps the columns into the existing `Visitor` type; the sheet hides every
blank row, so pre-D28 conversations degrade to name + first-seen instead of empty lines.

**Install snippet generator.** `/dashboard/widget` leads with a snippet builder (site
key + accent colour + copy button) that fills in the real origin — paste the result
into any page. The live preview stays below it (preview = in-memory transport, real
page = the snippet).

**Or mount it yourself** (ES module):

```js
import { mountChatWidget } from "https://YOUR-HOST/widget/widget.js";
mountChatWidget({ assetUrl: ".../textbox-160.png", transport, accent: "#2563eb" });
```

**Pinning.** The host is a `popover="manual"` element in the top layer, so the widget stays
viewport-fixed even when the host page puts a transform/filter on an ancestor (which breaks
plain `position: fixed`). It is a 0×0 box with visible overflow, so it never blocks page clicks.

### Embed notes

- `/widget/*` is served with `Access-Control-Allow-Origin: *` (next.config.ts), because ES
  modules must be CORS-readable to load from another origin. Verified from a separate site.
- Artwork: 160px transparent PNG (23 KB). The 1254px original lives in
  `assets/textbox-full.png`, outside `public/`, so it is never served.
- `uid()` falls back when `crypto.randomUUID` is missing (http:// hosts).
- Strict-CSP hosts pass `styleNonce`.
- Sound: one Cuelume cue (`ready` in the `press` theme) when a reply notification arrives,
  delivered through the `onNotify` option. The one-liner lazily imports `cuelume/` (copied
  next to the widget by `build:widget`); the preview imports it from npm. Nothing else in the
  app plays sounds.
- Not built yet: delivery receipts, presence and typing indicators.

## 8. Responsive behaviour

| Breakpoint | What changes |
| --- | --- |
| 768px ≤ width | conversation list and thread sit side by side |
| < 768px (`md`) | one pane at a time: list → detail, back button returns |
| Shell container < 672px | sidebar becomes the shell's drawer with its own focus trap |

The visitor profile is a sheet over the panes at every width (D19), so opening it never
steals width from the thread.

The profile sheet is scoped to the inbox panes (it is positioned inside `InboxView`), so the
sidebar, header and tabs stay usable while it is open.

One gutter rule holds at every width: 16px is the left edge for the header title, tabs,
toolbar, list rows, thread, panels and page content — and 16px inside the sidebar for the
brand, nav icons and footer. Readable columns (thread messages, canned preview) are capped
and left-aligned, never centred. Chrome is one row wherever a page has tabs: the filters and
actions sit at the far right of the tab row (D15).

---

## 9. Where the missing pieces attach (live core, planned edges)

```
┌──────────────┐      ┌───────────────────────┐      ┌──────────────────┐
│ visitor widget│      │  Supabase + Next API  │      │ agent dashboard  │
│ Shadow DOM    │      │                       │      │ (this app)       │
│ one <script>  │      │  Postgres             │      │                  │
│ data-site key │      │   ├ sites             │      │                  │
│      │        │      │   ├ conversations     │      │                  │
│      │  (1)   │      │   └ messages          │◄─────│ (3)              │
│      └───────►│──────│  Next routes          │      │                  │
│               │      │   └ /api/widget/      │      │                  │
│      (4)      │      │     messages          │      │                  │
│      ◄────────│──────│  Realtime             │─────►│                  │
│               │      │   └ Postgres Changes  │      │                  │
└──────────────┘      └───────────────────────┘      └──────────────────┘
```

The loop above is live (D27); the preview still runs its in-memory fake beside it.

1. The widget POSTs `{ site, visitor, id, body }` to `/api/widget/messages`. The route
   validates the site key, upserts the open conversation and the message (client id =
   dedup key), and bumps `last_message`/`updated_at`. Rate limiting and CORS allowlist
   still belong here.
2. The same messages table feeds the dashboard; the agent notification email (Resend)
   still belongs here for when nobody is online.
3. Agents read via `fetchConversations(siteKey)` and subscribe to Postgres Changes under
   the demo RLS — the inbox list, thread and unread counters update from those events.
4. The visitor picks up agent replies on the widget's dynamic poll (2s open / 15s
   closed, paused while hidden and deduped by id; no supabase-js ships in the embed,
   by design). Broadcast
   per conversation would replace the polling when the embed grows a bundler.

| Concern | Today | Next |
| --- | --- | --- |
| Data | Supabase Postgres via `src/lib/conversations.ts`; seed data is the offline fallback; visitor context + read timestamps + CSAT on conversations (D28, D32) | per-site switcher in the inbox (query shape ready), tighten RLS with auth |
| Canned responses | `src/lib/canned-store.ts` (localStorage) | `canned_responses` table + realtime |
| Realtime | Postgres Changes dashboard-side (messages, conversations, typing); widget polls 2s open / 15s closed, pauses while hidden, and deduplicates delivery | Broadcast for the visitor leg, presence channel for `/dashboard/visitors` |
| Presence | `sites.agent_online_at` heartbeat + working hours; exact-thread `conversation_viewers` heartbeat (D37) | presence channel feeding `/dashboard/visitors` |
| Profiles | localStorage agent profile → `agents`; `messages.agent_name` snapshot shown in both surfaces (D37) | Supabase Auth identity, shared team profiles |
| Typing indicators | `typing` table, throttled timestamps, realtime (D32) | broadcast-only events if the table grows hot |
| Attachments | public `chat-attachments` bucket, 10MB cap, inline images (D32) | R2 + signed URLs when auth lands |
| Auth | none (fake "You") | Supabase Auth (magic link / Google) for agents; tighten RLS then |
| Email | none | Resend: offline messages, transcripts, notifications |
| Metrics | none | SQL views over the same tables; RSC fetches, no ETL |

---

## 10. File map

```
src/
├─ app/
│  ├─ layout.tsx                    dark class on <html>, fonts, metadata
│  ├─ globals.css                   dark-only tokens + @theme mapping (D6)
│  ├─ page.tsx                      / → /dashboard
│  ├─ api/
│  │  └─ widget/
│  │     ├─ messages/route.ts       GET messages+meta, POST send (+identity, attachments) (D27, D32)
│  │     ├─ state/route.ts          read · typing · csat · new · identify (D32)
│  │     ├─ conversations/route.ts  past-chat summaries (D32)
│  │     └─ upload/route.ts         attachment → storage bucket (D32)
│  └─ dashboard/
│     ├─ page.tsx                   inbox route: chrome state (tab, sort, tag)
│     ├─ visitors/page.tsx          honest presence empty state (D37)
│     ├─ widget/page.tsx            snippet generator + live preview (D27)
│     ├─ analytics/page.tsx         stub
│     ├─ canned-responses/page.tsx  list + editor for canned responses
│     └─ settings/page.tsx          agent profile + visitor copy (D43)
├─ components/
│  ├─ app-shell.tsx                 shared chrome around every route (D8)
│  ├─ coming-soon.tsx               shared empty state
│  ├─ canned/
│  │  ├─ response-list.tsx          shortcuts list
│  │  └─ response-editor.tsx        create / edit / delete + live preview
│  ├─ block/
│  │  ├─ dashboard-shell.tsx/.css   ObsidianUI shell (+ padding pass, D14)
│  └─ inbox/
│     ├─ inbox-view.tsx             state + list/thread panes + profile sheet
│     ├─ conversation-list.tsx      list pane
│     ├─ conversation-thread.tsx    thread + composer + close-confirm
│     ├─ visitor-sheet.tsx          profile sheet over the panes (D19)
│     ├─ visitor-avatar.tsx         initials avatar on a hashed gradient
│     └─ typing-dots.tsx            three-dot typing animation
├─ widget/                          the embeddable widget (D24–D32)
│  ├─ widget.ts                     mount · state machine · transport wiring · ticks · history · CSAT · attach
│  ├─ embed.ts                      one-line bootstrap (data-* options, context, transport capabilities)
│  ├─ styles.ts                     shadow-DOM stylesheet (header, history, csat, attachments, typing)
│  ├─ version.ts                    widget version for the storage reset / module cache bust
│  └─ types.ts                      WidgetOptions · Handle · Transport · Meta · Attachment
└─ lib/
   ├─ mock-data.ts                  types + seed data, offline fallback (D7)
   ├─ supabase.ts                   dashboard client, null without env (D27)
   ├─ widget-admin.ts               service client + 1s site cache for widget routes (D43)
   ├─ widget-copy.ts                default welcome + suggested-question normalization (D43)
   ├─ conversations.ts              fetch/send/subscribe, receipts, typing, viewers, unread (D27–D37)
   ├─ agent-profile.ts              localStorage profile + agents sync (D37)
   ├─ message-state.ts              merge/dedup + failed-send helpers (audit)
   ├─ widget-requests.ts            Zod schemas for widget POSTs (audit)
   ├─ canned-store.ts               in-session canned responses (D13)
   └─ utils.ts                      cn()
```

```
public/widget/                      built ES modules + 160px artwork (served)
supabase/schema.sql                 tables + typing + attachment bucket + demo RLS + realtime (D27, D32)
assets/textbox-full.png             full-resolution source art (never served)
```

---

## 11. D42 profile, draft, notification, and polling flow

```
agent profile store
  server fallback ──hydration──► localStorage profile ──► AppShell account control
                                      │                         │
                                      ├──► Settings field overlay │
                                      └──► agents upsert ─────────┼──► widget API onlineAgents
                                                                    │
notification row ──► /dashboard?conversation=<id> ──► InboxView selects thread

composer text ──► replyDrafts[conversation.id] ──► restore on thread switch

widget poll scheduler
  visible + open   ──► request every 2s
  visible + closed ──► request every 15s
  hidden           ──► cancel schedule; no request
  visible again    ──► immediate refresh
```

Settings renders the live profile until the user changes a field. A changed field becomes
an overlay value, so asynchronous profile hydration or a cross-tab update cannot erase
the agent's in-progress edit. On Save, the profile store writes localStorage, notifies the
dashboard, and upserts the `agents` row when Supabase is configured.

The widget GET response sends `{ id, name, avatar? }` for online agents. The header uses
that agent only when no typing agent, exact-thread viewer, or past reply supplies a more
specific identity. This gives a newly opened conversation an agent photo without changing
message history.

The widget subscription has one in-flight `fetchState` request. It uses an
`AbortController` for cleanup and ignores hidden documents. Its render path preserves the
message list when neither messages nor transcript-dependent state changed, so presence
updates do not recreate message nodes or image elements.

The dashboard list still loads row data first. When an agent opens a thread,
`fetchConversationById` requests the conversation row and its messages concurrently. The
app-shell notification query caches the site id for its lifetime, waits 250ms for grouped
realtime updates, and ignores row updates that do not affect unread count or preview text.

---

## 12. D43 visitor copy and new-conversation flow

```
Settings Save
  ├─ agent profile ──► local profile store ──► agents upsert (awaited)
  └─ welcome + suggested questions ──► sites update (awaited)
                                       │
                                       ▼
widget GET metadata ◄── one-second site cache ◄── sites row
  ├─ awayMessage ──► header presence line only
  ├─ welcomeMessage ──► empty live conversation greeting
  └─ presetMessages ──► empty live conversation chips ──► persisted question + answer

Your conversations ──► Start new ──► POST /state { action: "new" }
  ├─ failure / timeout ──► restore previous view, announce error
  └─ conversationId ──► render blank live chat immediately
                           └─ set active id + reset cursor ──► poll new thread
```

Settings preserves in-progress edits while site copy loads and awaits both persistence
operations before showing success. The widget keeps the header and transcript DOM intact
when a poll changes no visible content. Switching conversations increments a transport
version; a response started under an older version cannot update the current transcript,
metadata, or notification stream. The new conversation uses its server id immediately,
without a second blocking reload. The POST times out after ten seconds so the prior
view can be restored instead of hanging indefinitely.

---

## 13. D44 paired preset reply flow

```
Settings question + answer ──► sites.preset_messages JSON pair
                                  │
empty live widget ◄── GET metadata ┘
  │ tap question
  ▼
POST /api/widget/messages { presetQuestion, id, body }
  ├─ validate against current site preset
  ├─ insert visitor question + automated answer in one statement
  └─ return both messages
       ├─ visitor question ──► right-hand accent bubble
       └─ widget answer ──► left-hand neutral bubble + artwork icon (D45)

automated answer ──► transcript/history
                 └─► keep inbox unread count and last human agent
```

The widget uses the same id on retry and keeps a failed question visible. A duplicate
request returns the saved pair. Legacy question-only entries stay in Settings for the
team to complete, but the widget does not offer them as answered suggestions. Questions
are unique after case folding, so one visible question cannot map to two answers.

---

## 14. D46 dynamic tag registry

```
Settings page
  └─ New tag input ──► createTag ──► POST insert tags
                                       ├─ 23505 ──► read canonical row
                                       └─ ok ──► refresh useTags
                                                      │
dashboard useTags("site_demo_001") ◄──────────────────┘
  ├─ select tags { name } where site_id = …
  └─ subscribe postgres_changes(tags) ──► refetch
         │
         ├─► InboxPage Tag filter: [All tags, …registry]
         └─► InboxView ──► VisitorSheet "+ Add tag"
                               └─ existing unassigned tag ──► onAddTag(name)

conversation.tags = union(current, name) ──► optimistic patch ──► conversations UPDATE
        │                                                               │
        └─► list chips + profile sheet                                   └─► Realtime UPDATE
                                                                              (other tabs)
```

`tags` is the only tag list in the dashboard: `src/lib/mock-data.ts` no longer exports
`tagOptions`, and `src/app/dashboard/page.tsx` no longer hardcodes filter entries. The
table is unique on `(site_id, lower(name))`, so case-only duplicates resolve to one row.
Creation lives in `/dashboard/settings`: the New tag input calls `createTag`, which
trims/collapses whitespace, caps at 40 code points, and treats a unique violation as "use
the existing spelling"; Settings then refreshes `useTags` and reports added/already
exists. The migration backfills names already attached to conversations so those
historical assignments remain filterable; it seeds no product defaults.

The profile sheet only assigns existing tags. It hides tags already on the conversation
(case-insensitively), shows a "Manage tags in Settings" link when the registry is empty
or everything is already attached, and never creates a tag implicitly. Assigning a tag
stays optimistic: the chip paints immediately, then rolls back if the conversation update
fails. The registry row is never rolled back, because a tag can legitimately exist
without being attached to this thread.

---

## 15. D47 visitor topic prompt, D48 preset chips/topic card, D49 header identity

```
visitor sends a normal message
  └─ POST /api/widget/messages
       ├─ insert visitor message
       └─ site has tags && conversation.tags = {} && not a preset send
            └─ upsert messages.id = "topic-ask-<conversation>"
                 author=agent, agent_name=Widget, is_automated=true
                 body="What best describes your problem?"
                    │
                    └─ touch_conversation(): ask/ack keep last_message /
                       updated_at on the visitor's own message, unread untouched

widget GET /messages
  └─ meta { topicOptions: site tags, conversationTags: conversation.tags }
       + transcript includes the topic-ask message
            │
            ▼
     neutral prompt card + dropdown renders only on the live latest chat,
     after the ask, when conversationTags is empty, tags exist,
     and transport.selectTopic exists
            │ choose "Billing"
            ▼
POST /api/widget/state { action: "tag", value: "Billing" }
  ├─ verify tags.name belongs to this site (409 if it disappeared)
  ├─ append to conversations.tags when absent (duplicate = no-op)
  ├─ upsert topic-ask-ack-<conversation>
  │    "Thanks — we'll get back to you as soon as possible."
  └─ ok ──► optimistic tag + local ack replace the card in the same frame
                 │                              │
                 │                              └─ poll reconciles the ack by id
                 └─ failed ──► remove the optimistic tag/ack, restore the card

dashboard Realtime UPDATE(conversations) ──► row chip + profile sheet update

widget header identity
  ├─ agent typing in this thread ──► "<name> is typing…" + avatar + green dot
  ├─ agent viewing this thread    ──► "<name> is here" + avatar + green dot
  └─ nobody ──► brand textbox artwork + "Support is online/offline" + green/grey dot
                (online when at least one agent heartbeat is fresh)
```

The ask is persisted, not a local-only bubble, so it survives reloads and agents see the
same question in the transcript. The widget hides that bubble and renders a neutral card
in its transcript position — question, helper line, and a dashboard-style dropdown
(bordered trigger, chevron, floating option list) — so it has no timestamp and no amber
tint. The dashboard keeps the persisted ask row but hides its timestamp/ticks. Its stable
id and `ON CONFLICT DO NOTHING` upsert make repeat messages, retries, and two concurrent
first sends produce exactly one prompt. The prompt is skipped when there are no tags, when
the thread is already tagged (by the visitor or an agent), and for preset sends — a preset
answer already resolves a known question. A closed conversation's next message creates a
new row, so it gets its own ask.

After a successful selection the same state call upserts one automated
`topic-ask-ack-<conversation>`: "Thanks — we'll get back to you as soon as possible." The
widget also inserts that message locally in the same frame, so the card is replaced by the
thanks bubble immediately instead of leaving a blank gap; `pollNow()` then reconciles the
local copy with the saved row by id. A failed request removes the optimistic tag and
confirmation and restores the card. Both the question and the confirmation share the
`topic-ask-` namespace, so the trigger keeps them out of the inbox preview: the visitor's
own message stays the last_message/updated_at and the unread count is untouched. No second
trigger migration is needed.

The prompt card is hidden in history, past transcripts, and the ended/CSAT view. Starting
a new conversation resets the optimistic `conversationTags` so the previous thread's tag
cannot suppress the next prompt. If the widget is running on the local (no `data-site`)
transport, there is no `selectTopic`, so no dropdown is offered.

The prompt card is deliberately neutral: `var(--control)` surface, `var(--strong)` border,
normal text, no tint, no timestamp, no presence decoration. The dropdown mirrors the
inbox Tag filter menu — bordered trigger, label, chevron, and a floating option list with
hover states. It is ported into the panel and positioned with fixed viewport coordinates,
so it paints above the composer and is clamped inside the panel instead of being clipped
by the transcript's scroll area. It always opens above the trigger, with its max-height
capped to the room above; it closes on outside click, scroll, resize, or Escape. Dashboard
tag chips keep the amber accent (`#f59e0b` tint, `text-amber-300`) in inbox rows, the
profile sheet, and Settings. Preset question chips keep the neutral control colour and
blue hover.

Preset questions use the `.presets` container: `justify-content: flex-end` puts them on
the right, and in maximized mode the container is capped to the 720px message/composer
column. The topic prompt is a separate full-width card inside the transcript, not a chip
row.

The header identity is live-only (D49): it uses a typing agent or a `conversation_viewers`
row for this exact thread. There is no fallback to the last replying agent or any online
agent's identity. When nobody is there, the header shows the brand textbox artwork and
"Support is online" when at least one agent heartbeat is fresh, otherwise "Support is
offline", with a green or grey dot. The away message no longer fills the header.
Message-bubble dots and the ended-screen avatar still use the last agent as before.

---

## 16. D50 welcome notification toggle

```
Settings
  └─ "Welcome notification" switch ──► sites.welcome_notify
                                          (saved with welcome + presets)

widget mount (panel closed)
  └─ transport.initialMeta ──► GET /messages?site=…&visitor=…&meta=1
       └─ meta { welcomeNotify, welcomeMessage }
            ├─ off / blank / panel already open or opening / destroyed ──► nothing
            └─ on + panel closed
                 └─ pushWelcomeNotice()
                      ├─ one notice card above the launcher:
                      │    "Support" + "You have an unread notification."
                      │    (never the welcome copy)
                      ├─ options.onNotify() ──► same Cuelume sound as unread replies
                      ├─ no unread count change / no launcher badge
                      ├─ auto-dismiss after 6s; click opens the panel
                      └─ once per visitor (localStorage welcome key)
```

The switch has only its name and the control — no helper copy. It is saved through the
existing Save settings button together with the welcome message and presets. The
meta-only GET returns the site welcome copy and the toggle without loading messages, so
the closed widget does not pay for the transcript it is trying to avoid. The local demo
transport has no `initialMeta`, so the notification is a real-backend behavior.

The notice uses the existing notice stack/CSS and sound path but shows the generic
"You have an unread notification." line instead of the welcome text. The
`chat-platform:welcome-notified:<site>` localStorage key makes it once per visitor, not
once per page load. Opening the widget marks that key as seen when the setting is on, so
a delayed meta response cannot fire an alert after the visitor has already seen the
welcome bubble. The unread badge is untouched, and opening the panel clears the notice
like any other.

For a clean remount, a widget version bump clears the visitor id, identity, welcome-seen
keys, and tab-local demo messages once; the generated snippet and the embed's dynamic
`widget.js` import both carry the version. The migration is:

```sql
alter table sites
  add column if not exists welcome_notify boolean not null default false;
```

---

## 17. D51 no mandatory visitor identity

```
widget opens
  └─ composer + preset questions + topic prompt are available immediately
       (no name/email gate, no identity form in the DOM)

optional host identity
  ├─ data-name / data-email on the script
  ├─ window.chatPlatformIdentify(name, email)
  └─ saved in localStorage; every POST /messages carries it
       └─ dashboard conversation.visitor_name / visitor_email

no identity supplied
  └─ dashboard maps "Visitor <id>"; the first message is the context
```

The pre-chat form and its `identityNeeded()` gate are gone, so the visitor can send the
first message without typing a name or email. The transport `identify` action and the
`data-name`/`data-email` attributes remain for host compatibility; they now feed the
optional identity payload rather than a visible form. Existing conversations keep the
names already stored. The topic prompt and preset questions no longer check `identified`.

---

## 18. D52 email bar, first-chat CTA, compact panel, maximized status, sound

```
widget ready, live chat
  ├─ emails: meta.visitorEmail empty && not dismissed/saved
  │    └─ after first successful manual visitor message: compact indigo notification
  │         └─ click ──► centered bottom email card: [Email] [Set my email] [Skip]
  │              └─ submit ──► transport.identifyEmail(email)
  │              ├─ local identity keeps the existing name
  │              └─ POST state {action:"identify", email}
  │                   └─ API patches visitor_email only; name preserved
  ├─ messages.length = 0 ──► centered "Start chat" button ──► composer.focus()
  ├─ compact panel: 300px wide × up to 480px tall (mobile 520)
  └─ maximized header: centered title + status line underneath
       (brand icon + Support online/offline, or viewing/typing agent)

notification sound
  ├─ already had a user gesture ──► play now
  └─ audio context suspended ──► first pointerdown/keydown plays one pending sound
```

The email pill is optional and never blocks the composer. It stays hidden until a manual
visitor message has been accepted; preset questions do not count. It opens its card only
after the visitor clicks it. In maximized mode the pill and card match the 720px composer
width. Skip collapses the card back to the pill. Only a valid email submission or a meta
response containing `visitorEmail` dismisses it.
`identifyEmail` writes the existing local name plus the new email, and the API's identify
action only patches the fields present, so an email-only save cannot erase a host name.
The first-chat button is a focus CTA, not an empty conversation creator. The maximized
header no longer hides the status subtitle; it sits below the centered title. The sound
uses an AudioContext probe and `navigator.userActivation`, with one coalesced pending
play for the first gesture.

---

## 19. D56 deployed cross-site embed

```text
customer page
  └─ HTTPS script from support-widget-six.vercel.app, with data-site
       ├─ no site key → report the setup error; do not mount
       └─ valid site key → wait for document.body if needed
            └─ import versioned widget.js → mount one Shadow DOM widget
                 ├─ stylesheet uses the script nonce or data-style-nonce
                 ├─ artwork and modules resolve from the script host
                 └─ HTTP transport defaults to that host's /api/widget
                      ├─ GET messages and metadata across origins
                      └─ POST messages and state after browser preflight
```

The dashboard copies a snippet for the deployed HTTPS host. A build-time
`NEXT_PUBLIC_WIDGET_ORIGIN` can replace that host. `data-api` remains available only
when the API lives on a different host. The latest loaded snippet replaces an older
pending or mounted widget.

The host's `data-name` and `data-email` override an older stored visitor identity;
explicit empty values clear it after sign-out. A changed, previously nonempty identity
rotates the visitor ID so another user of the browser cannot reopen that conversation;
an unchanged identity keeps it. Omitted host fields preserve chat-collected identity
on reload, but clear when an explicit host field changes to another account.
`window.chatPlatformIdentify(name, email)` updates it later. Each manual or preset
message includes the page path at send time, so client-side navigation is reflected in
the dashboard. The host must permit the widget host in its script and connection CSP
rules; a stylesheet nonce is needed when inline styles are restricted.




