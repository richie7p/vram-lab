export type Family =
  | "qwen"
  | "llama"
  | "gemma"
  | "deepseek"
  | "nemotron"
  | "ministral"
  | "phi"
  | "other";

export type QuantId =
  | "q2"
  | "q3km"
  | "iq4xs"
  | "q4ks"
  | "q4km"
  | "q5"
  | "q6"
  | "q8"
  | "fp16";

export type KvPrecision = "fp16" | "q8" | "q4";

export type Verdict = "great" | "ok" | "tight" | "no";

export type BackendId = "llamacpp" | "ollama" | "vllm";

export type GpuId =
  | "1660s"
  | "4060"
  | "4060m"
  | "3070"
  | "3060"
  | "4070"
  | "5070"
  | "5060ti"
  | "4070tis"
  | "5070ti"
  | "4080s"
  | "5080"
  | "3090"
  | "4090"
  | "7900xtx"
  | "5090"
  | "3090x2"
  | "a6000"
  | "pro6000"
  | "b580"
  | "9070xt"
  | "m4pro48"
  | "m4max128"
  | "m3ultra512"
  | "strixhalo128"
  | "dgxspark";

export type GpuGroupId = "entry" | "12" | "16" | "24" | "work" | "unified";

export type GpuVendor = "nvidia" | "amd" | "intel" | "apple";

export type Gpu = {
  id: GpuId;
  name: string;
  shortName: string;
  vramGB: number;
  bandwidthGBs: number;
  tdpW: number;
  arch: string;
  cards: number;
  decodeEfficiency: number;
  kernelMs: number;
  /** Effective prompt-processing throughput in llama.cpp (TFLOPS), not the spec sheet. */
  ppTflops: number;
  vendor: GpuVendor;
  /**
   * Unified memory (Apple Silicon, Strix Halo, DGX Spark). vramGB is then the
   * default GPU-addressable share; this is the whole pool shared with the OS.
   */
  unifiedMemGB?: number;
  /** CPU-side memory bandwidth used for offloaded weights (default: desktop DDR5). */
  cpuBandwidthGBs?: number;
  note: string;
  group: GpuGroupId;
};

export type ModelArch = "dense" | "moe" | "hybrid";

export type Model = {
  id: string;
  name: string;
  family: Family;
  paramsB: number;
  activeParamsB?: number;
  layers: number;
  attnLayers: number;
  kvHeads: number;
  headDim: number;
  maxCtx: number;
  nativeCtx: number;
  kind: ModelArch;
  /** MoE only: parameters outside routed experts (attention, shared experts, embeddings). */
  nonExpertB?: number;
  /**
   * Sliding-window / chunked attention. `localLayers` of the `attnLayers` only
   * keep the last `window` tokens in KV; the rest attend to the full context.
   */
  swa?: { window: number; localLayers: number };
  purpose: string;
  note?: string;
};

export type Quant = {
  id: QuantId;
  label: string;
  bpw: number;
  quality: number;
  qualityNote: string;
};

export type LabAction =
  | { kind: "quant"; id: QuantId }
  | { kind: "ctx"; value: number }
  | { kind: "kv"; value: KvPrecision }
  | { kind: "backend"; value: BackendId };

export type Suggestion = {
  text: string;
  action?: LabAction;
  actionLabel?: string;
};

export type Pin = {
  id: string;
  gpuId: GpuId;
  useCustomVram: boolean;
  vramBudgetGB: number;
  ramGB: number;
  backend: BackendId;
  modelId: string;
  quantId: QuantId;
  context: number;
  kv: KvPrecision;
};

export type EstimateInput = {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  context: number;
  kv: KvPrecision;
  vramGB?: number;
  ramGB?: number;
  backend?: BackendId;
};

export type Fit = {
  weightsGB: number;
  kvGB: number;
  overheadGB: number;
  /** Full-model demand (weights + KV + overhead). */
  demandGB: number;
  /** Alias of demandGB for older call sites. */
  totalGB: number;
  /** What actually sits on the GPU after layer split. */
  gpuPlacedGB: number;
  usableGB: number;
  vramGB: number;
  gpuFreeGB: number;
  freeGB: number;
  /** max(0, demand − usable). The real capacity hole. */
  gapGB: number;
  headroomPct: number;
  fullOffload: boolean;
  /** MoE: attention + non-expert weights on GPU, some layers' experts on CPU (--n-cpu-moe). */
  moeOffload: boolean;
  /** Layers whose routed experts stay on CPU under moeOffload. */
  cpuMoeLayers: number;
  gpuLayers: number;
  totalLayers: number;
  cpuOffloadGB: number;
  ramGB: number;
  ramNeedGB: number;
  ramOk: boolean;
  backend: BackendId;
  backendNotes: string[];
  verdict: Verdict;
  speedLow: number;
  speedHigh: number;
  speedMid: number;
  /** Prompt processing (prefill) tok/s, averaged over filling the context. */
  prefillTokS: number;
  /** Seconds to read a prompt that fills the whole context. */
  fillSec: number;
  unified: boolean;
  suggestedCtx: number;
  suggestions: Suggestion[];
  kvBytesPerToken: number;
  qualityCap: Verdict;
};

export type Cost = {
  label: string;
  text: string;
  tone: "ok" | "warn" | "tight" | "bad";
};
