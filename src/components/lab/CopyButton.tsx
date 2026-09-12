import { cn } from "@/lib/utils";
import { useState } from "react";

export function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "min-h-10 rounded-md px-3 text-sm font-medium transition-colors duration-150",
        done ? "bg-accent text-accent-fg" : "bg-fg text-bg active:scale-[0.98]",
      )}
    >
      {done ? "已複製" : label}
    </button>
  );
}
