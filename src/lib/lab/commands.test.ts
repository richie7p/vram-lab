import assert from "node:assert/strict";
import { test } from "node:test";
import { launchCommands } from "./commands";
import { estimate } from "./calc";
import { GPU_BY_ID } from "./gpus";
import { MODEL_BY_ID } from "./models";
import { QUANT_BY_ID } from "./quants";
import { recommendForVram } from "./recommend";
const base = { gpu: GPU_BY_ID["3060"], model: MODEL_BY_ID["qwen25-7b"], quant: QUANT_BY_ID.q4km, context: 4096, kv: "fp16" as const };
test("Ollama creates the selected Modelfile before running the local model", () => {
  const result = launchCommands({ ...base, fit: estimate(base), backend: "ollama" });
  assert.equal(result.body, "ollama create vram-lab-local -f Modelfile\nollama run vram-lab-local");
  assert.match(result.modelfile!, /FROM .\/.*Q4_K_M.gguf/); assert.match(result.modelfile!, /PARAMETER num_ctx 4096/);
  assert.ok(!result.body.includes("PARAMETER"));
});
test("llama.cpp command carries context and offload settings", () => {
  const result = launchCommands({ ...base, fit: estimate(base), backend: "llamacpp" });
  assert.match(result.body, /-c 4096/); assert.match(result.body, /-ngl 99/); assert.equal(result.modelfile, null);
});
test("vLLM template asks for a real model path and does not claim GGUF is unsupported", () => {
  const result = launchCommands({ ...base, fit: estimate(base), backend: "vllm" });
  assert.match(result.body, /\/absolute\/path\/to\/hf-model/); assert.ok(result.unsupported.length > 0);
  assert.ok(!result.unsupported.join().includes("不載入 GGUF"));
});
test("invalid numeric estimates remain finite", () => {
  const result = estimate({ ...base, context: NaN, vramGB: Infinity, ramGB: NaN });
  for (const value of Object.values(result)) if (typeof value === "number") assert.ok(Number.isFinite(value));
});
test("recommendations fit their stated VRAM budget and invalid capacity is bounded", () => {
  for (const size of [4, 12, 24, NaN]) {
    const result = recommendForVram(size); assert.ok(Number.isFinite(result.vramGB));
    if (result.comfortable) { assert.equal(result.comfortable.fit.fullOffload, true); assert.ok(result.comfortable.fit.demandGB <= result.comfortable.fit.usableGB + 0.05); }
  }
});

test("Ollama KV precision is carried by documented server environment settings", () => {
  for (const [kv, type] of [["fp16", "f16"], ["q8", "q8_0"], ["q4", "q4_0"]] as const) {
    const opts = { ...base, kv };
    const result = launchCommands({ ...opts, fit: estimate(opts), backend: "ollama" });
    assert.equal(result.serverEnvironment, `OLLAMA_FLASH_ATTENTION=1\nOLLAMA_KV_CACHE_TYPE=${type}`);
    assert.ok(!result.modelfile!.includes("OLLAMA_"));
  }
});

test("launch contexts are finite and bounded by model capacity", () => {
  for (const context of [NaN, Infinity, -1, 1e12]) {
    const result = launchCommands({ ...base, context, fit: estimate(base), backend: "ollama" });
    const value = Number(result.modelfile!.match(/num_ctx (\d+)/)![1]);
    assert.ok(Number.isFinite(value) && value >= 512 && value <= base.model.maxCtx);
  }
});
