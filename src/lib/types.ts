export type RGB = [number, number, number];

/** Economy stats per country (optional, populated by binary parser). */
export interface CountryEconomyStats {
  readonly gold: number;
  readonly monthlyIncome: number;
  readonly monthlyTradeValue: number;
  readonly population: number;
  readonly maxManpower: number;
  readonly maxSailors: number;
  readonly expectedArmySize: number;
  readonly expectedNavySize: number;
  readonly courtLanguage: string;
  readonly govType: string;
}

export interface ParsedSave {
  countryLocations: Record<string, string[]>;
  tagToPlayers: Record<string, string[]>;
  countryColors: Record<string, RGB>;
  overlordSubjects: Record<string, Set<string>>;
  countryNames: Record<string, string>;
  countryStats: Record<string, CountryEconomyStats>;
}

export interface MapChartGroup {
  label: string;
  paths: string[];
}

export interface MapChartConfig {
  groups: Record<string, MapChartGroup>;
  title: string;
  hidden: string[];
  background: string;
  borders: string;
  legendFont: string;
  legendFontColor: string;
  legendBorderColor: string;
  legendBgColor: string;
  legendWidth: number;
  legendBoxShape: string;
  legendTitleMode: string;
  areBordersShown: boolean;
  defaultColor: string;
  labelsColor: string;
  labelsFont: string;
  strokeWidth: string;
  areLabelsShown: boolean;
  uncoloredScriptColor: string;
  zoomLevel: string;
  zoomX: string;
  zoomY: string;
  v6: boolean;
  mapTitleScale: number;
  page: string;
  mapVersion: null;
  legendPosition: string;
  legendSize: string;
  legendTranslateX: string;
  legendStatus: string;
  scalingPatterns: boolean;
  legendRowsSameColor: boolean;
  legendColumnCount: number;
}

export interface ExportOptions {
  title?: string;
  playersOnly?: boolean;
  provinceMapping?: Record<string, string[]>;
}

export type MapStyle = "parchment" | "modern" | "dark" | "satellite" | "pastel";
