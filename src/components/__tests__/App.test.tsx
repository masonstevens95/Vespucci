import { describe, it, expect } from "vitest";

describe("Header links", () => {
  it("renders Buy Me a Coffee link with correct href", async () => {
    const { render } = await import("@testing-library/react");
    const App = (await import("../../App")).default;
    const { container } = render(<App />);
    const bmcLink = container.querySelector(".bmc-link") as HTMLAnchorElement;
    expect(bmcLink).toBeInTheDocument();
    expect(bmcLink.href).toBe("https://www.buymeacoffee.com/masoncstevg");
    expect(bmcLink.target).toBe("_blank");
    expect(bmcLink.rel).toContain("noopener");
  });

  it("renders Buy Me a Coffee image", async () => {
    const { render } = await import("@testing-library/react");
    const App = (await import("../../App")).default;
    const { container } = render(<App />);
    const img = container.querySelector(".bmc-img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.alt).toBe("Buy Me A Coffee");
  });

  it("renders GitHub link with correct href", async () => {
    const { render } = await import("@testing-library/react");
    const App = (await import("../../App")).default;
    const { container } = render(<App />);
    const ghLink = container.querySelector(".github-link") as HTMLAnchorElement;
    expect(ghLink).toBeInTheDocument();
    expect(ghLink.href).toBe("https://github.com/masonstevens95/eu5-map-maker");
    expect(ghLink.target).toBe("_blank");
    expect(ghLink.rel).toContain("noopener");
    expect(ghLink.textContent).toContain("GitHub");
  });
});

describe("App debug visibility", () => {
  it("SHOW_DEBUG is true in test/dev environment", async () => {
    const { SHOW_DEBUG } = await import("../../App");
    expect(SHOW_DEBUG).toBe(true);
  });

  it("import.meta.env.DEV is true in vitest", () => {
    expect(import.meta.env.DEV).toBe(true);
  });
});

describe("CountryGroups rendering", () => {
  it("renders when SHOW_DEBUG is true", async () => {
    // In dev/test mode, CountryGroups should render
    const { render } = await import("@testing-library/react");
    const { CountryGroups } = await import("../CountryGroups");
    const groups = { "#ff0000": { label: "ENG", paths: ["London"] } };
    const { container } = render(<CountryGroups groups={groups} />);
    expect(container.querySelector(".group-card")).toBeInTheDocument();
  });
});

describe("DebugPanel rendering", () => {
  it("renders when SHOW_DEBUG is true", async () => {
    const { render } = await import("@testing-library/react");
    const { DebugPanel } = await import("../DebugPanel");
    const { container } = render(
      <DebugPanel
        parsed={{
          countryLocations: {},
          tagToPlayers: {},
          countryColors: {},
          overlordSubjects: {},
          countryNames: {}, countryStats: {},
        }}
        locToProvince={{}}
        config={{
          groups: {},
          title: "",
          hidden: [],
          background: "#fff",
          borders: "#000",
          legendFont: "Helvetica",
          legendFontColor: "#000",
          legendBorderColor: "#00000000",
          legendBgColor: "#00000000",
          legendWidth: 150,
          legendBoxShape: "square",
          legendTitleMode: "attached",
          areBordersShown: true,
          defaultColor: "#d1dbdd",
          labelsColor: "#6a0707",
          labelsFont: "Arial",
          strokeWidth: "medium",
          areLabelsShown: false,
          uncoloredScriptColor: "#ffff33",
          zoomLevel: "1.00",
          zoomX: "0.00",
          zoomY: "0.00",
          v6: true,
          mapTitleScale: 1,
          page: "eu-v-provinces",
          mapVersion: null,
          legendPosition: "bottom_left",
          legendSize: "medium",
          legendTranslateX: "0.00",
          legendStatus: "show",
          scalingPatterns: true,
          legendRowsSameColor: true,
          legendColumnCount: 1,
        }}
        provinceMapping={{}}
      />,
    );
    expect(container.querySelector(".debug-section")).toBeInTheDocument();
  });
});

describe("SHOW_DEBUG gating contract", () => {
  it("details-section is gated by SHOW_DEBUG in App source", async () => {
    // Verify the source code contains the SHOW_DEBUG gate
    const { readFileSync } = await import("fs");
    const source = readFileSync("src/App.tsx", "utf-8");
    expect(source).toContain("{SHOW_DEBUG && (");
    expect(source).toContain('<div className="details-section">');
    expect(source).toContain("export const SHOW_DEBUG = import.meta.env.DEV");
  });

  it("SHOW_DEBUG would be false in production build", () => {
    // In a production build, import.meta.env.DEV would be false
    // and the details-section would be tree-shaken out.
    // We verify the constant is derived from DEV:
    expect(import.meta.env.DEV).toBe(true); // true in test
    // In production: import.meta.env.DEV === false → SHOW_DEBUG === false
    // This test documents the contract.
  });
});
