import { useState } from "react";
import type { ParsedSave } from "../lib/types";
import { buildMilitaryEntries, sortMilitary, totalRegulars, totalLevies } from "../lib/military-sort";
import type { MilitarySortMode } from "../lib/military-sort";
import { filterPlayersOnly } from "../lib/ranking-sort";
import { fmtNum } from "../lib/format";

interface Props {
  parsed: ParsedSave;
  onCountryClick: (tag: string) => void;
}

export const MilitaryTab = ({ parsed, onCountryClick }: Props) => {
  const [sortMode, setSortMode] = useState<MilitarySortMode>("armyFrontage");
  const [playersOnly, setPlayersOnly] = useState(false);

  const allEntries = buildMilitaryEntries(
    parsed.countryStats,
    parsed.countryNames,
    parsed.tagToPlayers,
    parsed.countryColors,
  );
  const filtered = filterPlayersOnly(allEntries, playersOnly);
  const sorted = sortMilitary(filtered, sortMode);

  return (
    <div className="rankings-tab">
      <div className="rankings-controls">
        <label className="option">
          Sort:
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as MilitarySortMode)}
            className="style-select"
          >
            <option value="armyFrontage">Army Frontage</option>
            <option value="regulars">Regular Strength</option>
            <option value="infantry">Infantry</option>
            <option value="cavalry">Cavalry</option>
            <option value="artillery">Artillery</option>
            <option value="levies">Levy Strength</option>
            <option value="navyFrontage">Navy Frontage</option>
            <option value="totalNavy">Total Ships</option>
            <option value="heavyShips">Heavy Ships</option>
            <option value="manpower">Max Manpower</option>
            <option value="country">Country Name</option>
          </select>
        </label>
        <label className="option">
          <input
            type="checkbox"
            checked={playersOnly}
            onChange={(e) => setPlayersOnly(e.target.checked)}
          />
          Players only
        </label>
      </div>
      <div className="rankings-grid">
        {sorted.map((entry, i) => {
          const regs = totalRegulars(entry.stats);
          const levies = totalLevies(entry.stats);
          return (
            <div
              key={entry.tag}
              className={
                `ranking-row` +
                `${entry.players.length > 0 ? " ranking-player" : ""}`
              }
              style={{ borderLeftColor: entry.color }}
              onClick={() => onCountryClick(entry.tag)}
            >
              <span className="ranking-pos">{i + 1}</span>
              <div className="ranking-info">
                <span className="ranking-name">{entry.name}</span>
                {entry.players.length > 0 ? (
                  <span className="ranking-player-name">{entry.players.join(", ")}</span>
                ) : (
                  <span className="ranking-ai">AI</span>
                )}
              </div>
              <div className="ranking-stats">
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtNum(entry.stats.armyFrontage)}</span>
                  <span className="ranking-stat-lbl">Army</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtNum(regs)}</span>
                  <span className="ranking-stat-lbl">Regulars</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtNum(levies)}</span>
                  <span className="ranking-stat-lbl">Levies</span>
                </div>
                <div className="ranking-stat">
                  <span className="ranking-stat-val">{fmtNum(entry.stats.navyFrontage)}</span>
                  <span className="ranking-stat-lbl">Navy</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
