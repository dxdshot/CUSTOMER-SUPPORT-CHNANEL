"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DashboardButton } from "@/components/block/dashboard-shell";
import { VisitorAvatar } from "@/components/inbox/visitor-avatar";
import { saveAgentProfile, useAgentProfile, type AgentProfile } from "@/lib/agent-profile";
import { getSupabase } from "@/lib/supabase";
import { DEMO_SITE_KEY } from "@/lib/conversations";
import { TAG_NAME_MAX, createTag, useTags } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { DEFAULT_WELCOME, presetMessages } from "@/lib/widget-copy";
import type { PresetReply } from "@/widget/types";

const fieldClass =
  "w-full rounded-lg border border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-control) px-3 py-2 text-[13px] outline-none focus:border-(--obsidian-dashboard-shell-ring)";

export default function SettingsPage() {
  const profile = useAgentProfile();
  const [draft, setDraft] = useState<Partial<AgentProfile>>({});
  const name = draft.name ?? profile.name;
  const avatarUrl = draft.avatarUrl ?? profile.avatarUrl;
  const away = draft.awayMessage ?? profile.awayMessage;
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notice, setNotice] = useState("");
  const [siteCopy, setSiteCopy] = useState<{ welcome: string; presets: PresetReply[]; notify: boolean }>({ welcome: DEFAULT_WELCOME, presets: [], notify: false });
  const [siteDraft, setSiteDraft] = useState<Partial<typeof siteCopy>>({});
  const notify = siteDraft.notify ?? siteCopy.notify;
  const [loadingSite, setLoadingSite] = useState(Boolean(getSupabase()));
  const [saving, setSaving] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const { tags, refresh: refreshTags } = useTags(DEMO_SITE_KEY);
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [tagNotice, setTagNotice] = useState("");

  const addTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addingTag) return;
    const name = newTag.trim();
    if (!name) return;
    setAddingTag(true);
    setTagNotice("");
    const result = await createTag(DEMO_SITE_KEY, name);
    setAddingTag(false);
    if (!result.ok) {
      setTagNotice(
        result.reason === "backend"
          ? "Connect Supabase to create tags."
          : result.reason === "invalid"
            ? "Enter a tag name."
            : "Could not create that tag. Check the tags migration.",
      );
      return;
    }
    setNewTag("");
    await refreshTags();
    setTagNotice(result.created ? `Added “${result.name}”.` : `“${result.name}” already exists.`);
  };

  const toggleWelcomeNotify = async () => {
    if (savingNotify) return;
    const next = !notify;
    setSavingNotify(true);
    setSiteDraft((current) => ({ ...current, notify: next }));
    const client = getSupabase();
    if (!client) {
      setSiteDraft((current) => ({ ...current, notify: !next }));
      setNotice("Connect Supabase to save the welcome notification.");
      setSavingNotify(false);
      return;
    }
    const { data, error } = await client
      .from("sites")
      .update({ welcome_notify: next })
      .eq("site_key", DEMO_SITE_KEY)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setSiteDraft((current) => ({ ...current, notify: !next }));
      setNotice("Could not save the welcome notification.");
      setSavingNotify(false);
      return;
    }
    setSiteCopy((current) => ({ ...current, notify: next }));
    setSiteDraft((current) => {
      const nextDraft = { ...current };
      delete nextDraft.notify;
      return nextDraft;
    });
    setNotice("");
    setSavingNotify(false);
  };

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;
    void client.from("sites")
      .select("welcome_message, preset_messages, welcome_notify")
      .eq("site_key", DEMO_SITE_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setNotice("Could not load widget settings. Check the site migration.");
        else setSiteCopy({
          welcome: data.welcome_message || DEFAULT_WELCOME,
          presets: presetMessages(data.preset_messages),
          notify: Boolean(data.welcome_notify),
        });
        setLoadingSite(false);
      });
    return () => { active = false; };
  }, []);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setNotice("Choose a PNG or JPG under 2 MB.");
      return;
    }
    const client = getSupabase();
    if (!client) {
      setNotice("Connect Supabase to upload a photo.");
      return;
    }
    setUploadingAvatar(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
    const path = `avatars/${profile.id}-${Date.now()}-${safe}`;
    const { error } = await client.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type, upsert: true });
    setUploadingAvatar(false);
    if (error) {
      setNotice("Could not upload that photo.");
      return;
    }
    const { data } = client.storage.from("chat-attachments").getPublicUrl(path);
    setDraft((current) => ({ ...current, avatarUrl: data.publicUrl }));
    setNotice("Photo uploaded — press Save settings.");
  };

  const save = async () => {
    if (saving || loadingSite) return;
    setSaving(true);
    setNotice("");
    const welcome = (siteDraft.welcome ?? siteCopy.welcome).trim().slice(0, 200) || DEFAULT_WELCOME;
    const draftPresets = siteDraft.presets ?? siteCopy.presets;
    const presets = presetMessages(draftPresets);
    if (draftPresets.some((preset) => Boolean(preset.question.trim()) !== Boolean(preset.answer.trim()))) {
      setNotice("Add both a question and an answer for every preset reply.");
      setSaving(false);
      return;
    }
    const questions = draftPresets.map((preset) => preset.question.trim().toLowerCase()).filter(Boolean);
    if (new Set(questions).size !== questions.length) {
      setNotice("Each preset question needs to be unique.");
      setSaving(false);
      return;
    }
    const client = getSupabase();
    const [agentSaved, siteResult] = await Promise.all([
      saveAgentProfile(draft),
      client?.from("sites")
        .update({ welcome_message: welcome, preset_messages: presets, welcome_notify: notify })
        .eq("site_key", DEMO_SITE_KEY)
        .select("id")
        .maybeSingle(),
    ]);
    setDraft({});
    if (siteResult?.data && !siteResult.error) {
      setSiteCopy({ welcome, presets, notify });
      setSiteDraft({});
    }
    setNotice(agentSaved && siteResult?.data && !siteResult.error
      ? "Saved. The widget will refresh on its next update."
      : "Some settings could not sync. Check the site migration and try again.");
    setSaving(false);
  };

  return (
    <AppShell title="Settings">
      <div className="obsidian-dashboard-shell-scroll h-full overflow-y-auto px-4 py-6 md:px-8 md:py-10">
        <div className="max-w-lg pb-24">
          <h1 className="text-2xl font-medium tracking-tight">Agent profile</h1>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <VisitorAvatar name={name || "You"} size="lg" />
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <DashboardButton
                    variant="secondary"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInput.current?.click()}
                  >
                    <Upload aria-hidden />
                    {uploadingAvatar ? "Uploading…" : "Upload photo"}
                  </DashboardButton>
                  {avatarUrl && (
                    <DashboardButton variant="remove" size="sm" onClick={() => setDraft((current) => ({ ...current, avatarUrl: "" }))}>
                      Remove photo
                    </DashboardButton>
                  )}
                </div>
                <span className="text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                  PNG or JPG, up to 2 MB.
                </span>
              </div>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadAvatar(file);
                }}
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Display name</span>
              <input
                value={name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                maxLength={60}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Away message</span>
              <textarea
                rows={2}
                value={away}
                onChange={(event) => setDraft((current) => ({ ...current, awayMessage: event.target.value }))}
                maxLength={200}
                className={`${fieldClass} resize-none`}
              />
              <span className="mt-1.5 block text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                Shown in the widget header when nobody is viewing.
              </span>
            </label>
          </div>

          <div className="mt-8 border-t border-(--obsidian-dashboard-shell-border) pt-6">
            <h2 className="text-lg font-medium">Visitor welcome</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Welcome message</span>
                <textarea rows={2} maxLength={200} className={`${fieldClass} resize-none`}
                  value={siteDraft.welcome ?? siteCopy.welcome}
                  onChange={(event) => setSiteDraft((current) => ({ ...current, welcome: event.target.value }))} />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium">Welcome notification</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notify}
                  aria-label="Welcome notification"
                  aria-busy={savingNotify}
                  disabled={savingNotify || loadingSite}
                  onClick={() => void toggleWelcomeNotify()}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) disabled:opacity-50",
                    notify
                      ? "border-(--obsidian-dashboard-shell-accent) bg-(--obsidian-dashboard-shell-accent)"
                      : "border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-control)",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block size-3.5 rounded-full bg-white transition-transform",
                      notify ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Preset replies</span>
                <span className="block text-[11px] leading-4 text-(--obsidian-dashboard-shell-text-subtle)">
                  Visitors tap a question to receive its answer from the widget.
                </span>
              </label>
              {(siteDraft.presets ?? siteCopy.presets).map((preset, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-(--obsidian-dashboard-shell-border) p-3">
                  <input aria-label={`Question ${index + 1}`} maxLength={120} placeholder="Question"
                    className={fieldClass} value={preset.question}
                    onChange={(event) => setSiteDraft((current) => {
                      const next = [...(current.presets ?? siteCopy.presets)];
                      next[index] = { ...next[index], question: event.target.value };
                      return { ...current, presets: next };
                    })} />
                  <textarea aria-label={`Answer ${index + 1}`} maxLength={2000} rows={3} placeholder="Answer"
                    className={`${fieldClass} resize-none`} value={preset.answer}
                    onChange={(event) => setSiteDraft((current) => {
                      const next = [...(current.presets ?? siteCopy.presets)];
                      next[index] = { ...next[index], answer: event.target.value };
                      return { ...current, presets: next };
                    })} />
                  <DashboardButton variant="remove" size="sm"
                    onClick={() => setSiteDraft((current) => ({
                      ...current,
                      presets: (current.presets ?? siteCopy.presets).filter((_, item) => item !== index),
                    }))}>Remove reply</DashboardButton>
                </div>
              ))}
              {(siteDraft.presets ?? siteCopy.presets).length < 6 && (
                <DashboardButton variant="secondary" size="sm"
                  onClick={() => setSiteDraft((current) => ({
                    ...current,
                    presets: [...(current.presets ?? siteCopy.presets), { question: "", answer: "" }],
                  }))}><Plus aria-hidden />Add preset reply</DashboardButton>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-(--obsidian-dashboard-shell-border) pt-6">
            <h2 className="text-lg font-medium">Tags</h2>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {tags.length === 0 ? (
                <span className="text-xs text-(--obsidian-dashboard-shell-text-subtle)">No tags yet.</span>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-[11.5px] leading-4 text-amber-300"
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
            <form onSubmit={addTag} className="mt-4 flex items-end gap-2">
              <label className="block min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-medium">New tag</span>
                <input
                  value={newTag}
                  maxLength={TAG_NAME_MAX}
                  onChange={(event) => {
                    setNewTag(event.target.value);
                    if (tagNotice) setTagNotice("");
                  }}
                  placeholder="e.g. Onboarding"
                  className={fieldClass}
                />
              </label>
              <DashboardButton type="submit" variant="primary" disabled={!newTag.trim() || addingTag}>
                <Plus aria-hidden />
                {addingTag ? "Adding…" : "Add tag"}
              </DashboardButton>
            </form>
            {tagNotice && (
              <p className="mt-2 text-xs text-(--obsidian-dashboard-shell-text-muted)">{tagNotice}</p>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <DashboardButton variant="primary" onClick={() => void save()} disabled={uploadingAvatar || loadingSite || saving}>
              {saving ? "Saving…" : "Save settings"}
            </DashboardButton>
            {notice && (
              <span className="text-xs text-(--obsidian-dashboard-shell-text-muted)">{notice}</span>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
