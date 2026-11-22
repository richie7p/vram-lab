import { estimate } from "@/lib/lab/calc";
import { DATA_AS_OF } from "@/lib/lab/method";
import { verdictOf } from "@/lib/lab/recommend";
import { decodeConfig, encodeConfig, estimateInput, pickConfig } from "@/lib/lab/share";
import { useLabConfig, useLabStore, type LabMode } from "@/lib/lab/store";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, type ReactNode } from "react";
import { Configurator } from "./Configurator";
import { Led } from "./Led";
import { Readout } from "./Readout";
import { RecommendPanel } from "./RecommendPanel";

/** Load a config from ?g=…&m=… once, then keep the address bar in sync so it is always shareable. */
function useUrlSync() {
  useEffect(() => {
    const store = useLabStore;
    const fromUrl = decodeConfig(window.location.search, pickConfig(store.getState()));
    if (fromUrl) store.getState().applyConfig(fromUrl);

    const sync = () => {
      const s = store.getState();
      if (s.mode !== "lab") return;
      const next = `${window.location.pathname}?${encodeConfig(pickConfig(s))}${window.location.hash}`;
      const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next !== now) window.history.replaceState(window.history.state, "", next);
    };
    sync();
    // Lets tests (and anything else) know the client has taken over.
    document.documentElement.dataset.labReady = "1";
    return store.subscribe(sync);
  }, []);
}

export function LabApp() {
  useUrlSync();
  const mode = useLabStore((s) => s.mode);
  const setMode = useLabStore((s) => s.setMode);
  const config = useLabConfig();
  const input = useMemo(() => estimateInput(config), [config]);
  const { gpu, model, quant, context, kv } = input;
  const vramGB = input.vramGB ?? gpu.vramGB;
  const useCustomVram = config.useCustomVram;
  const fit = useMemo(() => estimate(input), [input]);

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
          <div className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
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
            input={input}
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
