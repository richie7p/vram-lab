import { formatGB, formatTok } from "@/lib/lab/calc";
import { BACKENDS } from "@/lib/lab/commands";
import { GPUS } from "@/lib/lab/gpus";
import { recommendForVram, verdictOf, type RecCard } from "@/lib/lab/recommend";
import { useLabStore } from "@/lib/lab/store";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Led } from "./Led";

const PRESETS = [4, 6, 8, 12, 16, 24, 32, 48, 96];
const RAM_PRESETS = [8, 16, 32, 64, 128];

export function RecommendPanel() {
  const vramInput = useLabStore((s) => s.vramInput);
  const setVramInput = useLabStore((s) => s.setVramInput);
  const ramGB = useLabStore((s) => s.ramGB);
  const setRam = useLabStore((s) => s.setRam);
  const backend = useLabStore((s) => s.backend);
  const setBackend = useLabStore((s) => s.setBackend);
  const loadPreset = useLabStore((s) => s.loadPreset);

  const rec = useMemo(
    () => recommendForVram(vramInput, ramGB, backend),
    [vramInput, ramGB, backend],
  );

  function apply(card: RecCard) {
    const nearest =
      rec.gpuHint ??
      [...GPUS].sort(
        (a, b) => Math.abs(a.vramGB - vramInput) - Math.abs(b.vramGB - vramInput),
      )[0];
    loadPreset({
      gpuId: nearest?.id,
      modelId: card.model.id,
      family: card.model.family,
      quantId: card.quant.id,
      context: card.context,
      keepCustomVram: true,
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6">
      <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          我有多少 VRAM
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 rounded-md bg-surface px-3 shadow-border">
            <input
              type="number"
              min={4}
              max={192}
              step={1}
              value={vramInput}
              onChange={(e) => setVramInput(Number(e.target.value) || 4)}
              className="w-20 bg-transparent font-mono text-xl tabular-nums text-accent outline-none"
              aria-label="VRAM GB"
            />
            <span className="text-sm text-muted">GB</span>
          </label>
          <p className="text-sm text-muted">
            以 {vramInput} GB 計算
            {rec.gpuHint ? ` · 速度參考 ${rec.gpuHint.name}` : ""}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              data-vram-preset={n}
              onClick={() => setVramInput(n)}
              className={cn(
                "min-h-10 rounded-full px-3 font-mono text-sm tabular-nums transition-colors duration-150",
                vramInput === n
                  ? "bg-fg text-bg"
                  : "bg-surface text-muted shadow-border hover:text-fg",
              )}
            >
              {n} GB
            </button>
          ))}
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-subtle">系統 RAM</p>
          <div className="flex flex-wrap gap-1.5">
            {RAM_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRam(n)}
                className={cn(
                  "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums",
                  ramGB === n
                    ? "bg-fg text-bg"
                    : "bg-surface text-muted shadow-border hover:text-fg",
                )}
              >
                {n} GB
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-subtle">執行後端</p>
          <div className="flex flex-wrap gap-1.5">
            {BACKENDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackend(b.id)}
                className={cn(
                  "min-h-9 rounded-full px-3 text-xs font-medium",
                  backend === b.id
                    ? "bg-fg text-bg"
                    : "bg-surface text-muted shadow-border hover:text-fg",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {rec.comfortable ? (
          <RecBlock card={rec.comfortable} onApply={apply} featured />
        ) : (
          <EmptyBlock title="最舒服" text="這個容量很難完整放下清單裡的模型。試試提高 VRAM 或看挑戰檔。" />
        )}
        {rec.challenge ? (
          <RecBlock card={rec.challenge} onApply={apply} />
        ) : (
          <EmptyBlock title="最大挑戰" text="沒有可嘗試的組合。" />
        )}
      </div>

      {rec.also.length > 0 ? (
        <section>
          <h3 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
            其他也適合
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {rec.also.map((card) => (
              <RecBlock key={card.model.id} card={card} onApply={apply} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RecBlock({
  card,
  onApply,
  featured,
  compact,
}: {
  card: RecCard;
  onApply: (c: RecCard) => void;
  featured?: boolean;
  compact?: boolean;
}) {
  const v = verdictOf(card.fit.verdict);
  return (
    <article
      className={cn(
        "flex flex-col rounded-lg bg-bg-elevated p-4 shadow-border",
        featured && "sm:p-5",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{card.title}</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Led tone={v.tone} />
          {v.label}
        </span>
      </div>
      <h3 className="text-lg font-medium tracking-tight">{card.model.name}</h3>
      <p className="mt-1 font-mono text-sm tabular-nums text-accent">
        {card.quant.label}
        <span className="text-subtle"> · {formatTok(card.context)}</span>
      </p>
      {!compact ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{card.purpose}</p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-subtle">{card.why}</p>
      {card.costs.length > 0 && !compact ? (
        <ul className="mt-3 space-y-2">
          {card.costs.map((c) => (
            <li key={c.label} className="text-xs leading-relaxed">
              <span className="font-medium text-fg">{c.label} · </span>
              <span className="text-muted">{c.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 font-mono text-xs tabular-nums text-muted">
        需求 {formatGB(card.fit.demandGB)} · 缺口 {formatGB(card.fit.gapGB)} ·{" "}
        {card.fit.speedLow}–{card.fit.speedHigh} tok/s
      </p>
      <button
        type="button"
        onClick={() => onApply(card)}
        className="mt-4 min-h-11 rounded-md bg-fg px-4 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.98]"
      >
        載入到實驗室
      </button>
    </article>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-lg bg-bg-elevated p-5 shadow-border">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </article>
  );
}
