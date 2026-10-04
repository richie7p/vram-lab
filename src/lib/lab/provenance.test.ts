import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MODEL_BY_ID } from "./models";
import { kvBytesPerToken } from "./calc";

test("default Qwen architecture matches the archived official config", () => {
  const config = JSON.parse(readFileSync(new URL("../../../tests/fixtures/qwen25-7b-config.json", import.meta.url), "utf8"));
  const model = MODEL_BY_ID["qwen25-7b"];
  assert.equal(model.layers, config.num_hidden_layers);
  assert.equal(model.attnLayers, config.num_hidden_layers);
  assert.equal(model.kvHeads, config.num_key_value_heads);
  assert.equal(model.headDim, config.hidden_size / config.num_attention_heads);
  assert.equal(model.nativeCtx, config.max_position_embeddings);
});

type Config = {
  num_hidden_layers: number;
  num_key_value_heads: number;
  num_attention_heads: number;
  hidden_size: number;
  head_dim?: number;
  kv_lora_rank?: number;
  qk_rope_head_dim?: number;
  block_configs?: { attention: { no_op: boolean; n_heads_in_group: number } }[];
  text_config?: Config;
};

test("archived public model configs verify architecture and computed FP16 cache", () => {
  const inventory = JSON.parse(readFileSync(new URL("../../../docs/CATALOG-PROVENANCE.json", import.meta.url), "utf8")) as {
    models: { id: string; config_file?: string; config_sha256: string | null }[];
  };
  let checked = 0;
  for (const row of inventory.models) {
    if (!row.config_file) continue;
    const bytes = readFileSync(new URL(`../../../${row.config_file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row.config_sha256, row.id);
    const outer = JSON.parse(bytes.toString("utf8")) as Config;
    const config = outer.text_config ?? outer;
    const model = MODEL_BY_ID[row.id];
    assert.equal(model.layers, config.num_hidden_layers, row.id);
    if (row.id === "deepseek-v3") {
      assert.equal(kvBytesPerToken(model, "fp16"), model.layers * (config.kv_lora_rank! + config.qk_rope_head_dim!) * 2);
    } else {
      const attention = config.block_configs?.filter(block => !block.attention.no_op);
      const layers = attention?.length ?? config.num_hidden_layers;
      const heads = attention ? config.num_attention_heads / attention[0].attention.n_heads_in_group : config.num_key_value_heads;
      if (attention) assert.ok(attention.every(block => config.num_attention_heads / block.attention.n_heads_in_group === heads));
      const dimension = config.head_dim ?? config.hidden_size / config.num_attention_heads;
      assert.equal(model.attnLayers, layers, row.id);
      assert.equal(model.kvHeads, heads, row.id);
      assert.equal(model.headDim, dimension, row.id);
      assert.equal(kvBytesPerToken(model, "fp16"), 2 * layers * heads * dimension * 2, row.id);
    }
    checked++;
  }
  assert.equal(checked, 31);
});
