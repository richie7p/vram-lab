import { estimate, formatTok } from "@/lib/lab/calc";
import type { BackendId, Gpu, KvPrecision, Model, Quant } from "@/lib/lab/types";

const STEPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];

export function ContextCurve({
  gpu,
  model,
  quant,
  kv,
  context,
  vramGB,
  ramGB,
  backend,
}: {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  kv: KvPrecision;
  context: number;
  vramGB: number;
  ramGB: number;
  backend: BackendId;
}) {
  const steps = STEPS.filter((c) => c <= model.maxCtx);
  const points = steps.map((c) => {
    const fit = estimate({ gpu, model, quant, context: c, kv, vramGB, ramGB, backend });
    return { c, total: fit.demandGB };
  });
  const maxY = Math.max(vramGB * 1.15, ...points.map((p) => p.total), 1);
  const maxX = Math.max(...points.map((p) => p.c), 1);

  const toX = (c: number) => (c / maxX) * 100;
  const toY = (v: number) => 100 - (v / maxY) * 100;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.c).toFixed(2)} ${toY(p.total).toFixed(2)}`)
    .join(" ");

  const capY = toY(vramGB);
  const nowX = toX(Math.min(context, maxX));

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        Context 對完整需求
      </p>
      <svg
        viewBox="0 0 100 56"
        className="h-28 w-full overflow-visible"
        role="img"
        aria-label="隨著 context 增加，完整 VRAM 需求上升的曲線"
      >
        <line
          x1="0"
          x2="100"
          y1={capY}
          y2={capY}
          className="stroke-line"
          strokeWidth="0.4"
          strokeDasharray="1.5 1.5"
        />
        <path d={d} fill="none" className="stroke-accent" strokeWidth="1.2" />
        <circle
          cx={nowX}
          cy={toY(points.reduce((acc, p) => (p.c <= context ? p.total : acc), points[0]?.total ?? 0))}
          r="1.6"
          className="fill-accent"
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-xs text-subtle">
        <span>{formatTok(steps[0] ?? 0)}</span>
        <span className="text-muted">虛線 = VRAM 預算 {vramGB} GB</span>
        <span>{formatTok(steps[steps.length - 1] ?? 0)}</span>
      </div>
    </div>
  );
}
