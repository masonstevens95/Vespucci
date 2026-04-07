import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { ProducesSection } from "../ProducesSection";
import type { RgoProductionEntry } from "../../../../lib/types";

const mkEntry = (totalSize: number, locationCount: number): RgoProductionEntry => ({
  totalSize, totalEmployment: totalSize * 1000, locationCount,
});

const emptyRankings = {};
const emptyPrices = {};

describe("ProducesSection", () => {
  it("renders nothing when production is empty", () => {
    const { container } = render(
      <ProducesSection production={{}} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the Produces label when there is production data", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={{ grain: 1 }} goodAvgPrices={{ grain: 1.5 }} />
    );
    const c = within(container);
    expect(c.getByText("Produces")).toBeTruthy();
  });

  it("shows the good name", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    expect(container.textContent).toContain("Grain");
  });

  it("shows location count", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(30, 5) }} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    expect(container.textContent).toContain("5");
  });

  it("shows levels", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(30, 5) }} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    expect(container.textContent).toContain("30");
  });

  it("shows price when available", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={emptyRankings} goodAvgPrices={{ grain: 2.75 }} />
    );
    expect(container.textContent).toContain("2.75");
  });

  it("shows rank when available", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={{ grain: 3 }} goodAvgPrices={emptyPrices} />
    );
    expect(container.textContent).toContain("#3");
  });

  it("shows — when rank is missing", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={{}} goodAvgPrices={emptyPrices} />
    );
    expect(container.textContent).toContain("—");
  });

  it("shows all goods, not just top 3", () => {
    const production = {
      grain: mkEntry(5, 3),
      iron: mkEntry(2, 1),
      fish: mkEntry(8, 4),
      silver: mkEntry(1, 1),
    };
    const { container } = render(
      <ProducesSection production={production} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Fish");
    expect(text).toContain("Grain");
    expect(text).toContain("Iron");
    expect(text).toContain("Silver");
  });

  it("includes divider when production is present", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    expect(container.querySelector(".modal-row-divider")).toBeTruthy();
  });

  it("shows table header columns", () => {
    const { container } = render(
      <ProducesSection production={{ grain: mkEntry(3, 2) }} goodsRankings={emptyRankings} goodAvgPrices={emptyPrices} />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Good");
    expect(text).toContain("Locs");
    expect(text).toContain("Levels");
    expect(text).toContain("Price");
    expect(text).toContain("Rank");
  });
});
