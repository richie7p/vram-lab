import { DATA_AS_OF, METHOD_LINES } from "@/lib/lab/method";
import { useState } from "react";

export function EstimateBasis() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          估算依據 · 資料 {DATA_AS_OF}
        </span>
        <span className="text-xs text-subtle">{open ? "收合" : "展開"}</span>
      </button>
      {open ? (
        <ul className="mt-3 space-y-2">
          {METHOD_LINES.map((line) => (
            <li key={line} className="text-xs leading-relaxed text-muted">
              {line}
            </li>
          ))}
          <li className="text-xs leading-relaxed text-subtle">
            速度、VRAM、RAM 皆為理論估算，不是實測。會受後端、CPU、記憶體頻寬、prompt 長度與驅動影響。
          </li>
        </ul>
      ) : (
        <p className="mt-2 text-xs text-subtle">理論估算，不是實測 benchmark。</p>
      )}
    </section>
  );
}
