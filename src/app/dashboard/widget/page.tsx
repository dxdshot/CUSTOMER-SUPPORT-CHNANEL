"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, RotateCcw } from "lucide-react";
import { play } from "cuelume";
import { AppShell } from "@/components/app-shell";
import { DashboardButton } from "@/components/block/dashboard-shell";
import { DEMO_SITE_KEY } from "@/lib/conversations";
import { useAgentProfile } from "@/lib/agent-profile";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_WELCOME, presetMessages, widgetSize } from "@/lib/widget-copy";
import { mountChatWidget, type WidgetHandle, type WidgetMessage } from "@/widget/widget";
import { WIDGET_RELEASE } from "@/widget/version";
import type { PresetReply, WidgetMeta, WidgetSize } from "@/widget/types";

const WIDGET_ORIGIN = (process.env.NEXT_PUBLIC_WIDGET_ORIGIN || "https://support-widget-six.vercel.app").replace(/\/+$/, "");
const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const WIDGET_SIZES: {
  value: WidgetSize;
  label: string;
  size: number;
}[] = [
  { value: "sm", label: "Small", size: 44 },
  { value: "md", label: "Medium", size: 50 },
  { value: "lg", label: "Large", size: 56 },
];

export default function WidgetPage() {
  const profile = useAgentProfile();
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const widget = useRef<WidgetHandle | null>(null);
  const previewTarget = useRef<HTMLDivElement>(null);
  const loadDelay = useRef(false);
  const receive = useRef<((message: WidgetMessage) => void) | null>(null);
  const history = useRef<WidgetMessage[]>([]);
  const presetReplies = useRef<PresetReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");

  const [siteKey, setSiteKey] = useState(DEMO_SITE_KEY);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<WidgetSize>("lg");
  const [sizeError, setSizeError] = useState(false);
  const activeSize = WIDGET_SIZES.find((option) => option.value === size) ?? WIDGET_SIZES[2];
  const snippet = `<script src="${WIDGET_ORIGIN}/widget/embed.js?v=${WIDGET_RELEASE.assets}" async\n  data-site="${escapeAttribute(siteKey)}"\n  data-size="${size}"\n  data-color="#2563eb"></script>`;

  function chooseSize(next: WidgetSize) {
    setSize(next);
    widget.current?.setSize(next);
    const client = getSupabase();
    if (!client) return;
    void client
      .from("sites")
      .update({ widget_size: next })
      .eq("site_key", DEMO_SITE_KEY)
      .then(({ error }) => setSizeError(Boolean(error)));
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const area = document.createElement("textarea");
      area.value = snippet;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    const target = previewTarget.current;
    if (!target) return;
    const handle = mountChatWidget({
      target,
      assetUrl: "/widget/textbox-160.png",
      onNotify() {
        // Cuelume: "ready" is the cue for "a result is there"; the "press" theme gives it
        // the click over a deep, ringing note.
        play("ready", { theme: "press" });
      },
      transport: {
        async meta() {
          const profile = profileRef.current;
          const client = getSupabase();
          const primary = await (client?.from("sites")
            .select("welcome_message, preset_messages, widget_size")
            .eq("site_key", DEMO_SITE_KEY)
            .maybeSingle() ?? Promise.resolve({ data: null }));
          let data: {
            welcome_message?: string | null;
            preset_messages?: unknown;
            widget_size?: string | null;
          } | null = primary.data;
          if (!data && client) {
            // Pre-D59 installs: keep the preview working without the size column.
            const retry = await client
              .from("sites")
              .select("welcome_message, preset_messages")
              .eq("site_key", DEMO_SITE_KEY)
              .maybeSingle();
            data = retry.data;
          }
          presetReplies.current = presetMessages(data?.preset_messages);
          return {
            conversationId: null,
            latestConversationId: null,
            status: "open",
            agentLastReadAt: null,
            agentTyping: false,
            typingAgent: null,
            onlineAgents: [{ id: profile.id, name: profile.name, avatar: profile.avatarUrl }],
            supportAgent: { id: profile.id, name: profile.name, avatar: profile.avatarUrl },
            online: true,
            awayMessage: profile.awayMessage,
            welcomeMessage: data?.welcome_message || DEFAULT_WELCOME,
            welcomeNotify: false,
            widgetSize: widgetSize(data?.widget_size),
            presetMessages: presetReplies.current,
            topicOptions: [],
            conversationTags: [],
            csat: null,
            visitorName: null,
            visitorEmail: null,
            identified: true,
            agentsViewing: [],
          } satisfies WidgetMeta;
        },
        async load(signal) {
          if (loadDelay.current) {
            loadDelay.current = false;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, 1800);
              signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
              }, { once: true });
            });
          }
          return [...history.current];
        },
        async send(message) {
          const existing = history.current.find((item) => item.id === message.id);
          if (existing) return existing;
          const accepted: WidgetMessage = { ...message, author: "visitor", createdAt: new Date().toISOString() };
          history.current.push(accepted);
          return accepted;
        },
        async sendPreset(question, id) {
          const preset = presetReplies.current.find((item) => item.question === question && item.answer);
          if (!preset) throw new Error("Preset reply is unavailable");
          const existing = history.current.find((item) => item.id === id);
          const answer = history.current.find((item) => item.id === `preset-${id}`);
          if (existing && answer) return [existing, answer] as [WidgetMessage, WidgetMessage];
          const sent: WidgetMessage = { id, author: "visitor", body: question, createdAt: new Date().toISOString() };
          const reply: WidgetMessage = { id: `preset-${id}`, author: "agent", body: preset.answer,
            authorName: "Widget", isAutomated: true, createdAt: new Date(Date.now() + 1).toISOString() };
          history.current.push(sent, reply);
          return [sent, reply] as [WidgetMessage, WidgetMessage];
        },
        subscribe(callback) {
          receive.current = callback;
          return () => { receive.current = null; };
        },
      },
    });
    widget.current = handle;
    handle.open();
    return () => {
      handle.destroy();
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;
    void client
      .from("sites")
      .select("widget_size")
      .eq("site_key", DEMO_SITE_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        const next = widgetSize(data?.widget_size);
        setSize(next);
        widget.current?.setSize(next);
      });
    return () => {
      active = false;
    };
  }, []);

  async function replayLoading() {
    const handle = widget.current;
    if (!handle || loading) return;
    setLoading(true);
    loadDelay.current = true;
    // Close first: this is the "first open" loading state — it shows on the launcher while
    // the panel waits, then the panel opens once the conversation has loaded.
    handle.close();
    await handle.reload();
    handle.open();
    setLoading(false);
  }

  function sendReply(event: React.FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;
    const message: WidgetMessage = {
      id: crypto.randomUUID(),
      author: "agent",
      authorName: profileRef.current.name,
      authorAvatar: profileRef.current.avatarUrl || undefined,
      body,
      createdAt: new Date().toISOString(),
    };
    history.current.push(message);
    receive.current?.(message);
    setReply("");
  }

  return (
    <AppShell title="Widget">
      <div className="obsidian-dashboard-shell-scroll h-full overflow-y-auto px-4 py-6 md:px-8 md:py-10">
        <div className="max-w-lg pb-24 min-[1100px]:pr-4">
          <h1 className="text-xl font-medium tracking-tight">Install widget</h1>
          <div className="mt-4 space-y-3 rounded-xl border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-control) p-4">
            <div className="grid gap-3">
              <label className="block text-xs">
                <span className="mb-1.5 block font-medium">Site key</span>
                <input
                  value={siteKey}
                  onChange={(event) => setSiteKey(event.target.value.trim())}
                  spellCheck={false}
                  className="w-full rounded-lg border border-(--obsidian-dashboard-shell-border-strong) bg-transparent px-2.5 py-2 font-mono text-[11px] outline-none focus:border-(--obsidian-dashboard-shell-ring)"
                />
              </label>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-(--obsidian-dashboard-shell-border) bg-black/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre">{snippet}</pre>
            <DashboardButton variant="secondary" onClick={() => void copySnippet()} disabled={!siteKey}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? "Copied" : "Copy snippet"}
            </DashboardButton>
          </div>
          <div className="mt-9 border-t border-(--obsidian-dashboard-shell-border) pt-6">
            <h2 className="text-xl font-medium tracking-tight">Preview widget</h2>
            <div className="mt-4 rounded-xl border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-control) p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Widget size</p>
                  <p className="mt-1 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                    Sets the floating launcher size below and everywhere the widget is embedded.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) px-2 py-1 font-mono text-[10px] leading-none text-(--obsidian-dashboard-shell-text-subtle)">
                  {activeSize.size}px
                </span>
              </div>
              <div role="radiogroup" aria-label="Widget size" className="mt-3 grid grid-cols-3 gap-2">
                {WIDGET_SIZES.map((option) => {
                  const selected = size === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseSize(option.value)}
                      className="relative flex h-[112px] flex-col items-center justify-center gap-2.5 rounded-lg border p-2 outline-none transition-[border-color,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)"
                      style={{
                        borderColor: selected
                          ? "var(--obsidian-dashboard-shell-accent)"
                          : "var(--obsidian-dashboard-shell-border)",
                        background: selected
                          ? "color-mix(in srgb, var(--obsidian-dashboard-shell-accent) 9%, var(--obsidian-dashboard-shell-control))"
                          : "transparent",
                      }}
                    >
                      <span
                        aria-hidden
                        className="grid place-items-center rounded-full shadow-[0_10px_24px_-12px_rgb(0_0_0/0.9)] transition-[width,height,background-color] duration-300 ease-out"
                        style={{
                          width: option.size,
                          height: option.size,
                          background: selected
                            ? "var(--obsidian-dashboard-shell-accent)"
                            : "var(--obsidian-dashboard-shell-muted)",
                          boxShadow: selected
                            ? "inset 0 0 0 1px rgba(255, 255, 255, 0.22)"
                            : "inset 0 0 0 1px var(--obsidian-dashboard-shell-border-strong)",
                        }}
                      >
                        <MessageCircle
                          aria-hidden
                          style={{
                            width: Math.round(option.size * 0.42),
                            height: Math.round(option.size * 0.42),
                            color: selected ? "#fff" : "var(--obsidian-dashboard-shell-text-subtle)",
                          }}
                        />
                      </span>
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color: selected
                            ? "var(--obsidian-dashboard-shell-foreground)"
                            : "var(--obsidian-dashboard-shell-text-subtle)",
                        }}
                      >
                        {option.label} · {option.size}px
                      </span>
                    </button>
                  );
                })}
              </div>
              {sizeError && (
                <p className="mt-2 text-[11px] leading-4 text-(--obsidian-dashboard-shell-danger)">
                  Could not sync the size. Run the widget size migration to apply it everywhere.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <DashboardButton variant="primary" onClick={() => widget.current?.open()}><MessageCircle aria-hidden />Open chat</DashboardButton>
              <DashboardButton variant="secondary" onClick={() => void replayLoading()} disabled={loading}><RotateCcw aria-hidden />{loading ? "Showing loading state" : "Preview loading"}</DashboardButton>
            </div>
            <div className="mt-9 border-t border-(--obsidian-dashboard-shell-border) pt-6">
              <h3 className="text-sm font-medium">Send a preview reply</h3>
              <form onSubmit={sendReply} className="mt-3 space-y-3">
                <label htmlFor="preview-reply" className="sr-only">Support reply</label>
                <textarea id="preview-reply" rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Hi there. How can we help?" maxLength={4000} className="w-full resize-none rounded-xl border border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-control) px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-(--obsidian-dashboard-shell-text-subtle) focus:border-(--obsidian-dashboard-shell-ring)" />
                <DashboardButton type="submit" variant="primary" disabled={!reply.trim()}>Send preview reply</DashboardButton>
              </form>
            </div>
          </div>
        </div>
        <div ref={previewTarget} />
      </div>
    </AppShell>
  );
}
