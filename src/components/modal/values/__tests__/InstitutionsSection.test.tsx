import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InstitutionsSection } from "../InstitutionsSection";

describe("InstitutionsSection", () => {
  it("renders nothing when institutions is empty", () => {
    const { container } = render(<InstitutionsSection institutions={[]} />);
    expect(container.textContent).toBe("");
  });

  it("renders institution names when institutions are present", () => {
    const { container } = render(<InstitutionsSection institutions={["feudalism", "renaissance"]} />);
    expect(container.textContent).toContain("Institutions (2)");
    expect(container.textContent).toContain("Feudalism");
    expect(container.textContent).toContain("Renaissance");
  });

  it("renders a single institution correctly", () => {
    const { container } = render(<InstitutionsSection institutions={["printing_press"]} />);
    expect(container.textContent).toContain("Institutions (1)");
    expect(container.textContent).toContain("Printing Press");
  });
});
