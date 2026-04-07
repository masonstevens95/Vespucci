import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NavySection } from "../NavySection";
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

describe("NavySection", () => {
  it("shows 'Navy: None' when totalShips = 0", () => {
    const { container } = render(<NavySection stats={mkStats()} />);
    expect(container.textContent).toContain("Navy");
    expect(container.textContent).toContain("None");
  });

  it("shows navy section when totalShips > 0", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 5, lightShips: 3, galleys: 2, transports: 1 })} />);
    expect(container.textContent).toContain("Navy Frontage");
    expect(container.textContent).toContain("Heavy / Light / Galley");
    expect(container.textContent).toContain("Transports");
    expect(container.textContent).toContain("Sailors");
  });

  it("shows Monthly Sailors when monthlySailors > 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, monthlySailors: 50 })} />);
    expect(container.textContent).toContain("Monthly Sailors");
  });

  it("does not show Monthly Sailors when monthlySailors = 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, monthlySailors: 0 })} />);
    expect(container.textContent).not.toContain("Monthly Sailors");
  });

  it("shows Navy Maintenance when navyMaintenance > 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, navyMaintenance: 3 })} />);
    expect(container.textContent).toContain("Navy Maintenance");
  });

  it("does not show Navy Maintenance when navyMaintenance = 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, navyMaintenance: 0 })} />);
    expect(container.textContent).not.toContain("Navy Maintenance");
  });

  it("shows Navy Tradition when navyTradition > 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, navyTradition: 40 })} />);
    expect(container.textContent).toContain("Navy Tradition");
  });

  it("does not show Navy Tradition when navyTradition = 0 and navy present", () => {
    const { container } = render(<NavySection stats={mkStats({ heavyShips: 1, navyTradition: 0 })} />);
    expect(container.textContent).not.toContain("Navy Tradition");
  });

  it("shows Military Tactics when militaryTactics > 0", () => {
    const { container } = render(<NavySection stats={mkStats({ militaryTactics: 2 })} />);
    expect(container.textContent).toContain("Military Tactics");
  });

  it("does not show Military Tactics when militaryTactics = 0", () => {
    const { container } = render(<NavySection stats={mkStats({ militaryTactics: 0 })} />);
    expect(container.textContent).not.toContain("Military Tactics");
  });

  it("shows War Exhaustion when warExhaustion > 0", () => {
    const { container } = render(<NavySection stats={mkStats({ warExhaustion: 100 })} />);
    expect(container.textContent).toContain("War Exhaustion");
  });

  it("does not show War Exhaustion when warExhaustion = 0", () => {
    const { container } = render(<NavySection stats={mkStats({ warExhaustion: 0 })} />);
    expect(container.textContent).not.toContain("War Exhaustion");
  });
});
