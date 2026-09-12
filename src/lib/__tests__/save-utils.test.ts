import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasSavMagic,
  isPacked03,
  isBinarySave,
  serializeConfig,
  downloadConfig,
} from "../save-utils";
import type { MapChartConfig } from "../types";

// =============================================================================
// Pure helper tests
// =============================================================================

describe("hasSavMagic", () => {
  it("returns true for valid SAV header", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x33, 0x30]);
    expect(hasSavMagic(bytes)).toBe(true);
  });

  it("returns false for non-SAV header", () => {
    const bytes = new TextEncoder().encode("metadata={\n}");
    expect(hasSavMagic(bytes)).toBe(false);
  });

  it("returns false for empty data", () => {
    expect(hasSavMagic(new Uint8Array([]))).toBe(false);
  });

  it("returns false for data shorter than 8 bytes", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30]);
    expect(hasSavMagic(bytes)).toBe(false);
  });

  it("returns false when second byte is wrong", () => {
    const bytes = new Uint8Array([0x53, 0x00, 0x56, 0x30, 0x32, 0x30, 0x33, 0x30]);
    expect(hasSavMagic(bytes)).toBe(false);
  });

  it("returns false when third byte is wrong", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x00, 0x30, 0x32, 0x30, 0x33, 0x30]);
    expect(hasSavMagic(bytes)).toBe(false);
  });
});

describe("isPacked03", () => {
  it("returns true for 03 at positions 5-6", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x33, 0x30]);
    expect(isPacked03(bytes)).toBe(true);
  });

  it("returns false for 00 at positions 5-6", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x30, 0x30]);
    expect(isPacked03(bytes)).toBe(false);
  });

  it("returns false when byte 5 is not '0'", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x31, 0x33, 0x30]);
    expect(isPacked03(bytes)).toBe(false);
  });

  it("returns false when byte 6 is not '3'", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x32, 0x30]);
    expect(isPacked03(bytes)).toBe(false);
  });
});

describe("isBinarySave", () => {
  it("returns true for SAV header with packed format 03", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x33, 0x30]);
    expect(isBinarySave(bytes)).toBe(true);
  });

  it("returns false for SAV header with text format 00", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30, 0x32, 0x30, 0x30, 0x30]);
    expect(isBinarySave(bytes)).toBe(false);
  });

  it("returns false for non-SAV file", () => {
    const bytes = new TextEncoder().encode("metadata={\n}");
    expect(isBinarySave(bytes)).toBe(false);
  });

  it("returns false for empty data", () => {
    expect(isBinarySave(new Uint8Array([]))).toBe(false);
  });

  it("returns false for data shorter than 8 bytes", () => {
    const bytes = new Uint8Array([0x53, 0x41, 0x56, 0x30]);
    expect(isBinarySave(bytes)).toBe(false);
  });
});

describe("serializeConfig", () => {
  const config: MapChartConfig = {
    groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    title: "Test", hidden: [], background: "#ffffff", borders: "#000",
    legendFont: "Helvetica", legendFontColor: "#000",
    legendBorderColor: "#00000000", legendBgColor: "#00000000",
    legendWidth: 150, legendBoxShape: "square", legendTitleMode: "attached",
    areBordersShown: true, defaultColor: "#d1dbdd", labelsColor: "#6a0707",
    labelsFont: "Arial", strokeWidth: "medium", areLabelsShown: false,
    uncoloredScriptColor: "#ffff33", zoomLevel: "1.00", zoomX: "0.00",
    zoomY: "0.00", v6: true, mapTitleScale: 1, page: "eu-v-locations",
    mapVersion: null, legendPosition: "bottom_left", legendSize: "medium",
    legendTranslateX: "0.00", legendStatus: "show", scalingPatterns: true,
    legendRowsSameColor: true, legendColumnCount: 1,
  };

  it("returns valid JSON string", () => {
    const json = serializeConfig(config);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("Test");
  });

  it("includes groups in output", () => {
    const json = serializeConfig(config);
    expect(json).toContain("#ff0000");
    expect(json).toContain("ENG");
  });
});

