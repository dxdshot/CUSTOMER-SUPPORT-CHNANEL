import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Icon aria-hidden className="size-6 text-(--obsidian-dashboard-shell-text-subtle)" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs leading-relaxed text-(--obsidian-dashboard-shell-text-muted)">{description}</p>
        </div>
      </div>
    </div>
  );
}
