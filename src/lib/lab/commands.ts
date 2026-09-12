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

const TAGS: Record<string, { gguf: string; ollama: string }> = {
  "qwen25-05b": { gguf: "Qwen2.5-0.5B-Instruct", ollama: "qwen2.5:0.5b" },
  "qwen25-15b": { gguf: "Qwen2.5-1.5B-Instruct", ollama: "qwen2.5:1.5b" },
  "qwen25-3b": { gguf: "Qwen2.5-3B-Instruct", ollama: "qwen2.5:3b" },
  "qwen25-7b": { gguf: "Qwen2.5-7B-Instruct", ollama: "qwen2.5:7b-instruct" },
  "qwen25-14b": { gguf: "Qwen2.5-14B-Instruct", ollama: "qwen2.5:14b-instruct" },
  "qwen25-32b": { gguf: "Qwen2.5-32B-Instruct", ollama: "qwen2.5:32b-instruct" },
  "qwen25-coder-32b": { gguf: "Qwen2.5-Coder-32B-Instruct", ollama: "qwen2.5-coder:32b" },
  "qwen25-72b": { gguf: "Qwen2.5-72B-Instruct", ollama: "qwen2.5:72b-instruct" },
  "qwen3-06b": { gguf: "Qwen3-0.6B", ollama: "qwen3:0.6b" },
  "qwen3-17b": { gguf: "Qwen3-1.7B", ollama: "qwen3:1.7b" },
  "qwen3-4b": { gguf: "Qwen3-4B", ollama: "qwen3:4b" },
  "qwen3-8b": { gguf: "Qwen3-8B", ollama: "qwen3:8b" },
  "qwen3-14b": { gguf: "Qwen3-14B", ollama: "qwen3:14b" },
  "qwen3-32b": { gguf: "Qwen3-32B", ollama: "qwen3:32b" },
  "qwq-32b": { gguf: "QwQ-32B", ollama: "qwq:32b" },
  "qwen3-30b-a3b": { gguf: "Qwen3-30B-A3B", ollama: "qwen3:30b-a3b" },
  "qwen3-235b-a22b": { gguf: "Qwen3-235B-A22B", ollama: "qwen3:235b-a22b" },
  "gemma3-1b": { gguf: "gemma-3-1b-it", ollama: "gemma3:1b" },
  "gemma3-4b": { gguf: "gemma-3-4b-it", ollama: "gemma3:4b" },
  "gemma3-12b": { gguf: "gemma-3-12b-it", ollama: "gemma3:12b" },
  "gemma3-27b": { gguf: "gemma-3-27b-it", ollama: "gemma3:27b" },
  "nemotron-nano-8b": { gguf: "Llama-3.1-Nemotron-Nano-8B-v1", ollama: "nemotron-nano:8b" },
  "nemotron-super-49b": { gguf: "Llama-3_3-Nemotron-Super-49B-v1", ollama: "nemotron-super:49b" },
  "nemotron-70b": { gguf: "Llama-3.1-Nemotron-70B-Instruct", ollama: "nemotron:70b" },
  "ministral3-3b": { gguf: "Ministral-3-3B-Instruct", ollama: "ministral:3b" },
  "ministral3-8b": { gguf: "Ministral-3-8B-Instruct", ollama: "ministral:8b" },
  "ministral3-14b": { gguf: "Ministral-3-14B-Instruct", ollama: "ministral:14b" },
  "phi4-mini": { gguf: "Phi-4-mini-instruct", ollama: "phi4-mini" },
  phi4: { gguf: "phi-4", ollama: "phi4" },
  "llama32-1b": { gguf: "Llama-3.2-1B-Instruct", ollama: "llama3.2:1b" },
  "llama32-3b": { gguf: "Llama-3.2-3B-Instruct", ollama: "llama3.2:3b" },
  "llama31-8b": { gguf: "Llama-3.1-8B-Instruct", ollama: "llama3.1:8b-instruct" },
  "llama33-70b": { gguf: "Llama-3.3-70B-Instruct", ollama: "llama3.3:70b" },
  "llama4-scout": { gguf: "Llama-4-Scout-17B-16E", ollama: "llama4:scout" },
  "mistral-7b": { gguf: "Mistral-7B-Instruct-v0.3", ollama: "mistral:7b" },
  "mistral-small-24b": { gguf: "Mistral-Small-24B-Instruct-2501", ollama: "mistral-small:24b" },
  "r1-distill-8b": { gguf: "DeepSeek-R1-Distill-Llama-8B", ollama: "deepseek-r1:8b" },
  "r1-distill-14b": { gguf: "DeepSeek-R1-Distill-Qwen-14B", ollama: "deepseek-r1:14b" },
  "r1-distill-32b": { gguf: "DeepSeek-R1-Distill-Qwen-32B", ollama: "deepseek-r1:32b" },
  "deepseek-v3": { gguf: "DeepSeek-V3-0324", ollama: "deepseek-v3" },
};

