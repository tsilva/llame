import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer, sanitizeMarkdownUrl } from "@/components/MarkdownRenderer";

describe("sanitizeMarkdownUrl", () => {
  it("allows http, https, mailto, and relative URLs", () => {
    expect(sanitizeMarkdownUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeMarkdownUrl("http://example.com")).toBe("http://example.com");
    expect(sanitizeMarkdownUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(sanitizeMarkdownUrl("/docs")).toBe("/docs");
  });

  it("rejects scriptable, unsafe data, and malformed URLs", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeMarkdownUrl("https://exa mple.com")).toBeNull();
  });
});

describe("MarkdownRenderer", () => {
  it("renders safe links with hardened external-link attributes", () => {
    render(<MarkdownRenderer content="[safe](https://example.com)" />);

    const link = screen.getByRole("link", { name: "safe" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render unsafe links or image markdown from generated output", () => {
    render(<MarkdownRenderer content="[bad](javascript:alert(1)) ![pixel](https://example.com/pixel.png)" />);

    expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
    expect(screen.getByText("bad")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
