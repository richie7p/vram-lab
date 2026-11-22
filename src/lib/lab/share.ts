import { GPU_BY_ID } from "./gpus";
import { MODEL_BY_ID } from "./models";
import { QUANT_BY_ID } from "./quants";
import type { BackendId, GpuId, KvPrecision, QuantId } from "./types";

/** The part of the lab state that a link or saved config carries. */
export type LabConfig = {
  gpuId: GpuId;
  modelId: string;
  quantId: QuantId;
  context: number;
  kv: KvPrecision;
  ramGB: number;
  backend: BackendId;
  useCustomVram: boolean;
  vramInput: number;
};

export const DEFAULT_CONFIG: LabConfig = {
  gpuId: "3060",
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
  return {
    gpuId: isGpuId(raw.gpuId) ? raw.gpuId : fallback.gpuId,
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

const KEYS = { g: "gpuId", m: "modelId", q: "quantId", c: "context", kv: "kv", ram: "ramGB", b: "backend", v: "vramInput" } as const;

export function encodeConfig(c: LabConfig): string {
  const p = new URLSearchParams();
  p.set("g", c.gpuId);
  p.set("m", c.modelId);
  p.set("q", c.quantId);
  p.set("c", String(c.context));
  p.set("kv", c.kv);
  p.set("ram", String(c.ramGB));
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
  return sanitizeConfig(raw, base);
}

export function pickConfig(s: LabConfig): LabConfig {
  return {
    gpuId: s.gpuId,
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
