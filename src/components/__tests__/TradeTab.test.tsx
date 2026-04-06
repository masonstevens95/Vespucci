import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SortHeader } from "../trade/SortHeader";
import { GoodsSubTab } from "../trade/GoodsSubTab";
import { MarketsSubTab } from "../trade/MarketsSubTab";
import { GoodModal } from "../trade/GoodModal";
import { MarketModal } from "../trade/MarketModal";
import type { DetailSortMode, MarketType } from "../../lib/trade-helpers";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const mkGood = (name: string, overrides = {}) => ({
  name,
  price: 1,
  supply: 10,
  demand: 8,
  surplus: -2,
  stockpile: 5,
  totalProduction: 10,
  ...overrides,
});

const mkMarket = (id: number, overrides = {}): MarketType => ({
  id,
  centerLocation: 0,
  dialect: "",
  population: 1000,
  price: 1.5,
  food: 500,
  capacity: 2000,
  goods: [],
  ...overrides,
});

const marketNames = { 1: "Venice", 2: "London" };

// ─── SortHeader ──────────────────────────────────────────────────────

describe("SortHeader", () => {
  it("renders label text", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={false} dir="desc" onSort={() => {}} />
    );
    expect(container.textContent).toContain("Supply");
  });

  it("shows ▾ when active and desc", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={true} dir="desc" onSort={() => {}} />
    );
    expect(container.textContent).toContain(" ▾");
  });

  it("shows ▴ when active and asc", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={true} dir="asc" onSort={() => {}} />
    );
    expect(container.textContent).toContain(" ▴");
  });

  it("does not show ▾ when inactive", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={false} dir="desc" onSort={() => {}} />
    );
    expect(container.textContent).not.toContain("▾");
  });

  it("has trade-sort-active class when active", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={true} dir="desc" onSort={() => {}} />
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("trade-sort-active");
  });

  it("does not have trade-sort-active class when inactive", () => {
    const { container } = render(
      <SortHeader col="supply" label="Supply" active={false} dir="desc" onSort={() => {}} />
    );
    const span = container.querySelector("span");
    expect(span?.className).not.toContain("trade-sort-active");
  });

  it("calls onSort with col value on click", () => {
    const onSort = vi.fn();
    const { container } = render(
      <SortHeader col={"price" as DetailSortMode} label="Price" active={false} dir="desc" onSort={onSort} />
    );
    const span = container.querySelector("span")!;
    fireEvent.click(span);
    expect(onSort).toHaveBeenCalledWith("price");
  });
});

// ─── GoodsSubTab ─────────────────────────────────────────────────────

describe("GoodsSubTab", () => {
  const producedGoods = { "goods_grain": 500, "goods_wine": 300 };
  const markets = [
    mkMarket(1, {
      goods: [
        mkGood("goods_grain", { supply: 100, demand: 80 }),
        mkGood("goods_wine", { supply: 50, demand: 40 }),
      ],
    }),
  ];

  it("renders 2 ranking rows for 2 goods", () => {
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood={undefined}
        onSelectGood={() => {}}
      />
    );
    const rows = container.querySelectorAll(".ranking-row");
    expect(rows.length).toBe(2);
  });

  it("shows formatted good name not raw key", () => {
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood={undefined}
        onSelectGood={() => {}}
      />
    );
    expect(container.textContent).toContain("Grain");
    expect(container.textContent).not.toContain("goods_grain");
  });

  it("adds trade-good-selected class when row is clicked", () => {
    const onSelectGood = vi.fn();
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood="goods_grain"
        onSelectGood={onSelectGood}
      />
    );
    const selectedRows = container.querySelectorAll(".trade-good-selected");
    expect(selectedRows.length).toBeGreaterThan(0);
  });

  it("clicking a non-selected row calls onSelectGood with good name", () => {
    const onSelectGood = vi.fn();
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood={undefined}
        onSelectGood={onSelectGood}
      />
    );
    const rows = container.querySelectorAll(".ranking-row");
    fireEvent.click(rows[0]);
    expect(onSelectGood).toHaveBeenCalled();
    const arg = onSelectGood.mock.calls[0][0];
    expect(typeof arg).toBe("string");
  });

  it("clicking the selected row calls onSelectGood with undefined (deselects)", () => {
    const onSelectGood = vi.fn();
    const { container } = render(
      <GoodsSubTab
        producedGoods={{ "goods_grain": 500 }}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood="goods_grain"
        onSelectGood={onSelectGood}
      />
    );
    const row = container.querySelector(".trade-good-selected")!;
    fireEvent.click(row);
    expect(onSelectGood).toHaveBeenCalledWith(undefined);
  });

  it("shows modal-overlay when selectedGood is set", () => {
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood="goods_grain"
        onSelectGood={() => {}}
      />
    );
    expect(container.querySelector(".modal-overlay")).toBeTruthy();
  });

  it("shows no modal when selectedGood is undefined", () => {
    const { container } = render(
      <GoodsSubTab
        producedGoods={producedGoods}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood={undefined}
        onSelectGood={() => {}}
      />
    );
    expect(container.querySelector(".modal-overlay")).toBeFalsy();
  });

  it("closing the GoodModal calls onSelectGood(undefined)", () => {
    const onSelectGood = vi.fn();
    const { container } = render(
      <GoodsSubTab
        producedGoods={{ "goods_grain": 500 }}
        markets={markets}
        marketNames={marketNames}
        countryProduction={{}} countryNames={{}} sortMode="production"
        sortDir="desc"
        selectedGood="goods_grain"
        onSelectGood={onSelectGood}
      />
    );
    fireEvent.click(container.querySelector(".modal-close")!);
    expect(onSelectGood).toHaveBeenCalledWith(undefined);
  });
});

