import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { canPair } from "./gpus";
import { MODELS, MODEL_BY_ID } from "./models";
import {
  DEFAULT_CONFIG,
  clampContext,
  pickConfig,
  pinId,
  sanitizeConfig,
  sanitizePin,
  type LabConfig,
} from "./share";
import type {
  BackendId,
  Family,
  GpuId,
  KvPrecision,
  LabAction,
  MemProfileId,
  Pin,
  QuantId,
} from "./types";

export type LabMode = "lab" | "recommend";

export type LabState = LabConfig & {
  mode: LabMode;
  family: Family;
  pins: Pin[];
  setMode: (mode: LabMode) => void;
  setGpu: (id: GpuId) => void;
  setGpu2: (id: GpuId | null) => void;
  setModel: (id: string, family?: Family) => void;
  setFamily: (family: Family) => void;
  setQuant: (id: QuantId) => void;
  setContext: (n: number) => void;
  setKv: (kv: KvPrecision) => void;
  setVramInput: (n: number) => void;
  setUseCustomVram: (on: boolean) => void;
  setRam: (n: number) => void;
  setMem: (id: MemProfileId) => void;
  setParallel: (n: number) => void;
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
  applyConfig: (c: LabConfig) => void;
};

const MAX_PINS = 3;

/** Repair persisted state from older versions or a catalog that has since changed. */
function sanitizePersisted(persisted: unknown, current: LabState): LabState {
  const p = (persisted ?? {}) as Partial<LabState>;
  const config = sanitizeConfig(p as Record<string, unknown>, DEFAULT_CONFIG);
  const pins = Array.isArray(p.pins)
    ? p.pins.map(sanitizePin).filter((pin): pin is Pin => pin !== null)
    : [];
  return {
    ...current,
    mode: p.mode === "recommend" ? "recommend" : "lab",
    ...config,
    family: MODEL_BY_ID[config.modelId].family,
    pins: pins.slice(-MAX_PINS),
  };
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
      ...DEFAULT_CONFIG,
      mode: "lab",
      family: "qwen",
      pins: [],
      setMode: (mode) => set({ mode }),
      setGpu: (gpuId) => {
        const gpu2Id = get().gpu2Id;
        set({ gpuId, useCustomVram: false, gpu2Id: canPair(gpuId, gpu2Id) ? gpu2Id : null });
      },
      setGpu2: (gpu2Id) =>
        set({ gpu2Id: canPair(get().gpuId, gpu2Id) ? gpu2Id : null, useCustomVram: false }),
      setModel: (modelId, family) =>
        set({
          modelId,
          ...(family ? { family } : {}),
          context: clampContext(modelId, get().context),
        }),
      setFamily: (family) => {
        const current = MODEL_BY_ID[get().modelId];
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
          context: clampContext(first.id, get().context),
        });
      },
      setQuant: (quantId) => set({ quantId }),
      setContext: (context) => set({ context: clampContext(get().modelId, context) }),
      setKv: (kv) => set({ kv }),
      setVramInput: (vramInput) => set({ vramInput: clampVram(vramInput) }),
      setUseCustomVram: (useCustomVram) => set({ useCustomVram }),
      setRam: (ramGB) => set({ ramGB: clampRam(ramGB) }),
      setMem: (memId) => set({ memId }),
      setParallel: (parallel) => set({ parallel: Math.min(16, Math.max(1, Math.round(parallel))) }),
      setBackend: (backend) => set({ backend }),
      loadPreset: (p) =>
        set({
          mode: "lab",
          ...(p.gpuId ? { gpuId: p.gpuId, gpu2Id: null } : {}),
          modelId: p.modelId,
          family: p.family,
          quantId: p.quantId,
          context: clampContext(p.modelId, p.context),
          useCustomVram: p.keepCustomVram ?? true,
        }),
      applyAction: (action) => {
        if (action.kind === "quant") set({ quantId: action.id });
        if (action.kind === "ctx") set({ context: clampContext(get().modelId, action.value) });
        if (action.kind === "kv") set({ kv: action.value });
        if (action.kind === "backend") set({ backend: action.value });
      },
      pinCurrent: () => {
        const s = get();
        const config = pickConfig(s);
        const next: Pin = { ...config, id: pinId(config) };
        if (s.pins.some((p) => p.id === next.id)) return;
        set({ pins: [...s.pins.slice(-(MAX_PINS - 1)), next] });
      },
      removePin: (id) => set({ pins: get().pins.filter((p) => p.id !== id) }),
      applyConfig: (c) =>
        set({
          ...c,
          mode: "lab",
          family: MODEL_BY_ID[c.modelId]?.family ?? get().family,
        }),
      loadPin: (pin) => get().applyConfig(sanitizeConfig(pin, DEFAULT_CONFIG)),
    }),
    {
      name: "vram-lab-config-v3",
      version: 5,
      migrate: (persisted) => persisted as LabState,
      merge: (persisted, current) => sanitizePersisted(persisted, current),
    },
  ),
);

/** The current config as one object; re-renders only when a config field changes. */
export function useLabConfig(): LabConfig {
  return useLabStore(useShallow(pickConfig));
}
