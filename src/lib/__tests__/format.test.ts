import { describe, it, expect } from "vitest";
import {
  fmtNum,
  computeProvinceCount,
  findTagProvinceCount,
  fmtLanguage,
  fmtGovType,
} from "../format";

describe("fmtNum", () => {
  it("formats millions", () => {
    expect(fmtNum(1_500_000)).toBe("1.5M");
  });

  it("formats thousands", () => {
    expect(fmtNum(45_000)).toBe("45.0K");
  });

  it("formats small numbers", () => {
    expect(fmtNum(500)).toBe("500");
  });

  it("returns dash for zero", () => {
    expect(fmtNum(0)).toBe("—");
  });

  it("returns dash for negative", () => {
    expect(fmtNum(-5)).toBe("—");
  });

  it("formats exact 1000 as K", () => {
    expect(fmtNum(1000)).toBe("1.0K");
  });

  it("formats exact 1M", () => {
    expect(fmtNum(1_000_000)).toBe("1.0M");
  });
});

describe("computeProvinceCount", () => {
  it("sums paths across all groups", () => {
    expect(computeProvinceCount({
      "#ff0000": { paths: ["a", "b"] },
      "#0000ff": { paths: ["c"] },
    })).toBe(3);
  });

  it("returns 0 for empty groups", () => {
    expect(computeProvinceCount({})).toBe(0);
  });
});

describe("findTagProvinceCount", () => {
  it("finds count for matching tag", () => {
    expect(findTagProvinceCount("ENG", {
      "#ff0000": { label: "ENG - Alice", paths: ["a", "b", "c"] },
    })).toBe(3);
  });

  it("returns 0 for no match", () => {
    expect(findTagProvinceCount("FRA", {
      "#ff0000": { label: "ENG", paths: ["a"] },
    })).toBe(0);
  });

  it("returns 0 for empty groups", () => {
    expect(findTagProvinceCount("ENG", {})).toBe(0);
  });
});

describe("fmtLanguage", () => {
  it("formats underscored language", () => {
    expect(fmtLanguage("czech_dialect")).toBe("Czech Dialect");
  });

  it("returns empty for empty string", () => {
    expect(fmtLanguage("")).toBe("");
  });
});

describe("fmtGovType", () => {
  it("capitalizes first letter", () => {
    expect(fmtGovType("monarchy")).toBe("Monarchy");
  });

  it("returns empty for empty string", () => {
    expect(fmtGovType("")).toBe("");
  });

  it("handles already capitalized", () => {
    expect(fmtGovType("Republic")).toBe("Republic");
  });
});
