import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SocietalValuesSection } from "../SocietalValuesSection";
import type { CountryEconomyStats } from "../../../../lib/types";

const mkSV = (overrides: Partial<CountryEconomyStats["societalValues"]> = {}): CountryEconomyStats["societalValues"] => ({
  centralization: 0, innovative: 0, humanist: 0, plutocracy: 0,
  freeSubjects: 0, freeTrade: 0, conciliatory: 0, quantity: 0,
  defensive: 0, naval: 0, traditionalEconomy: 0, communalism: 0,
  inward: 0, liberalism: 0, jurisprudence: 0, unsinicized: 0,
  ...overrides,
});

describe("SocietalValuesSection", () => {
  it("renders nothing when all values are zero", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV()} />);
    expect(container.textContent).toBe("");
  });

  it("renders section when one active value is present (1-100 range)", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV({ centralization: 70 })} />);
    expect(container.textContent).toContain("Societal Values");
    expect(container.querySelector(".sv-axis")).not.toBeNull();
  });

  it("does not render axis when value > 100 (disabled)", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV({ centralization: 101 })} />);
    expect(container.textContent).toBe("");
  });

  it("shows negative display when value < 50", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV({ centralization: 25 })} />);
    const valueEl = container.querySelector(".sv-bar-value");
    expect(valueEl?.textContent).toBe("-50");
  });

  it("shows positive display sign when value > 50", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV({ centralization: 75 })} />);
    const valueEl = container.querySelector(".sv-bar-value");
    expect(valueEl?.textContent).toBe("+50");
  });

  it("shows 0 display when value = 50", () => {
    const { container } = render(<SocietalValuesSection sv={mkSV({ centralization: 50 })} />);
    const valueEl = container.querySelector(".sv-bar-value");
    expect(valueEl?.textContent).toBe("0");
  });
});
