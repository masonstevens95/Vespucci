import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { OverviewTab } from "../OverviewTab";
import type { CountryEconomyStats } from "../../../../lib/types";
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

const noOp = () => { /* noop */ };

describe("OverviewTab", () => {
  it("shows player name when players present", () => {
    const info = mkInfo({ players: ["Alice"] });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    const c = within(container);
    expect(c.getByText("Alice")).toBeTruthy();
  });

  it("shows AI with muted class when players is empty", () => {
    const info = mkInfo({ players: [] });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    const c = within(container);
    expect(c.getByText("AI")).toBeTruthy();
    const muted = container.querySelector(".modal-muted");
    expect(muted?.textContent).toBe("AI");
  });

  it("shows government type when govType is present", () => {
    const info = mkInfo({ stats: mkStats({ govType: "monarchy" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Government");
    expect(container.textContent).toContain("Monarchy");
  });

  it("does not show government row when govType is absent", () => {
    const info = mkInfo({ stats: mkStats({ govType: "" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Government");
  });

  it("shows language when courtLanguage is present", () => {
    const info = mkInfo({ stats: mkStats({ courtLanguage: "english" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Language");
    expect(container.textContent).toContain("English");
  });

  it("does not show language row when courtLanguage is absent", () => {
    const info = mkInfo({ stats: mkStats({ courtLanguage: "" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Language");
  });

  it("shows culture when primaryCulture is present", () => {
    const info = mkInfo({ stats: mkStats({ primaryCulture: "english" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Culture");
    expect(container.textContent).toContain("English");
  });

  it("does not show culture row when primaryCulture is absent", () => {
    const info = mkInfo({ stats: mkStats({ primaryCulture: "" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Culture");
  });

  it("shows religion when religion is present", () => {
    const info = mkInfo({ stats: mkStats({ religion: "catholic" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Religion");
    expect(container.textContent).toContain("Catholic");
  });

  it("does not show religion row when religion is absent", () => {
    const info = mkInfo({ stats: mkStats({ religion: "" }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Religion");
  });

  it("shows rank without Great Power label for score 9", () => {
    const info = mkInfo({ stats: mkStats({ score: 9 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("#9");
    expect(container.textContent).not.toContain("Great Power");
  });

  it("shows Great Power label for score 1", () => {
    const info = mkInfo({ stats: mkStats({ score: 1 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("#1");
    expect(container.textContent).toContain("(Great Power)");
  });

  it("does not show rank row when score is 0", () => {
    const info = mkInfo({ stats: mkStats({ score: 0 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Rank");
  });

  it("shows numProvinces row when numProvinces > 0", () => {
    const info = mkInfo({ stats: mkStats({ numProvinces: 10 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Provinces (parsed)");
  });

  it("does not show numProvinces row when numProvinces = 0", () => {
    const info = mkInfo({ stats: mkStats({ numProvinces: 0 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Provinces (parsed)");
  });

  it("shows total development when totalDevelopment > 0", () => {
    const info = mkInfo({ stats: mkStats({ totalDevelopment: 100 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Total Development");
  });

  it("does not show total development when totalDevelopment = 0", () => {
    const info = mkInfo({ stats: mkStats({ totalDevelopment: 0 }) });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Total Development");
  });

  it("shows overlord when overlord is present", () => {
    const info = mkInfo({ overlord: "FRA" });
    const countryNames = { FRA: "France" };
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={countryNames} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Overlord");
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("(FRA)");
  });

  it("does not show overlord when overlord is absent", () => {
    const info = mkInfo({ overlord: "" });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Overlord");
  });

  it("does not show subjects row when subjects is empty", () => {
    const info = mkInfo({ subjects: [] });
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).not.toContain("Subjects");
  });

  it("shows subjects count and hides list when subjectsOpen=false", () => {
    const info = mkInfo({ subjects: ["FRA", "SPA"] });
    const countryNames = { FRA: "France", SPA: "Spain" };
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={countryNames} subjectsOpen={false} setSubjectsOpen={noOp} />
    );
    expect(container.textContent).toContain("Subjects (2)");
    expect(container.querySelector(".modal-subject-list")).toBeNull();
  });

  it("shows subject list when subjectsOpen=true", () => {
    const info = mkInfo({ subjects: ["FRA", "SPA"] });
    const countryNames = { FRA: "France", SPA: "Spain" };
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={countryNames} subjectsOpen={true} setSubjectsOpen={noOp} />
    );
    expect(container.querySelector(".modal-subject-list")).not.toBeNull();
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Spain");
  });

  it("calls setSubjectsOpen when subjects label is clicked", () => {
    const info = mkInfo({ subjects: ["FRA"] });
    const setSubjectsOpen = vi.fn();
    const { container } = render(
      <OverviewTab info={info} stats={info.stats} countryNames={{}} subjectsOpen={false} setSubjectsOpen={setSubjectsOpen} />
    );
    const label = container.querySelector(".modal-collapsible") as HTMLElement;
    fireEvent.click(label);
    expect(setSubjectsOpen).toHaveBeenCalledWith(true);
  });
});
