export type RGB = [number, number, number];

/** Combined stats per country (populated by binary parser). */
export interface CountryEconomyStats {
  readonly gold: number;
  readonly monthlyIncome: number;
  readonly monthlyTradeValue: number;
  readonly population: number;
  // Military — regulars: count + strength (men)
  readonly infantry: number;
  readonly cavalry: number;
  readonly artillery: number;
  readonly infantryStr: number;
  readonly cavalryStr: number;
  readonly artilleryStr: number;
  // Military — levies: count + strength (men)
  readonly levyInfantry: number;
  readonly levyCavalry: number;
  readonly levyInfantryStr: number;
  readonly levyCavalryStr: number;
  // Military — navy
  readonly heavyShips: number;
  readonly lightShips: number;
  readonly galleys: number;
  readonly transports: number;
  // Military — frontage (combat width from unit_manager)
  readonly armyFrontage: number;
  readonly navyFrontage: number;
  // Military — capacity (from country database)
  readonly maxManpower: number;
  readonly maxSailors: number;
  readonly monthlyManpower: number;
  readonly monthlySailors: number;
  readonly armyMaintenance: number;
  readonly navyMaintenance: number;
  readonly expectedArmySize: number;
  readonly expectedNavySize: number;
  // Identity
  readonly courtLanguage: string;
  readonly govType: string;
  readonly score: number;
}

export interface WarParticipantData {
  readonly tag: string;
  readonly side: "attacker" | "defender";
  readonly reason: string;
}

export interface WarBattleData {
  readonly location: number;
  readonly date: number;
  readonly attackerWon: boolean;
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

export interface WarData {
  readonly attackerTag: string;
  readonly defenderTag: string;
  readonly casusBelli: string;
  readonly startDate: number;
  readonly endDate: number;
  readonly isEnded: boolean;
  readonly attackerScore: number;
  readonly defenderScore: number;
  readonly participants: readonly WarParticipantData[];
  readonly battles: readonly WarBattleData[];
}

export interface ParsedSave {
  countryLocations: Record<string, string[]>;
  tagToPlayers: Record<string, string[]>;
  countryColors: Record<string, RGB>;
  overlordSubjects: Record<string, Set<string>>;
  countryNames: Record<string, string>;
  countryStats: Record<string, CountryEconomyStats>;
  wars: WarData[];
  trade: {
    readonly producedGoods: Readonly<Record<string, number>>;
    readonly marketNames: Readonly<Record<number, string>>;
    readonly marketOwners: Readonly<Record<number, string>>;
    readonly markets: readonly {
      readonly id: number;
      readonly centerLocation: number;
      readonly dialect: string;
      readonly population: number;
      readonly price: number;
      readonly food: number;
      readonly capacity: number;
      readonly goods: readonly {
        readonly name: string;
        readonly price: number;
        readonly supply: number;
        readonly demand: number;
        readonly surplus: number;
        readonly stockpile: number;
        readonly totalProduction: number;
      }[];
    }[];
  };
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
