import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { fmtEstateType, EstatesSection } from "../EstatesSection";
import type { EstateData } from "../../../../lib/types";

const mkEstate = (overrides: Partial<EstateData> = {}): EstateData => ({
  type: "estate_nobles",
  power: 0,
  powerFraction: 0,
  satisfaction: 0,
  targetSatisfaction: 0,
  numPrivileges: 0,
  maxPrivileges: 0,
  ...overrides,
});

describe("fmtEstateType", () => {
  it("formats estate_nobles as Nobility", () => {
    expect(fmtEstateType("estate_nobles")).toBe("Nobility");
  });

  it("formats estate_clergy as Clergy", () => {
    expect(fmtEstateType("estate_clergy")).toBe("Clergy");
  });

  it("formats estate_burghers as Burghers", () => {
    expect(fmtEstateType("estate_burghers")).toBe("Burghers");
  });

  it("formats estate_peasants as Commoners", () => {
    expect(fmtEstateType("estate_peasants")).toBe("Commoners");
  });

  it("formats estate_dhimmi as Dhimmi", () => {
    expect(fmtEstateType("estate_dhimmi")).toBe("Dhimmi");
  });

  it("formats estate_tribes as Tribes", () => {
    expect(fmtEstateType("estate_tribes")).toBe("Tribes");
  });

  it("formats estate_cossacks as Cossacks", () => {
    expect(fmtEstateType("estate_cossacks")).toBe("Cossacks");
  });

  it("formats estate_crown as Crown", () => {
    expect(fmtEstateType("estate_crown")).toBe("Crown");
  });

  it("formats unknown type via fmtTitle stripping estate_ prefix", () => {
    expect(fmtEstateType("estate_unknown_type")).toBe("Unknown Type");
  });
});

describe("EstatesSection", () => {
  it("renders nothing for empty estates", () => {
    const { container } = render(<EstatesSection estates={[]} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when all estates have type=''", () => {
    const { container } = render(<EstatesSection estates={[mkEstate({ type: "" })]} />);
    expect(container.textContent).toBe("");
  });

  it("shows estate with power, satisfaction, numPrivileges, maxPrivileges", () => {
    const estate = mkEstate({ type: "estate_nobles", power: 5000, satisfaction: 7000, numPrivileges: 3, maxPrivileges: 5 });
    const { container } = render(<EstatesSection estates={[estate]} />);
    expect(container.textContent).toContain("Nobility");
    expect(container.textContent).toContain("50.0%");
    expect(container.textContent).toContain("70.0%");
    expect(container.textContent).toContain("3/5");
  });

  it("shows — for power when power = 0", () => {
    const estate = mkEstate({ type: "estate_clergy", power: 0, satisfaction: 3000, numPrivileges: 1, maxPrivileges: 3 });
    const { container } = render(<EstatesSection estates={[estate]} />);
    const rows = container.querySelectorAll(".estates-row");
    const spans = rows[0].querySelectorAll("span");
    expect(spans[1].textContent).toBe("—");
  });

  it("shows — for satisfaction when satisfaction = 0", () => {
    const estate = mkEstate({ type: "estate_clergy", power: 3000, satisfaction: 0, numPrivileges: 1, maxPrivileges: 3 });
    const { container } = render(<EstatesSection estates={[estate]} />);
    const rows = container.querySelectorAll(".estates-row");
    const spans = rows[0].querySelectorAll("span");
    expect(spans[2].textContent).toBe("—");
  });

  it("shows just numPrivileges when maxPrivileges = 0 and numPrivileges > 0", () => {
    const estate = mkEstate({ type: "estate_burghers", power: 0, satisfaction: 0, numPrivileges: 2, maxPrivileges: 0 });
    const { container } = render(<EstatesSection estates={[estate]} />);
    const rows = container.querySelectorAll(".estates-row");
    const spans = rows[0].querySelectorAll("span");
    expect(spans[3].textContent).toBe("2");
  });

  it("shows — for privileges when maxPrivileges = 0 and numPrivileges = 0", () => {
    const estate = mkEstate({ type: "estate_burghers", power: 0, satisfaction: 0, numPrivileges: 0, maxPrivileges: 0 });
    const { container } = render(<EstatesSection estates={[estate]} />);
    const rows = container.querySelectorAll(".estates-row");
    const spans = rows[0].querySelectorAll("span");
    expect(spans[3].textContent).toBe("—");
  });
});
