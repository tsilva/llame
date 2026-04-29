import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenizedText } from "@/components/TokenizedText";

describe("TokenizedText", () => {
  it("preserves multiline whitespace and exposes plain text to assistive tech", () => {
    const { container } = render(
      <TokenizedText
        text={"Hello\nworld"}
        tokens={[
          { index: 0, id: 1, text: "Hello" },
          { index: 1, id: 2, text: "\n" },
          { index: 2, id: 3, text: "world" },
        ]}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute("aria-label", "Hello\nworld");
  });
});
