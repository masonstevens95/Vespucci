import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RoyalMarriagesSection } from "../RoyalMarriagesSection";
import type { RoyalMarriageData } from "../../../../lib/types";

describe("RoyalMarriagesSection", () => {
  it("renders nothing when no marriages involve this tag", () => {
    const rm: RoyalMarriageData = { countryATag: "FRA", countryBTag: "SPA", startDate: 0 };
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[rm]} countryNames={{}} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when royalMarriages is empty", () => {
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[]} countryNames={{}} />
    );
    expect(container.textContent).toBe("");
  });

  it("shows marriage when countryATag = tag", () => {
    const rm: RoyalMarriageData = { countryATag: "ENG", countryBTag: "FRA", startDate: 0 };
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[rm]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).toContain("Royal Marriages (1)");
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("FRA");
  });

  it("shows marriage when countryBTag = tag", () => {
    const rm: RoyalMarriageData = { countryATag: "FRA", countryBTag: "ENG", startDate: 0 };
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[rm]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).toContain("Royal Marriages (1)");
    expect(container.textContent).toContain("France");
  });

  it("uses tag as display name when not in countryNames", () => {
    const rm: RoyalMarriageData = { countryATag: "ENG", countryBTag: "UNK", startDate: 0 };
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[rm]} countryNames={{}} />
    );
    // resolveDisplayName falls back to tag when not found
    expect(container.textContent).toContain("UNK");
  });

  it("shows count for multiple marriages", () => {
    const rm1: RoyalMarriageData = { countryATag: "ENG", countryBTag: "FRA", startDate: 0 };
    const rm2: RoyalMarriageData = { countryATag: "SPA", countryBTag: "ENG", startDate: 0 };
    const { container } = render(
      <RoyalMarriagesSection tag="ENG" royalMarriages={[rm1, rm2]} countryNames={{ FRA: "France", SPA: "Spain" }} />
    );
    expect(container.textContent).toContain("Royal Marriages (2)");
  });
});
