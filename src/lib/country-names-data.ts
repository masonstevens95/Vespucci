/**
 * Known EU5 country tag → display name mapping.
 *
 * Sourced from EU5/EU4 wiki data. Used as localization fallback since
 * the save file only stores tag keys, not display names.
 * Dynamic countries (AAA/ABA/etc.) get names from the save's country_name field.
 */

export const KNOWN_NAMES: Readonly<Record<string, string>> = {
  // Scandinavia & Baltic
  SWE: "Sweden", DEN: "Denmark", NOR: "Norway", FIN: "Finland",
  GOT: "Gotland", ICE: "Iceland", SCA: "Scandinavia", SHL: "Holstein",
  EST: "Estonia", LVA: "Livonia", SKE: "Scania",

  // British Isles
  ENG: "England", SCO: "Scotland", WLS: "Wales", IRL: "Ireland",
  GBR: "Great Britain", NOL: "Northumberland", CRN: "Cornwall",
  LEI: "Leinster", TYR: "Tyrone", ULS: "Ulster", KID: "Kildare",
  ORD: "Ormond", LAN: "Lancaster",

  // France
  FRA: "France", BRI: "Brittany", BUR: "Burgundy", PRO: "Provence",
  GUY: "Gascony", TOU: "Toulouse", ALE: "Alencon", AUV: "Auvergne",
  AMG: "Armagnac", BOU: "Bourbonnais", BER: "Berry", FOI: "Foix",
  NEV: "Nevers", NRM: "Normandy", ORL: "Orleans", DAU: "Dauphine",

  // Low Countries
  HOL: "Holland", FLA: "Flanders", BRB: "Brabant", NED: "Netherlands",
  FRI: "Frisia", GEL: "Guelders", HAI: "Hainaut", LIE: "Liege",
  LUX: "Luxembourg", UTR: "Utrecht",

  // Iberia
  CAS: "Castile", ARA: "Aragon", POR: "Portugal", SPA: "Spain",
  GRA: "Granada", NAV: "Navarre", CAT: "Catalonia", GAL: "Galicia",
  LON: "Leon", ADU: "Andalusia", VAL: "Valencia", ASU: "Asturias",

  // Italy
  VEN: "Venice", GEN: "Genoa", MLO: "Milan", NAP: "Naples",
  PAP: "Papal States", FLO: "Florence", SIC: "Sicily", SAV: "Savoy",
  PIE: "Piedmont", FER: "Ferrara", MAN: "Mantua", MOD: "Modena",
  PAR: "Parma", LUC: "Lucca", SIE: "Siena", TUS: "Tuscany",
  URB: "Urbino", SAR: "Sardinia", AQN: "Aquileia", MFA: "Montferrat",
  SAL: "Saluzzo", ITA: "Italy", TWS: "Two Sicilies", BLG: "Bologna",

  // HRE / Germany
  HAB: "Austria", BOH: "Bohemia", BRA: "Brandenburg", BAV: "Bavaria",
  SAX: "Saxony", HES: "Hesse", MAI: "Mainz", TRE: "Trier",
  COL: "Cologne", PAL: "Palatinate", BAD: "Baden", OLD: "Oldenburg",
  BRE: "Bremen", HAM: "Hamburg", LUB: "Lubeck", MKL: "Mecklenburg",
  POM: "Pomerania", SIL: "Silesia", THU: "Thuringia", WUR: "Wurttemberg",
  AAC: "Aachen", ANH: "Anhalt", ANS: "Ansbach", AUG: "Augsburg",
  BRU: "Brunswick", EFR: "East Frisia", FRN: "Frankfurt", KLE: "Cleves",
  LOR: "Lorraine", LUN: "Luneburg", MAG: "Magdeburg", MEI: "Meissen",
  MUN: "Munster", MVA: "Moravia", NSA: "Nassau", SLZ: "Salzburg",
  STY: "Styria", SWI: "Switzerland", TIR: "Tirol", ULM: "Ulm",
  WBG: "Wurzburg", WES: "Westphalia", NUM: "Nuremberg", DTT: "Dithmarschen",
  GER: "Germany", PRU: "Prussia", HAN: "Hanover", BRG: "Berg",
  BAM: "Bamberg", PDB: "Paderborn", OSN: "Osnabruck", DNZ: "Danzig",
  RIG: "Riga", FRK: "Franconia", SFC: "Swiss Confederation", CHE: "Switzerland",
  ERF: "Erfurt",

  // Poland & Lithuania
  POL: "Poland", LIT: "Lithuania", MAZ: "Mazovia", KRA: "Krakow",
  PLC: "Commonwealth",

  // Balkans
  BYZ: "Byzantium", TUR: "Ottomans", HUN: "Hungary", SER: "Serbia",
  BOS: "Bosnia", BUL: "Bulgaria", WAL: "Wallachia", MOL: "Moldavia",
  CRO: "Croatia", ALB: "Albania", MON: "Montenegro", RAG: "Ragusa",
  ATH: "Athens", EPI: "Epirus", ACH: "Achaea", NAX: "Naxos",
  CYP: "Cyprus", GRE: "Greece", KNI: "Knights", RMN: "Romania",
  TRA: "Transylvania", DAL: "Dalmatia",

  // Russia & Eastern Europe
  MOS: "Muscovy", RUS: "Russia", NOV: "Novgorod", PSK: "Pskov",
  TVE: "Tver", RYA: "Ryazan", YAR: "Yaroslavl", RSO: "Rostov",
  SMO: "Smolensk", PRM: "Perm", KIE: "Kiev", NZH: "Nizhny Novgorod",
  BLO: "Beloozero", UKR: "Ruthenia", VYT: "Vyatka", VLR: "Vladimir",

  // Steppe & Central Asia
  GLH: "Golden Horde", CRI: "Crimea", KAZ: "Kazan", AST: "Astrakhan",
  NOG: "Nogai", SIB: "Sibir", CHG: "Chagatai", KZH: "Kazakh",
  KHI: "Khiva", BUK: "Bukhara", TRS: "Transoxiana", OIR: "Oirat",
  KHA: "Mongolia", KLM: "Kalmyk", KLK: "Khalkha", CHH: "Chahar",

  // Caucasus
  GEO: "Georgia", ARM: "Armenia", IME: "Imereti", SME: "Samtskhe",
  CIR: "Circassia", SRV: "Shirvan",

  // Anatolia & Levant
  RUM: "Rum", KAR: "Karamanids", CND: "Candarids", DUL: "Dulkadirids",
  AYD: "Aydin", GRM: "Germiyanids", MEN: "Mentese", RAM: "Ramazan",
  TRE: "Trebizond", SYR: "Syria", IRQ: "Iraq", HSN: "Hisn Kayfa",

  // Persia & Afghanistan
  PER: "Persia", TIM: "Timurids", QAR: "Qara Qoyunlu", AQQ: "Aq Qoyunlu",
  KHO: "Khorasan", AFG: "Afghanistan", ARL: "Ardabil", ORM: "Hormuz",
  LRI: "Luristan", SIS: "Sistan", FRS: "Fars", KRM: "Kerman",
  YZD: "Yazd", BSR: "Basra", BAL: "Baluchistan",

  // Arabia
  HED: "Hejaz", YEM: "Yemen", OMA: "Oman", ADE: "Aden",
  NAJ: "Najd", SHM: "Shammar", MDA: "Medina",

  // North Africa
  MAM: "Mamluks", MOR: "Morocco", TUN: "Tunis", TLE: "Tlemcen",
  FEZ: "Fez", ALG: "Algiers", TRP: "Tripoli", FZA: "Fezzan",
  EGY: "Egypt",

  // West Africa
  MAL: "Mali", SON: "Songhai", BNI: "Benin", OYO: "Oyo",
  KBO: "Kanem Bornu", KAN: "Kano", KTS: "Katsina", SOK: "Sokoto",
  JOL: "Jolof", ASH: "Ashanti", DAH: "Dahomey", DGB: "Dagbon",
  FUL: "Fulo", MSI: "Mossi", NUP: "Nupe", TMB: "Timbuktu",
  AIR: "Air", YAT: "Yatenga", ZZZ: "Zazzau", OUA: "Wagadou",

  // East Africa
  ETH: "Ethiopia", ADL: "Adal", AJU: "Ajuuraan", KIL: "Kilwa",
  SFA: "Sofala", MBA: "Mombasa", MLI: "Malindi", WAR: "Warsangali",
  ENN: "Ennarea", SOA: "Shewa", KAF: "Kaffa", ALO: "Alodia",
  DAR: "Darfur", HAR: "Harar", MED: "Medri Bahri",

  // Central & Southern Africa
  KON: "Kongo", ZIM: "Zimbabwe", NDO: "Ndongo", LOA: "Loango",
  LBA: "Luba", LND: "Lunda", CKO: "Chokwe", RWA: "Rwanda",
  BUG: "Buganda", NKO: "Nkore", BNY: "Bunyoro", MRA: "Maravi",

  // India — North
  DEL: "Delhi", MUG: "Mughals", JAU: "Jaunpur", MAW: "Malwa",
  GUJ: "Gujarat", MEW: "Mewar", MUL: "Multan", SND: "Sindh",
  PUN: "Punjab", KSH: "Kashmir", NPL: "Nepal", BHT: "Bhutan",
  GWA: "Gwalior", ODH: "Oudh", BND: "Bundelkhand", KGR: "Kangra",
  HIN: "Hindustan", LDK: "Ladakh",

  // India — South
  VIJ: "Vijayanagar", BAH: "Bahmanis", BEN: "Bengal", BIJ: "Bijapur",
  GOC: "Golkonda", DEC: "Deccan", MAR: "Marathas", MYS: "Mysore",
  AHM: "Ahmednagar", MAD: "Madurai", ORI: "Orissa", NAG: "Nagpur",
  BRR: "Berar", KHD: "Khandesh", JFN: "Jaffna", CEY: "Kotte",
  KND: "Kandy", ASS: "Assam",

  // Southeast Asia
  AYU: "Ayutthaya", SOI: "Siam", KHM: "Khmer", DAI: "Dai Viet",
  CHA: "Champa", LNA: "Lan Na", LXA: "Lan Xang", LUA: "Luang Prabang",
  SUK: "Sukhothai", PAT: "Pattani", PEG: "Pegu", TAU: "Taungu",
  MAJ: "Majapahit", ATJ: "Aceh", BLI: "Bali", BRU: "Brunei",
  MKS: "Makassar", MLC: "Malacca", PLB: "Palembang", PSA: "Pasai",
  TER: "Ternate", TID: "Tidore", KED: "Kedah", MSA: "Malaya",
  CEB: "Cebu",

  // China
  MNG: "Ming", WUU: "Wu", SHU: "Shu", YUE: "Yue", MIN: "Min",
  CDL: "Dali", QNG: "Qing",

  // Japan
  JAP: "Japan", ASK: "Ashikaga", SMZ: "Shimazu", ODA: "Oda",
  TKG: "Tokugawa", DTE: "Date", MRI: "Mori", UES: "Uesugi",
  HJO: "Hojo", TKD: "Takeda", HSK: "Hosokawa", OTM: "Otomo",
  IMG: "Imagawa", RYU: "Ryukyu",

  // Korea & Manchuria
  KOR: "Korea", MCH: "Manchu",

  // Mongolia & Tibet
  TIB: "Tibet",

  // Americas — Mesoamerica
  AZT: "Aztec", MAY: "Maya", ZAP: "Zapotec", TAR: "Tarascan",
  TLX: "Tlaxcala", ITZ: "Itza",

  // Americas — South America
  INC: "Inca", CHM: "Chimu", MPC: "Mapuche", MCA: "Muisca",

  // Americas — North America
  CHR: "Cherokee", CRE: "Creek", HUR: "Huron", IRO: "Iroquois",
  SHA: "Shawnee", ABE: "Abenaki", APA: "Apache", COM: "Comanche",
  SIO: "Sioux", PUE: "Pueblo", NAH: "Navajo", OJI: "Ojibwe",
  ONW: "Onondaga",

  // Colonial / Formables
  USA: "United States", MEX: "Mexico", BRZ: "Brazil", CAN: "Canada",
  CHL: "Chile", COL: "Colombia", HAT: "Haiti", PEU: "Peru",
  QUE: "Quebec", AUS: "Australia", TEX: "Texas",

  // Special / Endgame
  ROM: "Roman Empire", HRE: "Holy Roman Empire", MGE: "Mongol Empire",
  TMK: "Tamatave", IJO: "Ijaw", PLE: "Palestine",

  // Military Orders
  TEU: "Teutonic Order", LIV: "Livonian Order",
};
