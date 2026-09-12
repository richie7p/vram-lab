import { estimate, formatGB, formatTok } from "./calc";
import { GPUS } from "./gpus";
import { MODELS } from "./models";
import { QUANT_BY_ID } from "./quants";
import type { BackendId, Cost, Fit, Gpu, Model, Quant, Verdict } from "./types";

export type RecCard = {
  title: string;
  model: Model;
  quant: Quant;
  context: number;
  fit: Fit;
  purpose: string;
  why: string;
  costs: Cost[];
};

export type RecResult = {
  vramGB: number;
  ramGB: number;
  backend: BackendId;
  gpuHint: Gpu | null;
  comfortable: RecCard | null;
  challenge: RecCard | null;
  also: RecCard[];
};

function syntheticGpu(vramGB: number): Gpu {
  const nearest = [...GPUS].sort(
    (a, b) => Math.abs(a.vramGB - vramGB) - Math.abs(b.vramGB - vramGB),
  )[0];
  const scale = nearest.vramGB > 0 ? vramGB / nearest.vramGB : 1;
  return {
    ...nearest,
    name: `${vramGB} GB VRAM`,
    shortName: `${vramGB} GB`,
    vramGB,
    bandwidthGBs: nearest.bandwidthGBs * Math.min(1.4, Math.max(0.7, Math.sqrt(scale))),
    note: `以最接近的 ${nearest.name} 頻寬特性做速度估計。容量仍按 ${vramGB} GB 計算。`,
  };
}

function scoreComfort(model: Model, quant: Quant, fit: Fit): number {
  if (fit.verdict === "no" || !fit.fullOffload) return -1;
  if (fit.verdict === "tight") return -0.2;
  const vBonus = fit.verdict === "great" ? 1.12 : 1;
  const sweet =
    quant.id === "q4km" || quant.id === "q5" || quant.id === "iq4xs"
      ? 1.22
      : quant.id === "q6"
        ? 1.05
        : quant.id === "q4ks"
          ? 1.08
          : quant.id === "q3km"
            ? 0.7
            : quant.id === "q2"
              ? 0.25
              : 0.82;
  const cap = Math.log2(Math.max(model.paramsB, 1));
  const moe = model.kind === "moe" ? 1.14 : 1;
  const head = 0.9 + Math.min(Math.max(fit.headroomPct, 0), 0.28);
  const speed = Math.min(fit.speedLow / 18, 1.15);
  return vBonus * sweet * (0.3 + cap * 0.44) * moe * head * (0.75 + 0.25 * speed);
}

function scoreChallenge(model: Model, quant: Quant, fit: Fit): number {
  if (fit.verdict === "no") return -1;
  const size = model.paramsB;
  const penalty = fit.fullOffload ? 1 : 0.62;
  const q = quant.id === "q2" ? 0.78 : 1;
  const v = fit.verdict === "tight" ? 1.08 : 1;
  return size * penalty * q * v;
}

const CTX_COMFORT = 8192;
const CTX_CHALLENGE = 4096;

function bestQuantFor(
  gpu: Gpu,
  model: Model,
  context: number,
  mode: "comfort" | "challenge",
  ramGB: number,
  backend: BackendId,
): { quant: Quant; fit: Fit } | null {
  const order =
    mode === "comfort"
      ? (["q4km", "iq4xs", "q5", "q6", "q8", "fp16"] as const)
      : (["q4km", "q3km", "iq4xs", "q2", "q5"] as const);

  let best: { quant: Quant; fit: Fit; score: number } | null = null;
  for (const id of order) {
    const quant = QUANT_BY_ID[id];
    const fit = estimate({
      gpu,
      model,
      quant,
      context,
      kv: "fp16",
      vramGB: gpu.vramGB,
      ramGB,
      backend,
    });
    const score =
      mode === "comfort" ? scoreComfort(model, quant, fit) : scoreChallenge(model, quant, fit);
    if (score < 0) continue;
    if (mode === "comfort" && !fit.fullOffload) continue;
    if (!best || score > best.score) best = { quant, fit, score };
  }
  return best;
}

