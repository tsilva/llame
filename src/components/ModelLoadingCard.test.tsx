import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelLoadingCard } from "@/components/ModelLoadingCard";

describe("ModelLoadingCard", () => {
  it("does not show overall progress before aggregate totals are available", () => {
    render(
      <ModelLoadingCard
        progress={new Map([
          [
            "tokenizer.json",
            {
              file: "tokenizer.json",
              progress: 100,
              loaded: 1,
              total: 1,
            },
          ],
        ])}
        totalProgress={null}
        message="Loading tokenizer..."
        modelName="onnx-community/Qwen3.5-0.8B-ONNX"
      />,
    );

    expect(screen.queryByText("Overall")).not.toBeInTheDocument();
    expect(screen.queryByText("1 B / 1 B")).not.toBeInTheDocument();
    expect(screen.getByText("Show details (1 files)")).toBeInTheDocument();
  });

  it("derives overall progress from bytes instead of misreading a raw progress value", () => {
    render(
      <ModelLoadingCard
        progress={new Map([
          [
            "model.onnx",
            {
              file: "model.onnx",
              progress: 1,
              loaded: 1,
              total: 100,
            },
          ],
        ])}
        totalProgress={{
          progress: 1,
          loaded: 1,
          total: 100,
        }}
        message="Loading model..."
        modelName="onnx-community/Qwen3.5-0.8B-ONNX"
      />,
    );

    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getByText("1%")).toBeInTheDocument();
    expect(screen.getByText("1 B / 100 B")).toBeInTheDocument();
  });
});
