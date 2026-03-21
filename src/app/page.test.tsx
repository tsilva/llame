import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home landing page", () => {
  it("routes Launch app through the fresh chat entrypoint", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Launch app" })).toHaveAttribute("href", "/chat?new=1");
  });
});
