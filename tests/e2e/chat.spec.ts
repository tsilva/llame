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

          const isSlowReply = message.messages.at(-1)?.content?.includes("slow");
          const reply = isSlowReply
            ? ["Mock", " reply", " streaming"]
            : ["Mock", " reply"];
          const tokenDelayMs = isSlowReply ? 200 : 40;

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
            }, tokenDelayMs * (index + 1));
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

test("does not persist an empty assistant draft after stopping and reloading", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explain quantum computing in simple terms" }).click();
  await expect(page.getByText("Mock reply")).toBeVisible();

  const textarea = page.locator("textarea");
  await textarea.fill("slow reply");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("button", { name: "Stop generation" })).toBeVisible();
  await page.getByRole("button", { name: "Stop generation" }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();

  const messagesBeforeReload = await page.evaluate(async () => {
    const activeId = localStorage.getItem("llame-active-conversation");
    if (!activeId) return [];

    return await new Promise<Array<{ role: string; content: string }>>((resolve, reject) => {
      const request = indexedDB.open("llame", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("conversations", "readonly");
        const getRequest = transaction.objectStore("conversations").get(activeId);
        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          const conversation = getRequest.result as { messages?: Array<{ role: string; content: string }> } | undefined;
          resolve(conversation?.messages ?? []);
        };
      };
    });
  });

  expect(messagesBeforeReload.map((message) => ({ role: message.role, content: message.content }))).toEqual([
    { role: "user", content: "Explain quantum computing in simple terms" },
    { role: "assistant", content: "Mock reply" },
    { role: "user", content: "slow reply" },
  ]);

  await page.reload();
  await expect(page.getByText("slow reply")).toBeVisible();
  await expect(page.getByText("Mock reply")).toHaveCount(1);
});
