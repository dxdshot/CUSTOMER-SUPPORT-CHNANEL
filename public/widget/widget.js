import { widgetStyles } from "./styles.js";
const instances = new WeakMap();
const TOPIC_ACK = "Thanks — we'll get back to you as soon as possible.";
// Module-level decode cache: every mount on the page shares it, so opening a
// second widget (or remounting) never re-flashes artwork that already decoded.
const artCache = new Map();
const icons = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    chat: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-8h6v8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checks: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
    expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    shrink: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
    back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    attach: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    good: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    bad: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
};
function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
function element(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
}
// The welcome copy is plain text, so a pasted URL would otherwise read as a dead
// string. Split it into text nodes and real anchors, trailing punctuation intact.
const linkPattern = /(?<![\w@])(?:https?:\/\/|www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi;
function linkify(text) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(linkPattern)) {
        const start = match.index ?? 0;
        if (start > cursor)
            fragment.append(text.slice(cursor, start));
        const raw = match[0];
        const trimmed = raw.replace(/[.,!?;:)\]]+$/, "");
        const anchor = document.createElement("a");
        anchor.href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        anchor.textContent = trimmed;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        fragment.append(anchor);
        if (trimmed.length < raw.length)
            fragment.append(raw.slice(trimmed.length));
        cursor = start + raw.length;
    }
    if (cursor < text.length)
        fragment.append(text.slice(cursor));
    return fragment;
}
function presenceDot(online) {
    const dot = document.createElement("span");
    dot.className = `presence-dot ${online ? "online" : "offline"}`;
    dot.title = online ? "Online" : "Offline";
    dot.setAttribute("aria-label", online ? "Online" : "Offline");
    return dot;
}
// Support-wide status with no identity: the green/grey dot beside the text.
function statusDot(online) {
    const dot = document.createElement("span");
    dot.className = `status-dot ${online ? "online" : "offline"}`;
    dot.setAttribute("aria-hidden", "true");
    return dot;
}
// Mirrors the dashboard's VisitorAvatar palette so the same agent reads the
// same way in the inbox and in the widget.
const avatarGradients = [
    "linear-gradient(135deg,#f08a3c,#d94f2b)",
    "linear-gradient(135deg,#7c5cf0,#4b3ec7)",
    "linear-gradient(135deg,#2fd0b5,#0e8f88)",
    "linear-gradient(135deg,#4c9bff,#2a5bd7)",
    "linear-gradient(135deg,#f2b54a,#d9822b)",
    "linear-gradient(135deg,#f06a9b,#c73a72)",
];
function initialAvatar(name) {
    const initials = name
        .split(/\s+/)
        .map((word) => word[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "S";
    const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const node = element("span", "avatar-initial");
    node.textContent = initials;
    node.style.background = avatarGradients[hash % avatarGradients.length];
    return node;
}
// crypto.randomUUID is secure-context only — an http:// embed would otherwise throw at mount.
const uid = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export function mountChatWidget(options) {
    const target = options.target ?? document.body;
    const existing = instances.get(target);
    if (existing)
        return existing;
    const host = element("div", "chat-platform-widget");
    // Top-layer popover: a plain `position: fixed` element gets trapped by a transform, filter
    // or contain on any ancestor of the host, which makes it scroll away with the page. The
    // top layer is immune to that, so the widget stays pinned bottom-right on any site.
    if (typeof host.showPopover === "function")
        host.setAttribute("popover", "manual");
    host.style.cssText =
        "position:fixed;inset:0;width:0;height:0;margin:0;padding:0;border:0;background:transparent;overflow:visible;";
    const shadow = host.attachShadow({ mode: "open" });
    const style = element("style", "");
    if (options.styleNonce)
        style.nonce = options.styleNonce;
    style.textContent = widgetStyles;
    shadow.append(style);
    let ownedFont;
    if (options.fontUrl) {
        const font = new FontFace("Chat Geist", `url(${JSON.stringify(new URL(options.fontUrl, document.baseURI).href)})`, { weight: "100 900" });
        ownedFont = font;
        void font.load().then((loaded) => { if (!destroyed)
            document.fonts.add(loaded); }).catch(() => { });
    }
    const abort = new AbortController();
    let loadAbort;
    let state = "idle";
    let opened = false;
    let destroyed = false;
    let messages = [];
    let renderedMessages;
    let renderedTranscriptState = "";
    let renderedHeaderState = "";
    let renderedEndedAvatarState = "";
    let returnFocus = null;
    let unread = 0;
    let maximized = false;
    let meta = null;
    let view = "chat";
    let historyItems = [];
    let historyLoading = false;
    let historyFetchedAt = 0;
    let startingNew = false;
    let viewingPast = false;
    let firstChatStarted = false;
    let pendingAttachment = null;
    let presetMenuItems = [];
    let presetMenuIndex = 0;
    let presetMenuDismissed = false;
    let uploading = false;
    let emailPromptDone = false;
    let emailCardOpen = false;
    let csatPending = null;
    let csatPendingTimer;
    let topicPending = null;
    let topicPendingTimer;
    let typingSentAt = 0;
    let typingClear;
    let closeTopicMenu = null;
    let welcomeNotified = false;
    const historyAbort = new AbortController();
    const noticeTimers = new Map();
    const noticeIds = new Set();
    const MAX_NOTICES = 3;
    const widget = element("div", "widget");
    widget.dataset.size = options.size ?? "lg";
    if (options.accent)
        widget.style.setProperty("--blue", options.accent);
    const panel = element("section", "panel");
    panel.id = `chat-${uid()}`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", options.title ?? "Your conversation");
    panel.hidden = true;
    const header = element("header", "header");
    const topline = element("div", "topline");
    const actions = element("div", "actions");
    // One right-side button: maximize/minimize. Past chats live on the left
    // brand button (no separate clock button) — D33.
    const expandButton = element("button", "icon-btn");
    expandButton.type = "button";
    expandButton.setAttribute("aria-label", "Maximize chat");
    expandButton.innerHTML = icon("expand");
    actions.append(expandButton);
    const artFallback = () => {
        const fallback = element("span", "art-fallback");
        fallback.setAttribute("aria-hidden", "true");
        fallback.innerHTML = icon("chat");
        return fallback;
    };
    // Decoded-art cache (module-level, shared by every mount): an <img> whose URL
    // already finished loading anywhere on the page renders directly from the
    // browser cache. render() rebuilds the whole list each time, so without this
    // every new message would re-create every avatar from scratch (pop-in on
    // each send) — and a second mount would re-flash art the first one decoded.
    const assetUrl = (options.assetUrl ?? "").trim();
    // Mount-time preload: fetching starts here — long before anyone clicks — so
    // decoded bytes are usually cached by first open. On success it primes
    // artCache (first art() renders direct); on error the holder path covers it
    // with the fallback glyph; the timeout guarantees a hung image never matters.
    // render() consults artCache for per-image readiness.
    if (assetUrl) {
        const prime = new Promise((resolve) => {
            const done = () => resolve();
            const timer = window.setTimeout(done, 1500);
            try {
                const preload = new Image();
                preload.decoding = "async";
                preload.onload = () => {
                    window.clearTimeout(timer);
                    artCache.set(assetUrl, true);
                    done();
                };
                preload.onerror = () => {
                    window.clearTimeout(timer);
                    done();
                };
                preload.src = assetUrl;
            }
            catch {
                window.clearTimeout(timer);
                done();
            }
        });
        void prime;
    }
    const art = () => {
        // Empty or broken artwork must never show a broken-image glyph or an
        // empty "ghost" box: fall back to the chat glyph on the same footprint.
        // Listener attached before src so a cached failure still swaps.
        if (!assetUrl)
            return artFallback();
        // Already decoded somewhere in this widget: render the <img> directly.
        // The browser serves it from cache — no flash, no second fetch.
        if (artCache.get(assetUrl)) {
            const img = element("img", "art");
            img.alt = "";
            img.draggable = false;
            img.decoding = "async";
            img.src = assetUrl;
            return img;
        }
        // Not decoded yet: hold a solid placeholder on the exact footprint and
        // swap in the real image the moment it decodes. The box is never empty.
        const holder = element("span", "art art-pending");
        holder.setAttribute("aria-hidden", "true");
        const img = element("img", "art art-pending-img");
        img.alt = "";
        img.draggable = false;
        img.decoding = "async";
        img.addEventListener("load", () => {
            // Mark cached BEFORE swapping: art() consults the cache, and without
            // this the swap would build another holder in an endless loop.
            artCache.set(assetUrl, true);
            holder.replaceWith(art());
        }, { once: true });
        img.addEventListener("error", () => {
            holder.replaceWith(artFallback());
        }, { once: true });
        img.src = assetUrl;
        holder.append(img);
        return holder;
    };
    // The home button is the header's brand mark. Clicking it steps back one level:
    // maximized → normal panel, normal → the launcher ("home" for the widget).
    const homeButton = element("button", "header-art");
    homeButton.type = "button";
    homeButton.setAttribute("aria-label", "Close chat");
    homeButton.append(art());
    const title = element("h2", "title");
    title.style.margin = "0";
    title.textContent = options.title ?? "Your conversation";
    const identityText = element("div", "identity-text");
    identityText.append(title);
    // Presence line: Online / away message, replaced by "Support is typing…".
    const statusLine = element("p", "subtitle");
    identityText.append(statusLine);
    topline.append(homeButton, identityText, actions);
    header.append(topline);
    const body = element("div", "body");
    const live = element("p", "sr-only");
    live.setAttribute("role", "status");
    const loading = element("div", "loading");
    loading.setAttribute("role", "status");
    loading.setAttribute("aria-label", "Loading conversation");
    const loadingArt = element("div", "loading-art");
    loadingArt.append(art());
    loading.append(loadingArt);
    const error = element("div", "error");
    const errorText = element("p", "");
    errorText.textContent = "Couldn’t load your conversation.";
    const reloadButton = element("button", "");
    reloadButton.textContent = "Try again";
    error.append(errorText, reloadButton);
    // Past chats: flat rows — avatar, "You, date", last-message preview,
    // chevron. No boxes; one pill at the bottom starts a new conversation.
    const historyView = element("div", "history");
    historyView.hidden = true;
    const historyList = element("div", "history-list");
    const newChatButton = element("button", "history-new");
    newChatButton.type = "button";
    newChatButton.innerHTML = `${icon("plus")}<span>Start new conversation</span>`;
    historyView.append(historyList, newChatButton);
    const list = element("ol", "messages");
    list.setAttribute("aria-label", "Messages");
    const presets = element("div", "presets");
    presets.setAttribute("aria-label", "Suggested questions");
    const firstChat = element("button", "first-chat");
    firstChat.type = "button";
    firstChat.textContent = "Start chat";
    // "Support is typing" matches the inbox: a bubble with three bouncing dots
    // beside the agent's photo and name.
    const typingRow = element("div", "typing-row");
    typingRow.hidden = true;
    const typingAvatar = element("span", "typing-avatar");
    typingAvatar.hidden = true;
    const typingBubble = element("span", "typing-bubble");
    typingBubble.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index += 1) {
        const dot = element("span", "typing-dot");
        dot.style.animationDelay = `${index * 0.15}s`;
        typingBubble.append(dot);
    }
    const typingLabel = element("span", "");
    typingLabel.textContent = "Support is typing…";
    typingRow.append(typingAvatar, typingBubble, typingLabel);
    body.append(loading, error, historyView, list, presets, typingRow);
    const formWrap = element("div", "composer-wrap");
    // D52: the email ask stays collapsed to a single notification pill until the
    // visitor taps it; only then does the card open above the composer.
    const emailTrigger = element("button", "email-trigger");
    emailTrigger.type = "button";
    emailTrigger.hidden = true;
    emailTrigger.setAttribute("aria-expanded", "false");
    emailTrigger.innerHTML = `${icon("bell")}<span>Get notified when we reply</span>`;
    const emailPrompt = element("form", "email-card");
    emailPrompt.hidden = true;
    emailPrompt.id = `email-${uid()}`;
    emailTrigger.setAttribute("aria-controls", emailPrompt.id);
    const emailTitle = element("p", "email-title");
    emailTitle.textContent = "What is your email address?";
    const emailHelp = element("p", "email-help");
    emailHelp.textContent = "Enter your email to know when we reply.";
    const emailInput = element("input", "email-input");
    emailInput.type = "email";
    emailInput.placeholder = "Enter your email address…";
    emailInput.setAttribute("aria-label", "Email");
    emailInput.setAttribute("autocomplete", "email");
    emailInput.required = true;
    const emailActions = element("div", "email-actions");
    const emailSave = element("button", "email-save");
    emailSave.type = "submit";
    emailSave.textContent = "Set my email";
    const emailDismiss = element("button", "email-skip");
    emailDismiss.type = "button";
    emailDismiss.textContent = "Skip";
    emailActions.append(emailSave, emailDismiss);
    emailPrompt.append(emailTitle, emailHelp, emailInput, emailActions);
    // Ended conversation: centered CSAT + start-new.
    const endedView = element("div", "ended");
    endedView.hidden = true;
    const endedAvatar = element("span", "ended-avatar");
    const endedTitle = element("p", "ended-title");
    endedTitle.textContent = "Conversation ended";
    const endedText = element("p", "ended-text");
    const csatActions = element("div", "csat-actions");
    const csatGood = element("button", "csat-btn");
    csatGood.type = "button";
    csatGood.setAttribute("aria-label", "Rate this conversation good");
    csatGood.innerHTML = icon("good");
    const csatBad = element("button", "csat-btn");
    csatBad.type = "button";
    csatBad.setAttribute("aria-label", "Rate this conversation bad");
    csatBad.innerHTML = icon("bad");
    csatActions.append(csatGood, csatBad);
    const endedNew = element("button", "ended-new");
    endedNew.type = "button";
    endedNew.innerHTML = `${icon("plus")}<span>Start new conversation</span>`;
    endedView.append(endedAvatar, endedTitle, endedText, csatActions, endedNew);
    body.insertBefore(endedView, typingRow);
    const form = element("form", "composer");
    const input = element("textarea", "input");
    input.rows = 1;
    input.maxLength = 4000;
    input.placeholder = "Compose your message…";
    input.setAttribute("aria-label", "Your message");
    const bar = element("div", "composer-bar");
    const attachInput = element("input", "attach-input");
    attachInput.type = "file";
    attachInput.hidden = true;
    const attachButton = element("button", "attach");
    attachButton.type = "button";
    attachButton.setAttribute("aria-label", "Attach a file");
    attachButton.innerHTML = icon("attach");
    if (!options.transport.upload)
        attachButton.hidden = true;
    const barLeft = element("div", "bar-left");
    barLeft.append(attachButton);
    const send = element("button", "send");
    send.type = "submit";
    send.setAttribute("aria-label", "Send message");
    send.innerHTML = icon("send");
    bar.append(barLeft, send);
    const attachChip = element("div", "attach-chip");
    attachChip.hidden = true;
    const presetMenu = element("div", "preset-menu");
    presetMenu.hidden = true;
    presetMenu.setAttribute("role", "listbox");
    presetMenu.setAttribute("aria-label", "Preset replies");
    form.append(presetMenu, input, attachChip, attachInput, bar);
    formWrap.append(emailTrigger, emailPrompt, firstChat, form);
    panel.append(header, body, formWrap);
    const launcher = element("button", "launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open support chat");
    launcher.setAttribute("aria-controls", panel.id);
    launcher.setAttribute("aria-expanded", "false");
    launcher.append(art());
    const badge = element("span", "badge");
    badge.hidden = true;
    const launcherWrap = element("div", "launcher-wrap");
    launcherWrap.append(launcher, badge);
    // Incoming replies stack here: at most three, each dismissible on its own.
    const notices = element("div", "notices");
    widget.append(panel, notices, launcherWrap, live);
    shadow.append(widget);
    target.append(host);
    if (host.hasAttribute("popover")) {
        try {
            host.showPopover();
        }
        catch {
            // Older browser or a blocked top layer: fall back to plain fixed positioning.
            host.removeAttribute("popover");
        }
    }
    function renderHistory() {
        historyList.replaceChildren();
        if (historyLoading) {
            const p = element("p", "history-empty");
            p.textContent = "Loading…";
            historyList.append(p);
            return;
        }
        if (historyItems.length === 0) {
            const p = element("p", "history-empty");
            p.textContent = "No past conversations yet.";
            historyList.append(p);
            return;
        }
        for (const item of historyItems) {
            const button = element("button", "history-item");
            button.type = "button";
            const date = new Date(item.updatedAt).toLocaleDateString("en-GB");
            button.setAttribute("aria-label", `Open conversation from ${date}`);
            const avatar = element("span", "history-avatar");
            avatar.append(art());
            const text = element("span", "history-text");
            const who = element("span", "history-who");
            who.textContent = `You, ${date}`;
            const msg = element("span", "history-msg");
            msg.textContent = item.lastMessage || "No messages";
            const chevron = element("span", "history-chevron");
            chevron.innerHTML = icon("chevron");
            text.append(who, msg);
            button.append(avatar, text, chevron);
            button.addEventListener("click", () => void openConversation(item.id));
            historyList.append(button);
        }
    }
    // Keep an optimistic CSAT or topic visible until the server echoes it,
    // otherwise a poll landing mid-request flips the UI back to the prompt.
    function clearTopicPending() {
        topicPending = null;
        if (topicPendingTimer) {
            window.clearTimeout(topicPendingTimer);
            topicPendingTimer = undefined;
        }
    }
    function adoptMeta(next) {
        if (next.widgetSize)
            widget.dataset.size = next.widgetSize;
        let result = next;
        if (topicPending) {
            const tags = next.conversationTags ?? [];
            if (tags.includes(topicPending)) {
                clearTopicPending();
            }
            else {
                result = { ...result, conversationTags: [...tags, topicPending] };
            }
        }
        if (!csatPending)
            return result;
        if (result.csat === csatPending) {
            csatPending = null;
            if (csatPendingTimer)
                window.clearTimeout(csatPendingTimer);
            return result;
        }
        return { ...result, csat: csatPending };
    }
    function render() {
        const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
        const closed = meta?.status === "closed";
        const showHistory = view === "history" && state === "ready";
        const ended = closed && !showHistory && !viewingPast;
        // Title follows the surface: empty chat, live conversation, or history.
        const panelTitle = options.title
            ?? (showHistory
                ? "Your conversations"
                : messages.length > 0
                    ? "Your conversation"
                    : "Chat with support");
        title.textContent = panelTitle;
        panel.setAttribute("aria-label", panelTitle);
        panel.setAttribute("aria-busy", String(state === "loading"));
        launcher.dataset.loading = String(state === "loading");
        if (state === "loading")
            launcher.setAttribute("aria-busy", "true");
        else
            launcher.removeAttribute("aria-busy");
        // Presence line; only an agent typing in or viewing this exact thread gets
        // an identity. Otherwise the line is the site/agent away copy with no avatar.
        const viewing = meta?.agentsViewing ?? [];
        const typingAgent = meta?.agentTyping ? (meta.typingAgent ?? { name: "Support" }) : null;
        const onlineIds = new Set((meta?.onlineAgents ?? []).map((agent) => agent.id));
        const onlineNames = new Set((meta?.onlineAgents ?? []).map((agent) => agent.name.toLowerCase()));
        const lastAgentMessage = [...messages].reverse().find((message) => message.author === "agent" && !message.isAutomated);
        const lastAgent = lastAgentMessage
            ? {
                id: lastAgentMessage.agentId,
                name: lastAgentMessage.authorName ?? "Support",
                avatar: lastAgentMessage.authorAvatar,
            }
            : null;
        // Header identity is strictly live: only an agent typing in or actively
        // viewing this exact conversation gets a name/photo. Otherwise the brand
        // artwork plus Support online/offline (at least one agent heartbeat).
        const supportOnline = (meta?.onlineAgents?.length ?? 0) > 0;
        const lead = typingAgent ?? viewing[0];
        const statusText = !meta
            ? ""
            : typingAgent
                ? `${typingAgent.name} is typing…`
                : viewing.length === 0
                    ? supportOnline
                        ? "Support is online"
                        : "Support is offline"
                    : viewing.length === 1
                        ? `${viewing[0].name} is here`
                        : `${viewing.length} agents here`;
        const statusOnline = lead ? true : supportOnline;
        // A specific agent's photo/initial appears only while that agent is in this
        // exact thread. The support-wide line is a status, not a person, so it
        // carries just the dot — never an avatar (D60).
        const headerState = JSON.stringify([statusText, statusOnline, lead?.id, lead?.name, lead?.avatar]);
        if (headerState !== renderedHeaderState) {
            renderedHeaderState = headerState;
            statusLine.replaceChildren();
            if (statusText) {
                if (lead) {
                    const avatarWrap = element("span", "status-avatar-wrap");
                    if (lead.avatar) {
                        const photo = element("img", "");
                        photo.src = lead.avatar;
                        photo.alt = "";
                        photo.addEventListener("error", () => {
                            const initial = element("span", "status-initial");
                            initial.textContent = (lead.name || "S").slice(0, 1).toUpperCase();
                            photo.replaceWith(initial);
                        }, { once: true });
                        avatarWrap.append(photo);
                    }
                    else {
                        const initial = element("span", "status-initial");
                        initial.textContent = (lead.name || "S").slice(0, 1).toUpperCase();
                        avatarWrap.append(initial);
                    }
                    avatarWrap.append(presenceDot(statusOnline));
                    statusLine.append(avatarWrap);
                }
                else {
                    statusLine.append(statusDot(statusOnline));
                }
                const text = element("span", "status-text");
                text.textContent = statusText;
                statusLine.append(text);
            }
        }
        statusLine.hidden = !statusText || showHistory || ended;
        // Named typing row with the writer's photo.
        typingAvatar.replaceChildren();
        typingAvatar.hidden = !typingAgent;
        typingLabel.textContent = typingAgent ? `${typingAgent.name} is typing…` : "Support is typing…";
        if (typingAgent) {
            const avatarWrap = element("span", "typing-avatar-wrap");
            if (typingAgent.avatar) {
                const photo = element("img", "");
                photo.src = typingAgent.avatar;
                photo.alt = "";
                photo.addEventListener("error", () => {
                    const initial = element("span", "status-initial");
                    initial.textContent = typingAgent.name.slice(0, 1).toUpperCase();
                    photo.replaceWith(initial);
                }, { once: true });
                avatarWrap.append(photo);
            }
            else {
                const initial = element("span", "status-initial");
                initial.textContent = typingAgent.name.slice(0, 1).toUpperCase();
                avatarWrap.append(initial);
            }
            avatarWrap.append(presenceDot(true));
            typingAvatar.append(avatarWrap);
        }
        loading.hidden = state !== "loading";
        error.hidden = state !== "error";
        // Ended current conversation → centered end/CSAT view instead of transcript.
        historyView.hidden = !showHistory;
        endedView.hidden = !(ended && state === "ready");
        list.hidden = state !== "ready" || showHistory || ended;
        typingRow.hidden = !(state === "ready" && !showHistory && !ended && meta?.agentTyping);
        // The left brand button opens history; in history it returns to chat.
        homeButton.setAttribute("aria-label", options.transport.history
            ? view === "history"
                ? "Back to chat"
                : "Past conversations"
            : maximized
                ? "Restore size"
                : "Close chat");
        newChatButton.disabled = startingNew;
        endedNew.disabled = startingNew;
        const endedAvatarState = JSON.stringify([lastAgent?.id, lastAgent?.name, lastAgent?.avatar]);
        if (endedAvatarState !== renderedEndedAvatarState) {
            renderedEndedAvatarState = endedAvatarState;
            endedAvatar.replaceChildren();
            if (lastAgent?.avatar) {
                const photo = element("img", "ended-avatar-img");
                photo.src = lastAgent.avatar;
                photo.alt = "";
                photo.addEventListener("error", () => {
                    endedAvatar.replaceChildren();
                    if (lastAgent.name) {
                        const initial = element("span", "ended-avatar-initial");
                        initial.textContent = lastAgent.name.slice(0, 1).toUpperCase();
                        endedAvatar.append(initial);
                    }
                    else {
                        endedAvatar.append(art());
                    }
                }, { once: true });
                endedAvatar.append(photo);
            }
            else if (lastAgent?.name) {
                const initial = element("span", "ended-avatar-initial");
                initial.textContent = lastAgent.name.slice(0, 1).toUpperCase();
                endedAvatar.append(initial);
            }
            else {
                endedAvatar.append(art());
            }
        }
        endedText.textContent = meta?.csat ? "Thanks for the feedback." : "How did we do?";
        csatGood.dataset.active = String(meta?.csat === "good");
        csatBad.dataset.active = String(meta?.csat === "bad");
        csatActions.hidden = Boolean(meta?.csat);
        const showFirstChat = state === "ready" && !showHistory && !ended && !viewingPast
            && messages.length === 0 && !firstChatStarted;
        firstChat.hidden = !showFirstChat;
        form.hidden = state !== "ready" || closed || showHistory || viewingPast || showFirstChat;
        input.disabled = state !== "ready" || closed;
        const presetVisitorIds = new Set(messages
            .filter((message) => message.author === "agent" && message.isAutomated && message.id.startsWith("preset-"))
            .map((message) => message.id.slice("preset-".length)));
        const hasSentManualVisitorMessage = messages.some((message) => message.author === "visitor"
            && message.delivery === "sent"
            && !message.presetQuestion
            && !presetVisitorIds.has(message.id));
        const showEmailPrompt = state === "ready" && !showHistory && !closed && !viewingPast
            && hasSentManualVisitorMessage && !emailPromptDone && !meta?.visitorEmail;
        if (!showEmailPrompt)
            emailCardOpen = false;
        emailTrigger.hidden = !showEmailPrompt || emailCardOpen;
        emailTrigger.setAttribute("aria-expanded", String(showEmailPrompt && emailCardOpen));
        emailPrompt.hidden = !showEmailPrompt || !emailCardOpen;
        formWrap.hidden = form.hidden && emailTrigger.hidden && emailPrompt.hidden && firstChat.hidden;
        send.disabled = state !== "ready" || (!input.value.trim() && !pendingAttachment);
        attachButton.disabled = uploading;
        attachButton.setAttribute("aria-label", uploading ? "Uploading…" : "Attach a file");
        // Pending attachment chip.
        attachChip.replaceChildren();
        attachChip.hidden = !pendingAttachment;
        if (pendingAttachment) {
            const name = element("span", "attach-name");
            name.textContent = `${pendingAttachment.name}${pendingAttachment.size ? ` · ${pendingAttachment.size}` : ""}`;
            const remove = element("button", "attach-remove");
            remove.type = "button";
            remove.setAttribute("aria-label", "Remove attachment");
            remove.innerHTML = icon("close");
            remove.addEventListener("click", () => {
                pendingAttachment = null;
                render();
            });
            attachChip.append(name, remove);
        }
        if (showHistory)
            renderHistory();
        const showPresets = state === "ready" && !showHistory && !ended && !viewingPast
            && messages.length === 0 && Boolean(meta?.presetMessages?.some((preset) => preset.answer));
        presets.hidden = !showPresets;
        // The server inserts one automated "What best describes your problem?"
        // message. The widget replaces that bubble with a structured card and a
        // neutral dropdown, shown only while the conversation is untagged on the
        // live latest chat (D47).
        const askId = meta?.conversationId ? `topic-ask-${meta.conversationId}` : "";
        const showTopicPrompt = state === "ready" && !showHistory && !ended && !viewingPast
            && Boolean(options.transport.selectTopic)
            && (meta?.conversationTags?.length ?? 0) === 0
            && (meta?.topicOptions?.length ?? 0) > 0
            && Boolean(askId)
            && messages.some((message) => message.id === askId);
        const transcriptState = JSON.stringify([
            meta?.agentLastReadAt, meta?.onlineAgents, meta?.welcomeMessage,
            meta?.presetMessages, meta?.topicOptions, meta?.conversationTags,
            meta?.status, showTopicPrompt,
            showHistory, viewingPast,
        ]);
        if (messages === renderedMessages && transcriptState === renderedTranscriptState) {
            if (nearBottom)
                body.scrollTop = body.scrollHeight;
            return;
        }
        renderedMessages = messages;
        renderedTranscriptState = transcriptState;
        // A rebuilt transcript removes the prompt card; close any open topic menu
        // and drop its document listener before the old nodes go away.
        closeTopicMenu?.();
        closeTopicMenu = null;
        presets.replaceChildren();
        if (showPresets) {
            for (const preset of meta?.presetMessages ?? []) {
                if (!preset.answer)
                    continue;
                const button = element("button", "preset");
                button.type = "button";
                button.textContent = preset.question;
                button.addEventListener("click", () => {
                    if (state !== "ready" || meta?.status === "closed" || viewingPast)
                        return;
                    // Preset chips send their paired answer straight away — never paste
                    // the question into the composer and wait for a second tap.
                    firstChatStarted = true;
                    void transmit({
                        id: uid(),
                        author: "visitor",
                        body: preset.question,
                        createdAt: new Date().toISOString(),
                        delivery: "sending",
                        presetQuestion: preset.question,
                    });
                });
                presets.append(button);
            }
        }
        list.replaceChildren();
        messages.forEach((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            // Messages from the same author sit close together, and only the last one in the
            // run carries a timestamp.
            const sameSource = (other) => other?.id !== askId && other?.author === message.author && (message.author !== "agent" ||
                (other.agentId === message.agentId && Boolean(other.isAutomated) === Boolean(message.isAutomated)));
            const endsRun = !sameSource(next);
            const startsRun = !sameSource(previous);
            // The persisted ask is replaced by a structured, untinted card with a
            // dropdown. It disappears once the thread has a tag, or on a past/history
            // view, so it never becomes a stale prompt.
            if (message.id === askId) {
                if (!showTopicPrompt)
                    return;
                const prompt = element("li", "topic-prompt");
                prompt.setAttribute("aria-label", "What best describes your problem?");
                const card = element("div", "topic-prompt-card");
                const title = element("p", "topic-prompt-title");
                title.textContent = "What best describes your problem?";
                const help = element("p", "topic-prompt-help");
                help.textContent = "Choose a topic so we can route it to the right person.";
                const picker = element("div", "topic-picker");
                const trigger = element("button", "topic-trigger");
                trigger.type = "button";
                trigger.setAttribute("aria-haspopup", "listbox");
                trigger.setAttribute("aria-expanded", "false");
                const triggerLabel = element("span", "topic-trigger-label");
                triggerLabel.textContent = "Select a topic…";
                const chevron = element("span", "topic-chevron");
                chevron.innerHTML = icon("chevron");
                trigger.append(triggerLabel, chevron);
                const menu = element("div", "topic-menu");
                menu.hidden = true;
                menu.setAttribute("role", "listbox");
                menu.setAttribute("aria-label", "Topics");
                function onTopicPointer(event) {
                    const path = event.composedPath();
                    if (!path.includes(picker) && !path.includes(menu))
                        closeTopicMenu?.();
                }
                function closeTopicPicker() {
                    const hadFocus = menu.contains(shadow.activeElement);
                    menu.hidden = true;
                    menu.remove();
                    trigger.setAttribute("aria-expanded", "false");
                    document.removeEventListener("pointerdown", onTopicPointer, true);
                    window.removeEventListener("scroll", closeTopicPicker, true);
                    window.removeEventListener("resize", closeTopicPicker);
                    if (closeTopicMenu === closeTopicPicker)
                        closeTopicMenu = null;
                    if (hadFocus)
                        trigger.focus({ preventScroll: true });
                }
                function openTopicPicker() {
                    closeTopicMenu?.();
                    // Port the menu into the panel so it paints above the composer and
                    // transcript, then keep it inside the panel bounds so the panel's
                    // overflow cannot clip it.
                    panel.append(menu);
                    const rect = trigger.getBoundingClientRect();
                    const bounds = panel.getBoundingClientRect();
                    const width = rect.width;
                    const left = Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - width - 8));
                    menu.style.width = `${width}px`;
                    menu.style.left = `${left}px`;
                    // Always open above the trigger; cap the menu to the room above so it
                    // never spills over the panel edge or covers the composer.
                    const availableAbove = Math.max(60, rect.top - bounds.top - 14);
                    menu.style.maxHeight = `${Math.min(168, availableAbove)}px`;
                    menu.hidden = false;
                    trigger.setAttribute("aria-expanded", "true");
                    const menuHeight = menu.getBoundingClientRect().height;
                    menu.style.top = `${Math.max(bounds.top + 8, rect.top - 6 - menuHeight)}px`;
                    document.addEventListener("pointerdown", onTopicPointer, true);
                    window.addEventListener("scroll", closeTopicPicker, true);
                    window.addEventListener("resize", closeTopicPicker);
                    closeTopicMenu = closeTopicPicker;
                    menu.firstElementChild?.focus({ preventScroll: true });
                }
                trigger.addEventListener("click", () => {
                    if (menu.hidden)
                        openTopicPicker();
                    else
                        closeTopicPicker();
                });
                trigger.addEventListener("keydown", (event) => {
                    if (event.key === "ArrowDown" && menu.hidden) {
                        event.preventDefault();
                        openTopicPicker();
                    }
                });
                menu.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeTopicPicker();
                        return;
                    }
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                        return;
                    event.preventDefault();
                    const items = [...menu.querySelectorAll(".topic-option")];
                    if (items.length === 0)
                        return;
                    const index = items.indexOf(shadow.activeElement);
                    const next = event.key === "ArrowDown"
                        ? items[(index + 1) % items.length]
                        : items[(index - 1 + items.length) % items.length];
                    next?.focus();
                });
                picker.addEventListener("keydown", (event) => {
                    if (event.key === "Escape" && !menu.hidden) {
                        event.preventDefault();
                        event.stopPropagation();
                        closeTopicPicker();
                        trigger.focus();
                    }
                });
                let choosing = false;
                for (const topic of meta?.topicOptions ?? []) {
                    const option = element("button", "topic-option");
                    option.type = "button";
                    option.setAttribute("role", "option");
                    option.textContent = topic;
                    option.addEventListener("click", () => {
                        if (choosing)
                            return;
                        choosing = true;
                        triggerLabel.textContent = topic;
                        closeTopicPicker();
                        void selectTopic(topic);
                    });
                    menu.append(option);
                }
                picker.append(trigger, menu);
                card.append(title, help, picker);
                prompt.append(card);
                list.append(prompt);
                return;
            }
            const row = element("li", "message");
            row.dataset.author = message.author;
            if (message.isAutomated)
                row.dataset.automated = "true";
            if (!startsRun)
                row.dataset.sameAuthor = "true";
            row.setAttribute("aria-label", message.author === "visitor" ? "You" : "Support");
            if (message.author === "agent") {
                // Support's photo opens its runs: it sits on the first message, and the
                // later ones hold the same 22px slot so every bubble shares one left edge.
                if (startsRun) {
                    const avatar = element("span", "avatar");
                    const messageOnline = message.agentId
                        ? onlineIds.has(message.agentId)
                        : message.authorName
                            ? onlineNames.has(message.authorName.toLowerCase())
                            : false;
                    if (message.isAutomated) {
                        avatar.append(art());
                    }
                    else if (message.authorAvatar) {
                        const photo = element("span", "avatar-photo");
                        const image = element("img", "avatar-img");
                        image.src = message.authorAvatar;
                        image.alt = "";
                        image.addEventListener("error", () => photo.replaceWith(initialAvatar(message.authorName ?? "Support")), { once: true });
                        photo.append(image);
                        avatar.append(photo, presenceDot(messageOnline));
                    }
                    else {
                        avatar.append(initialAvatar(message.authorName ?? "Support"), presenceDot(messageOnline));
                    }
                    row.append(avatar);
                }
                else {
                    row.append(element("span", "avatar-spacer"));
                }
            }
            const wrap = element("div", "bubble-wrap");
            const bubble = element("p", "bubble");
            bubble.textContent = message.body;
            bubble.hidden = !message.body;
            wrap.append(bubble);
            if (message.attachment) {
                if (message.attachment.kind === "image") {
                    const image = element("img", "attachment-image");
                    image.src = message.attachment.url;
                    image.alt = message.attachment.name;
                    image.loading = "lazy";
                    wrap.append(image);
                }
                else {
                    const file = element("a", "attachment-file");
                    file.href = message.attachment.url;
                    file.target = "_blank";
                    file.rel = "noopener";
                    file.textContent = `${message.attachment.name}${message.attachment.size ? ` · ${message.attachment.size}` : ""}`;
                    wrap.append(file);
                }
            }
            if (message.delivery === "failed") {
                const retry = element("button", "retry");
                retry.textContent = "Not sent. Retry";
                retry.addEventListener("click", () => void transmit(message));
                wrap.append(retry);
            }
            else if (message.delivery === "sending") {
                const stateText = element("span", "delivery");
                stateText.textContent = "Sending…";
                wrap.append(stateText);
            }
            else if (endsRun) {
                const metaRow = element("span", "meta");
                const time = element("time", "");
                time.dateTime = message.createdAt;
                time.textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                metaRow.append(time);
                if (message.author === "visitor") {
                    // One tick = sent, two = the agent read it.
                    const read = meta?.agentLastReadAt
                        ? new Date(message.createdAt).getTime() <= new Date(meta.agentLastReadAt).getTime()
                        : false;
                    const tick = element("span", "tick");
                    tick.dataset.read = String(read);
                    tick.setAttribute("role", "img");
                    tick.setAttribute("aria-label", read ? "Read" : "Sent");
                    tick.innerHTML = icon(read ? "checks" : "check");
                    metaRow.append(tick);
                }
                wrap.append(metaRow);
            }
            row.append(wrap);
            list.append(row);
        });
        // The welcome sits at the top of the live transcript, like any other
        // message, so it stays put as the visitor types and the thread grows.
        if (!showHistory && !viewingPast) {
            const greeting = element("li", "message");
            greeting.dataset.welcome = "true";
            const avatar = element("span", "avatar");
            avatar.append(art());
            const welcome = element("p", "bubble");
            welcome.append(linkify(meta?.welcomeMessage?.trim() || "Hi! How can we help?"));
            greeting.append(avatar, welcome);
            list.prepend(greeting);
        }
        renderPresetMenu();
        if (nearBottom)
            body.scrollTop = body.scrollHeight;
    }
    // "/" in the composer opens the preset replies configured in Settings, the
    // same way the inbox slash menu opens canned responses.
    function closePresetMenu(dismissed) {
        presetMenu.hidden = true;
        presetMenu.replaceChildren();
        presetMenuItems = [];
        presetMenuIndex = 0;
        presetMenuDismissed = dismissed;
    }
    function renderPresetMenu() {
        if (presetMenuDismissed || state !== "ready" || meta?.status === "closed" || viewingPast) {
            presetMenu.hidden = true;
            return;
        }
        const command = /^\/([a-z0-9-]*)$/i.exec(input.value);
        const query = command ? command[1].toLowerCase() : null;
        presetMenuItems = query === null
            ? []
            : (meta?.presetMessages ?? []).filter((preset) => Boolean(preset.answer) && preset.question.toLowerCase().includes(query));
        if (presetMenuItems.length === 0) {
            presetMenu.hidden = true;
            presetMenu.replaceChildren();
            return;
        }
        if (presetMenuIndex >= presetMenuItems.length)
            presetMenuIndex = 0;
        presetMenu.replaceChildren(...presetMenuItems.map((preset, index) => {
            const item = element("button", "preset-menu-item");
            item.type = "button";
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", String(index === presetMenuIndex));
            item.dataset.active = String(index === presetMenuIndex);
            item.textContent = preset.question;
            item.addEventListener("mousedown", (event) => event.preventDefault());
            item.addEventListener("click", () => applyPreset(preset));
            return item;
        }));
        presetMenu.hidden = false;
    }
    function applyPreset(preset) {
        if (state !== "ready" || meta?.status === "closed" || viewingPast)
            return;
        closePresetMenu(true);
        input.value = "";
        input.style.height = "auto";
        send.disabled = state !== "ready";
        firstChatStarted = true;
        void transmit({
            id: uid(),
            author: "visitor",
            body: preset.question,
            createdAt: new Date().toISOString(),
            delivery: "sending",
            presetQuestion: preset.question,
        });
        input.focus();
    }
    async function reload(conversationId) {
        loadAbort?.abort();
        const request = new AbortController();
        loadAbort = request;
        viewingPast = Boolean(conversationId);
        state = "loading";
        render();
        try {
            const history = await options.transport.load(request.signal, conversationId);
            if (destroyed || request.signal.aborted)
                return;
            const merged = new Map();
            for (const message of history)
                merged.set(message.id, { ...message, delivery: "sent" });
            for (const message of messages)
                if (!merged.has(message.id))
                    merged.set(message.id, message);
            messages = [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            state = "ready";
        }
        catch {
            if (destroyed || request.signal.aborted)
                return;
            // A failed reload keeps an existing conversation on screen; only an empty one errors out.
            state = messages.length === 0 ? "error" : "ready";
        }
        try {
            const nextMeta = await options.transport.meta?.(request.signal, conversationId);
            if (nextMeta && !destroyed && !request.signal.aborted) {
                meta = adoptMeta(nextMeta);
                // Meta belongs to the loaded conversation; "past" means it is not the
                // visitor's latest chat.
                viewingPast = Boolean(nextMeta.conversationId &&
                    nextMeta.latestConversationId &&
                    nextMeta.conversationId !== nextMeta.latestConversationId);
            }
        }
        catch {
            // Meta is best-effort: the transcript already rendered.
        }
        render();
    }
    async function transmit(message) {
        if (messages.some((item) => item.id === message.id && item.delivery === "sending"))
            return;
        const pending = { ...message, delivery: "sending" };
        messages = [...messages.filter((item) => item.id !== message.id), pending];
        render();
        body.scrollTop = body.scrollHeight;
        try {
            const accepted = message.presetQuestion && options.transport.sendPreset
                ? await options.transport.sendPreset(message.presetQuestion, message.id, abort.signal)
                : await options.transport.send({ id: message.id, body: message.body, attachment: message.attachment }, abort.signal);
            if (destroyed)
                return;
            const confirmed = Array.isArray(accepted) ? accepted : [accepted];
            const ids = new Set([message.id, ...confirmed.map((item) => item.id)]);
            messages = messages.filter((item) => !ids.has(item.id));
            messages.push(...confirmed.map((item) => ({ ...item, delivery: "sent" })));
            historyFetchedAt = 0;
            live.textContent = "Message sent.";
            // The server may have inserted the one-time topic prompt with this send;
            // an immediate poll surfaces it without waiting for the timer.
            options.transport.pollNow?.();
        }
        catch {
            if (destroyed)
                return;
            messages = messages.map((item) => item.id === message.id ? { ...item, delivery: "failed" } : item);
            live.textContent = "Message could not be sent. Use Retry to send it again.";
        }
        messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        render();
    }
    async function selectTopic(tag) {
        const transport = options.transport;
        if (!transport.selectTopic || !meta || state !== "ready")
            return;
        const ackId = meta.conversationId ? `topic-ask-ack-${meta.conversationId}` : "";
        // Keep the optimistic confirmation after the newest known message even if
        // this browser's clock is behind the server's.
        const newestKnown = messages.reduce((latest, message) => {
            const time = Date.parse(message.createdAt);
            return Number.isFinite(time) && time > latest ? time : latest;
        }, 0);
        const optimisticAck = ackId
            ? {
                id: ackId,
                author: "agent",
                body: TOPIC_ACK,
                createdAt: new Date(Math.max(Date.now(), newestKnown + 1)).toISOString(),
                isAutomated: true,
                delivery: "sent",
            }
            : null;
        // Remove the card and show the confirmation in the same frame; the server
        // upserts the same id, so the next poll replaces this copy with the saved row.
        topicPending = tag;
        if (topicPendingTimer)
            window.clearTimeout(topicPendingTimer);
        topicPendingTimer = window.setTimeout(clearTopicPending, 8000);
        meta = { ...meta, conversationTags: [...(meta.conversationTags ?? []), tag] };
        if (optimisticAck) {
            messages = [...messages.filter((message) => message.id !== ackId), optimisticAck]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        }
        render();
        try {
            await transport.selectTopic(tag);
            live.textContent = `Topic saved: ${tag}.`;
            transport.pollNow?.();
        }
        catch {
            clearTopicPending();
            if (optimisticAck) {
                messages = messages.filter((message) => message.id !== optimisticAck.id);
            }
            if (meta) {
                meta = {
                    ...meta,
                    conversationTags: (meta.conversationTags ?? []).filter((value) => value !== tag),
                };
            }
            live.textContent = "Could not save the topic. Try again.";
            render();
        }
    }
    function markRead() {
        options.transport.markRead?.();
    }
    function loadHistory(force) {
        if (!options.transport.history)
            return;
        // Reuse recent history when the visitor switches views.
        if (!force && Date.now() - historyFetchedAt < 30000) {
            render();
            return;
        }
        if (historyItems.length === 0)
            historyLoading = true;
        render();
        void options.transport
            .history(historyAbort.signal)
            .then((items) => {
            if (destroyed)
                return;
            historyItems = items;
            historyLoading = false;
            historyFetchedAt = Date.now();
            render();
        })
            .catch(() => {
            historyLoading = false;
            render();
        });
    }
    function showHistory() {
        if (!options.transport.history)
            return;
        view = "history";
        loadHistory(false);
    }
    async function openConversation(id) {
        view = "chat";
        clearTopicPending();
        // Never merge two transcripts: clear before loading the selected one.
        messages = [];
        meta = null;
        options.transport.setConversation?.(id);
        await reload(id);
        // Viewing a past chat must not mark the current one read.
        if (!viewingPast)
            markRead();
    }
    async function startNew() {
        if (startingNew)
            return;
        startingNew = true;
        const previousView = view;
        const previousMessages = messages;
        const previousMeta = meta;
        const previousViewingPast = viewingPast;
        const previousFirstChatStarted = firstChatStarted;
        const previousPendingAttachment = pendingAttachment;
        const previousInput = input.value;
        clearTopicPending();
        firstChatStarted = false;
        pendingAttachment = null;
        input.value = "";
        input.style.height = "auto";
        loadAbort?.abort();
        // Leave the ended/history screen immediately and show the loader — never sit
        // on the old view while the request runs.
        view = "chat";
        messages = [];
        meta = null;
        state = "loading";
        render();
        try {
            if (options.transport.startConversation) {
                const conversationId = await options.transport.startConversation();
                historyFetchedAt = 0;
                viewingPast = false;
                meta = previousMeta ? {
                    ...previousMeta,
                    conversationId,
                    latestConversationId: conversationId,
                    status: "open",
                    csat: null,
                    agentLastReadAt: null,
                    agentTyping: false,
                    typingAgent: null,
                    agentsViewing: [],
                    conversationTags: [],
                } : null;
                state = "ready";
                options.transport.setConversation?.(conversationId);
            }
            else {
                // Local demo: no backend row — just clear this tab's transcript.
                state = "ready";
                viewingPast = false;
            }
            input.focus();
        }
        catch {
            view = previousView;
            messages = previousMessages;
            meta = previousMeta;
            viewingPast = previousViewingPast;
            firstChatStarted = previousFirstChatStarted;
            pendingAttachment = previousPendingAttachment;
            input.value = previousInput;
            input.style.height = "auto";
            input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
            state = "ready";
            live.textContent = "Could not start a new conversation. Try again.";
        }
        finally {
            startingNew = false;
            render();
        }
    }
    async function rate(value) {
        // Optimistic: the thanks state must be instant; the write is background.
        const previous = meta?.csat ?? null;
        csatPending = value;
        if (csatPendingTimer)
            window.clearTimeout(csatPendingTimer);
        csatPendingTimer = window.setTimeout(() => {
            csatPending = null;
        }, 5000);
        if (meta)
            meta = { ...meta, csat: value };
        render();
        try {
            await options.transport.rate?.(value);
        }
        catch {
            csatPending = null;
            if (meta)
                meta = { ...meta, csat: previous };
            live.textContent = "Could not save your rating.";
            render();
        }
        options.transport.pollNow?.();
    }
    // Visitor typing is throttled to one POST per 2s and cleared after 3s idle.
    function signalTyping() {
        const transport = options.transport;
        if (!transport.setTyping)
            return;
        const now = Date.now();
        if (now - typingSentAt > 2000) {
            typingSentAt = now;
            transport.setTyping(true);
        }
        if (typingClear)
            window.clearTimeout(typingClear);
        typingClear = window.setTimeout(() => {
            typingSentAt = 0;
            transport.setTyping?.(false);
        }, 3000);
    }
    function setMaximized(next) {
        maximized = next;
        widget.dataset.maximized = String(next);
        expandButton.innerHTML = icon(next ? "shrink" : "expand");
        expandButton.setAttribute("aria-label", next ? "Minimize chat" : "Maximize chat");
        homeButton.setAttribute("aria-label", next ? "Restore size" : "Close chat");
    }
    function close() {
        opened = false;
        if (maximized)
            setMaximized(false);
        panel.hidden = true;
        // Rebuild the launcher art (fresh <img> so a previously failed load retries
        // instead of sticking on the fallback glyph forever). replaceChildren also
        // clears the X icon: reveal() only sets it once the deferred unhide runs,
        // so a close during the art wait restores the art here.
        launcher.replaceChildren(art());
        launcher.setAttribute("aria-expanded", "false");
        closePresetMenu(true);
        syncLauncher();
        options.transport.setOpen?.(false);
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
            returnFocus.focus({ preventScroll: true });
        else
            launcher.focus({ preventScroll: true });
    }
    function syncLauncher() {
        badge.hidden = unread === 0;
        badge.textContent = unread > 9 ? "9+" : String(unread);
        launcher.setAttribute("aria-label", opened ? "Close support chat" : unread > 0 ? `Open support chat, ${unread} unread ${unread === 1 ? "message" : "messages"}` : "Open support chat");
    }
    function removeNotice(card) {
        const timer = noticeTimers.get(card);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            noticeTimers.delete(card);
        }
        noticeIds.delete(card.dataset.messageId ?? "");
        card.remove();
    }
    function clearNotices() {
        for (const card of [...notices.children]) {
            if (card instanceof HTMLElement)
                removeNotice(card);
        }
    }
    // A reply that lands while the panel is closed gets a badge on the launcher and a
    // preview card above it — at most three, newest nearest the launcher.
    function pushNotice(message) {
        if (noticeIds.has(message.id))
            return;
        noticeIds.add(message.id);
        const card = element("div", "notice");
        card.dataset.messageId = message.id;
        const openNotice = element("button", "notice-open");
        openNotice.type = "button";
        openNotice.setAttribute("aria-label", `Open chat: ${message.authorName ?? "Support"} replied`);
        const name = element("span", "notice-name");
        name.textContent = message.authorName ?? "Support";
        const body = element("span", "notice-body");
        body.textContent = message.body.trim() || "New message";
        openNotice.append(name, body);
        openNotice.addEventListener("click", open);
        const dismiss = element("button", "notice-close");
        dismiss.type = "button";
        dismiss.setAttribute("aria-label", "Dismiss notification");
        dismiss.innerHTML = icon("close");
        dismiss.addEventListener("click", () => removeNotice(card));
        card.append(openNotice, dismiss);
        notices.append(card);
        noticeTimers.set(card, window.setTimeout(() => removeNotice(card), 6000));
        // Only three at once: the oldest leaves when a fourth arrives.
        while (notices.children.length > MAX_NOTICES) {
            const oldest = notices.firstElementChild;
            if (!(oldest instanceof HTMLElement))
                break;
            removeNotice(oldest);
        }
    }
    // D50: optional welcome alert. Same card and badge as an unread reply, but
    // no sound, a generic preview, and it runs once per visitor.
    function welcomeAlreadySeen() {
        if (!options.welcomeStorageKey)
            return false;
        try {
            return window.localStorage.getItem(options.welcomeStorageKey) === "1";
        }
        catch {
            return false;
        }
    }
    function markWelcomeSeen() {
        if (!options.welcomeStorageKey)
            return;
        try {
            window.localStorage.setItem(options.welcomeStorageKey, "1");
        }
        catch {
            // Blocked storage: the in-memory flag still prevents repeats this mount.
        }
    }
    function pushWelcomeNotice() {
        if (welcomeNotified || welcomeAlreadySeen())
            return;
        welcomeNotified = true;
        markWelcomeSeen();
        // Same badge behaviour as an unread reply. Opening the panel clears it.
        unread += 1;
        syncLauncher();
        const card = element("div", "notice");
        card.dataset.messageId = "welcome";
        const openNotice = element("button", "notice-open");
        openNotice.type = "button";
        openNotice.setAttribute("aria-label", "Open chat: you have an unread notification");
        const body = element("span", "notice-body");
        body.textContent = "You have an unread notification.";
        openNotice.append(body);
        openNotice.addEventListener("click", open);
        const dismiss = element("button", "notice-close");
        dismiss.type = "button";
        dismiss.setAttribute("aria-label", "Dismiss notification");
        dismiss.innerHTML = icon("close");
        dismiss.addEventListener("click", () => removeNotice(card));
        card.append(openNotice, dismiss);
        notices.append(card);
        noticeTimers.set(card, window.setTimeout(() => removeNotice(card), 6000));
        while (notices.children.length > MAX_NOTICES) {
            const oldest = notices.firstElementChild;
            if (!(oldest instanceof HTMLElement))
                break;
            removeNotice(oldest);
        }
    }
    function announce(message) {
        unread += 1;
        syncLauncher();
        pushNotice(message);
        options.onNotify?.(message);
    }
    function reveal() {
        if (destroyed || opened)
            return;
        returnFocus = document.activeElement === host ? shadow.activeElement : document.activeElement;
        opened = true;
        if (meta?.welcomeNotify)
            markWelcomeSeen();
        panel.hidden = false;
        launcher.innerHTML = icon("close");
        launcher.setAttribute("aria-expanded", "true");
        unread = 0;
        clearNotices();
        syncLauncher();
        markRead();
        options.transport.setOpen?.(true);
        expandButton.focus({ preventScroll: true });
    }
    function open() {
        if (destroyed || opened)
            return;
        // Reveal in the same frame as the click. The transcript is prefetched at
        // mount, so this is normally already loaded; if the request is still in
        // flight the panel opens on its loader instead of leaving the visitor
        // staring at a launcher that swallowed their click.
        if (state === "idle")
            void reload();
        reveal();
    }
    launcher.addEventListener("click", () => opened ? close() : open());
    homeButton.addEventListener("click", () => {
        // History lives on the left brand button (no separate clock) — D33.
        if (options.transport.history) {
            if (view === "history") {
                view = "chat";
                // Returning from history reopens the live conversation, not the last
                // transcript that was being read.
                if (viewingPast) {
                    options.transport.setConversation?.(null);
                    void reload();
                }
                else
                    render();
            }
            else {
                showHistory();
            }
            return;
        }
        if (maximized)
            setMaximized(false);
        else
            close();
    });
    expandButton.addEventListener("click", () => setMaximized(!maximized));
    newChatButton.addEventListener("click", () => void startNew());
    endedNew.addEventListener("click", () => void startNew());
    csatGood.addEventListener("click", () => void rate("good"));
    csatBad.addEventListener("click", () => void rate("bad"));
    attachButton.addEventListener("click", () => attachInput.click());
    attachInput.addEventListener("change", () => {
        const file = attachInput.files?.[0];
        attachInput.value = "";
        if (!file || !options.transport.upload)
            return;
        uploading = true;
        render();
        void options.transport
            .upload(file)
            .then((attachment) => {
            if (destroyed)
                return;
            pendingAttachment = attachment;
            uploading = false;
            render();
        })
            .catch(() => {
            uploading = false;
            live.textContent = "Could not upload that file.";
            render();
        });
    });
    reloadButton.addEventListener("click", () => void reload());
    shadow.addEventListener("keydown", (event) => {
        if (!(event instanceof KeyboardEvent) || event.key !== "Escape" || !opened)
            return;
        event.preventDefault();
        if (emailCardOpen) {
            emailCardOpen = false;
            render();
            emailTrigger.focus();
            return;
        }
        if (maximized) {
            setMaximized(false);
            return;
        }
        close();
    });
    // Keep Tab inside the open panel; the launcher stays reachable as the exit.
    panel.addEventListener("keydown", (event) => {
        if (!opened || event.key !== "Tab")
            return;
        const focusable = [...panel.querySelectorAll("button:not([disabled]), textarea:not([disabled]), input:not([disabled])")].filter((node) => !node.closest("[hidden]"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last)
            return;
        const active = shadow.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    });
    input.addEventListener("input", () => {
        signalTyping();
        presetMenuDismissed = false;
        presetMenuIndex = 0;
        renderPresetMenu();
        send.disabled = state !== "ready" || (!input.value.trim() && !pendingAttachment);
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    });
    input.addEventListener("keydown", (event) => {
        if (!presetMenu.hidden && presetMenuItems.length > 0) {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                presetMenuIndex = (presetMenuIndex + 1) % presetMenuItems.length;
                renderPresetMenu();
                return;
            }
            if (event.key === "ArrowUp") {
                event.preventDefault();
                presetMenuIndex = (presetMenuIndex - 1 + presetMenuItems.length) % presetMenuItems.length;
                renderPresetMenu();
                return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const preset = presetMenuItems[presetMenuIndex];
                if (preset)
                    applyPreset(preset);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closePresetMenu(true);
                return;
            }
        }
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    firstChat.addEventListener("click", () => {
        firstChatStarted = true;
        render();
        input.focus();
    });
    emailTrigger.addEventListener("click", () => {
        emailCardOpen = true;
        render();
        emailInput.focus();
    });
    emailPrompt.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        if (!email || !emailInput.checkValidity()) {
            emailInput.focus();
            return;
        }
        emailPromptDone = true;
        emailCardOpen = false;
        render();
        const request = options.transport.identifyEmail?.(email);
        if (request) {
            void request.catch(() => {
                emailPromptDone = false;
                emailCardOpen = true;
                live.textContent = "Could not save your email.";
                render();
            });
        }
        input.focus();
    });
    emailDismiss.addEventListener("click", () => {
        emailCardOpen = false;
        render();
        emailTrigger.focus();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        const attachment = pendingAttachment;
        if ((!text && !attachment) || state !== "ready" || meta?.status === "closed" || viewingPast)
            return;
        input.value = "";
        input.style.height = "auto";
        pendingAttachment = null;
        closePresetMenu(true);
        void transmit({
            id: uid(),
            author: "visitor",
            body: text,
            createdAt: new Date().toISOString(),
            delivery: "sending",
            attachment: attachment ?? undefined,
        });
        input.focus();
    });
    const unsubscribe = options.transport.subscribe?.((message) => {
        if (destroyed || startingNew)
            return;
        messages = [...messages.filter((item) => item.id !== message.id), { ...message, delivery: "sent" }];
        messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        render();
        if (message.author === "agent") {
            live.textContent = `${message.authorName ?? "Support"}: ${message.body}`;
            if (!opened)
                announce(message);
            else
                markRead();
        }
    }, (nextMeta) => {
        if (destroyed || startingNew)
            return;
        // With conversation pinning this meta always belongs to the screen,
        // including a past transcript, so presence dots keep updating there too.
        meta = adoptMeta(nextMeta);
        render();
    });
    const onVisibility = () => {
        if (document.visibilityState === "visible" && opened)
            options.transport.pollNow?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    render();
    // Prefetch at mount while the panel is still closed. The first click then
    // reveals a ready transcript instead of waiting on a cold request, and the
    // same response carries the optional welcome notification (D50) — one round
    // trip replaces the old meta-only probe.
    void reload().then(() => {
        if (destroyed || !meta)
            return;
        if (opened) {
            // They have already seen the widget/welcome; never notify later.
            if (meta.welcomeNotify)
                markWelcomeSeen();
            return;
        }
        if (!meta.welcomeNotify || !meta.welcomeMessage?.trim())
            return;
        pushWelcomeNotice();
    });
    const handle = {
        open, close, reload,
        setSize(next) {
            widget.dataset.size = next;
        },
        destroy() {
            destroyed = true;
            abort.abort();
            loadAbort?.abort();
            historyAbort.abort();
            if (typingClear)
                window.clearTimeout(typingClear);
            if (csatPendingTimer)
                window.clearTimeout(csatPendingTimer);
            clearTopicPending();
            closeTopicMenu?.();
            closeTopicMenu = null;
            document.removeEventListener("visibilitychange", onVisibility);
            unsubscribe?.();
            clearNotices();
            if (ownedFont)
                document.fonts.delete(ownedFont);
            host.remove();
            instances.delete(target);
        },
    };
    instances.set(target, handle);
    return handle;
}
