import path from "node:path";
import { test, expect } from "@playwright/test";

const assetPath = path.join(process.cwd(), "assets", "book_page.png");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class MockWorker {
      onmessage = null;
      loadedModel = null;
      loadedRevision = null;
      loadedDevice = "webgpu";
      timeouts = [];

      emit(data) {
        queueMicrotask(() => {
          this.onmessage?.({ data });
        });
      }

      postMessage(message) {
        if (message.type === "load") {
          this.loadedModel = message.modelId;
          this.loadedRevision = message.revision ?? null;
          this.loadedDevice = message.device;
          this.emit({ status: "loading", message: "Loading tokenizer..." });
          const handle = setTimeout(() => {
            this.emit({
              status: "loaded",
              modelId: message.modelId,
              revision: message.revision ?? null,
              device: message.device,
              precision: "q4",
              supportsImages: /Qwen3\.5/i.test(message.modelId),
            });
          }, 30);
          this.timeouts.push(handle);
          return;
        }

        if (message.type === "generate") {
          this.emit({ status: "generating" });
          this.emit({ status: "prompt", inputText: "mock prompt" });

          const reply = message.messages.at(-1)?.content?.includes("slow")
            ? ["Mock", " reply", " streaming"]
            : ["Mock", " reply"];

          reply.forEach((token, index) => {
            const handle = setTimeout(() => {
              this.emit({ status: "raw_update", token });
              this.emit({
                status: "update",
                token,
                tps: 12,
                numTokens: index + 1,
                inputTokens: 5,
                isThinking: false,
              });
              if (index === reply.length - 1) {
                this.emit({ status: "complete", tps: 12, numTokens: reply.length });
              }
            }, 40 * (index + 1));
            this.timeouts.push(handle);
          });
          return;
        }

        if (message.type === "interrupt") {
          this.timeouts.forEach((timeout) => clearTimeout(timeout));
          this.timeouts = [];
          this.emit({ status: "complete", tps: 0, numTokens: 0 });
          return;
        }

        if (message.type === "reset") {
          this.timeouts.forEach((timeout) => clearTimeout(timeout));
          this.timeouts = [];
          this.loadedModel = null;
          this.loadedRevision = null;
          this.emit({ status: "unloaded" });
        }
      }

      terminate() {
        this.timeouts.forEach((timeout) => clearTimeout(timeout));
        this.timeouts = [];
      }
    }

    window.__LLAME_WORKER_FACTORY__ = () => {
      const worker = new MockWorker();
      queueMicrotask(() => worker.emit({ status: "ready" }));
      return worker;
    };

    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: async () => ({ name: "Mock GPU" }),
      },
    });
  });
});

test("sends a prompt and restores the same conversation after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explain quantum computing in simple terms" }).click();

  await expect(page.getByText("Mock reply")).toBeVisible();
  await page.reload();

  await expect(page.getByText("Explain quantum computing in simple terms")).toBeVisible();
  await expect(page.getByText("Mock reply")).toBeVisible();
});

test("attaches and removes an image before sending", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explain quantum computing in simple terms" }).click();
  await expect(page.getByRole("button", { name: "Upload images" })).toBeEnabled();

  await page.locator('input[type="file"]').setInputFiles(assetPath);
  await expect(page.getByAltText("Preview")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(page.getByAltText("Preview")).toHaveCount(0);
});

test("switches model presets and handles a stop action", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Qwen3\.5 0\.8B/i }).click();
  await page.getByRole("menuitemradio", { name: /Qwen3\.5 2B/i }).click();

  const textarea = page.locator("textarea");
  await textarea.fill("slow reply");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("button", { name: "Stop generation" })).toBeVisible();
  await page.getByRole("button", { name: "Stop generation" }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
});
