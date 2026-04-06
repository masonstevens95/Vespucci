export type RGB = [number, number, number];

export interface EstateData {
  readonly type: string;
  readonly power: number;
  readonly powerFraction: number;
  readonly satisfaction: number;
  readonly targetSatisfaction: number;
  readonly numPrivileges: number;
  readonly maxPrivileges: number;
}

/** Combined stats per country (populated by binary parser). */
export interface CountryEconomyStats {
  readonly gold: number;
  readonly monthlyIncome: number;
  readonly monthlyTradeValue: number;
  readonly stability: number;
  readonly prestige: number;
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
  // Economy — political
  readonly legitimacy: number;
  readonly inflation: number;
  readonly stabilityInvestment: number;
  // Government
  readonly republicanTradition: number;
  readonly hordeUnity: number;
  readonly devotion: number;
  readonly tribalCohesion: number;
  readonly governmentPower: number;
  readonly karma: number;
  readonly religiousInfluence: number;
  readonly purity: number;
  readonly righteousness: number;
  readonly diplomaticCapacity: number;
  // Diplomacy / politics
  readonly diplomaticReputation: number;
  readonly warExhaustion: number;
  readonly powerProjection: number;
  readonly libertyDesire: number;
  readonly greatPowerScore: number;
  readonly numAllies: number;
  // Military — tactics
  readonly militaryTactics: number;
  // Military — traditions
  readonly armyTradition: number;
  readonly navyTradition: number;
  // Economy — monthly flows
  readonly monthlyGoldIncome: number;
  readonly monthlyGoldExpense: number;
  readonly monthlyPrestige: number;
  readonly prestigeDecay: number;
  // Territory
  readonly totalDevelopment: number;
  readonly numProvinces: number;
  // Institutions (list of institution definition names)
  readonly institutions: readonly string[];
  // Societal values (0-100 scale each)
  readonly societalValues: {
    readonly centralization: number;
    readonly innovative: number;
    readonly humanist: number;
    readonly plutocracy: number;
    readonly freeSubjects: number;
    readonly freeTrade: number;
    readonly conciliatory: number;
    readonly quantity: number;
    readonly defensive: number;
    readonly naval: number;
    readonly traditionalEconomy: number;
    readonly communalism: number;
    readonly inward: number;
    readonly liberalism: number;
    readonly jurisprudence: number;
    readonly unsinicized: number;
  };
  // Identity
  readonly courtLanguage: string;
  readonly govType: string;
  readonly primaryCulture: string;
  readonly religion: string;
  readonly score: number;
  // Estates
  readonly estates: readonly EstateData[];
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
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerCountryTag: string;
  readonly defenderCountryTag: string;
  readonly battleWarScore: number;
  readonly attackerTroopBreakdown: readonly number[];
  readonly defenderTroopBreakdown: readonly number[];
  readonly attackerLossBreakdown: readonly number[];
  readonly defenderLossBreakdown: readonly number[];
  readonly attackerCommander: number;
  readonly defenderCommander: number;
  readonly attackerPrisoners: number;
  readonly defenderPrisoners: number;
  readonly attackerWarExhaustion: number;
  readonly defenderWarExhaustion: number;
}

export interface WarData {
  readonly attackerTag: string;
  readonly defenderTag: string;
  readonly casusBelli: string;
  readonly targetProvince: number;
  readonly startDate: number;
  readonly endDate: number;
  readonly isEnded: boolean;
  readonly isCivilWar: boolean;
  readonly isRevolt: boolean;
  readonly attackerScore: number;
  readonly defenderScore: number;
  readonly warDirectionQuarter: number;
  readonly warDirectionYear: number;
  readonly stalledYears: number;
  readonly participants: readonly WarParticipantData[];
  readonly battles: readonly WarBattleData[];
  readonly occupiedLocations: readonly { readonly location: number; readonly controllerTag: string }[];
}

export interface PastWarData {
  readonly countryATag: string;
  readonly countryBTag: string;
  readonly lastWarDate: number;
  readonly warScore: number;
}

export interface WarReparationData {
  readonly winnerTag: string;
  readonly loserTag: string;
  readonly startDate: number;
  readonly expirationDate: number;
}

export interface AnnulledTreatyData {
  readonly enforcerTag: string;
  readonly targetTag: string;
  readonly startDate: number;
  readonly expirationDate: number;
}

export interface RoyalMarriageData {
  readonly countryATag: string;
  readonly countryBTag: string;
  readonly startDate: number;
}

export interface ActiveCBData {
  readonly holderTag: string;
  readonly targetTag: string;
  readonly startDate: number;
}

export interface ParsedSave {
  countryLocations: Record<string, string[]>;
  tagToPlayers: Record<string, string[]>;
  countryColors: Record<string, RGB>;
  overlordSubjects: Record<string, Set<string>>;
  countryNames: Record<string, string>;
  countryStats: Record<string, CountryEconomyStats>;
  wars: WarData[];
  pastWars: PastWarData[];
  warReparations: WarReparationData[];
  annulledTreaties: AnnulledTreatyData[];
  royalMarriages: RoyalMarriageData[];
  activeCBs: ActiveCBData[];
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
