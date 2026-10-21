/* Demo data used when the inbox has no configured backend. */

export type ConversationStatus = "open" | "pending" | "closed";
export function conversationStatus(value: unknown, fallback: ConversationStatus = "open"): ConversationStatus {
  return value === "open" || value === "pending" || value === "closed" ? value : fallback;
}
export type MessageAuthor = "visitor" | "agent" | "system";

export type JourneyStep = { id: string; label: string; path: string; at: string };

export type Visitor = {
  id: string;
  name: string;
  email: string;
  /** Country only — city-level location needs a paid geolocation lookup. */
  country: string;
  /** Country flag emoji, shown as a badge on the avatar. */
  flag: string;
  browser: string;
  os: string;
  device: "desktop" | "laptop" | "phone" | "tablet";
  timezone: string;
  firstSeen: string;
  sessionCount: number;
  currentPage: string;
  journey: JourneyStep[];
};

export type Message = {
  id: string;
  author: MessageAuthor;
  name?: string;
  body: string;
  at: string;
  /** ISO timestamp; used for read-receipt/unread comparisons (D35). */
  createdAt?: string;
  day: "Today" | "Yesterday";
  read?: boolean;
  delivery?: "sending" | "sent" | "failed";
  attachment?: { name: string; size: string; kind: "image" | "file"; url?: string };
};

export type Conversation = {
  id: string;
  visitor: Visitor;
  status: ConversationStatus;
  assignee: string | null;
  tags: string[];
  unread: number;
  /** Minutes since the last message. Drives sorting and the "now" label after sending. */
  updatedMinutes: number;
  updatedLabel: string;
  typing?: boolean;
  csat?: "good" | "bad";
  lastMessage: string;
  messages: Message[];
  /** False when only the list row was fetched; the thread loads on select (D37). */
  historyLoaded?: boolean;
};

export const currentAgent = "You";

