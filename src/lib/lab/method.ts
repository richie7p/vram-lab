export const DATA_AS_OF = "2026-11-22";

export const METHOD_LINES = [
  "權重 VRAM ≈ 參數量(B) × 每權重位元 / 8。對齊常見 GGUF 檔案大小，不是官方精確表。",
  "KV cache = 2 × 注意力層 × KV heads × head_dim × context × 每元素位元組 / 1024³。",
  "滑動視窗／chunked 注意力（Gemma 3、Llama 4）的局部層只算視窗內的 token，長 context 主要吃全域層。",
  "開銷含 CUDA／驅動保留、compute buffer 與 ggml 運行時，隨 context 略增。",
  "完整需求 = 權重 + KV + 開銷。GPU 實際配置只計放得進的層 + KV + 開銷。",
  "容量缺口 = max(0, 完整需求 − 可用 VRAM)。剩餘是 GPU 上放完之後的餘地，兩者不是同一件事。",
  "系統 RAM 需求 ≈ 6 GB 系統保留 + CPU 承接權重 × 1.15。KV 預設仍在 GPU。統一記憶體機器（Mac、Strix Halo、DGX Spark）的 GPU 配置也從同一池扣。",
  "生成速度 = 1 / (GPU 端權重 ÷ GPU 有效頻寬 + CPU 端權重 ÷ CPU 頻寬 + kernel 開銷)。桌機 CPU 以約 50 GB/s（雙通道 DDR5）計。",
  "MoE 只讀 active 參數：共享權重 × 1.1、routed expert × 1.8（讀取較分散）。放不下時 llama.cpp 用 --n-cpu-moe 只把 expert 移到 CPU，注意力與 KV 留在 GPU。",
  "Prompt 處理 = 有效算力 ÷ (2 × active 參數)，隨 context 略降；CPU 上的權重每 512 token 要經 PCIe 搬一次。算力取 llama.cpp 實測量級，不是規格表。",
  "架構數字來自各模型公開 config（層數、KV heads、head dim），可用 npm run check:models 對照 Hugging Face。全部是理論估算，不是實測 benchmark。",
] as const;
