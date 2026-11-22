export const DATA_AS_OF = "2026-11-22";

export const METHOD_LINES = [
  "權重 VRAM ≈ 參數量(B) × 每權重位元 / 8。對齊常見 GGUF 檔案大小，不是官方精確表。",
  "KV cache = 2 × 注意力層 × KV heads × head_dim × context × 每元素位元組 / 1024³。",
  "滑動視窗／chunked 注意力（Gemma 3、Llama 4）的局部層只算視窗內的 token，長 context 主要吃全域層。",
  "開銷含 CUDA／驅動保留、compute buffer 與 ggml 運行時，隨 context 略增。",
  "完整需求 = 權重 + KV + 開銷。GPU 實際配置只計放得進的層 + KV + 開銷。",
  "容量缺口 = max(0, 完整需求 − 可用 VRAM)。剩餘是 GPU 上放完之後的餘地，兩者不是同一件事。",
  "系統 RAM 需求 ≈ 6 GB 系統保留 + CPU 承接權重 × 1.05（GGUF 以 mmap 載入）。KV 預設仍在 GPU。統一記憶體機器（Mac、Strix Halo、DGX Spark）的 GPU 配置也從同一池扣。",
  "生成速度 = 1 / ((GPU 端權重 + KV 讀取) ÷ GPU 有效頻寬 + CPU 端權重 ÷ 系統記憶體頻寬 + kernel 開銷)。KV 以平均填到一半計，所以 context 越長越慢。",
  "系統記憶體有效頻寬：DDR4 雙通道約 35、DDR5 雙通道約 55、四通道約 110、八通道約 190、12 通道約 270 GB/s（llama.cpp 實際拿得到的量級）。",
  "同時多人：每人各一份 KV；權重每步只讀一次大家共用，所以總吞吐上升、每人速度下降。",
  "雙卡混搭：層數依容量分配、兩張卡輪流算，每 token 時間是兩張卡各自時間相加；vLLM 張量並行只能用 2 × 較小那張。",
  "MoE 只讀 active 參數：共享權重 × 1.1、routed expert × 1.8（讀取較分散）。放不下時 llama.cpp 用 --n-cpu-moe 只把 expert 移到 CPU，注意力與 KV 留在 GPU。",
  "Prompt 處理 = 有效算力 ÷ (2 × active 參數)，隨 context 略降；CPU 上的權重每 512 token 要經 PCIe 搬一次。算力取 llama.cpp 實測量級，不是規格表。",
  "架構數字來自各模型公開 config（層數、KV heads、head dim），可用 npm run check:models 對照 Hugging Face。全部是理論估算，不是實測 benchmark。",
] as const;
