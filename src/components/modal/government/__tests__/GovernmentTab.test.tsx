import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GovernmentTab } from "../GovernmentTab";
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

describe("GovernmentTab", () => {
  it("shows government type when govType is present", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ govType: "monarchy" })} />);
    expect(container.textContent).toContain("Government Type");
    expect(container.textContent).toContain("Monarchy");
  });

  it("does not show government type when govType is absent", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ govType: "" })} />);
    expect(container.textContent).not.toContain("Government Type");
  });

  it("shows Government Power when governmentPower > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ governmentPower: 500 })} />);
    expect(container.textContent).toContain("Government Power");
  });

  it("does not show Government Power when governmentPower = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ governmentPower: 0 })} />);
    expect(container.textContent).not.toContain("Government Power");
  });

  it("shows Diplomatic Capacity when diplomaticCapacity > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ diplomaticCapacity: 200 })} />);
    expect(container.textContent).toContain("Diplomatic Capacity");
  });

  it("does not show Diplomatic Capacity when diplomaticCapacity = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ diplomaticCapacity: 0 })} />);
    expect(container.textContent).not.toContain("Diplomatic Capacity");
  });

  it("shows Religious Influence when religiousInfluence > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ religiousInfluence: 300 })} />);
    expect(container.textContent).toContain("Religious Influence");
  });

  it("does not show Religious Influence when religiousInfluence = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ religiousInfluence: 0 })} />);
    expect(container.textContent).not.toContain("Religious Influence");
  });

  it("shows Karma when karma > 0, karma < 99000, religion includes 'buddh'", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ karma: 5000, religion: "buddhism" })} />);
    expect(container.textContent).toContain("Karma");
  });

  it("does not show Karma when karma = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ karma: 0, religion: "buddhism" })} />);
    expect(container.textContent).not.toContain("Karma");
  });

  it("does not show Karma when karma >= 99000", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ karma: 99000, religion: "buddhism" })} />);
    expect(container.textContent).not.toContain("Karma");
  });

  it("does not show Karma when religion does not include 'buddh'", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ karma: 5000, religion: "catholic" })} />);
    expect(container.textContent).not.toContain("Karma");
  });

  it("shows Purity when purity > 0 and purity != 6000", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ purity: 3000 })} />);
    expect(container.textContent).toContain("Purity");
  });

  it("does not show Purity when purity = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ purity: 0 })} />);
    expect(container.textContent).not.toContain("Purity");
  });

  it("does not show Purity when purity = 6000", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ purity: 6000 })} />);
    expect(container.textContent).not.toContain("Purity");
  });

  it("shows Righteousness when righteousness > 0 and != 9000", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ righteousness: 5000 })} />);
    expect(container.textContent).toContain("Righteousness");
  });

  it("does not show Righteousness when righteousness = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ righteousness: 0 })} />);
    expect(container.textContent).not.toContain("Righteousness");
  });

  it("does not show Righteousness when righteousness = 9000", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ righteousness: 9000 })} />);
    expect(container.textContent).not.toContain("Righteousness");
  });

  it("shows Stability Investment when stabilityInvestment > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ stabilityInvestment: 100 })} />);
    expect(container.textContent).toContain("Stability Investment");
  });

  it("does not show Stability Investment when stabilityInvestment = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ stabilityInvestment: 0 })} />);
    expect(container.textContent).not.toContain("Stability Investment");
  });

  it("shows 'Republican Tradition' label when republicanTradition > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ republicanTradition: 7000 })} />);
    expect(container.textContent).toContain("Republican Tradition");
  });

  it("shows 'Horde Unity' label when hordeUnity > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ hordeUnity: 5000 })} />);
    expect(container.textContent).toContain("Horde Unity");
  });

  it("shows 'Devotion' label when devotion > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ devotion: 3000 })} />);
    expect(container.textContent).toContain("Devotion");
  });

  it("shows 'Tribal Cohesion' label when tribalCohesion > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ tribalCohesion: 4000 })} />);
    expect(container.textContent).toContain("Tribal Cohesion");
  });

  it("shows 'Legitimacy' label when all legit values are zero", () => {
    const { container } = render(<GovernmentTab stats={mkStats()} />);
    expect(container.textContent).toContain("Legitimacy");
  });

  it("shows Monthly Prestige when monthlyPrestige != 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ monthlyPrestige: 10 })} />);
    expect(container.textContent).toContain("Monthly Prestige");
  });

  it("does not show Monthly Prestige when monthlyPrestige = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ monthlyPrestige: 0 })} />);
    expect(container.textContent).not.toContain("Monthly Prestige");
  });

  it("shows Prestige Decay when prestigeDecay != 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ prestigeDecay: 5 })} />);
    expect(container.textContent).toContain("Prestige Decay");
  });

  it("does not show Prestige Decay when prestigeDecay = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ prestigeDecay: 0 })} />);
    expect(container.textContent).not.toContain("Prestige Decay");
  });

  it("shows Power Projection when powerProjection > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ powerProjection: 200 })} />);
    expect(container.textContent).toContain("Power Projection");
  });

  it("does not show Power Projection when powerProjection = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ powerProjection: 0 })} />);
    expect(container.textContent).not.toContain("Power Projection");
  });

  it("shows War Exhaustion when warExhaustion > 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ warExhaustion: 100 })} />);
    expect(container.textContent).toContain("War Exhaustion");
  });

  it("does not show War Exhaustion when warExhaustion = 0", () => {
    const { container } = render(<GovernmentTab stats={mkStats({ warExhaustion: 0 })} />);
    expect(container.textContent).not.toContain("War Exhaustion");
  });

  it("renders EstatesSection when estates are present", () => {
    const estates = [{ type: "estate_nobles", power: 0, powerFraction: 0, satisfaction: 0, targetSatisfaction: 0, numPrivileges: 0, maxPrivileges: 0 }];
    const { container } = render(<GovernmentTab stats={mkStats({ estates })} />);
    expect(container.textContent).toContain("Estates");
  });
});
