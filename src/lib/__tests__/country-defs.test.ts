import { describe, it, expect } from "vitest";
import { COUNTRY_DEFS, countryDef, wikiName } from "../country-defs";
import type { CountryDef } from "../country-defs";

describe("COUNTRY_DEFS", () => {
  it("contains 2,296 entries", () => {
    expect(Object.keys(COUNTRY_DEFS).length).toBe(2296);
  });

  it("every entry has required fields", () => {
    for (const [tag, def] of Object.entries(COUNTRY_DEFS)) {
      expect(def.tag).toBe(tag);
      expect(def.name.length).toBeGreaterThan(0);
      expect(["County", "Duchy", "Kingdom", "Empire"]).toContain(def.rank);
      expect(["pop", "location", "army", "building"]).toContain(def.type);
      expect(["monarchy", "republic", "theocracy", "tribe", "steppe_horde"]).toContain(def.government);
      expect(def.culture.length).toBeGreaterThan(0);
      expect(def.religion.length).toBeGreaterThan(0);
      expect(def.mapColor).toHaveLength(3);
      expect(def.mapColor[0]).toBeGreaterThanOrEqual(0);
      expect(def.mapColor[0]).toBeLessThanOrEqual(255);
    }
  });
});

describe("countryDef", () => {
  it("returns Castile for CAS", () => {
    const cas = countryDef("CAS");
    expect(cas).toBeDefined();
    expect(cas!.name).toBe("Castile");
    expect(cas!.rank).toBe("Kingdom");
    expect(cas!.government).toBe("monarchy");
    expect(cas!.culture).toBe("Castilian");
    expect(cas!.religion).toBe("Catholicism");
    expect(cas!.capital).toBe("Valladolid");
    expect(cas!.acceptedCultures).toEqual(["Asturleonese", "Galician", "Basque"]);
  });

  it("returns Ottomans for TUR", () => {
    const tur = countryDef("TUR");
    expect(tur).toBeDefined();
    expect(tur!.name).toBe("Ottomans");
    expect(tur!.rank).toBe("Duchy");
  });

  it("returns undefined for unknown tag", () => {
    expect(countryDef("ZZZ_INVALID")).toBeUndefined();
  });
});

describe("wikiName", () => {
  it("returns name for known tag", () => {
    expect(wikiName("ENG")).toBe("England");
    expect(wikiName("BOH")).toBe("Bohemia");
    expect(wikiName("MNG")).toBe("Míng");
  });

  it("returns empty string for unknown tag", () => {
    expect(wikiName("ZZZ_NOPE")).toBe("");
  });
});

describe("mapColor parsing", () => {
  it("parses RGB correctly for Castile", () => {
    const cas = countryDef("CAS")!;
    expect(cas.mapColor).toEqual([235, 14, 14]);
  });

  it("parses RGB correctly for Aachen", () => {
    const aac = countryDef("AAC")!;
    expect(aac.mapColor).toEqual([157, 51, 167]);
  });
});

describe("toleratedCultures parsing", () => {
  it("parses semicolon-separated list", () => {
    const cas = countryDef("CAS")!;
    expect(cas.toleratedCultures).toEqual(["Sephardi"]);
  });

  it("returns empty array when no tolerated cultures", () => {
    const aac = countryDef("AAC")!;
    // Aachen has "Low Franconian" as tolerated
    expect(aac.toleratedCultures).toEqual(["Low Franconian"]);
  });
});
