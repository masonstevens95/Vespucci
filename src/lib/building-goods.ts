/**
 * Mapping from building type (unknown_0xe1 field in building_manager)
 * to the trade good it produces.
 *
 * Only productive buildings are listed — buildings with no good output
 * (castles, temples, libraries, marketplaces, etc.) are absent.
 * Derived empirically from save diagnostics + EU5 game knowledge.
 */
export const BUILDING_TO_GOOD: Readonly<Record<string, string>> = {
  // Stone / minerals
  mason:               "masonry",
  clay_pit:            "clay",
  sand_pit:            "sand",
  stone_quarry:        "stone",
  bog_iron_smelter:    "iron",
  local_smelters:      "iron",
  schwaz_mine:         "silver",
  mercury_patio:       "silver",

  // Wood / forest products
  lumber_mill:         "lumber",
  sawmill:             "lumber",
  forest_village:      "lumber",
  charcoal_maker:      "coal",
  tar_kiln:            "tar",

  // Agriculture / animal husbandry
  fiber_crops_farm:    "fiber_crops",
  fruit_orchard:       "fruit",
  sheep_farms:         "wool",
  horse_breeders:      "horses",
  fishing_village:     "fish",
  farming_village:     "livestock",

  // Naval
  shipyard:            "naval_supplies",
  dry_dock:            "naval_supplies",
  wharf:               "naval_supplies",
  north_sea_shipyards: "naval_supplies",

  // Leather
  tannery:             "leather",
  tanning_workshop:    "leather",

  // Ceramics / glass
  pottery_guild:       "pottery",
  pottery_workshop:    "pottery",
  glass_guild:         "glass",
  glass_workshop:      "glass",
  porcelain_guild:     "porcelain",
  lacquerware_guild:   "lacquerware",

  // Beverages
  brewery:             "beer",
  beer_workshop:       "beer",
  winery:              "wine",
  distillers_guild:    "liquor",
  distillers_workshop: "liquor",

  // Textiles
  cloth_guild:         "cloth",
  cloth_workshop:      "cloth",
  fine_cloth_guild:    "fine_cloth",
  fine_cloth_workshop: "fine_cloth",
  rural_clothmaker:    "cloth",

  // Paper / books
  paper_workshop:      "paper",
  paper_guild:         "paper",
  scriptorium:         "books",
  printing_press_shop: "books",

  // Furniture / jewelry
  furniture_guild:     "furniture",
  furniture_workshop:  "furniture",
  jewelry_guild:       "jewelry",

  // Metalwork / weapons
  tools_guild:         "tools",
  tools_workshop:      "tools",
  weapon_workshop:     "weaponry",
  weapon_guild:        "weaponry",
  gun_smith:           "firearms",
  guns_workshop:       "firearms",
  hand_cannon_guild:   "firearms",
  cannon_maker:        "cannons",
  cannon_workshop:     "cannons",

  // Chemicals / dyes
  dyes_guild:          "dyes",
  dyes_workshop:       "dyes",
  saltpeter_guild:     "saltpeter",
  saltpeter_workshop:  "saltpeter",
  apothecary:          "medicaments",

  // Naval / salt
  naval_supplies_guild:    "naval_supplies",
  naval_supplies_workshop: "naval_supplies",
  salt_collector:          "salt",

  // Plantations
  tobacco_plantation: "tobacco",
  cotton_plantation:  "cotton",
  sugar_plantation:   "sugar",

  // Exotic / special
  elephant_hunting_grounds: "elephants",
  slave_market:             "slaves_goods",
  slave_center:             "slaves_goods",
};
