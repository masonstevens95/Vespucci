import { describe, it, expect } from "vitest";
import { emptyIdentity, IDENTITY_FIELDS } from "../sections/country-identity";

describe("emptyIdentity", () => {
  it("returns default values", () => {
    const id = emptyIdentity();
    expect(id.countryName).toBe("");
    expect(id.level).toBe(-1);
    expect(id.govType).toBe("");
    expect(id.courtLanguage).toBe("");
    expect(id.score).toBe(0);
  });

  it("returns a new object each time", () => {
    expect(emptyIdentity()).not.toBe(emptyIdentity());
  });
});

describe("IDENTITY_FIELDS", () => {
  it("has all expected token IDs", () => {
    expect(IDENTITY_FIELDS.COUNTRY_NAME).toBeDefined();
    expect(IDENTITY_FIELDS.LEVEL).toBeDefined();
    expect(IDENTITY_FIELDS.GOVERNMENT).toBeDefined();
    expect(IDENTITY_FIELDS.COURT_LANG).toBeDefined();
    expect(IDENTITY_FIELDS.SCORE).toBeDefined();
    expect(IDENTITY_FIELDS.GREAT_POWER_RANK).toBeDefined();
  });
});