// =============================================================================
// Side-effect tests
// =============================================================================

describe("downloadConfig", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  const mockConfig: MapChartConfig = {
    groups: { "#ff0000": { label: "ENG", paths: ["London"] } },
    title: "", hidden: [], background: "#ffffff", borders: "#000",
    legendFont: "Helvetica", legendFontColor: "#000",
    legendBorderColor: "#00000000", legendBgColor: "#00000000",
    legendWidth: 150, legendBoxShape: "square", legendTitleMode: "attached",
    areBordersShown: true, defaultColor: "#d1dbdd", labelsColor: "#6a0707",
    labelsFont: "Arial", strokeWidth: "medium", areLabelsShown: false,
    uncoloredScriptColor: "#ffff33", zoomLevel: "1.00", zoomX: "0.00",
    zoomY: "0.00", v6: true, mapTitleScale: 1, page: "eu-v-locations",
    mapVersion: null, legendPosition: "bottom_left", legendSize: "medium",
    legendTranslateX: "0.00", legendStatus: "show", scalingPatterns: true,
    legendRowsSameColor: true, legendColumnCount: 1,
  };

  beforeEach(() => {
    clickSpy = vi.fn();
    revokeObjectURLSpy = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = revokeObjectURLSpy;
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
  });

  it("creates a blob URL and triggers download", () => {
    downloadConfig(mockConfig);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("sets download filename to mapchart_config.txt", () => {
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    downloadConfig(mockConfig);
    expect(mockAnchor.download).toBe("mapchart_config.txt");
  });

  it("revokes the blob URL after clicking", () => {
    downloadConfig(mockConfig);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("sets the anchor href to the blob URL", () => {
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    downloadConfig(mockConfig);
    expect(mockAnchor.href).toBe("blob:mock-url");
  });
});

describe("serializeConfig — exported artifact contract", () => {
  const exportConfig: MapChartConfig = {
    groups: { "#ff0000": { label: "FRA", paths: ["Bar_le_Duc", "Paris"] } },
    title: "Test", hidden: [], background: "#ffffff", borders: "#000",
    legendFont: "Helvetica", legendFontColor: "#000",
    legendBorderColor: "#00000000", legendBgColor: "#00000000",
    legendWidth: 150, legendBoxShape: "square", legendTitleMode: "attached",
    areBordersShown: true, defaultColor: "#d1dbdd", labelsColor: "#6a0707",
    labelsFont: "Arial", strokeWidth: "medium", areLabelsShown: false,
    uncoloredScriptColor: "#ffff33", zoomLevel: "1.00", zoomX: "0.00",
    zoomY: "0.00", v6: true, mapTitleScale: 1, page: "eu-v-locations",
    mapVersion: null, legendPosition: "bottom_left", legendSize: "medium",
    legendTranslateX: "0.00", legendStatus: "show", scalingPatterns: true,
    legendRowsSameColor: true, legendColumnCount: 1,
  };

  it("round-trips through JSON with the locations page id", () => {
    expect(JSON.parse(serializeConfig(exportConfig)).page).toBe("eu-v-locations");
  });

  it("round-trips group paths as canonical Title_Case ids", () => {
    const parsed = JSON.parse(serializeConfig(exportConfig));
    // mapchart.net matches path ids exactly; a lowercase save name would not
    // load, and per-segment title-casing cannot reproduce "Bar_le_Duc".
    expect(parsed.groups["#ff0000"].paths).toEqual(["Bar_le_Duc", "Paris"]);
    const lowercased = parsed.groups["#ff0000"].paths.filter(
      (p: string) => p === p.toLowerCase(),
    );
    expect(lowercased).toEqual([]);
  });
});
