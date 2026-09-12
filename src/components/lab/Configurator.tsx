import { budgetVramGB, estimate, formatTok } from "@/lib/lab/calc";
import { BACKENDS } from "@/lib/lab/commands";
import { GPUS, GPU_BY_ID, GPU_GROUPS } from "@/lib/lab/gpus";
import { FAMILIES, MODEL_BY_ID, MODELS } from "@/lib/lab/models";
import { QUANTS } from "@/lib/lab/quants";
import { verdictOf } from "@/lib/lab/recommend";
import { useLabStore } from "@/lib/lab/store";
import type { KvPrecision } from "@/lib/lab/types";
import { cn } from "@/lib/utils";
import { useMemo, useState, type ReactNode } from "react";
import { Led } from "./Led";

const CTX_PRESETS = [4096, 8192, 16384, 32768, 65536, 131072];
const RAM_PRESETS = [8, 16, 32, 64, 128];
const KV_OPTS: { id: KvPrecision; label: string }[] = [
  { id: "fp16", label: "KV FP16" },
  { id: "q8", label: "KV Q8" },
  { id: "q4", label: "KV Q4" },
];

export function Configurator() {
  const gpuId = useLabStore((s) => s.gpuId);
  const modelId = useLabStore((s) => s.modelId);
  const tabFamily = useLabStore((s) => s.family);
  const quantId = useLabStore((s) => s.quantId);
  const context = useLabStore((s) => s.context);
  const kv = useLabStore((s) => s.kv);
  const useCustomVram = useLabStore((s) => s.useCustomVram);
  const vramInput = useLabStore((s) => s.vramInput);
  const ramGB = useLabStore((s) => s.ramGB);
  const backend = useLabStore((s) => s.backend);
  const setGpu = useLabStore((s) => s.setGpu);
  const setModel = useLabStore((s) => s.setModel);
  const setFamily = useLabStore((s) => s.setFamily);
  const setQuant = useLabStore((s) => s.setQuant);
  const setContext = useLabStore((s) => s.setContext);
  const setKv = useLabStore((s) => s.setKv);
  const setVramInput = useLabStore((s) => s.setVramInput);
  const setUseCustomVram = useLabStore((s) => s.setUseCustomVram);
  const setRam = useLabStore((s) => s.setRam);
  const setBackend = useLabStore((s) => s.setBackend);
  const [query, setQuery] = useState("");

  const gpu = GPU_BY_ID[gpuId] ?? GPUS[0];
  const quant = QUANTS.find((q) => q.id === quantId) ?? QUANTS[4];
  const selected = MODEL_BY_ID[modelId];
  const family = selected?.family ?? tabFamily;
  const maxCtx = selected?.maxCtx ?? 131072;
  const vramGB = budgetVramGB(gpu, useCustomVram, vramInput);

  const models = useMemo(() => {
    const list = MODELS.filter((m) => m.family === family);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) => m.name.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q),
    );
  }, [family, query]);

  return (
    <div className="flex flex-col gap-4">
      <Section kicker="01" title="GPU">
        {useCustomVram ? (
          <p className="rounded-md bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
            VRAM 預算 <span className="font-mono text-accent">{vramInput} GB</span>
            。點選顯卡只改速度參考，容量仍按自訂值算。
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          {GPU_GROUPS.map((group) => {
            const cards = GPUS.filter((g) => g.group === group.id);
            return (
              <div key={group.id}>
                <p className="mb-1.5 text-xs text-subtle">{group.label}</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {cards.map((g) => {
                    const on = g.id === gpuId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        title={g.name}
                        onClick={() => setGpu(g.id)}
                        className={cn(
                          "flex min-h-11 flex-col justify-center rounded-md px-2 py-1.5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.99]",
                          on
                            ? "bg-surface-2 shadow-[0_0_0_1px_var(--color-accent)]"
                            : "bg-surface shadow-border hover:shadow-border-hover",
                        )}
                      >
                        <span className="truncate text-sm font-medium">{g.shortName}</span>
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {g.vramGB} GB
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted">{gpu.note}</p>
      </Section>

      <Section kicker="02" title="模型">
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => {
            const on = f.id === family;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setFamily(f.id);
                }}
                className={cn(
                  "min-h-9 rounded-full px-3 text-sm font-medium transition-colors duration-150",
                  on
                    ? "bg-fg text-bg"
                    : "bg-surface text-muted shadow-border hover:text-fg",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <label className="block">
          <span className="sr-only">篩選模型</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="篩選型號或用途"
            className="min-h-11 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-border outline-none placeholder:text-subtle"
          />
        </label>
        <div className="grid gap-1">
          {models.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">沒有符合的模型</p>
          ) : (
            models.map((m) => {
              const on = m.id === modelId;
              const fit = estimate({
                gpu,
                model: m,
                quant,
                context,
                kv,
                vramGB,
                ramGB,
                backend,
              });
              const v = verdictOf(fit.verdict);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id, m.family)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-[box-shadow,background-color] duration-150",
                    on
                      ? "bg-surface-2 shadow-[0_0_0_1px_var(--color-accent)]"
                      : "bg-surface shadow-border hover:shadow-border-hover",
                  )}
                >
                  <Led tone={v.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="block truncate text-xs text-muted">{m.purpose}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-subtle">
                    {m.activeParamsB
                      ? `${m.activeParamsB}A/${m.paramsB}B`
                      : `${m.paramsB}B`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Section>

      <Section kicker="03" title="量化">
        <div className="grid grid-cols-3 gap-1.5">
          {QUANTS.map((q) => {
            const on = q.id === quantId;
            const qFit =
              selected && gpu
                ? estimate({
                    gpu,
                    model: selected,
                    quant: q,
                    context,
                    kv,
                    vramGB,
                    ramGB,
                    backend,
                  })
                : null;
            const tone = qFit ? verdictOf(qFit.verdict).tone : "idle";
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setQuant(q.id)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1 rounded-md px-1.5 font-mono text-xs font-medium transition-[box-shadow,background-color] duration-150 sm:text-sm",
                  on
                    ? "bg-fg text-bg"
                    : "bg-surface text-muted shadow-border hover:text-fg",
                )}
              >
                {on ? null : <Led tone={tone} />}
                {q.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-muted">{quant.qualityNote}</p>
      </Section>

      <Section kicker="04" title="Context">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-lg tabular-nums text-accent">
            {formatTok(context)}
          </span>
          <span className="text-xs text-subtle">上限 {formatTok(maxCtx)}</span>
        </div>
        <input
          type="range"
          min={2048}
          max={maxCtx}
          step={1024}
          value={Math.min(context, maxCtx)}
          onChange={(e) => setContext(Number(e.target.value))}
          className="ctx-slider w-full cursor-pointer"
          aria-label="Context length"
        />
        <div className="flex flex-wrap gap-1.5">
          {CTX_PRESETS.filter((c) => c <= maxCtx).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setContext(c)}
              className={cn(
                "min-h-9 rounded-full px-3 font-mono text-xs tabular-nums transition-colors duration-150",
                context === c
                  ? "bg-fg text-bg"
                  : "bg-surface text-muted shadow-border hover:text-fg",
              )}
            >
              {formatTok(c)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KV_OPTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKv(opt.id)}
              className={cn(
                "min-h-9 rounded-full px-3 text-xs font-medium transition-colors duration-150",
                kv === opt.id
                  ? "bg-surface-2 text-fg shadow-[0_0_0_1px_var(--color-accent)]"
                  : "bg-surface text-muted shadow-border hover:text-fg",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section kicker="05" title="主機">
        <div>
          <p className="mb-1.5 text-xs text-subtle">VRAM 預算</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 items-center gap-2 rounded-md bg-surface px-3 shadow-border">
              <input
                type="number"
                min={4}
                max={192}
                step={1}
                value={useCustomVram ? vramInput : gpu.vramGB}
                onChange={(e) => {
                  setVramInput(Number(e.target.value) || 4);
                  setUseCustomVram(true);
                }}
                className="w-16 bg-transparent font-mono text-sm tabular-nums text-accent outline-none"
                aria-label="自訂 VRAM GB"
              />
              <span className="text-xs text-muted">GB</span>
            </label>
            {useCustomVram ? (
              <button
                type="button"
                onClick={() => setUseCustomVram(false)}
                className="min-h-9 rounded-full bg-surface px-3 text-xs text-muted shadow-border"
              >
                改用顯卡 {gpu.vramGB} GB
              </button>
            ) : (
              <span className="text-xs text-subtle">目前用顯卡容量</span>
            )}
          </div>
        </div>
        <div>
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
        <div>
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
      </Section>
    </div>
  );
}

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-bg-elevated p-3 shadow-border">
      <header className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-xs tabular-nums text-accent">{kicker}</span>
        <h2 className="text-sm font-medium tracking-wide">{title}</h2>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
