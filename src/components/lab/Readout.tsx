import { formatDuration, formatGB, formatKvTok, formatTok, formatTokS } from "@/lib/lab/calc";
import { verdictOf } from "@/lib/lab/recommend";
import { useLabStore } from "@/lib/lab/store";
import type { BackendId, Fit, Gpu, KvPrecision, Model, Quant } from "@/lib/lab/types";
import { cn } from "@/lib/utils";
import { CompareBench } from "./CompareBench";
import { ContextCurve } from "./ContextCurve";
import { CopyButton } from "./CopyButton";
import { EstimateBasis } from "./EstimateBasis";
import { LaunchCommands } from "./LaunchCommands";
import { Led } from "./Led";
import { VramMeter } from "./VramMeter";

export function Readout({
  gpu,
  model,
  quant,
  context,
  kv,
  fit,
  vramGB,
  useCustomVram,
}: {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  context: number;
  kv: KvPrecision;
  fit: Fit;
  vramGB: number;
  useCustomVram: boolean;
}) {
  const applyAction = useLabStore((s) => s.applyAction);
  const setContext = useLabStore((s) => s.setContext);
  const setBackend = useLabStore((s) => s.setBackend);
  const backend = useLabStore((s) => s.backend);
  const v = verdictOf(fit.verdict);
  const offloadLabel = fit.fullOffload
    ? "完整 GPU offload"
    : fit.moeOffload
      ? `MoE expert offload · ${fit.cpuMoeLayers}/${fit.totalLayers} 層的 expert 在 CPU`
      : `需 CPU offload · ${fit.gpuLayers}/${fit.totalLayers} 層在 GPU`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        className={cn(
          "rounded-lg p-5 shadow-border",
          v.tone === "ok" && "bg-ok-dim/30",
          v.tone === "warn" && "bg-warn-dim/25",
          v.tone === "tight" && "bg-tight-dim/30",
          v.tone === "bad" && "bg-bad-dim/30",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">判定</p>
          <CopyButton text={() => window.location.href} label="複製分享連結" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Led tone={v.tone} className="size-3" />
          <h2 className="text-2xl font-medium tracking-tight text-fg">{v.label}</h2>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          {useCustomVram ? `自訂 ${vramGB} GB` : gpu.shortName} · {model.name} · {quant.label} ·{" "}
          {formatTok(context)}
          {model.kind !== "dense" ? ` · ${model.kind.toUpperCase()}` : ""}
        </p>
        <p className="mt-1 text-sm text-fg">{offloadLabel}</p>
        {useCustomVram ? (
          <p className="mt-1 text-xs text-muted">
            VRAM 以 {vramGB} GB 計算。速度參考 {gpu.name} 頻寬，不是把顯卡改成 {vramGB} GB。
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted">{model.purpose}</p>
      </section>

      <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
        <VramMeter fit={fit} />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="權重" value={formatGB(fit.weightsGB)} hint="估算" />
        <Stat label="KV cache" value={formatGB(fit.kvGB)} hint={formatKvTok(fit.kvBytesPerToken)} />
        <Stat
          label="預估速度"
          value={`${fit.speedLow}–${fit.speedHigh}`}
          hint={useCustomVram ? `tok/s · 參考 ${gpu.shortName}` : "tok/s · 估計"}
          accent
        />
        <Stat
          label={fit.unified ? "統一記憶體" : "系統 RAM"}
          value={fit.ramOk ? "夠用" : "不足"}
          hint={`${formatGB(fit.ramNeedGB)} 估需 / ${formatGB(fit.ramGB)}`}
        />
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="Prompt 處理"
          value={`${formatTokS(fit.prefillTokS)}`}
          hint={`tok/s · 讀滿 ${formatTok(context)} 約 ${formatDuration(fit.fillSec)}`}
        />
        <Stat
          label="GPU 層數"
          value={fit.fullOffload || fit.moeOffload ? "全部" : `${fit.gpuLayers}/${fit.totalLayers}`}
          hint={
            fit.fullOffload
              ? "無需 CPU"
              : fit.moeOffload
                ? `expert ${formatGB(fit.cpuOffloadGB)} 在 CPU`
                : `CPU 承接 ${formatGB(fit.cpuOffloadGB)}`
          }
        />
        <button
          type="button"
          onClick={() => setContext(fit.suggestedCtx)}
          className="rounded-md bg-bg-elevated px-3 py-3 text-left shadow-border transition-transform duration-150 active:scale-[0.99]"
          aria-label={`套用建議 context ${formatTok(fit.suggestedCtx)}`}
        >
          <p className="text-xs text-muted">建議 context</p>
          <p className="mt-1 font-mono text-lg font-medium tabular-nums tracking-tight text-fg">
            {formatTok(fit.suggestedCtx)}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {fit.suggestedCtx === context ? "已是建議值" : "點擊套用"}
          </p>
        </button>
        <Stat
          label="KV 精度"
          value={kv.toUpperCase()}
          hint="預設 FP16，長窗可改 Q8"
        />
      </section>

      <LaunchCommands
        gpu={gpu}
        model={model}
        quant={quant}
        context={context}
        kv={kv}
        fit={fit}
        backend={backend}
        onBackend={(b: BackendId) => setBackend(b)}
      />

      <CompareBench />

      <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
        <ContextCurve
          gpu={gpu}
          model={model}
          quant={quant}
          kv={kv}
          context={context}
          vramGB={vramGB}
          ramGB={fit.ramGB}
          backend={backend}
          usableGB={fit.usableGB}
        />
      </section>

      {fit.suggestions.length > 0 ? (
        <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
          <h3 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
            實驗室備註
          </h3>
          <ul className="space-y-3">
            {fit.suggestions.map((s) => (
              <li key={s.text} className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-fg">{s.text}</p>
                {s.action && s.actionLabel ? (
                  <button
                    type="button"
                    onClick={() => applyAction(s.action!)}
                    className="min-h-9 shrink-0 rounded-md bg-fg px-3 text-xs font-medium text-bg"
                  >
                    {s.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EstimateBasis />

      {model.note ? (
        <p className="text-xs leading-relaxed text-muted">{model.note}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md bg-bg-elevated px-3 py-3 shadow-border">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-medium tabular-nums tracking-tight",
          accent ? "text-accent" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}