export function recommendForVram(
  vramGB: number,
  ramGB = 32,
  backend: BackendId = "llamacpp",
): RecResult {
  const vram = Math.min(192, Math.max(4, vramGB));
  const gpu = syntheticGpu(vram);
  const nearestGpu =
    [...GPUS].sort((a, b) => Math.abs(a.vramGB - vram) - Math.abs(b.vramGB - vram))[0] ?? null;

  const comforts: RecCard[] = [];
  const challenges: RecCard[] = [];

  for (const model of MODELS) {
    const c = bestQuantFor(
      gpu,
      model,
      Math.min(CTX_COMFORT, model.maxCtx),
      "comfort",
      ramGB,
      backend,
    );
    if (c) {
      comforts.push({
        title: "最舒服",
        model,
        quant: c.quant,
        context: Math.min(CTX_COMFORT, model.maxCtx),
        fit: c.fit,
        purpose: model.purpose,
        why: comfortWhy(model, c.quant, c.fit),
        costs: [],
      });
    }
    const h = bestQuantFor(
      gpu,
      model,
      Math.min(CTX_CHALLENGE, model.maxCtx),
      "challenge",
      ramGB,
      backend,
    );
    if (h) {
      challenges.push({
        title: "最大挑戰",
        model,
        quant: h.quant,
        context: Math.min(CTX_CHALLENGE, model.maxCtx),
        fit: h.fit,
        purpose: model.purpose,
        why: challengeWhy(model, h.quant, h.fit),
        costs: challengeCosts(h.quant, h.fit),
      });
    }
  }

  comforts.sort((a, b) => scoreComfort(b.model, b.quant, b.fit) - scoreComfort(a.model, a.quant, a.fit));
  challenges.sort(
    (a, b) => scoreChallenge(b.model, b.quant, b.fit) - scoreChallenge(a.model, a.quant, a.fit),
  );

  const comfortable = comforts[0] ?? null;
  const challenge =
    challenges.find((c) => !comfortable || c.model.id !== comfortable.model.id) ??
    challenges[0] ??
    null;

  const also = comforts
    .filter(
      (c) =>
        c.model.id !== comfortable?.model.id &&
        c.model.id !== challenge?.model.id &&
        c.fit.verdict !== "tight",
    )
    .slice(0, 3)
    .map((c) => ({ ...c, title: "也適合" }));

  return { vramGB: vram, ramGB, backend, gpuHint: nearestGpu, comfortable, challenge, also };
}

function comfortWhy(model: Model, quant: Quant, fit: Fit): string {
  const bits = [
    `${quant.label} 完整 GPU offload`,
    `需求 ${formatGB(fit.demandGB)} / 可用 ${formatGB(fit.usableGB)}`,
    `8K context`,
  ];
  if (model.kind === "moe") bits.push("MoE 速度快");
  return bits.join(" · ");
}

function challengeWhy(model: Model, quant: Quant, fit: Fit): string {
  if (!fit.fullOffload) {
    return `${quant.label}、${fit.gpuLayers}/${fit.totalLayers} 層在 GPU，缺口 ${formatGB(fit.gapGB)}`;
  }
  if (fit.verdict === "tight") return `${quant.label} 貼齊 VRAM，4K context 能跑`;
  return `${quant.label} 完整載入，這是此 VRAM 能挑戰的上限附近`;
}

export function challengeCosts(quant: Quant, fit: Fit): Cost[] {
  const costs: Cost[] = [];
  if (quant.quality < 0.88) {
    costs.push({
      label: "量化",
      text: `${quant.label} 品質係數約 ${quant.quality.toFixed(2)}（Q4_K_M ≈ 0.90）。指令遵循與推理會掉。`,
      tone: quant.id === "q2" ? "bad" : "tight",
    });
  } else {
    costs.push({
      label: "量化",
      text: `${quant.label} 仍接近常用平衡檔。`,
      tone: "ok",
    });
  }

  costs.push({
    label: "速度",
    text: `估計 ${fit.speedLow}–${fit.speedHigh} tok/s。不是實測。`,
    tone: fit.speedLow < 8 ? "tight" : fit.speedLow < 16 ? "warn" : "ok",
  });

  costs.push({
    label: "Context",
    text: `挑戰檔用 4K，比舒服檔的 8K 短一半。長文件會先爆。`,
    tone: "warn",
  });

  if (!fit.fullOffload) {
    costs.push({
      label: "記憶體",
      text: `完整需求 ${formatGB(fit.demandGB)}，GPU 只放下 ${formatGB(fit.gpuPlacedGB)}，缺口 ${formatGB(fit.gapGB)} 由 CPU 承接（估 RAM ${formatGB(fit.ramNeedGB)}，你有 ${formatGB(fit.ramGB)}）。`,
      tone: fit.ramOk ? "tight" : "bad",
    });
  } else if (fit.gapGB > 0.05) {
    costs.push({
      label: "記憶體",
      text: `缺口 ${formatGB(fit.gapGB)}。`,
      tone: "tight",
    });
  } else {
    costs.push({
      label: "記憶體",
      text: `完整 offload，GPU 餘 ${formatGB(fit.gpuFreeGB)}。`,
      tone: "ok",
    });
  }

  return costs;
}

export function verdictOf(v: Verdict): {
  label: string;
  tone: "ok" | "warn" | "tight" | "bad";
} {
  switch (v) {
    case "great":
      return { label: "很適合", tone: "ok" };
    case "ok":
      return { label: "可以跑，但有妥協", tone: "warn" };
    case "tight":
      return { label: "勉強", tone: "tight" };
    default:
      return { label: "不適合", tone: "bad" };
  }
}
