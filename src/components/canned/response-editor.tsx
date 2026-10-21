"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { DashboardButton, DashboardConfirmDialog } from "@/components/block/dashboard-shell";
import { cn } from "@/lib/utils";
import type { CannedResponse } from "@/lib/mock-data";

const fieldClass =
  "w-full rounded-lg border border-(--obsidian-dashboard-shell-border) bg-(--obsidian-dashboard-shell-control) px-2.5 py-2 text-[12.5px] leading-5 outline-none transition-colors placeholder:text-(--obsidian-dashboard-shell-text-subtle) focus:border-(--obsidian-dashboard-shell-border-strong) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)";

export function ResponseEditor({
  response,
  isNew,
  existingShortcuts,
  onSave,
  onDelete,
  onCancel,
  onBack,
  className,
}: {
  response: CannedResponse;
  isNew: boolean;
  /** Shortcuts of every other response, for the duplicate check. */
  existingShortcuts: string[];
  onSave: (next: CannedResponse) => void;
  onDelete: () => void;
  /** Abandons a new response without saving it. */
  onCancel: () => void;
  onBack?: () => void;
  className?: string;
}) {
  // A saved response opens as a read-only summary until Edit is selected.
  const [editing, setEditing] = useState(isNew);
  const [shortcut, setShortcut] = useState(response.shortcut);
  const [title, setTitle] = useState(response.title);
  const [body, setBody] = useState(response.body);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const normalized = shortcut.trim().toLowerCase();
  const wellFormed = /^\/[a-z0-9][a-z0-9-]*$/.test(normalized);
  const duplicate = existingShortcuts.some((existing) => existing.toLowerCase() === normalized);
  // Empty fields are marked by their red box alone; the text explains a format problem.
  const shortcutError = !normalized
    ? null
    : !wellFormed
      ? "Start with a slash, then letters, numbers or dashes — like /refund."
      : duplicate
        ? "That shortcut is already in use."
        : null;
  const shortcutInvalid = !wellFormed || duplicate;
  const titleInvalid = title.trim().length === 0;
  const bodyInvalid = body.trim().length === 0;

  const complete = !shortcutInvalid && !titleInvalid && !bodyInvalid;
  const dirty = shortcut !== response.shortcut || title !== response.title || body !== response.body;
  const canSave = complete && (dirty || isNew);

  const save = () => {
    onSave({ ...response, shortcut: normalized, title: title.trim(), body: body.trim() });
    if (!isNew) setEditing(false);
  };

  const cancel = () => {
    if (isNew) {
      onCancel();
      return;
    }
    setShortcut(response.shortcut);
    setTitle(response.title);
    setBody(response.body);
    setEditing(false);
  };

  return (
    <section
      aria-label={isNew ? "New canned response" : `${response.title}, ${response.shortcut}`}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-(--obsidian-dashboard-shell-border) px-4 py-2.5">
        {onBack && (
          <DashboardButton variant="ghost" size="icon" aria-label="Back to responses" onClick={onBack} className="-ml-1 md:hidden">
            <ChevronLeft aria-hidden />
          </DashboardButton>
        )}
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium leading-5">
          <span className="truncate">{isNew ? "New response" : response.title}</span>
          {isNew ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-muted) py-[3px] pl-[3px] pr-[6px] text-[11px] leading-none">
              <span aria-hidden className="relative flex size-3 items-center justify-center text-(--obsidian-dashboard-shell-warning)">
                <span className="absolute inset-0 rounded-full bg-current opacity-25" />
                <span className="size-1.5 rounded-full bg-current" />
              </span>
              Draft
            </span>
          ) : (
            <span className="shrink-0 font-mono text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-accent)">{response.shortcut}</span>
          )}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <DashboardButton variant="secondary" size="sm" onClick={cancel}>
                Cancel
              </DashboardButton>
              <DashboardButton variant="primary" size="sm" disabled={!canSave} onClick={save}>
                {isNew && <Plus aria-hidden />}
                {isNew ? "Create" : "Save"}
              </DashboardButton>
            </>
          ) : (
            <>
              <DashboardButton variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </DashboardButton>
              <DashboardButton variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </DashboardButton>
            </>
          )}
        </div>
      </header>

      {editing ? (
        <div className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          <div className="flex w-full max-w-2xl flex-col gap-3.5">
              <Field label="Shortcut" description="Typed in the composer to insert this message." error={shortcutError}>
                <input
                  autoFocus={isNew}
                  value={shortcut}
                  onChange={(event) => setShortcut(event.target.value)}
                  placeholder="/refund"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={shortcutInvalid ? true : undefined}
                  className={cn(fieldClass, "font-mono", shortcutInvalid && "border-(--obsidian-dashboard-shell-danger)")}
                />
              </Field>

              <Field label="Title">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Refund issued"
                  aria-invalid={titleInvalid ? true : undefined}
                  className={cn(fieldClass, titleInvalid && "border-(--obsidian-dashboard-shell-danger)")}
                />
              </Field>

              <Field label="Message">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="I’ve issued the refund — it usually lands in 3–5 business days."
                  rows={5}
                  aria-invalid={bodyInvalid ? true : undefined}
                  className={cn(fieldClass, "obsidian-dashboard-shell-scroll min-h-28 resize-y", bodyInvalid && "border-(--obsidian-dashboard-shell-danger)")}
                />
              </Field>

          </div>
        </div>
      ) : (
        <div className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <dl className="flex w-full max-w-2xl flex-col gap-4">
            <ReadOnlyRow label="Shortcut">
              <span className="font-mono text-[12px]">{response.shortcut}</span>
            </ReadOnlyRow>
            <ReadOnlyRow label="Title">{response.title}</ReadOnlyRow>
            <ReadOnlyRow label="Message">
              <span className="whitespace-pre-wrap">{response.body}</span>
            </ReadOnlyRow>
          </dl>
        </div>
      )}

      <DashboardConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        title={`Delete ${response.shortcut}?`}
        description={`"${response.title}" stops being available in the composer right away.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
      />
    </section>
  );
}

function Field({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-(--obsidian-dashboard-shell-foreground)">{label}</span>
      {children}
      {(error || description) && (
        <span className={cn("text-[11.5px] leading-4", error ? "text-(--obsidian-dashboard-shell-danger)" : "text-(--obsidian-dashboard-shell-text-subtle)")}>
          {error ?? description}
        </span>
      )}
    </label>
  );
}

function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium text-(--obsidian-dashboard-shell-text-muted)">{label}</dt>
      <dd className="text-[12.5px] leading-relaxed text-(--obsidian-dashboard-shell-foreground)">{children}</dd>
    </div>
  );
}
