import assert from "node:assert/strict";
import { test } from "node:test";
import { estimate, kvBytesPerToken, kvCacheGB, usableVramGB, weightsGB } from "./calc.ts";
import { GPU_BY_ID } from "./gpus.ts";
import { MODEL_BY_ID } from "./models.ts";
import { QUANT_BY_ID } from "./quants.ts";

test("Llama 3.1 8B KV is 128 KiB/token at FP16", () => {
  const m = MODEL_BY_ID["llama31-8b"];
  assert.equal(kvBytesPerToken(m, "fp16"), 131072);
});

test("Llama 3.1 8B KV at 8K is 1 GiB", () => {
  const m = MODEL_BY_ID["llama31-8b"];
  assert.equal(kvCacheGB(m, 8192, "fp16"), 1);
});

test("Qwen2.5 7B Q4_K_M weights are ~4.6 GB", () => {
  const w = weightsGB(MODEL_BY_ID["qwen25-7b"], QUANT_BY_ID.q4km);
  assert.ok(w > 4.4 && w < 4.8, `got ${w}`);
});

test("IQ4_XS is lighter than Q4_K_M", () => {
  const m = MODEL_BY_ID["qwen25-7b"];
  const xs = weightsGB(m, QUANT_BY_ID.iq4xs);
  const km = weightsGB(m, QUANT_BY_ID.q4km);
  assert.ok(xs < km, `${xs} !< ${km}`);
});

test("3060 12GB runs Qwen2.5 7B Q4 8K fully offloaded", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["3060"],
    model: MODEL_BY_ID["qwen25-7b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, true);
  assert.equal(fit.gapGB, 0);
  assert.ok(fit.verdict === "great" || fit.verdict === "ok", fit.verdict);
  assert.ok(fit.speedLow > 10);
});

test("4090 24GB full-offloads Qwen2.5 32B Q4 8K", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["4090"],
    model: MODEL_BY_ID["qwen25-32b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, true);
  assert.notEqual(fit.verdict, "no");
});

test("5090 32GB still cannot full-offload 70B Q8 at 8K", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["5090"],
    model: MODEL_BY_ID["llama33-70b"],
    quant: QUANT_BY_ID.q8,
    context: 8192,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, false);
});

test("3090 cannot full-offload 70B Q4", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["3090"],
    model: MODEL_BY_ID["llama33-70b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, false);
  assert.ok(fit.weightsGB > 40);
});

test("PRO 6000 can full-offload 70B Q4 at 8K", () => {
  const fit = estimate({
    gpu: GPU_BY_ID.pro6000,
    model: MODEL_BY_ID["llama33-70b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, true);
  assert.notEqual(fit.verdict, "no");
});

test("Qwen3 0.6B KV is fatter than Qwen2.5 0.5B", () => {
  const tiny = kvBytesPerToken(MODEL_BY_ID["qwen25-05b"], "fp16");
  const q3 = kvBytesPerToken(MODEL_BY_ID["qwen3-06b"], "fp16");
  assert.ok(q3 > tiny * 8, `${q3} vs ${tiny}`);
});

test("capacity gap equals demand minus usable, not leftover after partial offload", () => {
  const gpu = GPU_BY_ID["3090"];
  const fit = estimate({
    gpu,
    model: MODEL_BY_ID["qwen3-235b-a22b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
    vramGB: gpu.vramGB,
  });
  assert.ok(fit.demandGB > 100, `demand ${fit.demandGB}`);
  assert.ok(fit.gapGB > 80, `gap ${fit.gapGB} should track demand`);
  const expected = Math.round((fit.demandGB - fit.usableGB) * 100) / 100;
  assert.equal(fit.gapGB, expected < 0 ? 0 : expected);
  assert.ok(fit.gpuFreeGB < 2, `gpu leftover ${fit.gpuFreeGB} is not the hole`);
  assert.ok(Math.abs(fit.gapGB - fit.gpuFreeGB) > 50);
});

test("custom 4GB does not inherit 1660 Super 6GB usable", () => {
  const gpu = GPU_BY_ID["1660s"];
  const custom = estimate({
    gpu,
    model: MODEL_BY_ID["qwen25-7b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
    vramGB: 4,
  });
  const card = estimate({
    gpu,
    model: MODEL_BY_ID["qwen25-7b"],
    quant: QUANT_BY_ID.q4km,
    context: 8192,
    kv: "fp16",
    vramGB: gpu.vramGB,
  });
  assert.equal(custom.vramGB, 4);
  assert.ok(custom.usableGB < 4);
  assert.ok(custom.usableGB < card.usableGB - 1, `${custom.usableGB} vs ${card.usableGB}`);
  assert.ok(usableVramGB(4) < usableVramGB(6) - 1);
});

test("vLLM cannot partial-offload a model that does not fit", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["3060"],
    model: MODEL_BY_ID["llama33-70b"],
    quant: QUANT_BY_ID.q4km,
    context: 4096,
    kv: "fp16",
    backend: "vllm",
  });
  assert.equal(fit.fullOffload, false);
  assert.equal(fit.verdict, "no");
  assert.ok(fit.backendNotes.some((n) => n.includes("vLLM")));
});

test("tiny RAM fails offload feasibility", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["3060"],
    model: MODEL_BY_ID["qwen25-32b"],
    quant: QUANT_BY_ID.q4km,
    context: 4096,
    kv: "fp16",
    ramGB: 8,
  });
  if (fit.cpuOffloadGB > 1) {
    assert.equal(fit.ramOk, false);
  }
});

