import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { ProducesSection } from "../ProducesSection";
import type { RgoProductionEntry } from "../../../../lib/types";

const mkEntry = (totalSize: number, locationCount: number): RgoProductionEntry => ({
  totalSize, totalEmployment: totalSize * 1000, locationCount,
});

describe("ProducesSection", () => {
  it("renders nothing when production is empty", () => {
    const { container } = render(<ProducesSection production={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the Produces label when there is production data", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} />
    );
    const c = within(container);
    expect(c.getByText("Produces")).toBeTruthy();
  });

  it("formats good name with location count", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} />
    );
    expect(container.textContent).toContain("Grain");
    expect(container.textContent).toContain("2 locs");
  });

  it("uses singular 'loc' when locationCount is 1", () => {
    const { container } = render(
      <ProducesSection production={{ iron: mkEntry(1, 1) }} />
    );
    expect(container.textContent).toContain("1 loc");
    expect(container.textContent).not.toContain("1 locs");
  });

  it("shows up to 3 goods sorted by totalSize descending", () => {
    const production = {
      grain: mkEntry(5, 3),
      iron: mkEntry(2, 1),
      fish: mkEntry(8, 4),
      silver: mkEntry(1, 1),
    };
    const { container } = render(<ProducesSection production={production} />);
    const text = container.textContent ?? "";
    // Top 3 by size: fish(8), grain(5), iron(2) — silver excluded
    expect(text).toContain("Fish");
    expect(text).toContain("Grain");
    expect(text).toContain("Iron");
    expect(text).not.toContain("Silver");
  });

  it("includes divider when production is present", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} />
    );
    expect(container.querySelector(".modal-row-divider")).toBeTruthy();
  });
});
