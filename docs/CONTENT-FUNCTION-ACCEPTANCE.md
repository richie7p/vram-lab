# Content and function acceptance — 2026-10-04

31 official configuration snapshots are archived with hashes and checked in domain tests; nine gated files remain unavailable. Corrected Ministral 3 3B/14B head dimensions, Nemotron Super 49B active attention count, and the original Qwen3 30B-A3B/235B-A22B extended context limits. Templates now warn when a context requires manual extension configuration. See [field-level evidence and limitations](DATA-PROVENANCE.md) and [the complete inventory](CATALOG-PROVENANCE.json).

Lint, typecheck, build, 252 shared/scaffold tests and 24 domain tests pass. Production and development each pass six desktop/Pixel 7 browser cases for backend templates, clipboard, custom-capacity preservation, recommendations and extended-context warnings. Model/GPU identifiers and positive dimensions are also checked across all 40 models and 19 GPUs. An app context cap may intentionally be below a model's native context.

Formula consistency does not certify runtime memory or speed. GPU specifications, parameter counts, multimodal encoder allocations, quantization file sizes, native/extended context semantics for other variants and real hardware still need separate verification. No generated launch template was executed against a model runtime.