export const conversations: Conversation[] = [
  {
    id: "c-4821",
    visitor: {
      id: "v-maya",
      name: "Maya Chen",
      email: "maya@luminastudio.co",
      country: "Netherlands",
      flag: "🇳🇱",
      browser: "Chrome 141",
      os: "macOS 16",
      device: "laptop",
      timezone: "CET · 11:48",
      firstSeen: "Aug 2, 2026",
      sessionCount: 6,
      currentPage: "/settings/billing",
      journey: [
        { id: "j1", label: "Visited Pricing", path: "/pricing", at: "2d ago" },
        { id: "j2", label: "Started Pro trial", path: "/signup", at: "2d ago" },
        { id: "j3", label: "Opened Billing", path: "/settings/billing", at: "Yesterday" },
        { id: "j4", label: "Viewed invoice #4829", path: "/invoices/4829", at: "10:38" },
      ],
    },
    status: "open",
    assignee: "You",
    tags: ["Billing"],
    unread: 2,
    updatedMinutes: 1,
    updatedLabel: "1m",
    typing: true,
    lastMessage: "Any update on the double charge?",
    messages: [
      {
        id: "m1",
        author: "visitor",
        body: "Hi — I was charged twice for the Pro plan this month. Order #4821 and #4829.",
        at: "10:12",
        day: "Yesterday",
      },
      {
        id: "m2",
        author: "agent",
        name: "You",
        body: "Hi Maya! Thanks for flagging this. Let me pull up both charges and check what happened.",
        at: "10:20",
        day: "Yesterday",
        read: true,
      },
      { id: "m3", author: "visitor", body: "Sure, happy to wait.", at: "10:22", day: "Yesterday" },
      {
        id: "m4",
        author: "visitor",
        body: "Also my invoice PDF still shows the old company address.",
        at: "10:38",
        day: "Today",
      },
      { id: "m5", author: "visitor", body: "Any update on the double charge?", at: "10:41", day: "Today" },
    ],
  },
  {
    id: "c-4816",
    visitor: {
      id: "v-jonas",
      name: "Jonas Weber",
      email: "jonas@weber.dev",
      country: "Germany",
      flag: "🇩🇪",
      browser: "Safari 18",
      os: "macOS 16",
      device: "laptop",
      timezone: "CET · 11:48",
      firstSeen: "Sep 14, 2026",
      sessionCount: 12,
      currentPage: "/docs/embed",
      journey: [
        { id: "j1", label: "Visited Docs", path: "/docs/embed", at: "09:01" },
        { id: "j2", label: "Opened Embed guide", path: "/docs/embed/script", at: "09:02" },
      ],
    },
    status: "open",
    assignee: "You",
    tags: ["Bug"],
    unread: 0,
    updatedMinutes: 18,
    updatedLabel: "18m",
    lastMessage: "script-src 'self' cdn.example.com — I can send the full header.",
    messages: [
      {
        id: "m1",
        author: "visitor",
        body: "The widget doesn’t load on Safari 18 — the console shows a CSP error.",
        at: "09:02",
        day: "Today",
      },
      { id: "m2", author: "visitor", body: "It works in Chrome, so it’s probably the inline script policy.", at: "09:03", day: "Today" },
      {
        id: "m3",
        author: "agent",
        name: "You",
        body: "Thanks Jonas — that’s a useful clue. Which CSP directives do you have configured?",
        at: "09:10",
        day: "Today",
        read: true,
      },
      { id: "m4", author: "visitor", body: "script-src 'self' cdn.example.com — I can send the full header.", at: "09:14", day: "Today" },
    ],
  },
  {
    id: "c-4812",
    visitor: {
      id: "v-priya",
      name: "Priya Nair",
      email: "priya@nestwork.io",
      country: "India",
      flag: "🇮🇳",
      browser: "Edge 141",
      os: "Windows 11",
      device: "desktop",
      timezone: "IST · 15:18",
      firstSeen: "Jul 21, 2026",
      sessionCount: 31,
      currentPage: "/integrations",
      journey: [
        { id: "j1", label: "Visited Integrations", path: "/integrations", at: "Yesterday" },
        { id: "j2", label: "Searched “slack”", path: "/search?q=slack", at: "Yesterday" },
        { id: "j3", label: "Returned to Integrations", path: "/integrations", at: "11:00" },
      ],
    },
    status: "pending",
    assignee: "Sarah Kim",
    tags: ["Integration"],
    unread: 1,
    updatedMinutes: 42,
    updatedLabel: "42m",
    lastMessage: "Great. Any rough timeline?",
    messages: [
      {
        id: "m1",
        author: "visitor",
        body: "Do you have a Slack integration? We’d like conversations to post into #support.",
        at: "16:40",
        day: "Yesterday",
      },
      {
        id: "m2",
        author: "agent",
        name: "Sarah Kim",
        body: "We’re working on it — I’ve added you to the early access list.",
        at: "16:55",
        day: "Yesterday",
        read: true,
      },
      { id: "m3", author: "visitor", body: "Great. Any rough timeline?", at: "11:02", day: "Today" },
    ],
  },
  {
    id: "c-4788",
    visitor: {
      id: "v-tom",
      name: "Tom Okafor",
      email: "tom@okafor.design",
      country: "Nigeria",
      flag: "🇳🇬",
      browser: "Firefox 145",
      os: "Ubuntu 26.04",
      device: "desktop",
      timezone: "WAT · 10:48",
      firstSeen: "Jun 3, 2026",
      sessionCount: 48,
      currentPage: "/dashboard",
      journey: [
        { id: "j1", label: "Visited Billing", path: "/settings/billing", at: "Yesterday" },
        { id: "j2", label: "Requested refund", path: "/settings/billing/refund", at: "Yesterday" },
      ],
    },
    status: "closed",
    assignee: "You",
    tags: ["Billing"],
    unread: 0,
    updatedMinutes: 1560,
    updatedLabel: "1d",
    csat: "good",
    lastMessage: "Refund received, thanks!",
    messages: [
      { id: "m1", author: "visitor", body: "I need a refund for last month’s charge — we downgraded in time.", at: "08:50", day: "Yesterday" },
      {
        id: "m2",
        author: "agent",
        name: "You",
        body: "Done — a $59 refund is on its way and should land in 3–5 business days.",
        at: "09:12",
        day: "Yesterday",
        read: true,
      },
      { id: "m3", author: "visitor", body: "Refund received, thanks!", at: "09:20", day: "Yesterday" },
      { id: "m4", author: "system", body: "Conversation closed · rating 👍 Good", at: "09:21", day: "Yesterday" },
    ],
  },
  {
    id: "c-4840",
    visitor: {
      id: "v-elena",
      name: "Elena Petrova",
      email: "elena@petrovaatlas.eu",
      country: "Bulgaria",
      flag: "🇧🇬",
      browser: "Chrome 141",
      os: "Windows 11",
      device: "desktop",
      timezone: "EET · 12:48",
      firstSeen: "Today",
      sessionCount: 1,
      currentPage: "/pricing",
      journey: [
        { id: "j1", label: "Landed on homepage", path: "/", at: "13:04" },
        { id: "j2", label: "Visited Pricing", path: "/pricing", at: "13:09" },
        { id: "j3", label: "Compared plans", path: "/pricing#compare", at: "13:11" },
      ],
    },
    status: "open",
    assignee: null,
    tags: ["Feature request"],
    unread: 0,
    updatedMinutes: 96,
    updatedLabel: "1h",
    lastMessage: "Can visitors upload files in the widget?",
    messages: [
      {
        id: "m1",
        author: "visitor",
        body: "Can visitors upload files in the widget? We need screenshots in support.",
        at: "13:12",
        day: "Today",
      },
    ],
  },
  {
    id: "c-4801",
    visitor: {
      id: "v-lucas",
      name: "Lucas Martin",
      email: "lucas@atelierlumen.fr",
      country: "France",
      flag: "🇫🇷",
      browser: "Chrome 141",
      os: "macOS 16",
      device: "laptop",
      timezone: "CET · 11:48",
      firstSeen: "Aug 19, 2026",
      sessionCount: 22,
      currentPage: "/login",
      journey: [
        { id: "j1", label: "Visited Login", path: "/login", at: "11:40" },
        { id: "j2", label: "Visited Login", path: "/login", at: "11:47" },
        { id: "j3", label: "Visited Login", path: "/login", at: "12:01" },
      ],
    },
    status: "open",
    assignee: "You",
    tags: ["Bug"],
    unread: 0,
    updatedMinutes: 320,
    updatedLabel: "5h",
    lastMessage: "Same result in a private window.",
    messages: [
      {
        id: "m1",
        author: "visitor",
        body: "Login redirects me back to the widget every time — I can’t reach the dashboard.",
        at: "11:40",
        day: "Today",
        attachment: { name: "redirect-loop.mp4", size: "4.2 MB", kind: "file" },
      },
      {
        id: "m2",
        author: "agent",
        name: "You",
        body: "I can see the loop in your session log. Could you try a private window so I can compare?",
        at: "11:52",
        day: "Today",
        read: true,
      },
      { id: "m3", author: "visitor", body: "Same result in a private window.", at: "12:04", day: "Today" },
    ],
  },
  {
    id: "c-4795",
    visitor: {
      id: "v-sofia",
      name: "Sofia Rossi",
      email: "sofia@rossiandpartners.it",
      country: "Italy",
      flag: "🇮🇹",
      browser: "Safari 18",
      os: "iOS 19",
      device: "phone",
      timezone: "CET · 11:48",
      firstSeen: "May 30, 2026",
      sessionCount: 17,
      currentPage: "/invoices",
      journey: [
        { id: "j1", label: "Opened Invoices", path: "/invoices", at: "Yesterday" },
        { id: "j2", label: "Downloaded invoice", path: "/invoices/4712.pdf", at: "Yesterday" },
        { id: "j3", label: "Returned to Invoices", path: "/invoices", at: "08:39" },
      ],
    },
    status: "pending",
    assignee: "Sarah Kim",
    tags: ["Billing"],
    unread: 0,
    updatedMinutes: 640,
    updatedLabel: "10h",
    lastMessage: "Sent the VAT details to your email this morning.",
    messages: [
      { id: "m1", author: "visitor", body: "Could you add our VAT number IT-0932 to the invoices?", at: "17:22", day: "Yesterday" },
      {
        id: "m2",
        author: "agent",
        name: "Sarah Kim",
        body: "Sure — send the registered legal name and I’ll update billing.",
        at: "17:40",
        day: "Yesterday",
        read: true,
      },
      { id: "m3", author: "visitor", body: "Sent the VAT details to your email this morning.", at: "08:40", day: "Today" },
    ],
  },
];