// ─── MarketsSubTab ───────────────────────────────────────────────────

describe("MarketsSubTab", () => {
  const markets: MarketType[] = [
    mkMarket(1, {
      dialect: "western",
      goods: [mkGood("a"), mkGood("b"), mkGood("c")],
    }),
    mkMarket(2, {
      dialect: "",
      goods: [mkGood("a")],
    }),
  ];

  it("renders 2 ranking rows for 2 markets", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    const rows = container.querySelectorAll(".ranking-row");
    expect(rows.length).toBe(2);
  });

  it("shows market name from marketNames", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    expect(container.textContent).toContain("Venice");
    expect(container.textContent).toContain("London");
  });

  it("shows dialect in ai line when dialect is not empty", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    const aiSpans = container.querySelectorAll(".ranking-ai");
    const textsWithDialect = Array.from(aiSpans).filter(s => s.textContent?.includes("Western"));
    expect(textsWithDialect.length).toBe(1);
    expect(textsWithDialect[0].textContent).toContain("·");
  });

  it("shows owner country name when marketOwners has entry", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{ 1: "ENG" }}
        countryNames={{ ENG: "England" }}
        countryColors={{ ENG: [255, 0, 0] }}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    const veniceRow = Array.from(container.querySelectorAll(".ranking-row")).find(
      r => r.textContent?.includes("Venice")
    );
    expect(veniceRow?.textContent).toContain("Owned by England");
  });

  it("uses country color for border-left when owner is known", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{ 1: "ENG" }}
        countryNames={{ ENG: "England" }}
        countryColors={{ ENG: [255, 0, 0] }}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    const veniceRow = Array.from(container.querySelectorAll(".ranking-row")).find(
      r => r.textContent?.includes("Venice")
    ) as HTMLElement;
    expect(veniceRow.style.borderLeftColor).toBe("rgb(255, 0, 0)");
  });

  it("does NOT show separator when dialect is empty", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={() => {}}
      />
    );
    // The market with id=2 has empty dialect, find its ai span (London is marketNames[2])
    const londonRow = Array.from(container.querySelectorAll(".ranking-row")).find(
      r => r.textContent?.includes("London")
    );
    const aiSpan = londonRow?.querySelector(".ranking-ai");
    expect(aiSpan?.textContent).not.toContain("·");
  });

  it("clicking a row calls onSelectMarket with that market", () => {
    const onSelectMarket = vi.fn();
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={undefined}
        onSelectMarket={onSelectMarket}
      />
    );
    fireEvent.click(container.querySelectorAll(".ranking-row")[0]);
    expect(onSelectMarket).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(Number) }));
  });

  it("shows modal-overlay when selectedMarket is set", () => {
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={markets[0]}
        onSelectMarket={() => {}}
      />
    );
    expect(container.querySelector(".modal-overlay")).toBeTruthy();
  });

  it("closing the MarketModal calls onSelectMarket(undefined)", () => {
    const onSelectMarket = vi.fn();
    const { container } = render(
      <MarketsSubTab
        markets={markets}
        marketNames={marketNames}
        marketOwners={{}}
        countryNames={{}}
        countryColors={{}}
        sortMode="population"
        sortDir="desc"
        selectedMarket={markets[0]}
        onSelectMarket={onSelectMarket}
      />
    );
    fireEvent.click(container.querySelector(".modal-close")!);
    expect(onSelectMarket).toHaveBeenCalledWith(undefined);
  });
});

