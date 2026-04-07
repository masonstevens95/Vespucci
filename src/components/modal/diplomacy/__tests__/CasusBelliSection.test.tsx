import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CasusBelliSection } from "../CasusBelliSection";
import type { ActiveCBData } from "../../../../lib/types";

describe("CasusBelliSection", () => {
  it("renders nothing when activeCBs is empty", () => {
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[]} countryNames={{}} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when no CBs involve this tag", () => {
    const cb: ActiveCBData = { holderTag: "FRA", targetTag: "SPA", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cb]} countryNames={{}} />
    );
    expect(container.textContent).toBe("");
  });

  it("shows Casus Belli Held when holderTag = tag", () => {
    const cb: ActiveCBData = { holderTag: "ENG", targetTag: "FRA", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cb]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).toContain("Casus Belli Held (1)");
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("FRA");
  });

  it("shows Casus Belli Against when targetTag = tag", () => {
    const cb: ActiveCBData = { holderTag: "FRA", targetTag: "ENG", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cb]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).toContain("Casus Belli Against (1)");
    expect(container.textContent).toContain("France");
  });

  it("shows both held and against when both present", () => {
    const cbHeld: ActiveCBData = { holderTag: "ENG", targetTag: "FRA", startDate: 0 };
    const cbAgainst: ActiveCBData = { holderTag: "SPA", targetTag: "ENG", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cbHeld, cbAgainst]} countryNames={{ FRA: "France", SPA: "Spain" }} />
    );
    expect(container.textContent).toContain("Casus Belli Held");
    expect(container.textContent).toContain("Casus Belli Against");
  });

  it("shows only against when held is empty but against is not", () => {
    const cb: ActiveCBData = { holderTag: "FRA", targetTag: "ENG", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cb]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).not.toContain("Casus Belli Held");
    expect(container.textContent).toContain("Casus Belli Against");
  });

  it("shows only held when against is empty but held is not", () => {
    const cb: ActiveCBData = { holderTag: "ENG", targetTag: "FRA", startDate: 0 };
    const { container } = render(
      <CasusBelliSection tag="ENG" activeCBs={[cb]} countryNames={{ FRA: "France" }} />
    );
    expect(container.textContent).toContain("Casus Belli Held");
    expect(container.textContent).not.toContain("Casus Belli Against");
  });
});