export type CannedResponse = {
  id: string;
  /** The composer trigger, including the slash, such as "/refund". */
  shortcut: string;
  title: string;
  body: string;
  usedCount: number;
};

export const cannedResponses: CannedResponse[] = [
  { id: "cr-1", shortcut: "/refund", title: "Refund issued", body: "I’ve issued the refund — it usually lands in 3–5 business days.", usedCount: 128 },
  { id: "cr-2", shortcut: "/snippet", title: "Widget embed snippet", body: "Here’s the embed snippet: <script src=\"https://your-host/widget/embed.js\" async data-site=\"site_demo_001\" data-api=\"https://your-host/api/widget\" data-color=\"#2563eb\"></script>", usedCount: 64 },
  { id: "cr-3", shortcut: "/hours", title: "Support hours", body: "Our support hours are Mon–Fri, 9:00–18:00 CET. I’ll reply first thing tomorrow.", usedCount: 212 },
  { id: "cr-4", shortcut: "/escalate", title: "Escalating to the platform team", body: "Thanks for the detail — I’m escalating this to the platform team and will follow up here.", usedCount: 47 },
  { id: "cr-5", shortcut: "/reset", title: "Password reset link", body: "I’ve sent a reset link to your email. It expires in 30 minutes.", usedCount: 91 },
  { id: "cr-6", shortcut: "/invite", title: "Invite teammates", body: "You can invite teammates under Settings → Team. Each one gets their own seat and inbox.", usedCount: 23 },
  { id: "cr-7", shortcut: "/trial", title: "Extend the trial", body: "I’ve extended your trial by 14 days — nothing to do on your side.", usedCount: 31 },
  { id: "cr-8", shortcut: "/status", title: "Status page link", body: "Live status for the widget API is at status.chatplatform.dev — I’ll post updates there too.", usedCount: 0 },
];
