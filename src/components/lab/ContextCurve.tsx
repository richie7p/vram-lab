import { estimate, formatGB, formatTok } from "@/lib/lab/calc";
import type { BackendId, Gpu, KvPrecision, Model, Quant } from "@/lib/lab/types";

const STEPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
const W = 100;
const H = 40;

export function ContextCurve({
  gpu,
  model,
  quant,
  kv,
  context,
  vramGB,
  ramGB,
  backend,
  usableGB,
}: {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  kv: KvPrecision;
  context: number;
  vramGB: number;
  ramGB: number;
  backend: BackendId;
  usableGB: number;
}) {
  const steps = STEPS.filter((c) => c <= model.maxCtx);
  if (steps.length < 2) return null;

  const demandAt = (c: number) =>
    estimate({ gpu, model, quant, context: c, kv, vramGB, ramGB, backend }).demandGB;
  const points = steps.map((c) => ({ c, total: demandAt(c) }));
  const nowCtx = Math.min(Math.max(context, steps[0]), steps[steps.length - 1]);
  const nowTotal = demandAt(nowCtx);

  const maxY = Math.max(usableGB * 1.2, ...points.map((p) => p.total), 1);
  const lo = Math.log2(steps[0]);
  const hi = Math.log2(steps[steps.length - 1]);
  const toX = (c: number) => ((Math.log2(c) - lo) / (hi - lo)) * W;
  const toY = (v: number) => H - (Math.min(v, maxY) / maxY) * H;

  // First point where the curve crosses the usable line (linear in log-x).
  let cross: { c: number; x: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.total <= usableGB && b.total > usableGB) {
      const t = (usableGB - a.total) / (b.total - a.total);
      const logC = Math.log2(a.c) + t * (Math.log2(b.c) - Math.log2(a.c));
      cross = { c: 2 ** logC, x: toX(2 ** logC) };
      break;
    }
  }
  const allOver = points[0].total > usableGB;

  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const xy = points.map((p) => ({ x: toX(p.c), y: toY(p.total) }));
  let under = xy;
  let over: typeof xy = [];
  if (allOver) {
    under = [];
    over = xy;
  } else if (cross) {
    const crossPt = { x: cross.x, y: toY(usableGB) };
    const idx = points.findIndex((p) => p.total > usableGB);
    under = [...xy.slice(0, idx), crossPt];
    over = [crossPt, ...xy.slice(idx)];
  }

  const capY = toY(usableGB);
  const nowOver = nowTotal > usableGB;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Context 對完整需求</p>
        <p className="font-mono text-xs tabular-nums text-subtle">
          {allOver
            ? "最短 context 就超過可用 VRAM"
            : cross
              ? `約 ${formatTok(Math.round(cross.c / 1024) * 1024)} 起超過可用 VRAM`
              : `到 ${formatTok(steps[steps.length - 1])} 都放得下`}
        </p>
      </div>
      <div className="relative h-32 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`完整 VRAM 需求隨 context 上升，虛線為可用 VRAM ${formatGB(usableGB)}`}
        >
          {steps.map((c) => (
            <line
              key={c}
              x1={toX(c)}
              x2={toX(c)}
              y1="0"
              y2={H}
              className="stroke-line"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1="0"
            x2={W}
            y1={capY}
            y2={capY}
            className="stroke-line-strong"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          {under.length > 1 ? (
            <path
              d={line(under)}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {over.length > 1 ? (
            <path
              d={line(over)}
              fill="none"
              className="stroke-tight"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        <span
          className={`pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg-elevated ${nowOver ? "bg-tight" : "bg-accent"}`}
          style={{ left: `${toX(nowCtx)}%`, top: `${(toY(nowTotal) / H) * 100}%` }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 font-mono text-[10px] tabular-nums text-subtle"
          style={{ top: `${(capY / H) * 100}%` }}
        >
          可用 {formatGB(usableGB)}
        </span>
      </div>
      <div className="relative mt-1.5 h-4 font-mono text-[10px] tabular-nums text-subtle sm:text-xs">
        {steps.map((c, i) => {
          const edge = i === 0 ? "translate-x-0" : i === steps.length - 1 ? "-translate-x-full" : "-translate-x-1/2";
          // Thin out labels on phones; keep both ends.
          const thin = steps.length > 5 && i % 2 === 1 && i !== steps.length - 1;
          return (
            <span
              key={c}
              className={`absolute top-0 ${edge} ${thin ? "hidden sm:inline" : ""}`}
              style={{ left: `${toX(c)}%` }}
            >
              {formatTok(c)}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        目前 {formatTok(context)} 需求 {formatGB(nowTotal)} · 預算 {vramGB} GB（扣保留後可用{" "}
        {formatGB(usableGB)}）
      </p>
    </div>
  );
}
