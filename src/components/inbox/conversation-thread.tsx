"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCheck, ChevronLeft, FileText, MoreHorizontal, Paperclip, UserPlus, X, Zap } from "lucide-react";
import {
  DashboardButton,
  DashboardConfirmDialog,
  DashboardMenu,
  DashboardMenuContent,
  DashboardMenuItem,
  DashboardMenuSeparator,
  DashboardMenuTrigger,
  DashboardPopover,
  DashboardPopoverContent,
  DashboardPopoverTrigger,
} from "@/components/block/dashboard-shell";
import { cn } from "@/lib/utils";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import { useCannedResponses } from "@/lib/canned-store";
import { getSupabase } from "@/lib/supabase";
import { currentAgent, type CannedResponse, type Conversation, type ConversationStatus, type Message } from "@/lib/mock-data";
import { TypingDots } from "./typing-dots";
import { VisitorAvatar } from "./visitor-avatar";

const replyDrafts = new Map<string, string>();

const statusMeta: Record<ConversationStatus, { label: string; tone: string }> = {
  open: { label: "Open", tone: "text-(--obsidian-dashboard-shell-success)" },
  pending: { label: "Pending", tone: "text-(--obsidian-dashboard-shell-warning)" },
  closed: { label: "Closed", tone: "text-(--obsidian-dashboard-shell-text-subtle)" },
};

