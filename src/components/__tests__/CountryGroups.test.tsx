import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountryGroups } from "../CountryGroups";

describe("CountryGroups", () => {
  const groups = {
    "#ff0000": { label: "ENG - Alice", paths: ["London", "York"] },
    "#0000ff": { label: "FRA", paths: ["Paris"] },
  };

  it("renders heading", () => {
    render(<CountryGroups groups={groups} />);
    expect(screen.getByText("Country Groups")).toBeInTheDocument();
  });

  it("renders each group label", () => {
    const { container } = render(<CountryGroups groups={groups} />);
    const labels = container.querySelectorAll(".group-label");
    const texts = Array.from(labels).map((l) => l.textContent);
    expect(texts).toContain("ENG - Alice");
    expect(texts).toContain("FRA");
  });

  it("renders location counts", () => {
    const { container } = render(<CountryGroups groups={groups} />);
    const counts = container.querySelectorAll(".group-count");
    const texts = Array.from(counts).map((c) => c.textContent?.trim());
    expect(texts).toContain("2 locations");
    expect(texts).toContain("1 locations");
  });

  it("renders color swatches with correct background", () => {
    const { container } = render(<CountryGroups groups={groups} />);
    const swatches = container.querySelectorAll(".color-swatch");
    expect(swatches).toHaveLength(2);
    const styles = Array.from(swatches).map((s) => (s as HTMLElement).style.backgroundColor);
    expect(styles).toContain("rgb(255, 0, 0)");
    expect(styles).toContain("rgb(0, 0, 255)");
  });

  it("renders empty grid for no groups", () => {
    const { container } = render(<CountryGroups groups={{}} />);
    expect(container.querySelectorAll(".group-card")).toHaveLength(0);
  });
});