test("Gemma 3 27B sliding window keeps 32K KV small", () => {
  const m = MODEL_BY_ID["gemma3-27b"];
  const kv = kvCacheGB(m, 32768, "fp16");
  // 10 global layers × 32K + 52 local layers × 1K, 16 KV heads × 128 dim.
  const expected = (2 * 16 * 128 * 2 * (10 * 32768 + 52 * 1024)) / 1024 ** 3;
  assert.ok(Math.abs(kv - expected) < 1e-9, `${kv} vs ${expected}`);
  assert.ok(kv < 3, `got ${kv}`);
});

test("sliding window changes nothing below the window", () => {
  const m = MODEL_BY_ID["gemma3-27b"];
  const full = (kvBytesPerToken(m, "fp16") * 1024) / 1024 ** 3;
  assert.equal(kvCacheGB(m, 1024, "fp16"), full);
});

test("4090 full-offloads Gemma 3 27B Q4 at 32K", () => {
  const fit = estimate({
    gpu: GPU_BY_ID["4090"],
    model: MODEL_BY_ID["gemma3-27b"],
    quant: QUANT_BY_ID.q4km,
    context: 32768,
    kv: "fp16",
  });
  assert.equal(fit.fullOffload, true);
  assert.notEqual(fit.verdict, "no");
});

test("Llama 4 Scout chunked layers cap KV growth", () => {
  const m = MODEL_BY_ID["llama4-scout"];
  const kv128 = kvCacheGB(m, 131072, "fp16");
  const dense = (kvBytesPerToken(m, "fp16") * 131072) / 1024 ** 3;
  assert.ok(kv128 < dense * 0.3, `${kv128} vs dense ${dense}`);
});

test("Qwen3-30B-A3B decodes far faster than a dense model of the same file size", () => {
  const base = { gpu: GPU_BY_ID["4090"], quant: QUANT_BY_ID.q4km, context: 8192, kv: "fp16" as const };
  const moe = estimate({ ...base, model: MODEL_BY_ID["qwen3-30b-a3b"] });
  const dense = estimate({ ...base, model: MODEL_BY_ID["qwen25-32b"] });
  assert.equal(moe.fullOffload, true);
  assert.ok(moe.speedMid > 120 && moe.speedMid < 260, `got ${moe.speedMid}`);
  assert.ok(moe.speedMid > dense.speedMid * 3);
});

const base = { quant: QUANT_BY_ID.q4km, context: 8192, kv: "fp16" as const };

test("MoE that does not fit uses expert offload on llama.cpp", () => {
  const fit = estimate({ ...base, gpu: GPU_BY_ID["3060"], model: MODEL_BY_ID["qwen3-30b-a3b"] });
  assert.equal(fit.fullOffload, false);
  assert.equal(fit.moeOffload, true);
  assert.equal(fit.gpuLayers, fit.totalLayers);
  assert.ok(fit.cpuMoeLayers > 0 && fit.cpuMoeLayers < fit.totalLayers);
  assert.ok(fit.gpuPlacedGB <= fit.usableGB + 0.01);
  assert.ok(fit.speedLow >= 15, `got ${fit.speedLow}`);
  assert.notEqual(fit.verdict, "no");
});

test("expert offload beats Ollama's layer split for the same MoE", () => {
  const args = { ...base, gpu: GPU_BY_ID["3060"], model: MODEL_BY_ID["qwen3-30b-a3b"] };
  const moe = estimate({ ...args, backend: "llamacpp" });
  const split = estimate({ ...args, backend: "ollama" });
  assert.equal(split.moeOffload, false);
  assert.ok(moe.speedMid > split.speedMid);
  assert.ok(split.suggestions.some((s) => s.action?.kind === "backend"));
});

test("dense partial offload speed is bounded by CPU bandwidth", () => {
  const fit = estimate({ ...base, gpu: GPU_BY_ID["3090"], model: MODEL_BY_ID["llama33-70b"], ramGB: 64 });
  assert.equal(fit.fullOffload, false);
  assert.ok(fit.speedMid > 1.5 && fit.speedMid < 4, `got ${fit.speedMid}`);
});

test("prefill is far faster than decode and slows with CPU offload", () => {
  const gpu = GPU_BY_ID["4090"];
  const full = estimate({ ...base, gpu, model: MODEL_BY_ID["llama31-8b"] });
  assert.ok(full.prefillTokS > full.speedMid * 30);
  assert.ok(full.fillSec < 2);
  const off = estimate({ ...base, gpu, model: MODEL_BY_ID["llama33-70b"], ramGB: 64 });
  assert.ok(off.prefillTokS < 1000, `got ${off.prefillTokS}`);
});

test("Apple Silicon: unified memory replaces the RAM setting, prefill is slow", () => {
  const mac = GPU_BY_ID.m4max128;
  const fit = estimate({ ...base, gpu: mac, model: MODEL_BY_ID["llama33-70b"], ramGB: 8 });
  assert.equal(fit.unified, true);
  assert.equal(fit.ramGB, 128);
  assert.equal(fit.ramOk, true);
  assert.equal(fit.fullOffload, true);
  assert.ok(fit.prefillTokS < 200, `got ${fit.prefillTokS}`);
  const vllm = estimate({ ...base, gpu: mac, model: MODEL_BY_ID["llama31-8b"], backend: "vllm" });
  assert.equal(vllm.verdict, "no");
});

test("custom VRAM budget never borrows a unified-memory machine as speed reference", async () => {
  const { nearestDiscreteGpu } = await import("./gpus.ts");
  assert.equal(nearestDiscreteGpu(96).unifiedMemGB, undefined);
  assert.equal(nearestDiscreteGpu(128).unifiedMemGB, undefined);
});
