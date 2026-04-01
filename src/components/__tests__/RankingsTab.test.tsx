import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RankingsTab } from "../RankingsTab";
import type { ParsedSave, CountryEconomyStats } from "../../lib/types";

const mkStats = (overrides: Partial<CountryEconomyStats> = {}): CountryEconomyStats => ({
  gold: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 1000,
  infantry: 0, cavalry: 0, artillery: 0,
  infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0,
  levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0,
  expectedArmySize: 0, expectedNavySize: 0,
  courtLanguage: "", govType: "", score: 0, ...overrides,
});

const mockParsed: ParsedSave = {
  countryLocations: {},
  tagToPlayers: { GBR: ["Alice"], FRA: ["Bob"] },
  countryColors: { GBR: [255, 0, 0], FRA: [0, 0, 255], TIM: [0, 255, 0] },
  overlordSubjects: {},
  countryNames: { GBR: "Great Britain", FRA: "France", TIM: "Timurids" },
  countryStats: {
    GBR: mkStats({ score: 3, population: 500000, monthlyIncome: 100000 }),
    FRA: mkStats({ score: 1, population: 800000, monthlyIncome: 200000 }),
    TIM: mkStats({ score: 10, population: 300000, monthlyIncome: 50000 }),
  },
};

describe("RankingsTab", () => {
  it("renders ranking rows", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    const rows = container.querySelectorAll(".ranking-row");
    expect(rows.length).toBe(3);
  });

  it("shows country names", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    expect(container.textContent).toContain("Great Britain");
    expect(container.textContent).toContain("France");
  });

  it("shows player names", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
  });

  it("shows AI label for non-player countries", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    expect(container.querySelectorAll(".ranking-ai").length).toBe(1);
  });

  it("shows rank values", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    expect(container.textContent).toContain("#1");
    expect(container.textContent).toContain("#3");
  });

  it("default sort is by rank", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    const names = Array.from(container.querySelectorAll(".ranking-name")).map(n => n.textContent);
    // FRA rank 1, GBR rank 3, TIM rank 10
    expect(names[0]).toBe("France");
    expect(names[1]).toBe("Great Britain");
    expect(names[2]).toBe("Timurids");
  });

  it("fires onCountryClick when row clicked", () => {
    const fn = vi.fn();
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={fn} />);
    const rows = container.querySelectorAll(".ranking-row");
    fireEvent.click(rows[0]);
    expect(fn).toHaveBeenCalledWith("FRA"); // first by rank
  });

  it("filters to players only when checkbox checked", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // First checkbox is "Players only"
    fireEvent.click(checkboxes[0]);
    const rows = container.querySelectorAll(".ranking-row");
    expect(rows.length).toBe(2); // GBR and FRA only
  });

  it("highlights great powers with gold class", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    // FRA (rank 1) and GBR (rank 3) are great powers, TIM (rank 10) is not
    const gpRows = container.querySelectorAll(".ranking-gp");
    expect(gpRows.length).toBe(2);
  });

  it("has sort dropdown with options", () => {
    const { container } = render(<RankingsTab parsed={mockParsed} onCountryClick={() => {}} />);
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(5);
  });
});
