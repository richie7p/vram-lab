import { budgetVramGB } from "./calc";
import { GPU_BY_ID, MEM_BY_ID, canPair, resolveGpu } from "./gpus";
import { MODEL_BY_ID } from "./models";
import { QUANT_BY_ID } from "./quants";
import type {
  BackendId,
  EstimateInput,
  GpuId,
  KvPrecision,
  LabConfig,
  MemProfileId,
  QuantId,
} from "./types";

export type { LabConfig };

export const PARALLEL_OPTIONS = [1, 2, 4, 8];

export const DEFAULT_CONFIG: LabConfig = {
  gpuId: "3060",
  gpu2Id: null,
  memId: "ddr5-2ch",
  parallel: 1,
  modelId: "qwen25-7b",
  quantId: "q4km",
  context: 8192,
  kv: "fp16",
  ramGB: 32,
  backend: "llamacpp",
  useCustomVram: false,
  vramInput: 12,
};

const KVS: KvPrecision[] = ["fp16", "q8", "q4"];
const BACKEND_IDS: BackendId[] = ["llamacpp", "ollama", "vllm"];

export function isGpuId(v: unknown): v is GpuId {
  return typeof v === "string" && v in GPU_BY_ID;
}
export function isModelId(v: unknown): v is string {
  return typeof v === "string" && v in MODEL_BY_ID;
}
export function isMemId(v: unknown): v is MemProfileId {
  return typeof v === "string" && v in MEM_BY_ID;
}
export function isQuantId(v: unknown): v is QuantId {
  return typeof v === "string" && v in QUANT_BY_ID;
}
export function isKv(v: unknown): v is KvPrecision {
  return typeof v === "string" && (KVS as string[]).includes(v);
}
export function isBackend(v: unknown): v is BackendId {
  return typeof v === "string" && (BACKEND_IDS as string[]).includes(v);
}

function num(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function clampContext(modelId: string, context: number): number {
  const m = MODEL_BY_ID[modelId];
  const max = m?.maxCtx ?? 131072;
  return Math.min(Math.max(2048, Math.round(context)), max);
}

/** Drop anything that no longer matches the catalog; fill the rest from fallback. */
export function sanitizeConfig(raw: Partial<Record<keyof LabConfig, unknown>>, fallback = DEFAULT_CONFIG): LabConfig {
  const modelId = isModelId(raw.modelId) ? raw.modelId : fallback.modelId;
  const gpuId = isGpuId(raw.gpuId) ? raw.gpuId : fallback.gpuId;
  const gpu2 = raw.gpu2Id === undefined ? fallback.gpu2Id : raw.gpu2Id;
  return {
    gpuId,
    gpu2Id: isGpuId(gpu2) && canPair(gpuId, gpu2) ? gpu2 : null,
    memId: isMemId(raw.memId) ? raw.memId : fallback.memId,
    parallel: PARALLEL_OPTIONS.includes(num(raw.parallel, 1, 16) ?? -1)
      ? num(raw.parallel, 1, 16)!
      : fallback.parallel,
    modelId,
    quantId: isQuantId(raw.quantId) ? raw.quantId : fallback.quantId,
    context: clampContext(modelId, num(raw.context, 512, 1 << 20) ?? fallback.context),
    kv: isKv(raw.kv) ? raw.kv : fallback.kv,
    ramGB: num(raw.ramGB, 4, 512) ?? fallback.ramGB,
    backend: isBackend(raw.backend) ? raw.backend : fallback.backend,
    useCustomVram: typeof raw.useCustomVram === "boolean" ? raw.useCustomVram : fallback.useCustomVram,
    vramInput: num(raw.vramInput, 4, 192) ?? fallback.vramInput,
  };
}

const KEYS = { g: "gpuId", g2: "gpu2Id", mem: "memId", np: "parallel", m: "modelId", q: "quantId", c: "context", kv: "kv", ram: "ramGB", b: "backend", v: "vramInput" } as const;

export function encodeConfig(c: LabConfig): string {
  const p = new URLSearchParams();
  p.set("g", c.gpuId);
  if (c.gpu2Id) p.set("g2", c.gpu2Id);
  p.set("m", c.modelId);
  p.set("q", c.quantId);
  p.set("c", String(c.context));
  p.set("kv", c.kv);
  p.set("ram", String(c.ramGB));
  if (c.memId !== DEFAULT_CONFIG.memId) p.set("mem", c.memId);
  if (c.parallel > 1) p.set("np", String(c.parallel));
  p.set("b", c.backend);
  if (c.useCustomVram) p.set("v", String(c.vramInput));
  return p.toString();
}

/** Parse a query string. Returns null when it carries no lab config. */
export function decodeConfig(search: string, base: LabConfig): LabConfig | null {
  const p = new URLSearchParams(search);
  if (!p.has("m") && !p.has("g")) return null;
  const raw: Partial<Record<keyof LabConfig, unknown>> = {};
  for (const [short, key] of Object.entries(KEYS)) {
    const v = p.get(short);
    if (v !== null) raw[key] = v;
  }
  raw.useCustomVram = p.has("v");
  if (!p.has("g2")) raw.gpu2Id = null;
  if (!p.has("mem")) raw.memId = DEFAULT_CONFIG.memId;
  if (!p.has("np")) raw.parallel = 1;
  return sanitizeConfig(raw, base);
}

export function pickConfig(s: LabConfig): LabConfig {
  return {
    gpuId: s.gpuId,
    gpu2Id: s.gpu2Id,
    memId: s.memId,
    parallel: s.parallel,
    modelId: s.modelId,
    quantId: s.quantId,
    context: s.context,
    kv: s.kv,
    ramGB: s.ramGB,
    backend: s.backend,
    useCustomVram: s.useCustomVram,
    vramInput: s.vramInput,
  };
}

/** Stable id for a pinned config (the same string as its share link). */
export function pinId(c: LabConfig): string {
  return encodeConfig(pickConfig(c));
}

/** Older pins stored the VRAM budget as vramBudgetGB. */
export function sanitizePin(raw: unknown): (LabConfig & { id: string }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isGpuId(r.gpuId) || !isModelId(r.modelId)) return null;
  const c = sanitizeConfig({ ...r, vramInput: r.vramInput ?? r.vramBudgetGB, gpu2Id: r.gpu2Id ?? null }, DEFAULT_CONFIG);
  return { ...c, id: pinId(c) };
}

/** Everything estimate() needs for a config; the one place that resolves ids. */
export function estimateInput(c: LabConfig): EstimateInput {
  const gpu = resolveGpu(c.gpuId, c.gpu2Id);
  return {
    gpu,
    model: MODEL_BY_ID[c.modelId] ?? MODEL_BY_ID[DEFAULT_CONFIG.modelId],
    quant: QUANT_BY_ID[c.quantId] ?? QUANT_BY_ID.q4km,
    context: c.context,
    kv: c.kv,
    vramGB: budgetVramGB(gpu, c.useCustomVram, c.vramInput),
    ramGB: c.ramGB,
    backend: c.backend,
    cpuBandwidthGBs: MEM_BY_ID[c.memId]?.bandwidthGBs,
    parallel: c.parallel,
  };
}
