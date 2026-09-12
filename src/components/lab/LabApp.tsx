import { budgetVramGB, estimate } from "@/lib/lab/calc";
import { GPU_BY_ID } from "@/lib/lab/gpus";
import { DATA_AS_OF } from "@/lib/lab/method";
import { MODEL_BY_ID } from "@/lib/lab/models";
import { QUANT_BY_ID } from "@/lib/lab/quants";
import { verdictOf } from "@/lib/lab/recommend";
import { useLabStore, type LabMode } from "@/lib/lab/store";
import { cn } from "@/lib/utils";
import { useMemo, type ReactNode } from "react";
import { Configurator } from "./Configurator";
import { Led } from "./Led";
import { Readout } from "./Readout";
import { RecommendPanel } from "./RecommendPanel";

export function LabApp() {
  const mode = useLabStore((s) => s.mode);
  const setMode = useLabStore((s) => s.setMode);
  const gpuId = useLabStore((s) => s.gpuId);
  const modelId = useLabStore((s) => s.modelId);
  const quantId = useLabStore((s) => s.quantId);
  const context = useLabStore((s) => s.context);
  const kv = useLabStore((s) => s.kv);
  const useCustomVram = useLabStore((s) => s.useCustomVram);
  const vramInput = useLabStore((s) => s.vramInput);
  const ramGB = useLabStore((s) => s.ramGB);
  const backend = useLabStore((s) => s.backend);

  const gpu = GPU_BY_ID[gpuId] ?? GPU_BY_ID["3060"];
  const model = MODEL_BY_ID[modelId];
  const quant = QUANT_BY_ID[quantId];
  const vramGB = budgetVramGB(gpu, useCustomVram, vramInput);

  const fit = useMemo(() => {
    if (!gpu || !model || !quant) return null;
    return estimate({ gpu, model, quant, context, kv, vramGB, ramGB, backend });
  }, [gpu, model, quant, context, kv, vramGB, ramGB, backend]);

  const v = fit ? verdictOf(fit.verdict) : null;

  function go(next: LabMode) {
    setMode(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="lab-grid min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <p className="font-medium tracking-tight">VRAM Lab</p>
              <p className="text-xs text-muted">本地 LLM 硬體配置實驗室</p>
            </div>
          </div>

          <nav className="flex rounded-full bg-surface p-1 shadow-border">
            <Tab on={mode === "lab"} onClick={() => go("lab")}>
              實驗室
            </Tab>
            <Tab on={mode === "recommend"} onClick={() => go("recommend")}>
              VRAM 推薦
            </Tab>
          </nav>
        </div>

        {mode === "lab" && fit && v ? (
          <div className="border-t border-line bg-bg-elevated lg:hidden">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <Led tone={v.tone} />
              <span className="text-sm font-medium">{v.label}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-muted">
                需求 {fit.demandGB.toFixed(1)} · 缺口 {fit.gapGB.toFixed(1)} GB
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {mode === "lab" && gpu && model && quant && fit ? (
        <main className="mx-auto grid w-full max-w-7xl items-start gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(18rem,22rem)_1fr] lg:gap-6 lg:py-6">
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
            <Configurator />
          </div>
          <Readout
            gpu={gpu}
            model={model}
            quant={quant}
            context={context}
            kv={kv}
            fit={fit}
            vramGB={vramGB}
            useCustomVram={useCustomVram}
          />
        </main>
      ) : (
        <RecommendPanel />
      )}

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-subtle sm:px-6">
        理論估算 · 資料 {DATA_AS_OF} · 不是精確 benchmark
      </footer>
    </div>
  );
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full px-4 text-sm font-medium transition-colors duration-150",
        on ? "bg-fg text-bg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-surface-2" />
      <rect x="6" y="20" width="5" height="6" rx="1" className="fill-accent-dim" />
      <rect x="13.5" y="14" width="5" height="12" rx="1" className="fill-accent" />
      <rect x="21" y="9" width="5" height="17" rx="1" className="fill-fg" />
    </svg>
  );
}
