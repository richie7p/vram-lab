import type { Quant, QuantId } from "./types";

export const QUANTS: Quant[] = [
  {
    id: "q2",
    label: "Q2",
    bpw: 2.63,
    quality: 0.58,
    qualityNote: "能塞進卡裡，但邏輯與指令遵循明顯變差。只建議當「能不能跑」的挑戰檔。",
  },
  {
    id: "q3km",
    label: "Q3_K_M",
    bpw: 3.91,
    quality: 0.78,
    qualityNote: "6–8GB 卡的生存檔。比 Q2 能用很多，但寫作與 coding 仍會掉一截。",
  },
  {
    id: "iq4xs",
    label: "IQ4_XS",
    bpw: 4.25,
    quality: 0.88,
    qualityNote: "重要性矩陣量化。體積接近 Q4_K_S，品質常接近 Q4_K_M，很適合卡在容量邊緣時。",
  },
  {
    id: "q4ks",
    label: "Q4_K_S",
    bpw: 4.45,
    quality: 0.86,
    qualityNote: "比 Q4_K_M 略小略差。VRAM 差幾百 MB 過不了線時的折衷。",
  },
  {
    id: "q4km",
    label: "Q4_K_M",
    bpw: 4.85,
    quality: 0.9,
    qualityNote: "本地部署最常用的平衡點。品質接近 Q5，檔案明顯比較小。",
  },
  {
    id: "q5",
    label: "Q5",
    bpw: 5.72,
    quality: 0.95,
    qualityNote: "Q5_K_M。多數任務已很難跟 Q6/Q8 分出差距，是「有餘裕就升級」的檔。",
  },
  {
    id: "q6",
    label: "Q6",
    bpw: 6.59,
    quality: 0.98,
    qualityNote: "Q6_K。接近原精度，適合當主力且 VRAM 還有空間時。",
  },
  {
    id: "q8",
    label: "Q8",
    bpw: 8.5,
    quality: 0.995,
    qualityNote: "Q8_0。幾乎可視為無損量化，VRAM 代價高。",
  },
  {
    id: "fp16",
    label: "FP16",
    bpw: 16,
    quality: 1,
    qualityNote: "半精度原權重。品質上限，但同樣智慧通常 Q6/Q8 就夠，很少需要。",
  },
];

export const QUANT_BY_ID: Record<QuantId, Quant> = Object.fromEntries(
  QUANTS.map((q) => [q.id, q]),
) as Record<QuantId, Quant>;
