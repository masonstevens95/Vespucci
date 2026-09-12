import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ResultsSummary } from "../ResultsSummary";
import type { MapChartConfig } from "../../lib/types";

const mockConfig: MapChartConfig = {
  groups: {
    "#ff0000": { label: "ENG", paths: ["London", "York", "Bristol"] },
    "#0000ff": { label: "FRA", paths: ["Paris"] },
  },
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

describe("ResultsSummary", () => {
  const defaults = {
    config: mockConfig,
    fileSizeMb: 428,
    parseTimeMs: 3200,
    onDownload: vi.fn(),
    onReset: vi.fn(),
  };

  it("renders all stats", () => {
    const { container } = render(<ResultsSummary {...defaults} />);
    const values = Array.from(container.querySelectorAll(".stat-value")).map((el) => el.textContent);
    expect(values).toContain("428 MB");
    expect(values).toContain("3.2s");
    expect(values).toContain("2");
    expect(values).toContain("4");
  });

  it("renders stat labels", () => {
    const { container } = render(<ResultsSummary {...defaults} />);
    const labels = Array.from(container.querySelectorAll(".stat-label")).map((el) => el.textContent);
    expect(labels).toContain("File");
    expect(labels).toContain("Parse time");
    expect(labels).toContain("Countries");
    expect(labels).toContain("Locations");
  });

  it("calls onDownload when download button clicked", async () => {
    const fn = vi.fn();
    const { container } = render(<ResultsSummary {...defaults} onDownload={fn} />);
    const btn = container.querySelector(".btn.primary") as HTMLButtonElement;
    await userEvent.click(btn);
    expect(fn).toHaveBeenCalled();
  });

  it("calls onReset when upload another button clicked", async () => {
    const fn = vi.fn();
    const { container } = render(<ResultsSummary {...defaults} onReset={fn} />);
    const btn = container.querySelector(".btn.secondary") as HTMLButtonElement;
    await userEvent.click(btn);
    expect(fn).toHaveBeenCalled();
  });
});
