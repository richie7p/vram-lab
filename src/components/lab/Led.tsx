import { cn } from "@/lib/utils";

export type LedTone = "ok" | "warn" | "tight" | "bad" | "idle" | "accent";

const TONE: Record<LedTone, string> = {
  ok: "bg-ok shadow-[0_0_8px_color-mix(in_oklab,var(--color-ok)_70%,transparent)]",
  warn: "bg-warn shadow-[0_0_8px_color-mix(in_oklab,var(--color-warn)_55%,transparent)]",
  tight: "bg-tight shadow-[0_0_8px_color-mix(in_oklab,var(--color-tight)_55%,transparent)]",
  bad: "bg-bad shadow-[0_0_8px_color-mix(in_oklab,var(--color-bad)_55%,transparent)]",
  idle: "bg-subtle/50",
  accent:
    "bg-accent shadow-[0_0_8px_color-mix(in_oklab,var(--color-accent)_70%,transparent)]",
};

export function Led({
  tone,
  className,
}: {
  tone: LedTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", TONE[tone], className)}
    />
  );
}
