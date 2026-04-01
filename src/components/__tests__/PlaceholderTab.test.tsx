import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceholderTab } from "../PlaceholderTab";

describe("PlaceholderTab", () => {
  it("renders title", () => {
    render(<PlaceholderTab title="Economy" description="Coming soon" />);
    expect(screen.getByText("Economy")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<PlaceholderTab title="Trade" description="Trade data coming soon" />);
    expect(screen.getByText("Trade data coming soon")).toBeInTheDocument();
  });

  it("renders with placeholder class", () => {
    const { container } = render(<PlaceholderTab title="Test" description="Desc" />);
    expect(container.querySelector(".tab-placeholder")).toBeInTheDocument();
  });
});
