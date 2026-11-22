/**
 * Compare the hand-entered architecture numbers in src/lib/lab/models.ts with
 * each model's config.json on Hugging Face.
 *
 *   npm run check:models            # gated repos (Llama, Gemma) are skipped
 *   HF_TOKEN=hf_xxx npm run check:models
 *
 * Exits 1 when a number disagrees.
 */
import { hfRepo } from "../src/lib/lab/commands.ts";
import { MODELS } from "../src/lib/lab/models.ts";
import type { Model } from "../src/lib/lab/types.ts";

type Config = Record<string, unknown>;

async function fetchConfig(repo: string): Promise<Config | { status: number }> {
  const headers: Record<string, string> = {};
  if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  const res = await fetch(`https://huggingface.co/${repo}/resolve/main/config.json`, { headers });
  if (!res.ok) return { status: res.status };
  return (await res.json()) as Config;
}

/** Multimodal checkpoints keep the language model under text_config. */
function textConfig(cfg: Config): Config {
  const inner = cfg.text_config;
  return inner && typeof inner === "object" ? { ...cfg, ...(inner as Config) } : cfg;
}

function n(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function compare(model: Model, raw: Config): string[] {
  const cfg = textConfig(raw);
  const out: string[] = [];
  const check = (label: string, ours: number, theirs: number | undefined) => {
    if (theirs !== undefined && theirs !== ours) out.push(`${label}: ours ${ours}, config ${theirs}`);
  };

  // Heterogeneous (Nemotron Super) or MLA (DeepSeek) layouts don't map 1:1.
  const heterogeneous = Array.isArray(cfg.block_configs);
  const mla = n(cfg.kv_lora_rank) !== undefined;

  check("layers", model.layers, n(cfg.num_hidden_layers));
  if (!heterogeneous && !mla) {
    const heads = n(cfg.num_attention_heads);
    const hidden = n(cfg.hidden_size);
    const headDim = n(cfg.head_dim) ?? (heads && hidden ? hidden / heads : undefined);
    check("kvHeads", model.kvHeads, n(cfg.num_key_value_heads) ?? heads);
    check("headDim", model.headDim, headDim);
  }
  if (mla) {
    const kvLora = n(cfg.kv_lora_rank) ?? 0;
    const rope = n(cfg.qk_rope_head_dim) ?? 0;
    // We encode MLA as kvHeads=1 with K and V sharing (kv_lora_rank + rope) / 2 each.
    check("MLA kvHeads*headDim*2", model.kvHeads * model.headDim * 2, kvLora + rope);
  }
  return out;
}

const rows: string[] = [];
let mismatches = 0;
let skipped = 0;

for (const model of MODELS) {
  const repo = hfRepo(model);
  if (!repo) {
    rows.push(`?  ${model.id}: no Hugging Face repo mapped`);
    mismatches++;
    continue;
  }
  try {
    const cfg = await fetchConfig(repo);
    if ("status" in cfg && typeof cfg.status === "number" && Object.keys(cfg).length === 1) {
      skipped++;
      rows.push(`-  ${model.id}: ${repo} → HTTP ${cfg.status}${cfg.status === 401 || cfg.status === 403 ? " (gated; set HF_TOKEN)" : ""}`);
      continue;
    }
    const diffs = compare(model, cfg as Config);
    if (diffs.length) {
      mismatches++;
      rows.push(`✗  ${model.id}: ${diffs.join("; ")}`);
    } else {
      rows.push(`✓  ${model.id}`);
    }
  } catch (err) {
    skipped++;
    rows.push(`-  ${model.id}: ${(err as Error).message}`);
  }
}

console.log(rows.join("\n"));
console.log(`\n${MODELS.length} models · ${mismatches} mismatched · ${skipped} skipped`);
process.exit(mismatches > 0 ? 1 : 0);
