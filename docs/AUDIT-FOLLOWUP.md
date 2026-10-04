# PDF audit follow-up — 2026-10-04

Maps portfolio PDF pages 33–34. Repeated dependency findings use the same remediation. Source and benchmark limits are documented in [DATA-PROVENANCE](DATA-PROVENANCE.md).

| PDF finding | Implementation and evidence | Status |
| --- | --- | --- |
| P1 standard Windows build cannot launch Vite | Wrapper resolves installed Vite JavaScript and launches it with Node; retains environment/exit/signal behavior. Regression coverage and Windows/Ubuntu build matrix | Addressed |
| P2 dependency advisories | Compatible lockfile refresh, clean install and full audit gate on both OSes | Addressed by current scan |
| P2 undeclared tsx / unreproducible tests | Declared tsx and Playwright; portable test discovery separates scaffold and domain suites | Addressed |
| P2 lint errors/warnings | Strict source lint/typecheck remain active; portable fixture paths and Windows junctions; generated browser reports excluded from lint | Addressed |
| P2 model/GPU provenance and uncalibrated estimates | Default Qwen architecture checked against archived official config, complete per-row evidence inventory, visible qualification of static data and speed ranges; no hardware calibration claimed | Partial: remaining rows/hardware evidence required |
| P3 recommendation/launch flows | Desktop/mobile repository E2E covers recommendation adoption, custom-capacity persistence across GPU-reference change, explicit return to actual GPU capacity, backend templates, clipboard, Modelfile and KV settings | Automated coverage added |
| Launch command correctness found in follow-up | Ollama now separates Modelfile, create/run commands and service settings. vLLM placeholder/quantization limitations and supported CPU-offload option are accurately described using official docs | Addressed for generated templates |
| Numeric robustness / custom budget | Nonfinite estimate and command inputs are bounded. Selecting a speed-reference GPU preserves an explicitly chosen VRAM budget, matching the visible UI promise | Addressed |
| Hydration and persisted state found in browser testing | Persisted configuration restores after server markup hydrates, and controls accept input only after restoration. Desktop/mobile tests exercise the first interaction and reload persistence without page errors | Addressed |

## Reproduction

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm audit --audit-level=low
npm run build
npx playwright install chromium
npm run test:e2e
```

Set `E2E_DEV=1` to run the browser cases against development. CI uses Windows and Ubuntu; Linux also runs desktop/mobile Chromium E2E. Browser emulation and formula tests do not substitute for hardware benchmarking. No merge, deployment, inference call, or credential-based external check is part of this change.

## Local verification

On Windows with Node 22.23.2 and npm 10.9.8, clean install, lint, typecheck, standard production build and full dependency audit passed (zero current findings). All 252 scaffold/shared tests (197 CLI and 55 app/auth) and 22 domain tests passed. All four production and four development browser cases passed across desktop Chromium and Pixel 7 emulation; the command and recommendation screenshots were visually inspected at both widths. Generated launch templates were checked against the documented APIs and UI behavior, but were not executed against model runtimes or physical GPUs.

## Content and function acceptance update

See [the 2026-10-04 acceptance record](CONTENT-FUNCTION-ACCEPTANCE.md) for the additional content review, fixes, regression cases and limits. Earlier counts above describe the audit baseline.
