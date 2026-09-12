import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pinId } from "./calc";
import { MODELS } from "./models";
import type { BackendId, Family, GpuId, KvPrecision, LabAction, Pin, QuantId } from "./types";

export type LabMode = "lab" | "recommend";

type LabState = {
  mode: LabMode;
  gpuId: GpuId;
  modelId: string;
  family: Family;
  quantId: QuantId;
  context: number;
  kv: KvPrecision;
  vramInput: number;
  useCustomVram: boolean;
  ramGB: number;
  backend: BackendId;
  pins: Pin[];
  setMode: (mode: LabMode) => void;
  setGpu: (id: GpuId) => void;
  setModel: (id: string, family?: Family) => void;
  setFamily: (family: Family) => void;
  setQuant: (id: QuantId) => void;
  setContext: (n: number) => void;
  setKv: (kv: KvPrecision) => void;
  setVramInput: (n: number) => void;
  setUseCustomVram: (on: boolean) => void;
  setRam: (n: number) => void;
  setBackend: (b: BackendId) => void;
  loadPreset: (p: {
    gpuId?: GpuId;
    modelId: string;
    family: Family;
    quantId: QuantId;
    context: number;
    keepCustomVram?: boolean;
  }) => void;
  applyAction: (action: LabAction) => void;
  pinCurrent: () => void;
  removePin: (id: string) => void;
  loadPin: (pin: Pin) => void;
};

function clampCtx(modelId: string, context: number) {
  const m = MODELS.find((x) => x.id === modelId);
  if (!m) return context;
  return Math.min(Math.max(2048, context), m.maxCtx);
}

function clampVram(n: number) {
  return Math.min(192, Math.max(4, n));
}

function clampRam(n: number) {
  return Math.min(512, Math.max(4, n));
}

export const useLabStore = create<LabState>()(
  persist(
    (set, get) => ({
      mode: "lab",
      gpuId: "3060",
      modelId: "qwen25-7b",
      family: "qwen",
      quantId: "q4km",
      context: 8192,
      kv: "fp16",
      vramInput: 12,
      useCustomVram: false,
      ramGB: 32,
      backend: "llamacpp",
      pins: [],
      setMode: (mode) => set({ mode }),
      setGpu: (gpuId) => set({ gpuId, useCustomVram: false }),
      setModel: (modelId, family) =>
        set({
          modelId,
          ...(family ? { family } : {}),
          context: clampCtx(modelId, get().context),
        }),
      setFamily: (family) => {
        const current = MODELS.find((m) => m.id === get().modelId);
        if (current?.family === family) {
          set({ family });
          return;
        }
        const first = MODELS.find((m) => m.family === family);
        if (!first) {
          set({ family });
          return;
        }
        set({
          family,
          modelId: first.id,
          context: clampCtx(first.id, get().context),
        });
      },
      setQuant: (quantId) => set({ quantId }),
      setContext: (context) => set({ context: clampCtx(get().modelId, context) }),
      setKv: (kv) => set({ kv }),
      setVramInput: (vramInput) => set({ vramInput: clampVram(vramInput) }),
      setUseCustomVram: (useCustomVram) => set({ useCustomVram }),
      setRam: (ramGB) => set({ ramGB: clampRam(ramGB) }),
      setBackend: (backend) => set({ backend }),
      loadPreset: (p) =>
        set({
          mode: "lab",
          ...(p.gpuId ? { gpuId: p.gpuId } : {}),
          modelId: p.modelId,
          family: p.family,
          quantId: p.quantId,
          context: clampCtx(p.modelId, p.context),
          useCustomVram: p.keepCustomVram ?? true,
        }),
      applyAction: (action) => {
        if (action.kind === "quant") set({ quantId: action.id });
        if (action.kind === "ctx") set({ context: clampCtx(get().modelId, action.value) });
        if (action.kind === "kv") set({ kv: action.value });
      },
      pinCurrent: () => {
        const s = get();
        const next: Pin = {
          id: pinId({
            gpuId: s.gpuId,
            useCustomVram: s.useCustomVram,
            vramBudgetGB: s.vramInput,
            ramGB: s.ramGB,
            backend: s.backend,
            modelId: s.modelId,
            quantId: s.quantId,
            context: s.context,
            kv: s.kv,
          }),
          gpuId: s.gpuId,
          useCustomVram: s.useCustomVram,
          vramBudgetGB: s.vramInput,
          ramGB: s.ramGB,
          backend: s.backend,
          modelId: s.modelId,
          quantId: s.quantId,
          context: s.context,
          kv: s.kv,
        };
        if (s.pins.some((p) => p.id === next.id)) return;
        set({ pins: [...s.pins.slice(-2), next] });
      },
      removePin: (id) => set({ pins: get().pins.filter((p) => p.id !== id) }),
      loadPin: (pin) => {
        const m = MODELS.find((x) => x.id === pin.modelId);
        set({
          mode: "lab",
          gpuId: pin.gpuId,
          useCustomVram: pin.useCustomVram,
          vramInput: pin.vramBudgetGB,
          ramGB: pin.ramGB,
          backend: pin.backend,
          modelId: pin.modelId,
          family: m?.family ?? get().family,
          quantId: pin.quantId,
          context: clampCtx(pin.modelId, pin.context),
          kv: pin.kv,
        });
      },
    }),
    { name: "vram-lab-config-v3" },
  ),
);
