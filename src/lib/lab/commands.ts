import type { BackendId, Fit, Gpu, KvPrecision, Model, Quant, QuantId } from "./types";

export const BACKENDS: { id: BackendId; label: string }[] = [
  { id: "llamacpp", label: "llama.cpp" },
  { id: "ollama", label: "Ollama" },
  { id: "vllm", label: "vLLM" },
];

const QUANT_GGUF: Record<QuantId, string> = {
  q2: "Q2_K",
  q3km: "Q3_K_M",
  iq4xs: "IQ4_XS",
  q4ks: "Q4_K_S",
  q4km: "Q4_K_M",
  q5: "Q5_K_M",
  q6: "Q6_K",
  q8: "Q8_0",
  fp16: "F16",
};

const QUANT_OLLAMA: Record<QuantId, string> = {
  q2: "q2_K",
  q3km: "q3_K_M",
  iq4xs: "iq4_xs",
  q4ks: "q4_K_S",
  q4km: "q4_K_M",
  q5: "q5_K_M",
  q6: "q6_K",
  q8: "q8_0",
  fp16: "fp16",
};

const TAGS: Record<string, { hf: string; gguf: string; ollama: string }> = {
  "qwen25-05b": { hf: "Qwen/Qwen2.5-0.5B-Instruct", gguf: "Qwen2.5-0.5B-Instruct", ollama: "qwen2.5:0.5b" },
  "qwen25-15b": { hf: "Qwen/Qwen2.5-1.5B-Instruct", gguf: "Qwen2.5-1.5B-Instruct", ollama: "qwen2.5:1.5b" },
  "qwen25-3b": { hf: "Qwen/Qwen2.5-3B-Instruct", gguf: "Qwen2.5-3B-Instruct", ollama: "qwen2.5:3b" },
  "qwen25-7b": { hf: "Qwen/Qwen2.5-7B-Instruct", gguf: "Qwen2.5-7B-Instruct", ollama: "qwen2.5:7b-instruct" },
  "qwen25-14b": { hf: "Qwen/Qwen2.5-14B-Instruct", gguf: "Qwen2.5-14B-Instruct", ollama: "qwen2.5:14b-instruct" },
  "qwen25-32b": { hf: "Qwen/Qwen2.5-32B-Instruct", gguf: "Qwen2.5-32B-Instruct", ollama: "qwen2.5:32b-instruct" },
  "qwen25-coder-32b": { hf: "Qwen/Qwen2.5-Coder-32B-Instruct", gguf: "Qwen2.5-Coder-32B-Instruct", ollama: "qwen2.5-coder:32b" },
  "qwen25-72b": { hf: "Qwen/Qwen2.5-72B-Instruct", gguf: "Qwen2.5-72B-Instruct", ollama: "qwen2.5:72b-instruct" },
  "qwen3-06b": { hf: "Qwen/Qwen3-0.6B", gguf: "Qwen3-0.6B", ollama: "qwen3:0.6b" },
  "qwen3-17b": { hf: "Qwen/Qwen3-1.7B", gguf: "Qwen3-1.7B", ollama: "qwen3:1.7b" },
  "qwen3-4b": { hf: "Qwen/Qwen3-4B", gguf: "Qwen3-4B", ollama: "qwen3:4b" },
  "qwen3-8b": { hf: "Qwen/Qwen3-8B", gguf: "Qwen3-8B", ollama: "qwen3:8b" },
  "qwen3-14b": { hf: "Qwen/Qwen3-14B", gguf: "Qwen3-14B", ollama: "qwen3:14b" },
  "qwen3-32b": { hf: "Qwen/Qwen3-32B", gguf: "Qwen3-32B", ollama: "qwen3:32b" },
  "qwq-32b": { hf: "Qwen/QwQ-32B", gguf: "QwQ-32B", ollama: "qwq:32b" },
  "qwen3-30b-a3b": { hf: "Qwen/Qwen3-30B-A3B", gguf: "Qwen3-30B-A3B", ollama: "qwen3:30b-a3b" },
  "qwen3-235b-a22b": { hf: "Qwen/Qwen3-235B-A22B", gguf: "Qwen3-235B-A22B", ollama: "qwen3:235b-a22b" },
  "gemma3-1b": { hf: "google/gemma-3-1b-it", gguf: "gemma-3-1b-it", ollama: "gemma3:1b" },
  "gemma3-4b": { hf: "google/gemma-3-4b-it", gguf: "gemma-3-4b-it", ollama: "gemma3:4b" },
  "gemma3-12b": { hf: "google/gemma-3-12b-it", gguf: "gemma-3-12b-it", ollama: "gemma3:12b" },
  "gemma3-27b": { hf: "google/gemma-3-27b-it", gguf: "gemma-3-27b-it", ollama: "gemma3:27b" },
  "nemotron-nano-8b": { hf: "nvidia/Llama-3.1-Nemotron-Nano-8B-v1", gguf: "Llama-3.1-Nemotron-Nano-8B-v1", ollama: "nemotron-nano:8b" },
  "nemotron-super-49b": { hf: "nvidia/Llama-3_3-Nemotron-Super-49B-v1", gguf: "Llama-3_3-Nemotron-Super-49B-v1", ollama: "nemotron-super:49b" },
  "nemotron-70b": { hf: "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF", gguf: "Llama-3.1-Nemotron-70B-Instruct", ollama: "nemotron:70b" },
  "ministral3-3b": { hf: "mistralai/Ministral-3-3B-Instruct-2512", gguf: "Ministral-3-3B-Instruct", ollama: "ministral:3b" },
  "ministral3-8b": { hf: "mistralai/Ministral-3-8B-Instruct-2512", gguf: "Ministral-3-8B-Instruct", ollama: "ministral:8b" },
  "ministral3-14b": { hf: "mistralai/Ministral-3-14B-Instruct-2512", gguf: "Ministral-3-14B-Instruct", ollama: "ministral:14b" },
  "phi4-mini": { hf: "microsoft/Phi-4-mini-instruct", gguf: "Phi-4-mini-instruct", ollama: "phi4-mini" },
  phi4: { hf: "microsoft/phi-4", gguf: "phi-4", ollama: "phi4" },
  "llama32-1b": { hf: "meta-llama/Llama-3.2-1B-Instruct", gguf: "Llama-3.2-1B-Instruct", ollama: "llama3.2:1b" },
  "llama32-3b": { hf: "meta-llama/Llama-3.2-3B-Instruct", gguf: "Llama-3.2-3B-Instruct", ollama: "llama3.2:3b" },
  "llama31-8b": { hf: "meta-llama/Llama-3.1-8B-Instruct", gguf: "Llama-3.1-8B-Instruct", ollama: "llama3.1:8b-instruct" },
  "llama33-70b": { hf: "meta-llama/Llama-3.3-70B-Instruct", gguf: "Llama-3.3-70B-Instruct", ollama: "llama3.3:70b" },
  "llama4-scout": { hf: "meta-llama/Llama-4-Scout-17B-16E-Instruct", gguf: "Llama-4-Scout-17B-16E", ollama: "llama4:scout" },
  "mistral-7b": { hf: "mistralai/Mistral-7B-Instruct-v0.3", gguf: "Mistral-7B-Instruct-v0.3", ollama: "mistral:7b" },
  "mistral-small-24b": { hf: "mistralai/Mistral-Small-24B-Instruct-2501", gguf: "Mistral-Small-24B-Instruct-2501", ollama: "mistral-small:24b" },
  "r1-distill-8b": { hf: "deepseek-ai/DeepSeek-R1-Distill-Llama-8B", gguf: "DeepSeek-R1-Distill-Llama-8B", ollama: "deepseek-r1:8b" },
  "r1-distill-14b": { hf: "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B", gguf: "DeepSeek-R1-Distill-Qwen-14B", ollama: "deepseek-r1:14b" },
  "r1-distill-32b": { hf: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", gguf: "DeepSeek-R1-Distill-Qwen-32B", ollama: "deepseek-r1:32b" },
  "deepseek-v3": { hf: "deepseek-ai/DeepSeek-V3-0324", gguf: "DeepSeek-V3-0324", ollama: "deepseek-v3" },
};

function tags(model: Model) {
  return (
    TAGS[model.id] ?? {
      hf: model.name.replace(/\s+/g, "-"),
      gguf: model.name.replace(/\s+/g, "-"),
      ollama: model.id,
    }
  );
}

/** Hugging Face repo of the original (unquantized) weights. */
export function hfRepo(model: Model): string | null {
  return TAGS[model.id]?.hf ?? null;
}

export function modelsWithoutTags(models: Model[]): string[] {
  return models.filter((m) => !TAGS[m.id]).map((m) => m.id);
}

const KV_LLAMA: Record<KvPrecision, string> = { fp16: "f16", q8: "q8_0", q4: "q4_0" };

export type LaunchResult = {
  backend: BackendId;
  body: string;
  ggufFile: string;
  ollamaTag: string;
  hfRepo: string;
  notes: string[];
  unsupported: string[];
};

export function launchCommands(opts: {
  gpu: Gpu;
  model: Model;
  quant: Quant;
  context: number;
  kv: KvPrecision;
  fit: Fit;
  backend: BackendId;
}): LaunchResult {
  const t = tags(opts.model);
  const qg = QUANT_GGUF[opts.quant.id];
  const qo = QUANT_OLLAMA[opts.quant.id];
  const ngl = opts.fit.fullOffload || opts.fit.moeOffload ? 99 : opts.fit.gpuLayers;
  const ggufFile = `${t.gguf}-${qg}.gguf`;
  const ollamaTag = `${t.ollama}-${qo}`;
  const notes = [...opts.fit.backendNotes];
  const unsupported: string[] = [];
  const kvType = KV_LLAMA[opts.kv];

  let body: string;

  if (opts.backend === "llamacpp") {
    const lines = [
      `llama-server \\`,
      `  -m ${ggufFile} \\`,
      `  -c ${opts.context} \\`,
      `  -ngl ${ngl} \\`,
    ];
    if (opts.fit.moeOffload) lines.push(`  --n-cpu-moe ${opts.fit.cpuMoeLayers} \\`);
    if (opts.gpu.cards > 1) {
      const share = Array.from({ length: opts.gpu.cards }, () => 1).join(",");
      lines.push(`  -ts ${share} \\`);
    }
    lines.push(`  --flash-attn on \\`);
    lines.push(`  -ctk ${kvType} -ctv ${kvType} \\`);
    lines.push(`  --port 8080`);
    body = lines.join("\n");
    notes.push(
      `已寫入：GPU 層數 ${ngl === 99 ? "全部" : ngl}${opts.fit.moeOffload ? `、${opts.fit.cpuMoeLayers} 層 expert 放 CPU` : ""}、context ${opts.context}、KV ${opts.kv.toUpperCase()}、Flash Attention。`,
    );
    notes.push("llama-server 提供 OpenAI 相容 API（http://localhost:8080/v1）；只想在終端機聊天可把 llama-server 換成 llama-cli。");
  } else if (opts.backend === "ollama") {
    const env = ["OLLAMA_FLASH_ATTENTION=1"];
    if (opts.kv !== "fp16") env.push(`OLLAMA_KV_CACHE_TYPE=${kvType}`);
    body = [
      `# 1) 啟動伺服器（Flash Attention、KV 精度是全域設定）`,
      `${env.join(" ")} ollama serve`,
      ``,
      `# 2a) 用官方 tag；進入對話後輸入下面兩行 /set`,
      `ollama run ${ollamaTag}`,
      `#   /set parameter num_ctx ${opts.context}`,
      `#   /set parameter num_gpu ${ngl}`,
      ``,
      `# 2b) 或用本機 GGUF 建立固定設定的模型`,
      `cat > Modelfile <<'EOF'`,
      `FROM ./${ggufFile}`,
      `PARAMETER num_ctx ${opts.context}`,
      `PARAMETER num_gpu ${ngl}`,
      `EOF`,
      `ollama create ${opts.model.id}-lab -f Modelfile`,
      `ollama run ${opts.model.id}-lab`,
    ].join("\n");
    notes.push(`已寫入：num_gpu=${ngl}、num_ctx=${opts.context}、Flash Attention${opts.kv !== "fp16" ? `、KV ${opts.kv.toUpperCase()}` : ""}。2a 和 2b 擇一即可。`);
    if (opts.fit.moeOffload) {
      unsupported.push("Ollama 沒有 --n-cpu-moe，只能逐層切分；實際速度會比估計值低。");
    }
  } else {
    const tp = Math.max(1, opts.gpu.cards);
    const lines = [`vllm serve ${t.hf} \\`, `  --max-model-len ${opts.context} \\`];
    if (tp > 1) lines.push(`  --tensor-parallel-size ${tp} \\`);
    if (opts.quant.id === "q8") lines.push(`  --quantization fp8 \\`);
    if (opts.kv === "q8") lines.push(`  --kv-cache-dtype fp8 \\`);
    lines.push(`  --gpu-memory-utilization 0.90`);
    body = lines.join("\n");
    if (opts.gpu.vendor === "apple") {
      unsupported.push("vLLM 不支援 Apple Silicon GPU，這組指令在 Mac 上跑不起來。");
    }
    if (opts.quant.bpw < 8) {
      unsupported.push(
        `vLLM 不載入 GGUF ${opts.quant.label}。4–6 bit 請改用 AWQ／GPTQ 權重（在 Hugging Face 搜尋「${t.hf.split("/")[1]} AWQ」），把 repo 換掉即可。`,
      );
    }
    if (opts.quant.id === "q8") notes.push("Q8 對應 vLLM 線上 FP8 量化（需 Ada／Hopper 以上）。");
    if (opts.kv === "q4") {
      unsupported.push("vLLM 沒有 Q4 KV cache；最低是 FP8（--kv-cache-dtype fp8）。");
    }
    notes.push(`已寫入：max-model-len=${opts.context}${tp > 1 ? `、tensor-parallel=${tp}` : ""}。`);
  }

  notes.push("GGUF 檔名與 Ollama tag 為推測，請對到實際下載的檔案。");

  return {
    backend: opts.backend,
    body,
    ggufFile,
    ollamaTag,
    hfRepo: t.hf,
    notes,
    unsupported,
  };
}
