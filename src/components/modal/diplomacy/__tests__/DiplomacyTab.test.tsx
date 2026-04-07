import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DiplomacyTab } from "../DiplomacyTab";
import type { CountryEconomyStats, RoyalMarriageData, ActiveCBData } from "../../../../lib/types";
import type { CountryInfo } from "../../../../lib/country-info";

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

const mkInfo = (overrides: Partial<CountryInfo> = {}): CountryInfo => ({
  tag: "ENG", displayName: "England", players: [], color: "#ff0000",
  provinceCount: 5, overlord: "", subjects: [],
  stats: mkStats(), production: {}, goodsRankings: {}, goodAvgPrices: {},
  ...overrides,
});

describe("DiplomacyTab", () => {
  it("shows Great Power Score when greatPowerScore > 0", () => {
    const info = mkInfo({ stats: mkStats({ greatPowerScore: 500 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Great Power Score");
  });

  it("does not show Great Power Score when greatPowerScore = 0", () => {
    const info = mkInfo({ stats: mkStats({ greatPowerScore: 0 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).not.toContain("Great Power Score");
  });

  it("shows Diplomatic Reputation when diplomaticReputation != 0", () => {
    const info = mkInfo({ stats: mkStats({ diplomaticReputation: 2 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Diplomatic Reputation");
  });

  it("shows Diplomatic Reputation when diplomaticReputation < 0", () => {
    const info = mkInfo({ stats: mkStats({ diplomaticReputation: -1 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Diplomatic Reputation");
  });

  it("does not show Diplomatic Reputation when diplomaticReputation = 0", () => {
    const info = mkInfo({ stats: mkStats({ diplomaticReputation: 0 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).not.toContain("Diplomatic Reputation");
  });

  it("shows Power Projection when powerProjection > 0", () => {
    const info = mkInfo({ stats: mkStats({ powerProjection: 50 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Power Projection");
  });

  it("does not show Power Projection when powerProjection = 0", () => {
    const info = mkInfo({ stats: mkStats({ powerProjection: 0 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).not.toContain("Power Projection");
  });

  it("shows Liberty Desire when overlord is present", () => {
    const info = mkInfo({ overlord: "FRA", stats: mkStats({ libertyDesire: 50 }) });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{ FRA: "France" }} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Liberty Desire");
  });

  it("does not show Liberty Desire when overlord is absent", () => {
    const info = mkInfo({ overlord: "" });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).not.toContain("Liberty Desire");
  });

  it("shows Subjects row when subjects.length > 0", () => {
    const info = mkInfo({ subjects: ["FRA", "SPA"] });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Subjects");
    expect(container.textContent).toContain("2");
  });

  it("does not show Subjects when subjects.length = 0", () => {
    const info = mkInfo({ subjects: [] });
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{}} royalMarriages={[]} activeCBs={[]} />
    );
    expect(container.textContent).not.toContain("Subjects");
  });

  it("delegates Royal Marriages rendering to RoyalMarriagesSection", () => {
    const info = mkInfo({ tag: "ENG" });
    const rm: RoyalMarriageData = { countryATag: "ENG", countryBTag: "FRA", startDate: 0 };
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{ FRA: "France" }} royalMarriages={[rm]} activeCBs={[]} />
    );
    expect(container.textContent).toContain("Royal Marriages");
    expect(container.textContent).toContain("France");
  });

  it("delegates CB rendering to CasusBelliSection", () => {
    const info = mkInfo({ tag: "ENG" });
    const cb: ActiveCBData = { holderTag: "ENG", targetTag: "FRA", startDate: 0 };
    const { container } = render(
      <DiplomacyTab info={info} stats={info.stats} countryNames={{ FRA: "France" }} royalMarriages={[]} activeCBs={[cb]} />
    );
    expect(container.textContent).toContain("Casus Belli Held");
    expect(container.textContent).toContain("France");
  });
});
