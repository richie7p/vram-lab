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

/** KV bytes per token if every attention layer kept the full context. */
export function kvBytesPerToken(model: Model, kv: KvPrecision): number {
  return 2 * model.attnLayers * model.kvHeads * model.headDim * KV_BYTES[kv];
}

/**
 * Layer-tokens held in KV. Sliding-window (Gemma 3) and chunked (Llama 4)
 * layers cap at their window, so long context mostly costs the global layers.
 */
function kvLayerTokens(model: Model, context: number): number {
  const local = clamp(model.swa?.localLayers ?? 0, 0, model.attnLayers);
  const window = model.swa?.window ?? context;
  return (model.attnLayers - local) * context + local * Math.min(context, window);
}

export function kvCacheGB(model: Model, context: number, kv: KvPrecision): number {
  const perLayerToken = kvBytesPerToken(model, kv) / Math.max(model.attnLayers, 1);
  return (perLayerToken * kvLayerTokens(model, context)) / GIB;
}

/** Average KV bytes per token at this context (accounts for sliding windows). */
export function kvBytesPerTokenAt(model: Model, context: number, kv: KvPrecision): number {
  return (kvCacheGB(model, context, kv) * GIB) / Math.max(context, 1);
}

export function overheadGB(vramGB: number, model: Model, context: number): number {
  const cuda = vramGB >= 48 ? 0.7 : vramGB >= 24 ? 0.55 : vramGB >= 12 ? 0.42 : 0.32;
  const compute = 0.16 + Math.sqrt(context / 2048) * 0.11 * (model.attnLayers / 32);
  return cuda + compute + 0.12;
}

/** Desktop dual-channel DDR5, effective bandwidth for CPU-resident weights. */
export const CPU_BANDWIDTH_GBS = 55;
/** PCIe 4.0 x16 effective; offloaded weights are streamed per ubatch during prefill. */
const PCIE_GBS = 24;
const UBATCH = 512;
/** Routed-expert reads are less coalesced than dense GEMV; shared weights read almost like dense. */
const MOE_READ_FACTOR = 1.8;
const MOE_SHARED_FACTOR = 1.1;

/** Bytes read from memory per decoded token (GB). */
function decodeBytesGB(model: Model, quant: Quant): number {
  if (model.kind !== "moe" || !model.activeParamsB) return weightsGB(model, quant);
  const split = moeSplit(model, quant);
  if (split) {
    return split.nonExpertGB * MOE_SHARED_FACTOR + split.activeExpertGB * MOE_READ_FACTOR;
  }
  const active = Math.min(model.activeParamsB, model.paramsB);
  return ((active * quant.bpw) / 8) * MOE_READ_FACTOR;
}

