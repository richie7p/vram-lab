#!/usr/bin/env node
/**
 * Browser smoke test for the lab UI.
 *
 *   npm run test:e2e                      # starts its own dev server
 *   BASE_URL=http://localhost:8080 npm run test:e2e
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const PORT = 4317;
let baseUrl = process.env.BASE_URL;
let server;
let browser;

async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${url} did not start`);
}

before(async () => {
  if (!baseUrl) {
    baseUrl = `http://127.0.0.1:${PORT}`;
    server = spawn(
      process.execPath,
      ["scripts/with-app-env.mjs", "vite", "dev", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
      { stdio: "ignore", detached: true },
    );
    await waitFor(baseUrl);
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
});

/** Open a page, collect uncaught errors, and wait for the verdict to render. */
async function open(path = "/", { viewport, storage } = {}) {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1280, height: 900 } });
  if (storage) {
    await context.addInitScript((value) => {
      localStorage.setItem("vram-lab-config-v3", value);
    }, JSON.stringify(storage));
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(new URL(path, baseUrl).toString());
  await page.getByText("判定", { exact: true }).waitFor({ timeout: 30_000 });
  // Set by the URL-sync effect once React has hydrated.
  await page.locator("html[data-lab-ready]").waitFor({ state: "attached", timeout: 30_000 });
  return { page, errors, close: () => context.close() };
}

const GEMMA = "/?g=4090&m=gemma3-27b&q=q4km&c=32768&kv=fp16&ram=32&b=llamacpp";

test("a shared link restores the config and fits Gemma 3 27B on a 4090", async () => {
  const { page, errors, close } = await open(GEMMA);
  await page.getByText(/4090 · Gemma 3 27B/).waitFor();
  await page.getByText("完整 GPU offload", { exact: true }).waitFor();
  const verdict = await page.locator("h2").first().textContent();
  assert.notEqual(verdict?.trim(), "不適合");
  assert.match(await page.locator("pre").textContent(), /-c 32768/);
  assert.deepEqual(errors, []);
  await close();
});

test("changing the GPU updates the address bar", async () => {
  const { page, close } = await open(GEMMA);
  await page.getByRole("button", { name: /^3090\s*24 GB$/ }).click();
  await page.waitForFunction(() => location.search.includes("g=3090"));
  await close();
});

test("MoE that does not fit gets an --n-cpu-moe command", async () => {
  const { page, close } = await open("/?g=3060&m=qwen3-30b-a3b&q=q4km&c=8192&kv=fp16&ram=32&b=llamacpp");
  await page.getByText(/MoE expert offload ·/).waitFor();
  assert.match(await page.locator("pre").textContent(), /--n-cpu-moe \d+/);
  await close();
});

test("vLLM command uses the Hugging Face repo", async () => {
  const { page, close } = await open(GEMMA);
  await page.getByRole("button", { name: "vLLM", pressed: false }).first().click();
  await page.waitForFunction(() => document.querySelector("pre")?.textContent?.includes("vllm serve google/gemma-3-27b-it"));
  await close();
});

test("stale saved state with a removed model still renders the lab", async () => {
  const { page, errors, close } = await open("/", {
    storage: { state: { mode: "lab", gpuId: "4090", modelId: "removed-model", quantId: "q9", context: 8192 }, version: 3 },
  });
  await page.waitForFunction(() => location.search.includes("m=qwen25-7b"));
  assert.deepEqual(errors, []);
  await close();
});

for (const backend of ["llamacpp", "ollama", "vllm"]) {
  test(`phone width has nothing wider than the screen (${backend})`, async () => {
    const path = `/?g=4090&m=gemma3-27b&q=q4km&c=65536&kv=q8&ram=32&b=${backend}`;
    const { page, close } = await open(path, { viewport: { width: 375, height: 812 } });
    // Body may clip overflow, so check the widest laid-out section instead of scrollWidth.
    const widest = await page.evaluate(() =>
      Math.max(...[...document.querySelectorAll("main section")].map((el) => el.getBoundingClientRect().right)),
    );
    assert.ok(widest <= 376, `a section ends at ${widest}px on a 375px screen`);
    await close();
  });
}

test("adding a second card writes -ts and keeps it in the link", async () => {
  const { page, close } = await open("/?g=3090&m=llama33-70b&q=q3km&c=8192&kv=fp16&ram=64&b=llamacpp");
  await page.getByLabel("第二張顯卡").selectOption("3060");
  await page.waitForFunction(() => location.search.includes("g2=3060"));
  await page.waitForFunction(() => document.querySelector("pre")?.textContent?.includes("-ts 24,12"));
  await close();
});

test("parallel users show per-user and total speed", async () => {
  const { page, close } = await open("/?g=4090&m=qwen25-14b&q=q4km&c=8192&kv=fp16&ram=32&b=llamacpp");
  await page.getByRole("button", { name: "4 人" }).click();
  await page.getByText(/4 人合計約/).waitFor();
  assert.match(await page.locator("pre").textContent(), /-np 4/);
  await close();
});

test("pinning shows deltas against the current config", async () => {
  const { page, close } = await open("/?g=4090&m=qwen25-14b&q=q4km&c=8192&kv=fp16&ram=32&b=llamacpp");
  await page.getByRole("button", { name: "釘選目前組合" }).click();
  await page.getByRole("button", { name: /^3090\s*24 GB$/ }).click();
  await page.getByText(/^[+-]\d+%$/).first().waitFor();
  await close();
});
