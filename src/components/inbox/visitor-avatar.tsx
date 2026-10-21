import { cn } from "@/lib/utils";

const gradients = [
  "from-[#f08a3c] to-[#d94f2b]",
  "from-[#7c5cf0] to-[#4b3ec7]",
  "from-[#2fd0b5] to-[#0e8f88]",
  "from-[#4c9bff] to-[#2a5bd7]",
  "from-[#f2b54a] to-[#d9822b]",
  "from-[#f06a9b] to-[#c73a72]",
];

const sizeClasses = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-[11px]",
  lg: "size-10 text-xs",
} as const;

export function VisitorAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const gradient = gradients[hash % gradients.length];

  return (
    <span
      aria-hidden
      suppressHydrationWarning
      className={cn(
        "grid shrink-0 select-none place-items-center rounded-full bg-linear-to-br font-medium text-white/95 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]",
        gradient,
        sizeClasses[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