/** MoE split for llama.cpp --n-cpu-moe: always-on weights vs routed experts. */
function moeSplit(model: Model, quant: Quant) {
  if (model.kind !== "moe" || !model.nonExpertB || !model.activeParamsB) return null;
  const toGB = (b: number) => (b * quant.bpw) / 8;
  const nonExpertGB = toGB(model.nonExpertB);
  const expertGB = toGB(model.paramsB - model.nonExpertB);
  const activeExpertGB = toGB(Math.max(model.activeParamsB - model.nonExpertB, 0));
  return {
    nonExpertGB,
    expertPerLayerGB: expertGB / Math.max(model.layers, 1),
    activeExpertGB,
  };
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

function backendNotes(
  backend: BackendId,
  kv: KvPrecision,
  quant: Quant,
  gpu: Gpu,
): string[] {
  const out: string[] = [];
  if (backend === "vllm" && gpu.vendor === "apple") {
    out.push("vLLM 不支援 Apple Silicon GPU。Mac 請用 llama.cpp、Ollama 或 MLX。");
  }
  if (backend === "vllm") {
    out.push("vLLM 沒有 llama.cpp 式的 CPU offload；放不下就需要更多 VRAM 或張量並行。");
  }
  if (backend === "ollama") {
    out.push("Ollama 的 num_gpu 對應 GPU 層數。Flash Attention 與 KV 精度是 ollama serve 的環境變數，對所有模型生效。");
    if (kv !== "fp16") out.push("Ollama 的 KV 量化（OLLAMA_KV_CACHE_TYPE）需同時開 Flash Attention，部分模型會自動退回 FP16。");
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
  const unified = Boolean(gpu.unifiedMemGB);
  const ramGB = unified ? gpu.unifiedMemGB! : clamp(opts.ramGB ?? 32, 4, 512);
  let vramGB = Math.max(2, opts.vramGB ?? gpu.vramGB);
  // vLLM tensor parallel shards evenly, so a mixed pair only gets 2 × the smaller card.
  const uneven = gpu.split && Math.min(...gpu.split) !== Math.max(...gpu.split);
  if (backend === "vllm" && uneven && (opts.vramGB ?? gpu.vramGB) === gpu.vramGB) {
    vramGB = Math.min(...gpu.split!) * gpu.split!.length;
  }
  const context = clamp(Math.round(opts.context), 512, model.maxCtx);
  const parallel = clamp(Math.round(opts.parallel ?? 1), 1, 16);
  const usable = usableVramGB(vramGB, gpu.cards);
  const weights = weightsGB(model, quant);
  // Each concurrent slot keeps its own full-length KV.
  const kvSlotGB = kvCacheGB(model, context, opts.kv);
  const kvGB = kvSlotGB * parallel;
  const overhead = overheadGB(vramGB, model, context);
  const demand = weights + kvGB + overhead;
  const perLayer = weights / Math.max(model.layers, 1);

  const notes = backendNotes(backend, opts.kv, quant, gpu);
  if (backend === "vllm" && uneven) {
    notes.push(`vLLM 張量並行平均切分，混搭雙卡只能用 2 × ${Math.min(...gpu.split!)}GB = ${vramGB}GB。`);
  }
  const vllmStrict = backend === "vllm";
  const vllmBlocked = vllmStrict && gpu.vendor === "apple";

  let gpuLayers = model.layers;
  let fullOffload = demand <= usable + 0.05;
  let moeOffload = false;
  let cpuMoeLayers = 0;
  let cpuOffloadGB = 0;
  let gpuPlaced = demand;

  const moe = moeSplit(model, quant);
  if (!fullOffload && vllmStrict) {
    gpuLayers = 0;
    gpuPlaced = Math.min(usable, demand);
  } else if (!fullOffload) {
    // Plain layer split (-ngl / num_gpu).
    const vramForWeights = Math.max(0, usable - kvGB - overhead);
    gpuLayers = clamp(Math.floor(vramForWeights / Math.max(perLayer, 0.01)), 0, model.layers);
    if (gpuLayers >= model.layers) {
      fullOffload = true;
      gpuLayers = model.layers;
    } else {
      cpuOffloadGB = Math.max(0, weights - gpuLayers * perLayer);
      gpuPlaced = Math.min(usable, gpuLayers * perLayer + kvGB + overhead);
    }

    // llama.cpp can instead keep every layer's attention on GPU and push only
    // routed experts to CPU, which is much faster for MoE.
    if (!fullOffload && moe && backend === "llamacpp") {
      const base = moe.nonExpertGB + kvGB + overhead;
      if (base <= usable) {
        const gpuExpertLayers = clamp(
          Math.floor((usable - base) / Math.max(moe.expertPerLayerGB, 0.01)),
          0,
          model.layers,
        );
        moeOffload = true;
        gpuLayers = model.layers;
        cpuMoeLayers = model.layers - gpuExpertLayers;
        cpuOffloadGB = cpuMoeLayers * moe.expertPerLayerGB;
        gpuPlaced = base + gpuExpertLayers * moe.expertPerLayerGB;
      }
    }
  }

  const gpuFree = usable - gpuPlaced;
  const gap = Math.max(0, demand - usable);
  const headroomPct = vramGB > 0 ? gpuFree / vramGB : 0;

  // Unified memory: GPU allocations come out of the same pool as the OS.
  const ramNeed =
    6 +
    cpuOffloadGB * 1.05 +
    Math.min(context / 8192, 3) * 0.35 +
    (unified ? gpuPlaced : 0);
  const ramOk = ramGB + 0.25 >= ramNeed;

  // ---- decode speed: time per token = GPU bytes / GPU bw + CPU bytes / CPU bw
  const gpuBw = Math.max(gpu.bandwidthGBs * gpu.decodeEfficiency, 1);
  const cpuBw = unified
    ? (gpu.cpuBandwidthGBs ?? CPU_BANDWIDTH_GBS)
    : (opts.cpuBandwidthGBs ?? gpu.cpuBandwidthGBs ?? CPU_BANDWIDTH_GBS);
  const kernelSeconds = gpu.kernelMs / 1000;
  const decodeGB = decodeBytesGB(model, quant);
  let gpuReadGB = decodeGB;
  let cpuReadGB = 0;
  if (moeOffload && moe) {
    const cpuFrac = cpuMoeLayers / model.layers;
    gpuReadGB =
      moe.nonExpertGB * MOE_SHARED_FACTOR + moe.activeExpertGB * (1 - cpuFrac) * MOE_READ_FACTOR;
    cpuReadGB = moe.activeExpertGB * cpuFrac * 1.3;
  } else if (!fullOffload) {
    const gpuFrac = gpuLayers / model.layers;
    gpuReadGB = decodeGB * gpuFrac;
    cpuReadGB = decodeGB * (1 - gpuFrac);
  }
  // Every decoded token also reads its sequence's KV (half full on average);
  // batched slots share the weight read but each reads its own KV.
  const kvReadGB = kvSlotGB * 0.5 * parallel;
  const kvGpuFrac = fullOffload || moeOffload ? 1 : gpuLayers / model.layers;
  const kernelScale = (moeOffload ? 1.4 : 1) * (1 + 0.1 * (parallel - 1));
  const stepSeconds =
    (gpuReadGB + kvReadGB * kvGpuFrac) / gpuBw +
    (cpuReadGB + kvReadGB * (1 - kvGpuFrac)) / cpuBw +
    kernelSeconds * kernelScale;
  let mid = 1 / stepSeconds;
  if (!fullOffload && vllmStrict) mid *= 0.02;
  if (!ramOk && cpuOffloadGB > 0) mid *= 0.35;
  const speed = speedRange(mid);

  // ---- prefill: compute-bound on GPU; CPU-resident weights stream over PCIe
  const activeB = Math.min(model.activeParamsB ?? model.paramsB, model.paramsB);
  const flopsPerTok = 2 * activeB * 1e9;
  const moeEff = model.kind === "moe" ? 0.55 : 1;
  const attnDecay = 1 / (1 + context / 131072);
  let ppSecPerTok = flopsPerTok / (gpu.ppTflops * 1e12 * moeEff * attnDecay);
  if (cpuOffloadGB > 0) {
    ppSecPerTok += unified
      ? (flopsPerTok * (cpuOffloadGB / weights)) / 1.5e12
      : cpuOffloadGB / PCIE_GBS / UBATCH;
  }
  if (!fullOffload && vllmStrict) ppSecPerTok *= 50;
  const prefillTokS = Math.max(1, Math.round(1 / ppSecPerTok));
  const fillSec = round1(context / prefillTokS);

  // ---- verdict
  const gpuFrac = gpuLayers / model.layers;
  let verdict: Verdict;
  if (vllmBlocked || (vllmStrict && !fullOffload)) {
    verdict = "no";
  } else if (moeOffload) {
    verdict = speed.low >= 10 ? "ok" : speed.low >= 5 ? "tight" : "no";
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

  if (!ramOk && (cpuOffloadGB > 0.4 || unified)) {
    verdict = ramNeed > ramGB * 1.4 ? "no" : minVerdict(verdict, "tight");
    notes.push(
      `${unified ? "統一記憶體" : "CPU offload"} 估需 RAM ${round1(ramNeed)} GB，目前 ${ramGB} GB${ramNeed > ramGB * 1.4 ? "，很可能跑不起來" : "，會大量走 swap"}。`,
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
    moeOffload,
    cpuMoeLayers,
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
    parallel,
    aggregateTokS: Math.round(speed.mid * parallel),
    prefillTokS,
    fillSec,
    unified,
    kvBytesPerToken: kvBytesPerTokenAt(model, context, opts.kv),
    qualityCap,
  };
}

export type QuickFit = CoreFit;

/** Fit without suggested context or suggestions: for lists, curves and LEDs. */
export function estimateQuick(opts: EstimateInput): QuickFit {
  return estimateCore(opts);
}

export function estimate(opts: EstimateInput): Fit {
  const core = estimateCore(opts);
  const suggestedCtx = suggestContext(opts);
  const suggestions = buildSuggestions({ ...opts, fit: { ...core, suggestedCtx } });
  return { ...core, suggestedCtx, suggestions };
}

export function suggestContext(opts: EstimateInput): number {
  const steps = [
    2048, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 49152, 65536, 98304, 131072, 196608, 262144,
  ].filter((c) => c <= opts.model.maxCtx);

  let best = Math.min(2048, opts.model.maxCtx);
  for (const ctx of steps) {
    const fit = estimateCore({ ...opts, context: ctx });
    if (rankVerdict(fit.verdict) >= 2 && (fit.fullOffload || fit.moeOffload)) best = ctx;
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

  if (fit.moeOffload) {
    out.push({
      text: `MoE expert offload：注意力層與 KV 全在 GPU，${fit.cpuMoeLayers}/${fit.totalLayers} 層的 expert 放 CPU（llama.cpp --n-cpu-moe ${fit.cpuMoeLayers}），比逐層切分快。`,
    });
  } else if (
    !fit.fullOffload &&
    model.kind === "moe" &&
    model.nonExpertB &&
    fit.backend === "ollama"
  ) {
    out.push({
      text: "Ollama 只能逐層切分。改用 llama.cpp 的 --n-cpu-moe 只把 expert 放 CPU，注意力和 KV 都留在 GPU，速度與長 prompt 處理都會明顯更好。",
      action: { kind: "backend", value: "llamacpp" },
      actionLabel: "改 llama.cpp",
    });
  }

  if (!fit.fullOffload && gpu.vendor === "apple" && !fit.moeOffload) {
    const total = gpu.unifiedMemGB ?? vramGB;
    out.push({
      text: `macOS 預設只讓 GPU 用約 75% 統一記憶體。可用 sudo sysctl iogpu.wired_limit_mb=${Math.round((total - 8) * 1024)} 調高（保留約 8GB 給系統）。`,
    });
  }

  if (fit.fillSec >= 60 && context >= 16384) {
    out.push({
      text: `讀滿 ${formatTok(context)} 的 prompt 約要 ${formatDuration(fit.fillSec)}（約 ${fit.prefillTokS} tok/s）。長文件、RAG、coding agent 會先卡在這裡。`,
    });
  }

  if (!fit.fullOffload && !fit.moeOffload) {
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
  } else if (fit.fullOffload && fit.gpuFreeGB < 1.2 && context >= 8192) {
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

  if (model.swa && context > model.swa.window) {
    out.push({
      text: `${model.swa.localLayers}/${model.attnLayers} 層只保留最近 ${formatTok(model.swa.window)} token 的 KV，長 context 主要吃剩下的全域層。需後端支援 SWA（新版 llama.cpp／Ollama／vLLM）。`,
    });
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
      text: gpu.split
        ? `雙卡 layer split 是兩張卡輪流算，不會變 2 倍快；好處是容量相加（${gpu.split.join(" + ")} GB）。`
        : "雙卡速度不是 2 倍。PCIe tensor split 通常約 1.5–1.8× 單卡。",
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

  return out.slice(0, 6);
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

export function formatDuration(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 90) return `${Math.round(sec)} 秒`;
  if (sec < 5400) return `${Math.round(sec / 60)} 分鐘`;
  return `${(sec / 3600).toFixed(1)} 小時`;
}

export function formatTokS(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
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
