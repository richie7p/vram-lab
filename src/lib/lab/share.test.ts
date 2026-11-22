import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CONFIG, decodeConfig, encodeConfig, sanitizeConfig } from "./share.ts";

test("config round-trips through the URL", () => {
  const c = { ...DEFAULT_CONFIG, gpuId: "4090" as const, modelId: "gemma3-27b", context: 32768, kv: "q8" as const, backend: "ollama" as const };
  assert.deepEqual(decodeConfig(encodeConfig(c), DEFAULT_CONFIG), c);
});

test("custom VRAM is only set when present in the URL", () => {
  const c = { ...DEFAULT_CONFIG, useCustomVram: true, vramInput: 20 };
  const qs = encodeConfig(c);
  assert.ok(qs.includes("v=20"));
  assert.deepEqual(decodeConfig(qs, DEFAULT_CONFIG), c);
  assert.equal(decodeConfig("g=4090&m=qwen25-7b", { ...DEFAULT_CONFIG, useCustomVram: true })?.useCustomVram, false);
});

test("unrelated query strings are ignored", () => {
  assert.equal(decodeConfig("utm_source=x", DEFAULT_CONFIG), null);
  assert.equal(decodeConfig("", DEFAULT_CONFIG), null);
});

test("unknown ids and out-of-range numbers fall back safely", () => {
  const c = decodeConfig("g=gtx9999&m=gone-model&q=q9&c=99999999&kv=fp8&ram=-5&b=tgi", DEFAULT_CONFIG)!;
  assert.equal(c.gpuId, DEFAULT_CONFIG.gpuId);
  assert.equal(c.modelId, DEFAULT_CONFIG.modelId);
  assert.equal(c.quantId, DEFAULT_CONFIG.quantId);
  assert.equal(c.context, 131072);
  assert.equal(c.kv, DEFAULT_CONFIG.kv);
  assert.equal(c.ramGB, 4);
  assert.equal(c.backend, DEFAULT_CONFIG.backend);
});

test("sanitize repairs old persisted state", () => {
  const c = sanitizeConfig({ gpuId: "3060", modelId: "removed", context: "abc", vramInput: 999 });
  assert.equal(c.modelId, DEFAULT_CONFIG.modelId);
  assert.equal(c.context, DEFAULT_CONFIG.context);
  assert.equal(c.vramInput, 192);
});

test("second card, memory and parallel survive the URL", () => {
  const c = { ...DEFAULT_CONFIG, gpuId: "3090" as const, gpu2Id: "3060" as const, memId: "ddr5-4ch" as const, parallel: 4 };
  const qs = encodeConfig(c);
  assert.match(qs, /g2=3060/);
  assert.deepEqual(decodeConfig(qs, DEFAULT_CONFIG), c);
});

test("an impossible pair is dropped", () => {
  // Apple machines and AMD cards cannot pair with an NVIDIA card.
  assert.equal(decodeConfig("g=m4max128&g2=3060&m=qwen25-7b", DEFAULT_CONFIG)?.gpu2Id, null);
  assert.equal(decodeConfig("g=3090&g2=7900xtx&m=qwen25-7b", DEFAULT_CONFIG)?.gpu2Id, null);
});

test("old pins with vramBudgetGB are migrated", async () => {
  const { sanitizePin } = await import("./share.ts");
  const pin = sanitizePin({ gpuId: "4090", modelId: "qwen25-14b", quantId: "q5", context: 8192, kv: "fp16", useCustomVram: true, vramBudgetGB: 20, ramGB: 64, backend: "ollama" });
  assert.equal(pin?.vramInput, 20);
  assert.equal(pin?.gpu2Id, null);
  assert.equal(sanitizePin({ gpuId: "nope", modelId: "qwen25-14b" }), null);
});
