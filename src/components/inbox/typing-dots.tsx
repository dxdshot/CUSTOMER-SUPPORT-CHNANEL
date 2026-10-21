export function TypingDots() {
  return (
    <span aria-hidden className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1 animate-bounce rounded-full bg-current [animation-duration:0.9s]"
          style={{ animationDelay: `${index * 0.15}s` }}
        />
      ))}
    </span>
  );
}
