# Data provenance and estimation limits

Reviewed 2026-10-04. The catalogue's displayed 2026-09-12 date is its original snapshot date, not evidence that every model or GPU has been revalidated.

## Verified primary references

- [Qwen2.5-7B-Instruct config](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/blob/main/config.json): 28 layers, 4 KV heads, head dimension 3584/28 = 128, and 32768 native positions. The public JSON is archived in `tests/fixtures/qwen25-7b-config.json`, with SHA-256 in the inventory. A domain test checks those fields. This does not verify parameter count, extrapolated maximum context, GGUF file size, or speed.
- [Ollama model import](https://docs.ollama.com/import): a local GGUF belongs in a Modelfile `FROM` entry; create the local model before running it. The app now provides separate copyable Modelfile and shell commands.
- [Ollama FAQ](https://docs.ollama.com/faq): KV cache types are service environment settings and quantized KV requires Flash Attention. The app emits `OLLAMA_KV_CACHE_TYPE` and `OLLAMA_FLASH_ATTENTION` separately, with a restart/global-scope explanation.
- [vLLM 0.18.1 GGUF](https://docs.vllm.ai/en/v0.18.1/features/quantization/gguf/): GGUF support exists but is experimental and constrained. The app's HF-directory template explicitly does not apply the selected GGUF quantization; an actual directory must replace the placeholder.
- [vLLM 0.18.1 engine arguments](https://docs.vllm.ai/en/v0.18.1/configuration/engine_args/#--cpu-offload-gb): CPU offload exists, with interconnect costs. The app's vLLM estimate assumes full GPU placement and does not model that option.

## Coverage inventory

`CATALOG-PROVENANCE.json` lists every model and GPU. On 2026-10-04, 31 official public configuration files were archived under `tests/fixtures/model-configs/`, with source URLs and SHA-256 hashes. A regression test checks their attention layer counts, KV head counts, explicit head dimensions (falling back to hidden-size/head-count only when absent), and FP16 KV arithmetic. Nine Meta/Google configurations returned HTTP 401 and remain unverified. Context limits are not inferred solely from `max_position_embeddings`: that can include a model's extension settings rather than its native training length. Parameter counts and GPU capacity/bandwidth still require separate evidence.

This review corrected Ministral 3 3B/14B head dimensions to 128; dividing hidden size by head count produces incorrect values for these models. Nemotron Super 49B has 49 active attention blocks among 80 configured blocks, so its cache estimate now uses 49. DeepSeek V3 retains an explicitly approximate MLA cache surrogate: its FP16 bytes per token match `layers * (kv_lora_rank + qk_rope_head_dim) * 2`, without claiming its catalogue `kvHeads`/`headDim` represent standard GQA architecture.

The original [Qwen3-30B-A3B](https://huggingface.co/Qwen/Qwen3-30B-A3B) and [Qwen3-235B-A22B](https://huggingface.co/Qwen/Qwen3-235B-A22B) model cards specify 32768 native tokens and 131072 with YaRN. Their catalogue limits now match those variants; later 2507 variants are different models. All launch templates flag contexts above the catalogue's native length as requiring manual model/backend extension configuration. The app does not execute or certify that configuration.

The table's parameter sizes, quantization bits per weight, GPU decode efficiency, kernel latency, driver reserve, split loss, CPU offload penalties, and speed multipliers are modelling assumptions. Speed low/high are heuristic bounds, not statistical confidence intervals. Dense KV arithmetic does not fully capture sliding windows, MLA/hybrid attention, batching, backend allocations, or architecture-specific kernels. Numeric capacity output remains approximate and must be compared with the actual model file and runtime memory report.

No model weights were downloaded, no generated launch command was executed, no local/remote inference was called, and no hardware benchmark was performed. To calibrate, record the exact model revision/file hash, backend/version, quantization and KV types, driver, GPU and RAM, context/batch/prompt lengths, measured peak memory and prefill/decode throughput. Repeat across hardware and operating systems before advertising a hardware guarantee.
