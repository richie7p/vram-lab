export const DATA_AS_OF = "2026-09-12";

export const METHOD_LINES = [
  "權重 VRAM ≈ 參數量(B) × 每權重位元 / 8。對齊常見 GGUF 檔案大小，不是官方精確表。",
  "KV cache = 2 × 注意力層 × KV heads × head_dim × context × 每元素位元組 / 1024³。",
  "開銷含 CUDA／驅動保留、compute buffer 與 ggml 運行時，隨 context 略增。",
  "完整需求 = 權重 + KV + 開銷。GPU 實際配置只計放得進的層 + KV + 開銷。",
  "容量缺口 = max(0, 完整需求 − 可用 VRAM)。剩餘是 GPU 上放完之後的餘地，兩者不是同一件事。",
  "系統 RAM 需求 ≈ 6 GB 系統保留 + CPU 承接權重 × 1.15。KV 預設仍在 GPU。",
  "速度用顯卡頻寬 × 解碼效率 / 有效權重，再加 kernel 開銷。MoE 用 active 參數估 decode。",
  "模型表為靜態近似值；Qwen2.5-7B 的層數、KV heads、head dim 已對照官方 config，其餘表項仍需逐項來源核對。資料日期不代表全表重新驗證。",
] as const;
