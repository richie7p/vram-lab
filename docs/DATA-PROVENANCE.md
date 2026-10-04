# Data provenance and estimation limits

Reviewed 2026-10-04. The catalogue's displayed 2026-09-12 date is its original snapshot date, not evidence that every model or GPU has been revalidated.

## Verified primary references

- [Qwen2.5-7B-Instruct config](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/blob/main/config.json): 28 layers, 4 KV heads, head dimension 3584/28 = 128, and 32768 native positions. The public JSON is archived in `tests/fixtures/qwen25-7b-config.json`, with SHA-256 in the inventory. A domain test checks those fields. This does not verify parameter count, extrapolated maximum context, GGUF file size, or speed.
- [Ollama model import](https://docs.ollama.com/import): a local GGUF belongs in a Modelfile `FROM` entry; create the local model before running it. The app now provides separate copyable Modelfile and shell commands.
- [Ollama FAQ](https://docs.ollama.com/faq): KV cache types are service environment settings and quantized KV requires Flash Attention. The app emits `OLLAMA_KV_CACHE_TYPE` and `OLLAMA_FLASH_ATTENTION` separately, with a restart/global-scope explanation.
- [vLLM 0.18.1 GGUF](https://docs.vllm.ai/en/v0.18.1/features/quantization/gguf/): GGUF support exists but is experimental and constrained. The app's HF-directory template explicitly does not apply the selected GGUF quantization; an actual directory must replace the placeholder.
- [vLLM 0.18.1 engine arguments](https://docs.vllm.ai/en/v0.18.1/configuration/engine_args/#--cpu-offload-gb): CPU offload exists, with interconnect costs. The app's vLLM estimate assumes full GPU placement and does not model that option.

## Coverage inventory

`CATALOG-PROVENANCE.json` lists every model and GPU. Unknown source/revision fields are null. The default Qwen architecture has partial verification; the remaining models and GPU capacity/bandwidth values require row-by-row owner review. No generic vendor link is treated as proof for an individual row.

The table's parameter sizes, quantization bits per weight, GPU decode efficiency, kernel latency, driver reserve, split loss, CPU offload penalties, and speed multipliers are modelling assumptions. Speed low/high are heuristic bounds, not statistical confidence intervals. Dense KV arithmetic does not fully capture sliding windows, MLA/hybrid attention, batching, backend allocations, or architecture-specific kernels. Numeric capacity output remains approximate and must be compared with the actual model file and runtime memory report.

No model weights were downloaded, no generated launch command was executed, no local/remote inference was called, and no hardware benchmark was performed. To calibrate, record the exact model revision/file hash, backend/version, quantization and KV types, driver, GPU and RAM, context/batch/prompt lengths, measured peak memory and prefill/decode throughput. Repeat across hardware and operating systems before advertising a hardware guarantee.
