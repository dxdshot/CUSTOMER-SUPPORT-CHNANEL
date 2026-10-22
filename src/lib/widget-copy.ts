import type { PresetReply, WidgetSize } from "@/widget/types";

export const DEFAULT_WELCOME = "Hi! How can we help?";

export function widgetSize(value: unknown): WidgetSize {
  return value === "sm" || value === "md" ? value : "lg";
}

export function presetMessages(value: unknown): PresetReply[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item): PresetReply | null => {
      if (typeof item === "string") return { question: item.trim().slice(0, 120), answer: "" };
      if (!item || typeof item !== "object") return null;
      const pair = item as Record<string, unknown>;
      if (typeof pair.question !== "string" || typeof pair.answer !== "string") return null;
      return { question: pair.question.trim().slice(0, 120), answer: pair.answer.trim().slice(0, 2000) };
    })
    .filter((item): item is PresetReply => Boolean(item?.question))
    .filter((item) => {
      const key = item.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}
