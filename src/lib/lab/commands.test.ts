import assert from "node:assert/strict";
import { test } from "node:test";
import { estimate } from "./calc.ts";
import { hfRepo, launchCommands, modelsWithoutTags } from "./commands.ts";
import { GPU_BY_ID } from "./gpus.ts";
import { MODELS, MODEL_BY_ID } from "./models.ts";
import { QUANT_BY_ID } from "./quants.ts";
import type { BackendId, KvPrecision } from "./types.ts";

function run(gpuId: keyof typeof GPU_BY_ID, modelId: string, backend: BackendId, kv: KvPrecision = "fp16") {
  const opts = { gpu: GPU_BY_ID[gpuId], model: MODEL_BY_ID[modelId], quant: QUANT_BY_ID.q4km, context: 8192, kv, backend };
  return launchCommands({ ...opts, fit: estimate(opts) });
}

test("every model has an org-qualified Hugging Face repo", () => {
  assert.deepEqual(modelsWithoutTags(MODELS), []);
  for (const m of MODELS) assert.match(hfRepo(m) ?? "", /^[\w.-]+\/[\w.-]+$/, m.id);
});

test("llama.cpp MoE offload writes --n-cpu-moe", () => {
  const c = run("3060", "qwen3-30b-a3b", "llamacpp");
  assert.match(c.body, /-ngl 99/);
  assert.match(c.body, /--n-cpu-moe \d+/);
});

test("dual cards get a tensor split", () => {
  assert.match(run("3090x2", "qwen25-32b", "llamacpp").body, /-ts 1,1/);
});

test("vLLM uses the HF repo and flags GGUF quant", () => {
  const c = run("4090", "qwen25-7b", "vllm");
  assert.match(c.body, /^vllm serve Qwen\/Qwen2\.5-7B-Instruct/);
  assert.ok(c.unsupported.some((u) => u.includes("AWQ")));
});

test("Ollama KV quant goes through OLLAMA_KV_CACHE_TYPE", () => {
  const c = run("4090", "qwen25-7b", "ollama", "q8");
  assert.match(c.body, /OLLAMA_KV_CACHE_TYPE=q8_0/);
  assert.ok(!c.body.split("\n").some((l) => l.startsWith(">>>")), "no REPL lines in a shell block");
});
