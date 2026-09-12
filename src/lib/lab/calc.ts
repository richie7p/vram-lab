import type {
  BackendId,
  EstimateInput,
  Fit,
  Gpu,
  KvPrecision,
  Model,
  Quant,
  Suggestion,
  Verdict,
} from "./types";
import { QUANT_BY_ID } from "./quants";

const GIB = 1024 ** 3;

const KV_BYTES: Record<KvPrecision, number> = {
  fp16: 2,
  q8: 1,
  q4: 0.5,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function usableVramGB(vramGB: number, cards = 1): number {
  const displayReserve = vramGB <= 8 ? 0.4 : vramGB <= 12 ? 0.25 : 0.2;
  const splitLoss = cards > 1 ? vramGB * 0.07 : 0;
  return Math.max(0.5, vramGB - displayReserve - splitLoss);
}

export function weightsGB(model: Model, quant: Quant): number {
  return (model.paramsB * quant.bpw) / 8;
}

export function kvBytesPerToken(model: Model, kv: KvPrecision): number {
  return 2 * model.attnLayers * model.kvHeads * model.headDim * KV_BYTES[kv];
}

export function kvCacheGB(model: Model, context: number, kv: KvPrecision): number {
  return (kvBytesPerToken(model, kv) * context) / GIB;
}

export function overheadGB(vramGB: number, model: Model, context: number): number {
  const cuda = vramGB >= 48 ? 0.7 : vramGB >= 24 ? 0.55 : vramGB >= 12 ? 0.42 : 0.32;
  const compute = 0.16 + Math.sqrt(context / 2048) * 0.11 * (model.attnLayers / 32);
  return cuda + compute + 0.12;
}

function effectiveWeightGB(model: Model, quant: Quant): number {
  const total = weightsGB(model, quant);
  if (!model.activeParamsB || model.kind !== "moe") return total;
  const ratio = clamp(model.activeParamsB / model.paramsB, 0.05, 1);
  return total * (0.35 + 0.65 * ratio);
}

export function rankVerdict(v: Verdict): number {
  return { great: 3, ok: 2, tight: 1, no: 0 }[v];
}

function minVerdict(a: Verdict, b: Verdict): Verdict {
  return rankVerdict(a) <= rankVerdict(b) ? a : b;
}

function speedRange(mid: number): { low: number; high: number; mid: number } {
  const m = Math.max(0.4, mid);
  return {
    mid: round1(m),
    low: round1(m * 0.72),
    high: round1(m * 1.32),
  };
}

export function budgetVramGB(
  gpu: Gpu,
  useCustomVram: boolean,
  vramBudgetGB: number,
): number {
  return useCustomVram ? vramBudgetGB : gpu.vramGB;
}

function backendNotes(backend: BackendId, kv: KvPrecision, quant: Quant): string[] {
  const out: string[] = [];
  if (backend === "vllm") {
    out.push("vLLM 不跑 GGUF。指令只對齊 context 與 GPU 數，量化請改 AWQ／FP8／FP16。");
    out.push("vLLM 沒有 llama.cpp 式的 CPU offload；放不下就需要更多 VRAM 或張量並行。");
  }
  if (backend === "ollama") {
    out.push("Ollama 的 num_gpu 對應 GPU 層數。Flash Attention 靠環境變數，不是所有建置都開。");
    if (kv !== "fp16") out.push("Ollama 對 KV 量化支援不完整，Q8／Q4 KV 以 llama.cpp 較準。");
    if (quant.id === "iq4xs") out.push("Ollama 官方 tag 常沒有 IQ4_XS，請自建 Modelfile 指向 GGUF。");
  }
  if (backend === "llamacpp" && kv !== "fp16") {
    out.push("llama.cpp 用 -ctk / -ctv 設定 KV 精度，需足夠新的建置。");
  }
  return out;
}

type CoreFit = Omit<Fit, "suggestedCtx" | "suggestions">;

function estimateCore(opts: EstimateInput): CoreFit {
  const { gpu, model, quant } = opts;
  const backend: BackendId = opts.backend ?? "llamacpp";
  const ramGB = clamp(opts.ramGB ?? 32, 4, 512);
  const vramGB = Math.max(2, opts.vramGB ?? gpu.vramGB);
  const context = clamp(Math.round(opts.context), 512, model.maxCtx);
  const usable = usableVramGB(vramGB, gpu.cards);
  const weights = weightsGB(model, quant);
  const kvGB = kvCacheGB(model, context, opts.kv);
  const overhead = overheadGB(vramGB, model, context);
  const demand = weights + kvGB + overhead;
  const perLayer = weights / Math.max(model.layers, 1);

  const notes = backendNotes(backend, opts.kv, quant);
  const vllmStrict = backend === "vllm";

  let gpuLayers = model.layers;
  let fullOffload = demand <= usable + 0.05;
  if (vllmStrict && !fullOffload) {
    gpuLayers = 0;
  } else if (!fullOffload) {
    const vramForWeights = Math.max(0, usable - kvGB - overhead);
    gpuLayers = clamp(Math.floor(vramForWeights / Math.max(perLayer, 0.01)), 0, model.layers);
    if (gpuLayers >= model.layers) {
      fullOffload = true;
      gpuLayers = model.layers;
    }
  }

  const cpuOffloadGB = fullOffload ? 0 : Math.max(0, weights - gpuLayers * perLayer);
  const gpuPlaced = fullOffload
    ? demand
    : Math.min(usable, gpuLayers * perLayer + kvGB + overhead);
  const gpuFree = usable - gpuPlaced;
  const gap = Math.max(0, demand - usable);
  const headroomPct = vramGB > 0 ? gpuFree / vramGB : 0;

  const ramNeed = 6 + cpuOffloadGB * 1.15 + Math.min(context / 8192, 3) * 0.35;
  const ramOk = ramGB + 0.25 >= ramNeed;

  const gpuFrac = gpuLayers / model.layers;
  const bytesPerTokGB = effectiveWeightGB(model, quant);
  const bw = gpu.bandwidthGBs * gpu.decodeEfficiency;
  const memSeconds = bytesPerTokGB / Math.max(bw, 1);
  const kernelSeconds = gpu.kernelMs / 1000;
  let mid = 1 / (memSeconds + kernelSeconds);

  if (!fullOffload) {
    if (vllmStrict) mid *= 0.02;
    else mid *= Math.pow(Math.max(gpuFrac, 0.05), 2.35);
  }
  if (!ramOk && cpuOffloadGB > 0) mid *= 0.35;

  const speed = speedRange(mid);

  let verdict: Verdict;
  if (vllmStrict && !fullOffload) {
    verdict = "no";
  } else if (gpuLayers <= 0 || (!fullOffload && gpuFrac < 0.32 && speed.high < 4)) {
    verdict = "no";
  } else if (!fullOffload && gpuFrac < 0.45) {
    verdict = "no";
  } else if (!fullOffload && gpuFrac <= 0.85) {
    verdict = speed.low >= 5 ? "tight" : "no";
  } else if (!fullOffload) {
    verdict = speed.low >= 8 ? "ok" : "tight";
  } else if (headroomPct >= 0.16 && speed.low >= 16 && context >= 4096) {
    verdict = "great";
  } else if (headroomPct >= 0.08 && speed.low >= 9) {
    verdict = "ok";
  } else if (headroomPct >= 0.02 && speed.low >= 5) {
    verdict = "ok";
  } else if (speed.high >= 4) {
    verdict = "tight";
  } else {
    verdict = "no";
  }

  if (!ramOk && cpuOffloadGB > 0.4) {
    verdict = ramNeed > ramGB * 1.4 ? "no" : minVerdict(verdict, "tight");
    notes.push(
      `CPU offload 估需系統 RAM ${round1(ramNeed)} GB，目前 ${ramGB} GB${ramNeed > ramGB * 1.4 ? "，很可能跑不起來" : "，會大量走 swap"}。`,
    );
  }

  let qualityCap: Verdict = "great";
  if (quant.id === "q2") qualityCap = "ok";
  if (opts.kv === "q4") qualityCap = minVerdict(qualityCap, "ok");
  verdict = minVerdict(verdict, qualityCap);

  const demandR = round2(demand);
  const gpuFreeR = round2(gpuFree);

  return {
    weightsGB: round2(weights),
    kvGB: round2(kvGB),
    overheadGB: round2(overhead),
    demandGB: demandR,
    totalGB: demandR,
    gpuPlacedGB: round2(gpuPlaced),
    usableGB: round2(usable),
    vramGB: round2(vramGB),
    gpuFreeGB: gpuFreeR,
    freeGB: gpuFreeR,
    gapGB: round2(gap),
    headroomPct,
    fullOffload,
    gpuLayers,
    totalLayers: model.layers,
    cpuOffloadGB: round2(cpuOffloadGB),
    ramGB: round1(ramGB),
    ramNeedGB: round1(ramNeed),
    ramOk,
    backend,
    backendNotes: notes,
    verdict,
    speedLow: speed.low,
    speedHigh: speed.high,
    speedMid: speed.mid,
    kvBytesPerToken: kvBytesPerToken(model, opts.kv),
    qualityCap,
  };
}

export function estimate(opts: EstimateInput): Fit {
  const core = estimateCore(opts);
  const suggestedCtx = suggestContext(opts);
  const suggestions = buildSuggestions({ ...opts, fit: { ...core, suggestedCtx } });
  return { ...core, suggestedCtx, suggestions };
}

export function suggestContext(opts: EstimateInput): number {
  const steps = [
    2048, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 49152, 65536, 98304, 131072,
  ].filter((c) => c <= opts.model.maxCtx);

  let best = Math.min(2048, opts.model.maxCtx);
  for (const ctx of steps) {
    const fit = estimateCore({ ...opts, context: ctx });
    if (rankVerdict(fit.verdict) >= 2 && fit.fullOffload) best = ctx;
    else break;
  }
  return best;
}

function buildSuggestions(
  opts: EstimateInput & { fit: CoreFit & { suggestedCtx: number } },
): Suggestion[] {
  const out: Suggestion[] = [];
  const { gpu, model, quant, context, kv, fit } = opts;
  const vramGB = opts.vramGB ?? gpu.vramGB;

  if (fit.gapGB >= 1) {
    out.push({
      text: `完整需求 ${formatGB(fit.demandGB)}，可用 ${formatGB(fit.usableGB)}，缺口 ${formatGB(fit.gapGB)}。`,
    });
  }

  if (!fit.fullOffload) {
    const lighter = (["q2", "q3km", "iq4xs", "q4ks", "q4km", "q5", "q6", "q8", "fp16"] as const)
      .map((id) => QUANT_BY_ID[id])
      .filter((q) => q.bpw < quant.bpw)
      .reverse();
    for (const q of lighter) {
      const trial = peekFit({ ...opts, quant: q });
      if (trial.full) {
        out.push({
          text: `改用 ${q.label} 可完整 GPU offload（權重約 ${trial.weights.toFixed(1)} GB）。`,
          action: { kind: "quant", id: q.id },
          actionLabel: `改 ${q.label}`,
        });
        break;
      }
    }

    if (context > 4096) {
      const trial = peekFit({ ...opts, context: 4096 });
      if (trial.full) {
        out.push({
          text: "把 context 降到 4K，這個量化就能完整放進 GPU。",
          action: { kind: "ctx", value: 4096 },
          actionLabel: "降到 4K",
        });
      }
    }

    if (kv === "fp16") {
      const trial = peekFit({ ...opts, kv: "q8" });
      if (trial.full) {
        out.push({
          text: "把 KV cache 改成 Q8 可能剛好塞進 VRAM。",
          action: { kind: "kv", value: "q8" },
          actionLabel: "KV Q8",
        });
      }
    }
  } else if (fit.gpuFreeGB < 1.2 && context >= 8192) {
    out.push({
      text: "VRAM 剩餘不多。長對話時 KV 會繼續漲，建議留 15% 以上餘裕。",
      action:
        fit.suggestedCtx < context
          ? { kind: "ctx", value: fit.suggestedCtx }
          : undefined,
      actionLabel: fit.suggestedCtx < context ? `改 ${formatTok(fit.suggestedCtx)}` : undefined,
    });
  }

  if (context > model.nativeCtx) {
    out.push({
      text: `超過模型原生約 ${formatTok(model.nativeCtx)} context，RoPE/YaRN 外推可能讓品質下滑。`,
      action: { kind: "ctx", value: model.nativeCtx },
      actionLabel: `回到 ${formatTok(model.nativeCtx)}`,
    });
  }

  if (quant.id === "q2") {
    out.push({ text: "Q2 能跑不代表能用。指令遵循與推理會明顯變差，只適合實驗。" });
  }

  if (model.kind === "moe") {
    out.push({
      text: "MoE 必須載入全部 expert 權重；省的是 decode 時的有效計算量，不是 VRAM。",
    });
  }

  if (gpu.id === "4060m" && vramGB === gpu.vramGB) {
    out.push({
      text: "筆電功耗牆會讓 tok/s 落在區間低端，插電且解除功耗限制時較準。",
    });
  }

  if (gpu.cards > 1) {
    out.push({
      text: "雙卡速度不是 2 倍。PCIe tensor split 通常約 1.5–1.8× 單卡。",
    });
  }

  if (fit.verdict === "great" && quant.id === "q4km" && fit.gpuFreeGB > 4) {
    const trial = peekFit({ ...opts, quant: QUANT_BY_ID.q5 });
    if (trial.full && trial.free > 1.5) {
      out.push({
        text: "VRAM 還有空間，升到 Q5 通常是免費的品質升級。",
        action: { kind: "quant", id: "q5" },
        actionLabel: "升 Q5",
      });
    }
  }

  if (fit.suggestedCtx !== context && fit.fullOffload && fit.suggestedCtx > context) {
    out.push({
      text: `以目前量化，context 可以開到 ${formatTok(fit.suggestedCtx)} 仍完整 offload。`,
      action: { kind: "ctx", value: fit.suggestedCtx },
      actionLabel: `開 ${formatTok(fit.suggestedCtx)}`,
    });
  }

  return out.slice(0, 5);
}

function peekFit(opts: EstimateInput) {
  const gpu = opts.gpu;
  const vramGB = opts.vramGB ?? gpu.vramGB;
  const usable = usableVramGB(vramGB, gpu.cards);
  const weights = weightsGB(opts.model, opts.quant);
  const kvGB = kvCacheGB(opts.model, opts.context, opts.kv);
  const overhead = overheadGB(vramGB, opts.model, opts.context);
  const total = weights + kvGB + overhead;
  return { full: total <= usable + 0.05, weights, free: usable - total };
}

export function formatTok(n: number): string {
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}K`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

export function formatGB(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10) return `${n.toFixed(1)} GB`;
  return `${n.toFixed(2)} GB`;
}

export function formatKvTok(bytes: number): string {
  const kib = bytes / 1024;
  if (kib >= 100) return `${Math.round(kib)} KiB/tok`;
  return `${kib.toFixed(1)} KiB/tok`;
}

export function pinId(p: {
  gpuId: string;
  useCustomVram?: boolean;
  vramBudgetGB?: number;
  ramGB?: number;
  backend?: string;
  modelId: string;
  quantId: string;
  context: number;
  kv: string;
}): string {
  const vram = p.useCustomVram ? `c${p.vramBudgetGB}` : "gpu";
  return `${p.gpuId}|${vram}|${p.ramGB ?? 32}|${p.backend ?? "llamacpp"}|${p.modelId}|${p.quantId}|${p.context}|${p.kv}`;
}
