import { estimateQuick, formatDuration, formatGB, formatTok, formatTokS, type QuickFit } from "@/lib/lab/calc";
import { BACKENDS } from "@/lib/lab/commands";
import { MEM_BY_ID } from "@/lib/lab/gpus";
import { verdictOf } from "@/lib/lab/recommend";
import { estimateInput, pinId } from "@/lib/lab/share";
import { useLabConfig, useLabStore } from "@/lib/lab/store";
import type { Pin } from "@/lib/lab/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Led } from "./Led";

const MAX_PINS = 3;

/** "+12%" style delta of a pinned value against the current config. */
function Delta({ value, base, higherIsBetter }: { value: number; base: number; higherIsBetter: boolean }) {
  if (base <= 0 || !Number.isFinite(value)) return null;
  const pct = Math.round(((value - base) / base) * 100);
  if (Math.abs(pct) < 3) return null;
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return (
    <span className={cn("ml-1 font-mono text-[11px] tabular-nums", good ? "text-ok" : "text-tight")}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-line/60 py-1.5 first:border-t-0">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-xs tabular-nums text-fg">{children}</dd>
    </div>
  );
}

export function CompareBench() {
  const pins = useLabStore((s) => s.pins);
  const pinCurrent = useLabStore((s) => s.pinCurrent);
  const removePin = useLabStore((s) => s.removePin);
  const loadPin = useLabStore((s) => s.loadPin);
  const config = useLabConfig();

  const currentId = pinId(config);
  const current = useMemo(() => estimateQuick(estimateInput(config)), [config]);
  const already = pins.some((p) => p.id === currentId);
  const full = pins.length >= MAX_PINS && !already;

  return (
    <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
          對照台 · {pins.length}/{MAX_PINS}
        </h3>
        <button
          type="button"
          disabled={already || full}
          onClick={pinCurrent}
          className={cn(
            "min-h-10 rounded-md px-3 text-sm font-medium transition-colors duration-150",
            already || full ? "bg-surface text-subtle" : "bg-fg text-bg active:scale-[0.98]",
          )}
        >
          {already ? "已釘選" : full ? `已滿 ${MAX_PINS} 組` : "釘選目前組合"}
        </button>
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-muted">
          釘選最多 {MAX_PINS} 組，改設定後就能看到每組和目前設定的差距（百分比是相對目前設定）。
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {pins.map((pin) => (
            <PinCard
              key={pin.id}
              pin={pin}
              current={current}
              on={pin.id === currentId}
              onLoad={() => loadPin(pin)}
              onRemove={() => removePin(pin.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PinCard({
  pin,
  current,
  on,
  onLoad,
  onRemove,
}: {
  pin: Pin;
  current: QuickFit;
  on: boolean;
  onLoad: () => void;
  onRemove: () => void;
}) {
  const input = estimateInput(pin);
  const fit = estimateQuick(input);
  const v = verdictOf(fit.verdict);
  const be = BACKENDS.find((b) => b.id === pin.backend)?.label ?? pin.backend;
  const device = pin.useCustomVram ? `${pin.vramInput} GB 自訂` : input.gpu.shortName;
  const showDelta = !on;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-md bg-surface p-3 shadow-border",
        on && "shadow-[0_0_0_1px_var(--color-accent)]",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Led tone={v.tone} />
        <span className="text-xs text-muted">{v.label}</span>
        {on ? <span className="ml-auto text-[11px] text-accent">目前設定</span> : null}
      </div>
      <p className="truncate text-sm font-medium">{input.model.name}</p>
      <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-accent">
        {device} · {input.quant.label} · {formatTok(pin.context)}
        {pin.parallel > 1 ? ` ×${pin.parallel}` : ""}
      </p>
      <dl className="mt-2">
        <Row label="生成">
          {fit.speedLow}–{fit.speedHigh}
          {showDelta ? <Delta value={fit.speedMid} base={current.speedMid} higherIsBetter /> : null}
        </Row>
        <Row label="Prompt">
          {formatTokS(fit.prefillTokS)}
          {showDelta ? <Delta value={fit.prefillTokS} base={current.prefillTokS} higherIsBetter /> : null}
        </Row>
        <Row label="讀滿">{formatDuration(fit.fillSec)}</Row>
        <Row label="需求">
          {formatGB(fit.demandGB)}
          {showDelta ? <Delta value={fit.demandGB} base={current.demandGB} higherIsBetter={false} /> : null}
        </Row>
        <Row label="缺口">{fit.gapGB > 0.05 ? formatGB(fit.gapGB) : "無"}</Row>
        <Row label="記憶體">
          {fit.unified ? `${fit.ramGB} GB 統一` : `${fit.ramGB} GB · ${MEM_BY_ID[pin.memId]?.label ?? ""}`}
        </Row>
        <Row label="後端">{be}</Row>
      </dl>
      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={onLoad}
          disabled={on}
          className={cn(
            "min-h-9 flex-1 rounded-md px-2 text-xs font-medium",
            on ? "bg-bg text-subtle shadow-border" : "bg-fg text-bg",
          )}
        >
          {on ? "已載入" : "載入"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-9 rounded-md bg-bg px-2 text-xs text-muted shadow-border"
        >
          移除
        </button>
      </div>
    </article>
  );
}
