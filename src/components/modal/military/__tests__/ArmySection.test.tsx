import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { ArmySection } from "../ArmySection";
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

describe("ArmySection", () => {
  it("always shows Regular Strength, Infantry/Cavalry/Artillery, Army Frontage", () => {
    const { container } = render(<ArmySection stats={mkStats()} />);
    const c = within(container);
    expect(c.getByText("Regular Strength")).toBeTruthy();
    expect(c.getByText("Infantry / Cavalry / Artillery")).toBeTruthy();
    expect(c.getByText("Army Frontage")).toBeTruthy();
  });

  it("shows Raised Levies when levyStr > 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ levyInfantryStr: 500 })} />);
    expect(container.textContent).toContain("Raised Levies");
  });

  it("does not show Raised Levies when levyStr = 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ levyInfantryStr: 0, levyCavalryStr: 0 })} />);
    expect(container.textContent).not.toContain("Raised Levies");
  });

  it("shows Monthly Manpower when monthlyManpower > 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ monthlyManpower: 10 })} />);
    expect(container.textContent).toContain("Monthly Manpower");
  });

  it("does not show Monthly Manpower when monthlyManpower = 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ monthlyManpower: 0 })} />);
    expect(container.textContent).not.toContain("Monthly Manpower");
  });

  it("shows Army Maintenance when armyMaintenance > 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ armyMaintenance: 5 })} />);
    expect(container.textContent).toContain("Army Maintenance");
  });

  it("does not show Army Maintenance when armyMaintenance = 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ armyMaintenance: 0 })} />);
    expect(container.textContent).not.toContain("Army Maintenance");
  });

  it("shows Army Tradition when armyTradition > 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ armyTradition: 50 })} />);
    expect(container.textContent).toContain("Army Tradition");
  });

  it("does not show Army Tradition when armyTradition = 0", () => {
    const { container } = render(<ArmySection stats={mkStats({ armyTradition: 0 })} />);
    expect(container.textContent).not.toContain("Army Tradition");
  });
});
