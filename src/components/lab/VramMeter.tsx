import { formatGB } from "@/lib/lab/calc";
import type { Fit } from "@/lib/lab/types";
import { cn } from "@/lib/utils";

export function VramMeter({ fit }: { fit: Fit }) {
  const cap = Math.max(fit.usableGB, fit.gpuPlacedGB, 0.5);
  const placedPct = Math.min(100, (fit.gpuPlacedGB / cap) * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="完整需求"
          value={formatGB(fit.demandGB)}
          hint="權重+KV+開銷"
        />
        <Metric
          label="GPU 實際配置"
          value={`${formatGB(fit.gpuPlacedGB)} / ${formatGB(fit.usableGB)}`}
          hint={
            fit.fullOffload
              ? "全部在 GPU"
              : `${fit.gpuLayers}/${fit.totalLayers} 層`
          }
        />
        <Metric
          label="CPU／RAM 承接"
          value={fit.cpuOffloadGB > 0.05 ? formatGB(fit.cpuOffloadGB) : "0"}
          hint={`估需 RAM ${formatGB(fit.ramNeedGB)} · 你有 ${formatGB(fit.ramGB)}`}
          warn={!fit.ramOk && fit.cpuOffloadGB > 0}
        />
        <Metric
          label="容量缺口"
          value={formatGB(fit.gapGB)}
          hint={fit.gapGB > 0.05 ? "需求 − 可用 VRAM" : "無缺口"}
          warn={fit.gapGB > 0.5}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            GPU 佔用
          </p>
          <p className="font-mono text-xs tabular-nums text-subtle">
            {formatGB(fit.gpuPlacedGB)} / {formatGB(fit.usableGB)} 可用
          </p>
        </div>
        <div
          className="h-3 overflow-hidden rounded-sm bg-bg"
          role="img"
          aria-label={`GPU 配置 ${formatGB(fit.gpuPlacedGB)}，可用 ${formatGB(fit.usableGB)}`}
        >
          <span
            className={cn("block h-full", fit.gapGB > 0.5 ? "bg-tight" : "bg-accent")}
            style={{ width: `${placedPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          完整需求 {formatGB(fit.demandGB)}
          {fit.gapGB > 0.05
            ? ` · 缺口 ${formatGB(fit.gapGB)} 不在 GPU 上，不要和 GPU 剩餘 ${formatGB(fit.gpuFreeGB)} 搞混`
            : ` · GPU 剩餘 ${formatGB(fit.gpuFreeGB)}`}
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-bg px-3 py-3 shadow-border">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-base font-medium tabular-nums tracking-tight",
          warn ? "text-tight" : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