// ─── GoodModal ───────────────────────────────────────────────────────

describe("GoodModal", () => {
  const markets: MarketType[] = [
    mkMarket(1, { goods: [mkGood("goods_grain", { supply: 200, demand: 150, totalProduction: 300 })] }),
    mkMarket(2, { goods: [mkGood("goods_grain", { supply: 100, demand: 80, totalProduction: 150 })] }),
  ];

  it("shows formatted good name", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    expect(container.querySelector(".modal-name")?.textContent).toBe("Grain");
  });

  it("shows 0.00 avg price when good is in no markets", () => {
    const { container } = render(
      <GoodModal goodName="goods_silk" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    const avgStat = Array.from(container.querySelectorAll(".modal-stat")).find(
      s => s.textContent?.includes("Avg Price")
    );
    expect(avgStat?.querySelector(".modal-stat-value")?.textContent).toBe("0.00");
  });

  it("shows traded in N markets", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    expect(container.textContent).toContain("Traded in 2 markets");
  });

  it("shows Total Production stat", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    expect(container.textContent).toContain("Total Production");
  });

  it("shows Total Supply stat", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    expect(container.textContent).toContain("Total Supply");
  });

  it("shows Total Demand stat", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    expect(container.textContent).toContain("Total Demand");
  });

  it("default sort is supply: highest supply market row is first", () => {
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    const rows = container.querySelectorAll(".trade-market-row");
    // Venice (market 1) has supply=200, London (market 2) has supply=100 → Venice first
    expect(rows[0].textContent).toContain("Venice");
  });

  it("clicking Price sort header reorders rows by price descending", () => {
    const sortMarkets: MarketType[] = [
      mkMarket(1, { goods: [mkGood("goods_grain", { supply: 200, price: 1.0 })] }),
      mkMarket(2, { goods: [mkGood("goods_grain", { supply: 100, price: 5.0 })] }),
    ];
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={sortMarkets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    // Default supply desc → Venice (supply 200) first
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("Venice");

    // Click Price header
    const priceHeader = Array.from(container.querySelectorAll(".trade-sort-header")).find(
      el => el.textContent?.startsWith("Price")
    )!;
    fireEvent.click(priceHeader);

    // Re-query: price desc → London (price 5.0) should be first
    const rowsAfter = container.querySelectorAll(".trade-market-row");
    expect(rowsAfter[0].textContent).toContain("London");
  });

  it("clicking the same column header twice toggles asc/desc", () => {
    const sortMarkets: MarketType[] = [
      mkMarket(1, { goods: [mkGood("goods_grain", { supply: 200 })] }),
      mkMarket(2, { goods: [mkGood("goods_grain", { supply: 100 })] }),
    ];
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={sortMarkets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={() => {}} />
    );
    const supplyHeader = Array.from(container.querySelectorAll(".trade-sort-header")).find(
      el => el.textContent?.startsWith("Supply")
    )!;
    // Default: supply desc → Venice first, shows ▾
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("Venice");
    expect(supplyHeader.textContent).toContain("▾");

    // Click same column → toggle to asc → London first, shows ▴
    fireEvent.click(supplyHeader);
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("London");
    expect(supplyHeader.textContent).toContain("▴");
  });

  it("close button click fires onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={onClose} />
    );
    const closeBtn = container.querySelector(".modal-close")!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking modal-overlay fires onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={onClose} />
    );
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking modal-content does NOT fire onClose (stopPropagation)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <GoodModal goodName="goods_grain" markets={markets} marketNames={marketNames} countryProduction={{}} countryNames={{}} onClose={onClose} />
    );
    const content = container.querySelector(".modal-content")!;
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── MarketModal ─────────────────────────────────────────────────────

