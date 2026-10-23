/*
 * One-line embed — paste this anywhere in a page:
 *
 *   <script src="https://your-host/widget/embed.js" async
 *           data-site="site_abc123" data-api="https://your-host/api/widget"
 *           data-color="#2563eb" data-name="Dhimant" data-email="hi@dhimant.dev"></script>
 *
 * Attributes (data-site is required):
 *   data-site      site key from the dashboard
 *   data-api       backend base URL (defaults to <script-origin>/api/widget)
 *   data-color     accent colour for the launcher, header, send button and bubbles
 *   data-asset     artwork URL (defaults to textbox-160.png next to this script)
 *   data-title     panel title
 *   data-subtitle  panel subtitle
 *   data-size      panel size: lg (default), md, or sm
 *   data-style-nonce  CSP nonce for the injected stylesheet (defaults to this script's nonce)
 *   data-name      visitor name (skips the inline identity prompt)
 *   data-email     visitor email (skips the inline identity prompt)
 *
 * This is a classic script (no type="module" needed) that resolves its own URL, imports the
 * widget module that sits next to it, and mounts it. It stays dependency-free on
 * purpose: the dashboard uses the Supabase client, this file only speaks HTTP.
 */
(() => {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;

  const base = new URL(".", script.src);
  const data = script.dataset;
  // Same app serves the widget files and the API, so default to /api/widget
  // on the same origin. data-api only needs setting for split hosting.
  const api = (data.api ?? new URL("/api/widget", base).href).replace(/\/$/, "");
  const site = (data.site ?? "").trim();
  if (!site) {
    console.error("[chat-platform] data-site is required to connect the widget to support.");
    return;
  }
  const size = data.size === "sm" || data.size === "md" ? data.size : "lg";
  // Keep in sync with src/widget/version.ts. Asset releases refresh the module
  // without erasing a visitor's conversation. Storage changes only when the
  // persisted data shape is no longer compatible.
  const WIDGET_RELEASE = {
    assets: "2026-10-23.2",
    storage: "2026-10-20.5",
  } as const;
  const STORAGE_VERSION_KEY = "chat-platform:widget-version";
  const WELCOME_SEEN_PREFIX = "chat-platform:welcome-notified:";
  try {
    if (window.localStorage.getItem(STORAGE_VERSION_KEY) !== WIDGET_RELEASE.storage) {
      const stale: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (
          key &&
          (key === "chat-platform:identity" ||
            key === "chat-platform:visitor-id" ||
            key.startsWith(WELCOME_SEEN_PREFIX))
        ) {
          stale.push(key);
        }
      }
      for (const key of stale) window.localStorage.removeItem(key);
      window.localStorage.setItem(STORAGE_VERSION_KEY, WIDGET_RELEASE.storage);
    }
  } catch {
    // Storage is unavailable; the widget still works for this page view.
  }

  type Attachment = { url: string; name: string; size: string; kind: "image" | "file" };
  type Message = {
    id: string;
    author: "visitor" | "agent";
    body: string;
    createdAt: string;
    agentId?: string;
    authorName?: string;
    authorAvatar?: string;
    isAutomated?: boolean;
    attachment?: Attachment;
  };
  type Meta = {
    conversationId: string | null;
    latestConversationId: string | null;
    status: "open" | "closed";
    agentLastReadAt: string | null;
    agentTyping: boolean;
    typingAgent: { id?: string; name: string; avatar?: string } | null;
    onlineAgents: { id: string; name: string; avatar?: string }[];
    online: boolean;
    awayMessage: string;
    welcomeMessage: string;
    welcomeNotify: boolean;
    widgetSize?: "sm" | "md" | "lg";
    presetMessages: { question: string; answer: string }[];
    topicOptions: string[];
    conversationTags: string[];
    csat: "good" | "bad" | null;
    visitorName: string | null;
    visitorEmail: string | null;
    identified: boolean;
    agentsViewing: { id?: string; name: string; avatar?: string }[];
  };
  type Summary = { id: string; status: string; lastMessage: string; updatedAt: string };
  type Identity = { name: string; email: string };

  const IDENTITY_KEY = "chat-platform:identity";

  const storedIdentity = (): Identity => {
    try {
      const raw = window.localStorage.getItem(IDENTITY_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            name: "name" in parsed && typeof parsed.name === "string" ? parsed.name : "",
            email: "email" in parsed && typeof parsed.email === "string" ? parsed.email : "",
          };
        }
      }
    } catch {
      // Private mode or an invalid old value: use an empty identity.
    }
    return { name: "", email: "" };
  };
  const previousIdentity = storedIdentity();
  const hasHostName = Object.prototype.hasOwnProperty.call(data, "name");
  const hasHostEmail = Object.prototype.hasOwnProperty.call(data, "email");
  const hasHostIdentity = hasHostName || hasHostEmail;
  const hostName = (data.name ?? "").trim();
  const hostEmail = (data.email ?? "").trim();
  const hostChangedVisitor = hasHostIdentity &&
    (previousIdentity.name !== "" || previousIdentity.email !== "") &&
    ((hasHostName && previousIdentity.name !== hostName) ||
      (hasHostEmail && previousIdentity.email !== hostEmail));
  const hostIdentity: Identity = {
    name: hasHostName ? hostName : hostChangedVisitor ? "" : previousIdentity.name,
    email: hasHostEmail ? hostEmail : hostChangedVisitor ? "" : previousIdentity.email,
  };
  let identity = hasHostIdentity ? hostIdentity : previousIdentity;
  const readIdentity = () => identity;

  const saveIdentity = (name: string, email: string) => {
    identity = { name, email };
    try {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      // Identity is a nicety; the chat still works without persistence.
    }
  };
  if (hasHostIdentity) saveIdentity(hostIdentity.name, hostIdentity.email);

  /**
   * Programmatic identify hook for host apps:
   *   window.chatPlatformIdentify("Dhimant", "hi@dhimant.dev")
   * Stored locally and sent with the next message.
   */
  (window as Window & { chatPlatformIdentify?: (name: string, email?: string) => void }).chatPlatformIdentify = (
    name,
    email = "",
  ) => {
    saveIdentity(name, email);
  };

  /*
   * Anonymous visitor id, stable across tabs and reloads. A host-provided
   * account switch starts a new conversation so the next visitor cannot see
   * the previous account's messages on a shared browser.
   */
  const visitorId = (() => {
    const key = "chat-platform:visitor-id";
    try {
      if (hostChangedVisitor) {
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(`${WELCOME_SEEN_PREFIX}${site}`);
      }
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const fresh =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      window.localStorage.setItem(key, fresh);
      return fresh;
    } catch {
      return `v-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    }
  })();

  /*
   * Visitor context, sniffed from the browser once per page view.
   * Sent with every message; the API stores it on the conversation so the
   * dashboard profile sheet shows real device/page/country instead of blanks.
   * Nothing here needs a paid lookup: country comes from the request headers
   * server-side, timezone from Intl, device from the UA + touch points.
   */
  const visitorContext = (() => {
    const ua = window.navigator.userAgent || "";
    const platform = (window.navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      ?? window.navigator.platform ?? "";
    const touch = "maxTouchPoints" in window.navigator && window.navigator.maxTouchPoints > 0;
    const width = Math.min(window.screen?.width ?? 0, window.innerWidth || 0);
    let device = "desktop";
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) device = touch && width > 500 ? "tablet" : "phone";
    else if (touch && width > 0 && width < 1100) device = "laptop";
    let browser = "";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    let os = platform || "";
    if (!os) {
      if (/Windows/.test(ua)) os = "Windows";
      else if (/Mac OS/.test(ua)) os = "macOS";
      else if (/Android/.test(ua)) os = "Android";
      else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
      else if (/Linux/.test(ua)) os = "Linux";
    }
    let timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      timezone = "";
    }
    return {
      browser,
      os,
      device,
      timezone,
    };
  })();
  const currentVisitorContext = () => ({
    ...visitorContext,
    page: `${window.location.pathname}${window.location.search}`,
  });

  const apiTransport = (baseUrl: string, siteKey: string, visitor: string) => {
    const seen = new Set<string>();
    let metaSink: ((meta: Meta) => void) | null = null;
    // The GET returns messages + meta together, so reload() must not pay a
    // second round trip: cache the meta that came with this load.
    let lastMeta: Meta | null = null;
    let lastMetaAt = 0;
    let lastMetaFor = "";
    let pollNowFn: (() => void) | null = null;
    let pollTick: (() => void) | null = null;
    // Live chat polls fast while the panel is open (a reply is on screen in
    // about a second), and stays cheap in the background while it is closed.
    let pollDelay = 5_000;
    // Incremental polling: only messages newer than the cursor are
    // fetched; switching conversations resets it.
    let cursor = "";
    let activeConversation: string | null = null;
    let conversationVersion = 0;

    const query = (extra = "") =>
      `${baseUrl}/messages?site=${encodeURIComponent(siteKey)}&visitor=${encodeURIComponent(visitor)}${extra}`;

    const fetchState = async (signal?: AbortSignal, conversationId?: string, after?: string) => {
      const version = conversationVersion;
      const params = new URLSearchParams();
      if (conversationId) params.set("conversation", conversationId);
      if (after) params.set("after", after);
      const suffix = params.size ? `&${params.toString()}` : "";
      const response = await fetch(query(suffix), { signal });
      if (!response.ok) throw new Error(`Could not load messages (${response.status})`);
      const payload = (await response.json()) as { messages: Message[]; meta: Meta };
      if (version !== conversationVersion) throw new DOMException("Conversation changed", "AbortError");
      for (const message of payload.messages) seen.add(message.id);
      const newest = payload.messages.reduce(
        (max, message) => (message.createdAt > max ? message.createdAt : max),
        "",
      );
      if (newest) cursor = newest;
      lastMeta = payload.meta;
      lastMetaAt = Date.now();
      lastMetaFor = conversationId ?? "latest";
      metaSink?.(payload.meta);
      return payload;
    };

    const action = (body: Record<string, unknown>) =>
      fetch(`${baseUrl}/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          site: siteKey,
          visitor,
          conversation: activeConversation ?? lastMeta?.conversationId ?? undefined,
          ...body,
        }),
      }).catch(() => {
        // State is best-effort: a missed read/typing tick costs nothing.
      });

    return {
      async load(signal: AbortSignal, conversationId?: string) {
        const payload = await fetchState(signal, conversationId);
        return payload.messages;
      },
      async meta(signal: AbortSignal, conversationId?: string) {
        const key = conversationId ?? "latest";
        if (lastMeta && lastMetaFor === key && Date.now() - lastMetaAt < 2000) {
          return lastMeta;
        }
        const payload = await fetchState(signal, conversationId);
        return payload.meta;
      },
      async send(message: { id: string; body: string; attachment?: Attachment }, signal: AbortSignal) {
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            site: siteKey,
            visitor,
            id: message.id,
            body: message.body,
            attachment: message.attachment,
            identity: readIdentity(),
            context: currentVisitorContext(),
          }),
          signal,
        });
        if (!response.ok) throw new Error(`Could not send the message (${response.status})`);
        const accepted = (await response.json()) as Message;
        seen.add(accepted.id);
        return accepted;
      },
      async sendPreset(question: string, id: string, signal: AbortSignal) {
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ site: siteKey, visitor, id, body: question, presetQuestion: question,
            identity: readIdentity(), context: currentVisitorContext() }),
          signal,
        });
        if (!response.ok) throw new Error(`Could not send preset (${response.status})`);
        const pair = (await response.json()) as { question: Message; answer: Message };
        seen.add(pair.question.id);
        seen.add(pair.answer.id);
        return [pair.question, pair.answer] as [Message, Message];
      },
      async selectTopic(tag: string) {
        const response = await action({ action: "tag", value: tag });
        if (!response?.ok) throw new Error("Could not save the topic");
      },
      /*
       * The widget core calls this once (widget.ts) and feeds every new
       * message into the open panel or a notification. Polling keeps this
       * file dependency-free: no supabase-js ships inside embed.js, so no
       * bundler is needed — tsc output stays a plain ES module.
       */
      subscribe(receive: (message: Message) => void, onMeta: (meta: Meta) => void) {
        metaSink = onMeta;
        // Delivery dedup: only messages that were NOT already known before this
        // fetch are "new". Without the `before` snapshot every poll re-delivered
        // the whole agent history — the endless notification/sound loop.
        let primed = false;
        let timer: number | undefined;
        let stopped = false;
        let inFlight = false;
        const controller = new AbortController();
        const run = async () => {
          if (stopped || inFlight) return;
          inFlight = true;
          const before = new Set(seen);
          const initialized = lastMeta !== null;
          try {
            const payload = await fetchState(
              controller.signal,
              activeConversation ?? undefined,
              cursor || undefined,
            );
            if (!primed && !initialized) {
              primed = true;
              return;
            }
            primed = true;
            for (const message of payload.messages) {
              if (message.author !== "agent" || before.has(message.id)) continue;
              receive(message);
            }
          } catch {
            // A failed poll leaves the current transcript visible.
          } finally {
            inFlight = false;
          }
        };
        const schedule = () => {
          if (stopped) return;
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(async () => {
            await run();
            schedule();
          }, pollDelay);
        };
        pollNowFn = () => void run();
        // setOpen reschedules at the new delay and fetches immediately.
        pollTick = () => {
          void run();
          schedule();
        };
        const onVisibility = () => {
          if (document.visibilityState === "visible") {
            pollTick?.();
            return;
          }
          // Keep polling in the background so replies still raise a notice and
          // a sound while the visitor is on another tab.
          schedule();
        };
        document.addEventListener("visibilitychange", onVisibility);
        schedule();
        return () => {
          stopped = true;
          controller.abort();
          metaSink = null;
          document.removeEventListener("visibilitychange", onVisibility);
          pollNowFn = null;
          pollTick = null;
          if (timer) window.clearTimeout(timer);
        };
      },
      setOpen(open: boolean) {
        pollDelay = open ? 1_000 : 5_000;
        pollTick?.();
      },
      setConversation(conversationId: string | null) {
        activeConversation = conversationId;
        conversationVersion += 1;
        cursor = "";
        pollTick?.();
      },
      pollNow() {
        pollNowFn?.();
      },
      markRead() {
        void action({ action: "read" });
      },
      setTyping(typing: boolean) {
        void action({ action: "typing", value: typing ? "true" : "false" });
      },
      async rate(value: "good" | "bad") {
        const response = await action({ action: "csat", value });
        if (!response?.ok) throw new Error("Could not save the rating");
      },
      async startConversation() {
        // Starting a conversation must be truthful: a failed call has to keep
        // the old transcript instead of clearing it.
        const response = await fetch(`${baseUrl}/state`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ site: siteKey, visitor, action: "new" }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Could not start conversation (${response.status})`);
        const payload = (await response.json()) as { conversationId: string };
        if (!payload.conversationId) throw new Error("New conversation has no id");
        return payload.conversationId;
      },
      async history(signal: AbortSignal) {
        const response = await fetch(
          `${baseUrl}/conversations?site=${encodeURIComponent(siteKey)}&visitor=${encodeURIComponent(visitor)}`,
          { signal },
        );
        if (!response.ok) return [];
        return (await response.json()) as Summary[];
      },
      async upload(file: File) {
        const form = new FormData();
        form.append("file", file);
        form.append("site", siteKey);
        form.append("visitor", visitor);
        const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        return (await response.json()) as Attachment;
      },
      async identify(name: string, email: string) {
        saveIdentity(name, email);
        await action({ action: "identify", name, email });
      },
      async identifyEmail(email: string) {
        const identity = readIdentity();
        saveIdentity(identity.name, email);
        await action({ action: "identify", email });
      },
    };
  };

  let pendingSound: (() => void) | null = null;
  const playSound = () => {
    void import(new URL("cuelume/index.js", base).href)
      .then(({ play }) => play("ready", { theme: "press" }))
      .catch(() => {
        // Sound is a bonus; the badge and preview already told the visitor.
      });
  };
  const canPlayNow = () => {
    try {
      const activation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation;
      if (activation?.hasBeenActive) return true;
    } catch {
      // Older browser: fall through to the audio-context probe.
    }
    try {
      const AudioCtor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return true;
      const probe = new AudioCtor();
      const state = probe.state;
      void probe.close();
      return state === "running";
    } catch {
      return true;
    }
  };
  const unlockSound = () => {
    window.removeEventListener("pointerdown", unlockSound, true);
    window.removeEventListener("keydown", unlockSound, true);
    pendingSound?.();
    pendingSound = null;
  };

  const options = {
    assetUrl: data.asset ?? new URL("textbox-160.png", base).href,
    title: data.title || undefined,
    subtitle: data.subtitle || undefined,
    size,
    accent: data.color || undefined,
    styleNonce: data.styleNonce || script.nonce || undefined,
    welcomeStorageKey: site ? `${WELCOME_SEEN_PREFIX}${site}` : undefined,
    transport: apiTransport(api, site, visitorId),
    onNotify() {
      // Autoplay policy: before the first gesture the audio context is
      // suspended. Play now if allowed, otherwise play on the first click/key.
      if (canPlayNow()) {
        playSound();
        return;
      }
      pendingSound = playSound;
      window.addEventListener("pointerdown", unlockSound, true);
      window.addEventListener("keydown", unlockSound, true);
    },
  };

  // An async script in <head> may finish before <body> exists. A later embed
  // replaces an earlier pending import as well as an already mounted widget.
  const globalWindow = window as Window & {
    chatPlatformWidget?: { destroy?: () => void };
    chatPlatformBoot?: object;
  };
  const boot = {};
  globalWindow.chatPlatformBoot = boot;
  const mount = () => {
    void import(new URL(`widget.js?v=${WIDGET_RELEASE.assets}`, base).href)
      .then((module) => {
        if (globalWindow.chatPlatformBoot !== boot) return;
        try {
          globalWindow.chatPlatformWidget?.destroy?.();
        } catch {
          // A stale handle from an older embed can be removed with its host.
        }
        document.querySelectorAll(".chat-platform-widget").forEach((node) => node.remove());
        globalWindow.chatPlatformWidget = module.mountChatWidget(options);
      })
      .catch((error) => console.error("[chat-platform] Could not load the widget module.", error));
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
