# Trade View — Improvement Ideas

## Priority

### 1. Market Owner / Country Mapping
Tie markets back to countries via `centerLocation` matching against `countryLocations`. Show which country hosts the market center and which countries participate. Would give geographic context to the market data.

### 2. Search / Filter
Text filter on goods or market names. With 30+ goods and many markets, finding a specific one is tedious. A simple input field above the list that filters as you type.

### 3. Trade Balance
Total supply vs total demand across all goods in a market. Markets with more demand than supply are net importers. Show a simple "Net Importer / Exporter" label and the magnitude on the market card.

## Backlog

- **Top good** — show the most-produced good on the market card so you can see specialization at a glance
- **Food per capita** — `food / population` ratio; markets with low ratios are under pressure
- **Capacity utilization bar** — visual bar on market cards using the pop/capacity % already computed
- **Good scarcity highlights** — color-code goods in the modal table with very low stockpile relative to demand
- **Cross-market comparison** — visual (bar chart or sparkline) showing price differences for a good across markets