export function ConversationThread({
  conversation,
  onSend,
  onRetry,
  onTyping,
  viewers,
  onStatusChange,
  onAssign,
  onOpenProfile,
  onBack,
  className,
}: {
  conversation: Conversation;
  onSend: (body: string, attachment?: Message["attachment"]) => void;
  onRetry: (message: Message) => void;
  /** Fired while the agent types; the parent throttles the write. */
  onTyping?: () => void;
  /** Other agents with this exact conversation open right now. */
  viewers?: { id: string; name: string; avatarUrl: string }[];
  onStatusChange: (status: ConversationStatus) => void;
  onAssign: (agent: string) => void;
  /** Opens the visitor profile sheet. */
  onOpenProfile: () => void;
  /** Small screens show one pane at a time; this returns to the conversation list. */
  onBack?: () => void;
  className?: string;
}) {
  const { visitor, messages, status, typing } = conversation;
  const [draft, updateDraft] = useState(() => replyDrafts.get(conversation.id) ?? "");
  const setDraft = (update: string | ((current: string) => string)) => {
    const next = typeof update === "function" ? update(draft) : update;
    if (next) replyDrafts.set(conversation.id, next);
    else replyDrafts.delete(conversation.id);
    updateDraft(next);
  };
  const [attachment, setAttachment] = useState<Message["attachment"] | undefined>();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  // The same store the canned responses page writes through, followed live.
  const canned = useCannedResponses();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = statusMeta[status];

  // Typing "/" in the reply box opens the same list the Canned button shows,
  // filtered by whatever follows the slash.
  const commandMatch = /^\/([a-z0-9-]*)$/i.exec(draft);
  const commandQuery = commandMatch ? commandMatch[1].toLowerCase() : null;
  const matches =
    commandQuery === null
      ? []
      : canned.filter((response) => {
          const name = response.shortcut.slice(1).toLowerCase();
          return name.startsWith(commandQuery) || response.title.toLowerCase().includes(commandQuery);
        });
  const menuOpen = commandQuery !== null && !menuDismissed;

  // Keep the highlighted row inside the menu's visible height while arrowing past it.
  useEffect(() => {
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>('[data-active="true"]');
    if (!menu || !active) return;
    const menuBox = menu.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    if (activeBox.bottom > menuBox.bottom) menu.scrollTop += activeBox.bottom - menuBox.bottom;
    else if (activeBox.top < menuBox.top) menu.scrollTop -= menuBox.top - activeBox.top;
  }, [menuIndex]);

  // Chat reads bottom-up: land at the newest message, and follow new ones.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, typing]);

  const resize = () => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  };

  const submit = () => {
    const body = draft.trim();
    if (uploading || (!body && !attachment)) return;
    onSend(body, attachment);
    setDraft("");
    setMenuIndex(0);
    setAttachment(undefined);
    requestAnimationFrame(resize);
  };

  // Agent attachments upload straight to the public bucket.
  const uploadAttachment = async (file: File) => {
    const supabase = getSupabase();
    if (!supabase || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    setUploading(false);
    if (error) return;
    const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    const bytes = file.size;
    setAttachment({
      name: file.name,
      size: bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`,
      kind: file.type.startsWith("image/") ? "image" : "file",
      url: data.publicUrl,
    });
  };

  const insertCanned = (body: string) => {
    setDraft((current) => (current ? `${current}\n${body}` : body));
    setMenuIndex(0);
    requestAnimationFrame(() => {
      resize();
      inputRef.current?.focus();
    });
  };

  // A slash command is replaced by the response it names.
  const applyCanned = (response: CannedResponse) => {
    setDraft(response.body);
    setMenuIndex(0);
    setMenuDismissed(false);
    requestAnimationFrame(() => {
      resize();
      inputRef.current?.focus();
    });
  };

  return (
    <section aria-label={`Conversation with ${visitor.name}`} className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <header className="flex shrink-0 items-center gap-3 border-b border-(--obsidian-dashboard-shell-border) px-4 py-2.5">
        {onBack && (
          <DashboardButton variant="ghost" size="icon" aria-label="Back to conversations" onClick={onBack} className="-ml-1 md:hidden">
            <ChevronLeft aria-hidden />
          </DashboardButton>
        )}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`Open ${visitor.name}'s profile`}
          className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)"
        >
          <VisitorAvatar name={visitor.name} size="md" />
        </button>
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium leading-5">
          <span className="truncate">{visitor.name}</span>
          <span suppressHydrationWarning className="inline-flex shrink-0 items-center gap-1 rounded-md border border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-muted) py-[3px] pl-[3px] pr-[6px] text-[11px] leading-none">
            <span aria-hidden suppressHydrationWarning className={cn("relative flex size-3 items-center justify-center", meta.tone)}>
              <span suppressHydrationWarning className="absolute inset-0 rounded-full bg-current opacity-25" />
              <span className="size-1.5 rounded-full bg-current" />
            </span>
            {meta.label}
          </span>
          {viewers && viewers.length > 0 && (
            <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-md border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) px-1.5 py-0.5 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-muted)">
              {viewers[0].avatarUrl ? (
                <img
                  src={viewers[0].avatarUrl}
                  alt=""
                  className="size-3.5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-(--obsidian-dashboard-shell-success)" />
              )}
              <span className="max-w-32 truncate">{viewers.map((viewer) => viewer.name).join(", ")}</span>
            </span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <DashboardButton
            variant="ghost"
            size="sm"
            disabled={conversation.assignee === currentAgent}
            onClick={() => onAssign(currentAgent)}
            className="max-lg:hidden"
          >
            <UserPlus aria-hidden />
            {conversation.assignee === currentAgent ? "Assigned to you" : "Assign to me"}
          </DashboardButton>
          <DashboardMenu>
            <DashboardMenuTrigger asChild>
              <DashboardButton variant="secondary" size="icon" aria-label="Conversation actions">
                <MoreHorizontal aria-hidden />
              </DashboardButton>
            </DashboardMenuTrigger>
            <DashboardMenuContent align="end" className="min-w-48">
              <DashboardMenuItem onSelect={onOpenProfile}>Open profile</DashboardMenuItem>
              <DashboardMenuSeparator />
              <DashboardMenuItem onSelect={() => onAssign(currentAgent)}>Assign to me</DashboardMenuItem>
              <DashboardMenuItem onSelect={() => onStatusChange("pending")}>Mark as pending</DashboardMenuItem>
              <DashboardMenuSeparator />
              {status === "closed" ? (
                <DashboardMenuItem onSelect={() => onStatusChange("open")}>Reopen conversation</DashboardMenuItem>
              ) : (
                <DashboardMenuItem onSelect={() => setConfirmClose(true)}>Close conversation</DashboardMenuItem>
              )}
            </DashboardMenuContent>
          </DashboardMenu>
        </div>
      </header>

      <div ref={scrollRef} className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* The readable column keeps long lines from stretching on wide screens. */}
        <div className="w-full max-w-3xl">
          {conversation.historyLoaded === false && (
            <div className="flex justify-center py-8"><BrandSpinner label="Loading messages" /></div>
          )}
          <ol>
            {messages.map((message, index) => (
              <MessageRow key={message.id} message={message} previous={index > 0 ? messages[index - 1] : undefined} visitorName={visitor.name} onRetry={onRetry} />
            ))}
          </ol>

          {typing && (
            <div className="mt-3 flex items-center gap-2 pl-1">
              <span className="inline-flex items-center rounded-2xl rounded-bl-md bg-(--obsidian-dashboard-shell-muted) px-3 py-2 text-(--obsidian-dashboard-shell-text-muted)">
                <TypingDots />
              </span>
              <span className="text-[11.5px] text-(--obsidian-dashboard-shell-text-subtle)">{visitor.name.split(" ")[0]} is typing…</span>
            </div>
          )}
        </div>
      </div>

      <form
        className="shrink-0 border-t border-(--obsidian-dashboard-shell-border) px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative w-full max-w-3xl rounded-xl border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-control) transition-colors focus-within:border-(--obsidian-dashboard-shell-border-strong)">
          {/* Typing "/" opens the same list the Canned button shows, filtered by what follows. */}
          {menuOpen && (
            <div
              className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-[10px] bg-(--obsidian-dashboard-shell-menu) p-1 shadow-(--obsidian-dashboard-shell-menu-shadow) backdrop-blur-xl backdrop-saturate-150"
            >
              <div ref={menuRef} className="obsidian-dashboard-shell-scroll max-h-64 overflow-y-auto">
                {matches.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                    Nothing matches “{draft}”.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {matches.map((response, index) => (
                      <li key={response.id}>
                        <button
                          type="button"
                          // Keep the caret in the reply box when an item is clicked.
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyCanned(response)}
                          data-active={index === menuIndex}
                          className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-(--obsidian-dashboard-shell-menu-highlight) data-[active=true]:bg-(--obsidian-dashboard-shell-menu-highlight)"
                        >
                          <span className="font-mono text-[11px] leading-4 text-(--obsidian-dashboard-shell-accent)">{response.shortcut}</span>
                          <span className="truncate text-[11.5px] leading-snug text-(--obsidian-dashboard-shell-text-muted)">{response.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <label htmlFor="reply-box" className="sr-only">
            Reply to {visitor.name}
          </label>
          <textarea
            id="reply-box"
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={`Reply to ${visitor.name.split(" ")[0]}…`}
            onChange={(event) => {
              setDraft(event.target.value);
              setMenuIndex(0);
              setMenuDismissed(false);
              onTyping?.();
              resize();
            }}
            onBlur={() => setMenuDismissed(true)}
            onKeyDown={(event) => {
              if (menuOpen && matches.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMenuIndex((index) => (index + 1) % matches.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setMenuIndex((index) => (index - 1 + matches.length) % matches.length);
                  return;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  const response = matches[Math.min(menuIndex, matches.length - 1)];
                  if (response) applyCanned(response);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setMenuDismissed(true);
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="obsidian-dashboard-shell-scroll max-h-32 w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-relaxed outline-none placeholder:text-(--obsidian-dashboard-shell-text-subtle)"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              <DashboardButton
                variant="ghost"
                size="icon"
                aria-label={uploading ? "Uploading attachment" : "Attach a file"}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip aria-hidden />
              </DashboardButton>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadAttachment(file);
                }}
              />
              {attachment && (
                <span className="inline-flex max-w-40 items-center gap-1.5 rounded-md border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) px-2 py-1 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-muted)">
                  <FileText aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => setAttachment(undefined)}
                    className="shrink-0 rounded-sm bg-(--obsidian-dashboard-shell-remove-background) p-0.5 text-(--obsidian-dashboard-shell-remove-foreground) outline-none hover:bg-(--obsidian-dashboard-shell-remove-background-hover) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-remove-border)"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              )}
              <DashboardPopover>
                <DashboardPopoverTrigger asChild>
                  <DashboardButton variant="ghost" size="sm">
                    <Zap aria-hidden />
                    Canned
                  </DashboardButton>
                </DashboardPopoverTrigger>
                <DashboardPopoverContent align="start" side="top" className="w-72">
                  {canned.length === 0 ? (
                    <p className="px-2.5 py-2 text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                      No canned responses yet. Create one in Canned responses.
                    </p>
                  ) : (
                    <ul className="flex flex-col">
                      {canned.map((response) => (
                        <li key={response.id}>
                          <button
                            type="button"
                            onClick={() => insertCanned(response.body)}
                            className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-(--obsidian-dashboard-shell-menu-highlight)"
                          >
                            <span className="font-mono text-[11px] leading-4 text-(--obsidian-dashboard-shell-accent)">
                              {response.shortcut}
                            </span>
                            <span className="truncate text-[11.5px] leading-snug text-(--obsidian-dashboard-shell-text-muted)">
                              {response.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardPopoverContent>
              </DashboardPopover>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-(--obsidian-dashboard-shell-text-subtle) max-sm:hidden">Enter to send</span>
              <DashboardButton type="submit" variant="primary" size="icon" aria-label="Send reply" disabled={uploading || (!draft.trim() && !attachment)}>
                <ArrowUp aria-hidden />
              </DashboardButton>
            </div>
          </div>
        </div>
      </form>

      <DashboardConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close conversation with ${visitor.name}?`}
        description="The visitor sees the chat end and can start a new conversation anytime."
        confirmLabel="Close conversation"
        onConfirm={() => {
          onStatusChange("closed");
          setConfirmClose(false);
        }}
      />
    </section>
  );
}

function MessageRow({ message, previous, visitorName, onRetry }: { message: Message; previous?: Message; visitorName: string; onRetry: (message: Message) => void }) {
  const showDay = !previous || previous.day !== message.day;
  const isAgent = message.author === "agent";
  const startsRun = !previous || previous.author !== message.author;
  // The automated topic question is a prompt, not a reply: no timestamp/ticks.
  const isTopicAsk = message.id.startsWith("topic-ask-") && !message.id.startsWith("topic-ask-ack-");

  return (
    <>
      {showDay && (
        <li aria-hidden className="my-4 flex items-center gap-3 first:mt-0">
          <span className="h-px flex-1 bg-(--obsidian-dashboard-shell-border)" />
          <span className="text-xs text-(--obsidian-dashboard-shell-text-muted)">{message.day}</span>
          <span className="h-px flex-1 bg-(--obsidian-dashboard-shell-border)" />
        </li>
      )}

      {message.author === "system" ? (
        <li className="my-3 flex justify-center">
          <span className="rounded-full border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) px-2.5 py-1 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-muted)">
            {message.body}
          </span>
        </li>
      ) : (
        <li className={cn("flex", isAgent ? "justify-end" : "justify-start", startsRun ? "mt-3" : "mt-1")}>
          <div className="flex max-w-[78%] flex-col">
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                isAgent
                  ? "rounded-br-md bg-(--obsidian-dashboard-shell-accent) text-(--obsidian-dashboard-shell-accent-foreground)"
                  : "rounded-bl-md bg-(--obsidian-dashboard-shell-muted) text-(--obsidian-dashboard-shell-foreground)",
              )}
            >
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.body}</p>
              {message.attachment &&
                (message.attachment.kind === "image" && message.attachment.url ? (
                  <a href={message.attachment.url} target="_blank" rel="noopener" className="mt-2 block">
                    <img
                      src={message.attachment.url}
                      alt={message.attachment.name}
                      className="max-h-48 max-w-full rounded-lg"
                    />
                  </a>
                ) : (
                  <a
                    href={message.attachment.url ?? "#"}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-[11.5px] transition-colors hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    <FileText aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{message.attachment.name}</span>
                    <span className="shrink-0 opacity-70">{message.attachment.size}</span>
                  </a>
                ))}
              {!isTopicAsk && (
                <span
                  className={cn(
                    "mt-1 flex items-center justify-end gap-1 text-[10.5px] tabular-nums",
                    isAgent ? "text-white/70" : "text-(--obsidian-dashboard-shell-text-subtle)",
                  )}
                >
                  {message.at}
                  {isAgent && (message.delivery === "sending"
                    ? <span role="status">Sending…</span>
                    : message.delivery === "failed"
                      ? <button type="button" className="rounded-md bg-white/15 px-2 py-1 font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => onRetry(message)}>Retry sending</button>
                      : <><CheckCheck aria-hidden className={cn("size-3", message.read ? "text-white" : "text-white/45")} /><span className="sr-only">{message.read ? "Read" : "Sent"}</span></>)}
                </span>
              )}
            </div>
            <span className="sr-only">
              {isAgent ? `Reply from ${message.name ?? "Support"} to ${visitorName}` : `Sent by ${visitorName}`}
            </span>
          </div>
        </li>
      )}
    </>
  );
}
