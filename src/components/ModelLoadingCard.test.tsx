import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelLoadingCard } from "@/components/ModelLoadingCard";

describe("ModelLoadingCard", () => {
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
