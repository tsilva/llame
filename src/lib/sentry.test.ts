import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { getSentryBaseConfig } from "@/lib/sentry";

describe("getSentryBaseConfig", () => {
  it("scrubs prompt, output, image, attachment, conversation, and message fields", () => {
    const event = {
      request: {
        data: {
          prompt: "secret prompt",
        },
      },
      extra: {
        prompt: "secret prompt",
        output: "secret output",
        imagePayload: "data:image/png;base64,secret",
        attachment: "secret attachment",
        conversation: "secret conversation",
        nested: {
          messages: ["secret message"],
          safeField: "kept",
        },
      },
      contexts: {
        generation: {
          model_id: "owner/model",
          rawOutput: "secret raw output",
        },
      },
    } as unknown as ErrorEvent;

    const processed = getSentryBaseConfig().beforeSend(event);

    expect(processed?.request).not.toHaveProperty("data");
    expect(processed?.extra).not.toHaveProperty("prompt");
    expect(processed?.extra).not.toHaveProperty("output");
    expect(processed?.extra).not.toHaveProperty("imagePayload");
    expect(processed?.extra).not.toHaveProperty("attachment");
    expect(processed?.extra).not.toHaveProperty("conversation");
    expect(processed?.extra?.nested).not.toHaveProperty("messages");
    expect(processed?.extra?.nested).toHaveProperty("safeField", "kept");
    expect(processed?.contexts?.generation).toHaveProperty("model_id", "owner/model");
    expect(processed?.contexts?.generation).not.toHaveProperty("rawOutput");
  });

  it("removes query strings and hashes from network breadcrumbs", () => {
    const processed = getSentryBaseConfig().beforeBreadcrumb({
      category: "fetch",
      data: {
        url: "https://huggingface.co/api/models?search=private-query#section",
        status_code: 200,
      },
    });

    expect(processed.data?.url).toBe("https://huggingface.co/api/models");
    expect(processed.data?.status_code).toBe(200);
  });
});
