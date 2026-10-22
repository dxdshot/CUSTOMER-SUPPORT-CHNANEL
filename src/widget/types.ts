export type WidgetAttachment = {
  url: string;
  name: string;
  size: string;
  kind: "image" | "file";
};

/** Panel footprint: lg is the classic 300×480, sm stays comfortably usable. */
export type WidgetSize = "sm" | "md" | "lg";

export type PresetReply = { question: string; answer: string };

export type WidgetMeta = {
  conversationId: string | null;
  /** Latest conversation for this visitor; differs while viewing a past chat. */
  latestConversationId: string | null;
  status: "open" | "closed";
  agentLastReadAt: string | null;
  agentTyping: boolean;
  /** Who is typing; drives the named typing row and header (D39). */
  typingAgent: { id?: string; name: string; avatar?: string } | null;
  /** Agents whose dashboard heartbeat is fresh (D39). */
  onlineAgents: { id: string; name: string; avatar?: string }[];
  online: boolean;
  awayMessage: string;
  welcomeMessage: string;
  /** Show the welcome message as a sound-only notification while closed (D50). */
  welcomeNotify: boolean;
  /** Site-wide launcher size; drives the floating circle everywhere. */
  widgetSize?: WidgetSize;
  presetMessages: PresetReply[];
  /** Site tags offered after the first message (D47). */
  topicOptions: string[];
  /** Tags already attached to this conversation; hides the chooser when set. */
  conversationTags: string[];
  csat: "good" | "bad" | null;
  visitorName: string | null;
  visitorEmail: string | null;
  identified: boolean;
  /** Agents currently viewing this exact conversation (D37/D38). */
  agentsViewing: { id?: string; name: string; avatar?: string }[];
};

export type ConversationSummary = {
  id: string;
  status: string;
  lastMessage: string;
  updatedAt: string;
};

export type WidgetMessage = {
  id: string;
  author: "visitor" | "agent";
  body: string;
  createdAt: string;
  /** Stable agent id; keys the online/offline dot (D39). */
  agentId?: string;
  /** Display name shown in the reply notification, e.g. "Dhimant". */
  authorName?: string;
  /** Agent profile photo; falls back to the artwork when empty (D38). */
  authorAvatar?: string;
  isAutomated?: boolean;
  attachment?: WidgetAttachment;
};

export type WidgetTransport = {
  load: (signal: AbortSignal, conversationId?: string) => Promise<WidgetMessage[]>;
  send: (
    message: { id: string; body: string; attachment?: WidgetAttachment },
    signal: AbortSignal,
  ) => Promise<WidgetMessage>;
  sendPreset?: (question: string, id: string, signal: AbortSignal) => Promise<[WidgetMessage, WidgetMessage]>;
  /** Attach a site tag after the visitor answers the topic prompt (D47). */
  selectTopic?: (tag: string) => Promise<void>;
  /** Poll/live hook. `onMeta` carries read receipts, typing, presence, CSAT. */
  subscribe?: (receive: (message: WidgetMessage) => void, onMeta: (meta: WidgetMeta) => void) => () => void;
  /** One-shot state fetch for reloads and history transcripts (D31). */
  meta?: (signal: AbortSignal, conversationId?: string) => Promise<WidgetMeta>;
  /** Lightweight meta-only fetch at mount, before the panel opens (D50). */
  initialMeta?: (signal: AbortSignal) => Promise<WidgetMeta>;
  /** Fetch state immediately instead of waiting for the next poll (D34). */
  pollNow?: () => void;
  /** The panel opened/closed — the transport may poll faster while open (D35). */
  setOpen?: (open: boolean) => void;
  /** Pin polling/read/typing to the conversation on screen (D37). */
  setConversation?: (conversationId: string | null) => void;
  markRead?: () => void;
  setTyping?: (typing: boolean) => void;
  rate?: (value: "good" | "bad") => Promise<void>;
  startConversation?: () => Promise<string>;
  history?: (signal: AbortSignal) => Promise<ConversationSummary[]>;
  upload?: (file: File) => Promise<WidgetAttachment>;
  identify?: (name: string, email: string) => Promise<void>;
  /** Save only the email, preserving any name the host already supplied (D52). */
  identifyEmail?: (email: string) => Promise<void>;
};

export type WidgetOptions = {
  transport: WidgetTransport;
  assetUrl: string;
  fontUrl?: string;
  target?: HTMLElement;
  title?: string;
  subtitle?: string;
  /** Panel size; defaults to lg (the classic 300×480). */
  size?: WidgetSize;
  /** Accent colour for the launcher, header, send button and visitor bubbles. */
  accent?: string;
  /** CSP nonce for the injected stylesheet, for hosts with a strict style-src policy. */
  styleNonce?: string;
  /** Called when a reply arrives while the panel is closed — for a toast sound or badge. */
  onNotify?: (message: WidgetMessage) => void;
  /** localStorage key marking the one-time welcome notification as shown (D50). */
  welcomeStorageKey?: string;
};

export type WidgetHandle = {
  open: () => void;
  close: () => void;
  reload: () => Promise<void>;
  /** Resize the panel without remounting or losing the conversation. */
  setSize: (size: WidgetSize) => void;
  destroy: () => void;
};