describe("MarketModal", () => {
  const market: MarketType = mkMarket(1, {
    capacity: 2000,
    population: 1000,
    dialect: "western_roman",
    goods: [
      mkGood("goods_grain", { supply: 200, demand: 150 }),
      mkGood("goods_wine", { supply: 100, demand: 80 }),
    ],
  });

  const emptyDialectMarket: MarketType = mkMarket(2, {
    capacity: 2000,
    population: 1000,
    dialect: "",
    goods: [mkGood("goods_grain")],
  });

  it("shows market name", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    expect(container.querySelector(".modal-name")?.textContent).toBe("Venice");
  });

  it("shows owner name in modal tag when provided", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="England" onClose={() => {}} />
    );
    expect(container.querySelector(".modal-tag")?.textContent).toContain("Owned by England");
  });

  it("does not show owner prefix when ownerName is empty", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    const tagText = container.querySelector(".modal-tag")?.textContent ?? "";
    // Should start with dialect or goods count, not " · "
    expect(tagText).not.toMatch(/^\s*·/);
  });

  it("shows dialect formatted", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    expect(container.textContent).toContain("Western Roman");
  });

  it("shows 50.0% capacity pct", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    expect(container.textContent).toContain("50.0%");
  });

  it("shows — for capacity pct when capacity is 0", () => {
    const zeroCapMarket: MarketType = mkMarket(1, {
      capacity: 0,
      population: 1000,
      dialect: "",
      goods: [],
    });
    const { container } = render(
      <MarketModal market={zeroCapMarket} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    const popCapStat = Array.from(container.querySelectorAll(".modal-stat")).find(
      s => s.textContent?.includes("Pop / Capacity")
    );
    expect(popCapStat?.querySelector(".modal-stat-value")?.textContent).toBe("—");
  });

  it("close button fires onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={onClose} />
    );
    fireEvent.click(container.querySelector(".modal-close")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking overlay fires onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={onClose} />
    );
    fireEvent.click(container.querySelector(".modal-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking modal-content does NOT fire onClose (stopPropagation)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={onClose} />
    );
    fireEvent.click(container.querySelector(".modal-content")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("default sort is supply: highest supply good is first row", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    const rows = container.querySelectorAll(".trade-market-row");
    // goods_grain supply=200 > goods_wine supply=100
    expect(rows[0].textContent).toContain("Grain");
  });

  it("clicking Price sort header reorders rows by price descending", () => {
    const sortableMarket: MarketType = mkMarket(1, {
      dialect: "",
      goods: [
        mkGood("goods_grain", { supply: 200, price: 1.0 }),
        mkGood("goods_wine", { supply: 100, price: 5.0 }),
      ],
    });
    const { container } = render(
      <MarketModal market={sortableMarket} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    // Default supply desc → Grain (supply 200) first
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("Grain");

    // Click Price header
    const priceHeader = Array.from(container.querySelectorAll(".trade-sort-header")).find(
      el => el.textContent?.startsWith("Price")
    )!;
    fireEvent.click(priceHeader);

    // Re-query: price desc → Wine (price 5.0) should be first
    const rowsAfter = container.querySelectorAll(".trade-market-row");
    expect(rowsAfter[0].textContent).toContain("Wine");
  });

  it("clicking the same column header twice toggles asc/desc", () => {
    const { container } = render(
      <MarketModal market={market} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    const supplyHeader = Array.from(container.querySelectorAll(".trade-sort-header")).find(
      el => el.textContent?.startsWith("Supply")
    )!;
    // Default: supply desc → Grain first, shows ▾
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("Grain");
    expect(supplyHeader.textContent).toContain("▾");

    // Click same column → toggle to asc → Wine first, shows ▴
    fireEvent.click(supplyHeader);
    expect(container.querySelectorAll(".trade-market-row")[0].textContent).toContain("Wine");
    expect(supplyHeader.textContent).toContain("▴");
  });

  it("does NOT show · separator when dialect is empty", () => {
    const { container } = render(
      <MarketModal market={emptyDialectMarket} marketNames={marketNames} ownerName="" onClose={() => {}} />
    );
    const modalTag = container.querySelector(".modal-tag");
    expect(modalTag?.textContent).not.toContain("·");
  });
});
