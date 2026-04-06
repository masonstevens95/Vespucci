import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { EconomyTab } from "../EconomyTab";
import type { CountryEconomyStats } from "../../../../lib/types";

const mkStats = (overrides: Partial<CountryEconomyStats> = {}): CountryEconomyStats => ({
  gold: 0, stability: 0, prestige: 0, monthlyIncome: 0, monthlyTradeValue: 0, population: 0,
  infantry: 0, cavalry: 0, artillery: 0, infantryStr: 0, cavalryStr: 0, artilleryStr: 0,
  levyInfantry: 0, levyCavalry: 0, levyInfantryStr: 0, levyCavalryStr: 0,
  heavyShips: 0, lightShips: 0, galleys: 0, transports: 0,
  armyFrontage: 0, navyFrontage: 0,
  maxManpower: 0, maxSailors: 0, monthlyManpower: 0, monthlySailors: 0,
  armyMaintenance: 0, navyMaintenance: 0, expectedArmySize: 0, expectedNavySize: 0,
  legitimacy: 0, inflation: 0, stabilityInvestment: 0,
  republicanTradition: 0, hordeUnity: 0, devotion: 0, tribalCohesion: 0,
  governmentPower: 0, karma: 0, religiousInfluence: 0, purity: 0, righteousness: 0,
  diplomaticCapacity: 0, diplomaticReputation: 0, warExhaustion: 0, powerProjection: 0,
  libertyDesire: 0, greatPowerScore: 0, numAllies: 0, militaryTactics: 0,
  armyTradition: 0, navyTradition: 0,
  monthlyGoldIncome: 0, monthlyGoldExpense: 0, monthlyPrestige: 0, prestigeDecay: 0,
  totalDevelopment: 0, numProvinces: 0,
  institutions: [], estates: [],
  societalValues: { centralization: 0, innovative: 0, humanist: 0, plutocracy: 0, freeSubjects: 0, freeTrade: 0, conciliatory: 0, quantity: 0, defensive: 0, naval: 0, traditionalEconomy: 0, communalism: 0, inward: 0, liberalism: 0, jurisprudence: 0, unsinicized: 0 },
  courtLanguage: "", govType: "", primaryCulture: "", religion: "", score: 0,
  ...overrides,
});

describe("EconomyTab", () => {
  it("always shows Treasury, Monthly Income, and Trade Value rows", () => {
    const { container } = render(<EconomyTab stats={mkStats()} production={{}} />);
    const c = within(container);
    expect(c.getByText("Treasury")).toBeTruthy();
    expect(c.getByText("Monthly Income (est.)")).toBeTruthy();
    expect(c.getByText("Trade Value")).toBeTruthy();
  });

  it("shows Monthly Gold Income via GoldFlowSection when monthlyGoldIncome > 0", () => {
    const { container } = render(<EconomyTab stats={mkStats({ monthlyGoldIncome: 5 })} production={{}} />);
    expect(container.textContent).toContain("Monthly Gold Income");
  });

  it("does not show Monthly Gold Income when monthlyGoldIncome = 0", () => {
    const { container } = render(<EconomyTab stats={mkStats({ monthlyGoldIncome: 0 })} production={{}} />);
    expect(container.textContent).not.toContain("Monthly Gold Income");
  });

  it("shows Inflation via GoldFlowSection when inflation != 0", () => {
    const { container } = render(<EconomyTab stats={mkStats({ inflation: 500 })} production={{}} />);
    expect(container.textContent).toContain("Inflation");
  });

  it("does not show Inflation when inflation = 0", () => {
    const { container } = render(<EconomyTab stats={mkStats({ inflation: 0 })} production={{}} />);
    expect(container.textContent).not.toContain("Inflation");
  });
});
