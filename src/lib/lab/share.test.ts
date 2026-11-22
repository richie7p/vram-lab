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
