import { budgetVramGB, estimate, formatGB, formatTok, pinId } from "@/lib/lab/calc";
import { BACKENDS } from "@/lib/lab/commands";
import { GPU_BY_ID } from "@/lib/lab/gpus";
import { MODEL_BY_ID } from "@/lib/lab/models";
import { QUANT_BY_ID } from "@/lib/lab/quants";
import { verdictOf } from "@/lib/lab/recommend";
import { useLabStore } from "@/lib/lab/store";
import { cn } from "@/lib/utils";
import { Led } from "./Led";

export function CompareBench() {
  const pins = useLabStore((s) => s.pins);
  const gpuId = useLabStore((s) => s.gpuId);
  const modelId = useLabStore((s) => s.modelId);
  const quantId = useLabStore((s) => s.quantId);
  const context = useLabStore((s) => s.context);
  const kv = useLabStore((s) => s.kv);
  const useCustomVram = useLabStore((s) => s.useCustomVram);
  const vramInput = useLabStore((s) => s.vramInput);
  const ramGB = useLabStore((s) => s.ramGB);
  const backend = useLabStore((s) => s.backend);
  const pinCurrent = useLabStore((s) => s.pinCurrent);
  const removePin = useLabStore((s) => s.removePin);
  const loadPin = useLabStore((s) => s.loadPin);

  const currentId = pinId({
    gpuId,
    useCustomVram,
    vramBudgetGB: vramInput,
    ramGB,
    backend,
    modelId,
    quantId,
    context,
    kv,
  });
  const already = pins.some((p) => p.id === currentId);
  const full = pins.length >= 3 && !already;

  return (
    <section className="rounded-lg bg-bg-elevated p-4 shadow-border sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
          對照台 · {pins.length}/3
        </h3>
        <button
          type="button"
          disabled={already || full}
          onClick={pinCurrent}
          className={cn(
            "min-h-10 rounded-md px-3 text-sm font-medium transition-colors duration-150",
            already || full
              ? "bg-surface text-subtle"
              : "bg-fg text-bg active:scale-[0.98]",
          )}
        >
          {already ? "已釘選" : full ? "已滿 3 組" : "釘選目前組合"}
        </button>
      </div>

      {pins.length === 0 ? (
        <p className="text-sm text-muted">
          釘選最多 3 組。對照使用同一套需求／缺口／RAM／後端計算。
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {pins.map((pin) => {
            const gpu = GPU_BY_ID[pin.gpuId];
            const model = MODEL_BY_ID[pin.modelId];
            const quant = QUANT_BY_ID[pin.quantId];
            if (!gpu || !model || !quant) return null;
            const vramGB = budgetVramGB(gpu, pin.useCustomVram, pin.vramBudgetGB);
            const fit = estimate({
              gpu,
              model,
              quant,
              context: pin.context,
              kv: pin.kv,
              vramGB,
              ramGB: pin.ramGB,
              backend: pin.backend,
            });
            const v = verdictOf(fit.verdict);
            const on = pin.id === currentId;
            const be = BACKENDS.find((b) => b.id === pin.backend)?.label ?? pin.backend;
            return (
              <article
                key={pin.id}
                className={cn(
                  "flex flex-col rounded-md bg-surface p-3 shadow-border",
                  on && "shadow-[0_0_0_1px_var(--color-accent)]",
                )}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <Led tone={v.tone} />
                  <span className="text-xs text-muted">{v.label}</span>
                </div>
                <p className="text-sm font-medium">{model.name}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-accent">
                  {pin.useCustomVram ? `${vramGB} GB 自訂` : gpu.shortName} · {quant.label} ·{" "}
                  {formatTok(pin.context)}
                </p>
                <p className="mt-2 font-mono text-xs tabular-nums text-muted">
                  需求 {formatGB(fit.demandGB)} · 缺口 {formatGB(fit.gapGB)}
                </p>
                <p className="mt-1 font-mono text-xs tabular-nums text-subtle">
                  {fit.speedLow}–{fit.speedHigh} tok/s · {be} · RAM {pin.ramGB} GB
                </p>
                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadPin(pin)}
                    className="min-h-9 flex-1 rounded-md bg-fg px-2 text-xs font-medium text-bg"
                  >
                    載入
                  </button>
                  <button
                    type="button"
                    onClick={() => removePin(pin.id)}
                    className="min-h-9 rounded-md bg-bg px-2 text-xs text-muted shadow-border"
                  >
                    移除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
