import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("backend templates, Modelfile, KV environment and clipboard match the selected settings", async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const launch = page.getByRole("region", { name: "啟動指令", exact: true });
  await expect(launch.locator("pre").first()).toContainText("llama-cli");
  await launch.getByRole("button", { name: "Ollama", exact: true }).click();
  await expect(launch.locator("pre").first()).toContainText("ollama create vram-lab-local -f Modelfile");
  await expect(launch.locator("pre").nth(1)).toContainText("PARAMETER num_ctx 8192");
  await launch.getByRole("button", { name: "複製 Modelfile", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("PARAMETER num_ctx 8192");
  await page.getByRole("button", { name: "KV Q8", exact: true }).click();
  await expect(launch).toContainText("OLLAMA_KV_CACHE_TYPE=q8_0");
  await launch.getByRole("button", { name: "複製服務設定", exact: true }).click();
  const copiedEnvironment = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedEnvironment.replace(/\r\n/g, "\n")).toBe("OLLAMA_FLASH_ATTENTION=1\nOLLAMA_KV_CACHE_TYPE=q8_0");
  await launch.getByRole("button", { name: "vLLM", exact: true }).click();
  await expect(launch.locator("pre")).toHaveCount(1);
  await expect(launch).toContainText("/absolute/path/to/hf-model");
  await expect(launch).toContainText("未套用所選 GGUF 量化");
  await launch.getByRole("button", { name: "llama.cpp", exact: true }).click();
  await expect(launch.locator("pre")).toContainText("-ctk q8_0 -ctv q8_0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await mkdir("screenshots", { recursive: true });
  await launch.scrollIntoViewIfNeeded(); await page.screenshot({ path: `screenshots/${info.project.name}-commands.png` });
});

test("recommendations preserve custom capacity when changing the speed reference GPU", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "VRAM 推薦", exact: true }).click();
  await page.getByLabel("VRAM GB", { exact: true }).fill("4");
  await expect(page.getByText("速度區間不是統計信賴區間", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "載入到實驗室", exact: true }).first().click();
  await expect(page.getByLabel("自訂 VRAM GB", { exact: true })).toHaveValue("4");
  await page.getByTitle("RTX 4090 24GB", { exact: true }).click();
  await expect(page.getByLabel("自訂 VRAM GB", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "改用顯卡 24 GB", exact: true }).click();
  await expect(page.getByLabel("自訂 VRAM GB", { exact: true })).toHaveValue("24");
  await page.reload();
  await expect(page.getByLabel("自訂 VRAM GB", { exact: true })).toHaveValue("24");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await mkdir("screenshots", { recursive: true }); await page.screenshot({ path: `screenshots/${info.project.name}-recommendation.png` });
});

test("extended Qwen context shows the manual-configuration warning and correct upper limit", async ({ page }, info) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("searchbox", { name: "篩選模型" }).fill("Qwen3 30B-A3B");
  await page.getByRole("button", { name: /^Qwen3 30B-A3B/ }).click();
  await expect(page.getByRole("slider", { name: "Context length" })).toHaveAttribute("max", "131072");
  await page.getByRole("button", { name: "64K", exact: true }).click();
  const launch = page.getByRole("region", { name: "啟動指令", exact: true });
  await expect(launch).toContainText("未自動加入延伸設定");
  await launch.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("extended-context.png") });
  await page.getByRole("button", { name: "32K", exact: true }).click();
  await expect(launch).not.toContainText("未自動加入延伸設定");
});
