import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandSpinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center justify-center text-(--obsidian-dashboard-shell-accent)", className)}>
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
