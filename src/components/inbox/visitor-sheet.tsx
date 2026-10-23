"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Calendar,
  ChevronDown,
  Clock,
  Globe,
  Link2,
  Mail,
  MapPin,
  MessagesSquare,
  MonitorSmartphone,
  Plus,
  X,
} from "lucide-react";
import { DashboardButton, DashboardPopover, DashboardPopoverContent, DashboardPopoverTrigger } from "@/components/block/dashboard-shell";
import { cn } from "@/lib/utils";
import type { Visitor } from "@/lib/mock-data";
import { VisitorAvatar } from "./visitor-avatar";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function VisitorSheet({
  visitor,
  tags,
  availableTags = [],
  csat,
  open,
  onClose,
  onAddTag,
}: {
  visitor: Visitor;
  /** Conversation tags, when the sheet is opened from a conversation. */
  tags?: string[];
  /** Site tags that can still be attached to this conversation. */
  availableTags?: string[];
  csat?: "good" | "bad";
  open: boolean;
  onClose: () => void;
  onAddTag?: (tag: string) => void;
}) {
  const reduceMotion = !!useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const unassignedTags = onAddTag
    ? availableTags.filter(
        (tag) =>
          !(tags ?? []).some((existing) => existing.toLowerCase() === tag.toLowerCase()),
      )
    : [];

  // Opening the sheet moves focus to its close button; Escape and the backdrop return it.
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
            className="absolute inset-0 z-20 bg-black/40"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${visitor.name} profile`}
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE_OUT }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
              }
            }}
            className="absolute inset-y-0 right-0 z-30 flex w-[368px] max-w-[92%] flex-col border-l border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-background) shadow-[-18px_0_44px_rgb(0_0_0/0.4)]"
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-(--obsidian-dashboard-shell-border) px-4 py-4">
              <span className="relative shrink-0">
                <VisitorAvatar name={visitor.name} size="lg" />
                {visitor.flag ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-(--obsidian-dashboard-shell-background) text-[11px] leading-none"
                  >
                    {visitor.flag}
                  </span>
                ) : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="truncate text-[15px] font-semibold leading-5">{visitor.name}</p>
                {visitor.flag || visitor.country ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) px-1.5 py-0.5 text-[11.5px] leading-4">
                    {visitor.flag ? <span aria-hidden>{visitor.flag}</span> : null}
                    {visitor.country ? <span className="truncate">{visitor.country}</span> : null}
                  </span>
                ) : null}
              </div>
              <DashboardButton ref={closeRef} variant="ghost" size="icon" aria-label="Close profile" onClick={onClose}>
                <X aria-hidden />
              </DashboardButton>
            </header>

            <div className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto">
              <SheetSection title="Details">
                <InfoRow icon={Mail}>{visitor.email || "No email yet"}</InfoRow>
                {visitor.timezone ? <InfoRow icon={Clock}>{visitor.timezone}</InfoRow> : null}
                <InfoRow icon={Calendar}>First seen {visitor.firstSeen}</InfoRow>
                <InfoRow icon={MessagesSquare}>
                  {visitor.sessionCount} {visitor.sessionCount === 1 ? "session" : "sessions"}
                </InfoRow>
                {visitor.currentPage ? (
                  <InfoRow icon={Link2}>
                    <span className="font-mono text-[11.5px]">{visitor.currentPage}</span>
                  </InfoRow>
                ) : null}
              </SheetSection>

              {visitor.browser || visitor.os ? (
                <SheetSection title="Visitor device">
                  {visitor.browser ? <InfoRow icon={Globe}>{visitor.browser}</InfoRow> : null}
                  {visitor.os ? <InfoRow icon={MonitorSmartphone}>{visitor.os}</InfoRow> : null}
                </SheetSection>
              ) : null}

              {visitor.journey.length > 0 ? (
                <SheetSection title="Journey">
                  <ol className="relative flex flex-col gap-3 pl-4">
                    <span aria-hidden className="absolute bottom-1.5 left-[3px] top-1.5 w-px bg-(--obsidian-dashboard-shell-border)" />
                    {visitor.journey.map((step, index) => {
                    const isLast = index === visitor.journey.length - 1;
                    return (
                      <li key={step.id} className="relative">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -left-4 top-[5px] size-[7px] rounded-full",
                            isLast ? "bg-(--obsidian-dashboard-shell-accent)" : "bg-(--obsidian-dashboard-shell-border-strong)",
                          )}
                        />
                        {isLast && (
                          <span aria-hidden className="absolute -left-4 top-[5px] size-[7px] animate-ping rounded-full bg-(--obsidian-dashboard-shell-accent)" />
                        )}
                        <p className="text-[12px] leading-4 text-(--obsidian-dashboard-shell-foreground)">{step.label}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                          <span className="truncate font-mono">{step.path}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0 tabular-nums">{step.at}</span>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </SheetSection>
              ) : null}

              {((tags?.length ?? 0) > 0 || onAddTag) && (
                <SheetSection title="Tags">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[11px] leading-4 text-amber-300"
                      >
                        {tag}
                      </span>
                    ))}
                    {onAddTag && (
                      <DashboardPopover>
                        <DashboardPopoverTrigger asChild>
                          <button
                            type="button"
                            className="rounded-md border border-dashed border-(--obsidian-dashboard-shell-border-strong) px-1.5 py-0.5 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle) outline-none transition-colors hover:text-(--obsidian-dashboard-shell-foreground) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)"
                          >
                            <Plus aria-hidden className="mr-1 inline size-3" />
                            Add tag
                          </button>
                        </DashboardPopoverTrigger>
                        <DashboardPopoverContent align="end" className="w-48">
                          {unassignedTags.length > 0 ? (
                            <ul className="flex max-h-40 flex-col overflow-y-auto">
                              {unassignedTags.map((tag) => (
                                <li key={tag}>
                                  <button
                                    type="button"
                                    onClick={() => onAddTag(tag)}
                                    className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-(--obsidian-dashboard-shell-text-muted) transition-colors hover:bg-(--obsidian-dashboard-shell-menu-highlight) hover:text-(--obsidian-dashboard-shell-foreground)"
                                  >
                                    {tag}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-2.5 py-1.5 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                              {availableTags.length === 0
                                ? "No tags yet."
                                : "All tags are already attached."}
                            </p>
                          )}
                          <div className="mt-1 border-t border-(--obsidian-dashboard-shell-border) pt-1">
                            <Link
                              href="/dashboard/settings"
                              className="block rounded-md px-2.5 py-1.5 text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle) transition-colors hover:bg-(--obsidian-dashboard-shell-menu-highlight) hover:text-(--obsidian-dashboard-shell-foreground)"
                            >
                              Manage tags in Settings
                            </Link>
                          </div>
                        </DashboardPopoverContent>
                      </DashboardPopover>
                    )}
                  </div>
                </SheetSection>
              )}

              {csat && (
                <SheetSection title="Rating">
                  <div className="flex items-center gap-2.5 rounded-lg border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-muted) p-2.5">
                    <span aria-hidden className="text-base leading-none">
                      {csat === "good" ? "👍" : "👎"}
                    </span>
                    <span className="text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-text-muted)">
                      The visitor rated this conversation{" "}
                      <span className="text-(--obsidian-dashboard-shell-foreground)">{csat === "good" ? "Good" : "Bad"}</span>
                    </span>
                  </div>
                </SheetSection>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <section className="border-b border-(--obsidian-dashboard-shell-border) last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left outline-none transition-colors hover:bg-(--obsidian-dashboard-shell-hover) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) focus-visible:ring-inset"
      >
        <span className="text-xs font-medium text-(--obsidian-dashboard-shell-foreground)">{title}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto size-3.5 shrink-0 text-(--obsidian-dashboard-shell-text-subtle) transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-2.5 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] leading-5 text-(--obsidian-dashboard-shell-foreground)">
      <Icon aria-hidden className="size-4 shrink-0 text-(--obsidian-dashboard-shell-text-muted)" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
