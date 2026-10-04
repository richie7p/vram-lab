import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { MODEL_BY_ID } from "./models";

test("default Qwen architecture matches the archived official config", () => {
  const config = JSON.parse(readFileSync(new URL("../../../tests/fixtures/qwen25-7b-config.json", import.meta.url), "utf8"));
  const model = MODEL_BY_ID["qwen25-7b"];
  assert.equal(model.layers, config.num_hidden_layers);
  assert.equal(model.attnLayers, config.num_hidden_layers);
  assert.equal(model.kvHeads, config.num_key_value_heads);
  assert.equal(model.headDim, config.hidden_size / config.num_attention_heads);
  assert.equal(model.nativeCtx, config.max_position_embeddings);
});