function tags(model: Model) {
  return (
    TAGS[model.id] ?? {
      gguf: model.name.replace(/\s+/g, "-"),
      ollama: model.id,
    }
  );
}

function kvFlags(kv: KvPrecision): string {
  if (kv === "fp16") return " \\\n  -ctk f16 -ctv f16";
  if (kv === "q8") return " \\\n  -ctk q8_0 -ctv q8_0";
  return " \\\n  -ctk q4_0 -ctv q4_0";
}

export type LaunchResult = {
  backend: BackendId;
  body: string;
  ggufFile: string;
  ollamaTag: string;
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
  const ngl = opts.fit.fullOffload ? 99 : opts.fit.gpuLayers;
  const ggufFile = `${t.gguf}-${qg}.gguf`;
  const ollamaTag = `${t.ollama}-${qo}`;
  const notes = [...opts.fit.backendNotes];
  const unsupported: string[] = [];
  const fa = "--flash-attn on";
  const split = opts.gpu.cards > 1 ? " \\\n  -ts 50,50" : "";

  let body: string;

  if (opts.backend === "llamacpp") {
    body = [
      `llama-cli \\`,
      `  -m ${ggufFile} \\`,
      `  -c ${opts.context} \\`,
      `  -ngl ${ngl} \\`,
      `  ${fa}${split}${kvFlags(opts.kv)}`,
    ].join("\n");
    notes.push(
      `已寫入：GPU 層數 ${ngl === 99 ? "全部" : ngl}、context ${opts.context}、KV ${opts.kv.toUpperCase()}、Flash Attention。`,
    );
  } else if (opts.backend === "ollama") {
    body = [
      `OLLAMA_FLASH_ATTENTION=1 ollama run ${ollamaTag}`,
      ``,
      `# Modelfile（與實驗室設定對齊）`,
      `FROM ./${ggufFile}`,
      `PARAMETER num_ctx ${opts.context}`,
      `PARAMETER num_gpu ${ngl}`,
    ].join("\n");
    notes.push(`已寫入：num_gpu=${ngl}、num_ctx=${opts.context}、Flash Attention 環境變數。`);
    if (opts.kv !== "fp16") {
      unsupported.push(`KV ${opts.kv.toUpperCase()}：Ollama 沒有穩定對應參數，請改 llama.cpp 或接受預設 FP16 KV。`);
    }
  } else {
    const tp = Math.max(1, opts.gpu.cards);
    body = [
      `vllm serve ${t.gguf} \\`,
      `  --max-model-len ${opts.context} \\`,
      `  --tensor-parallel-size ${tp} \\`,
      `  --gpu-memory-utilization 0.90 \\`,
      `  --dtype auto`,
    ].join("\n");
    unsupported.push("vLLM 不載入 GGUF。此指令只同步 context 與 GPU 數，權重請用 Hugging Face／AWQ／FP8。");
    if (!opts.fit.fullOffload) {
      unsupported.push("目前組合無法完整放進 GPU，vLLM 沒有 -ngl CPU offload。");
    }
    if (opts.kv !== "fp16") {
      unsupported.push("vLLM 不使用 llama.cpp 的 KV 量化旗標。");
    }
    notes.push(`已寫入：max-model-len=${opts.context}、tensor-parallel=${tp}。`);
  }

  notes.push("檔名與 tag 為估計，請對到本機實際檔案。");

  return { backend: opts.backend, body, ggufFile, ollamaTag, notes, unsupported };
}
