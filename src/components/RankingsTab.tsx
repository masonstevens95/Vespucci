import { useState } from "react";
import type { ParsedSave } from "../lib/types";
import { buildRankingEntries, sortRankings, filterPlayersOnly, isGreatPower, findTiedScores } from "../lib/ranking-sort";
import type { RankingSortMode } from "../lib/ranking-sort";
import { fmtNum } from "../lib/format";

interface Props {
  parsed: ParsedSave;
  onCountryClick: (tag: string) => void;
}

export const RankingsTab = ({ parsed, onCountryClick }: Props) => {
  const [sortMode, setSortMode] = useState<RankingSortMode>("rank");
  const [playersOnly, setPlayersOnly] = useState(false);
  const [highlightGP, setHighlightGP] = useState(true);

  const allEntries = buildRankingEntries(
    parsed.countryStats,
    parsed.countryNames,
    parsed.tagToPlayers,
    parsed.countryColors,
  );
  const filtered = filterPlayersOnly(allEntries, playersOnly);
  const sorted = sortRankings(filtered, sortMode);
  const tiedScores = findTiedScores(allEntries);

  return (
    <div className="rankings-tab">
      <div className="rankings-controls">
        <label className="option">
          Sort:
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as RankingSortMode)}
            className="style-select"
          >
            <option value="rank">Rank</option>
            <option value="country">Country Name</option>
            <option value="player">Player Name</option>
            <option value="population">Population</option>
            <option value="income">Income</option>
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
        <label className="option">
          <input
            type="checkbox"
            checked={highlightGP}
            onChange={(e) => setHighlightGP(e.target.checked)}
          />
          Highlight Great Powers
        </label>
      </div>
      <div className="rankings-grid">
        {sorted.map((entry, i) => (
          <div
            key={entry.tag}
            className={
              `ranking-row` +
              `${entry.players.length > 0 ? " ranking-player" : ""}` +
              `${highlightGP && isGreatPower(entry.stats.score) ? " ranking-gp" : ""}`
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
                <span className="ranking-stat-val">
                  {entry.stats.score > 0
                    ? `#${entry.stats.score}${tiedScores.has(entry.stats.score) ? " (tied)" : ""}`
                    : "—"}
                </span>
                <span className="ranking-stat-lbl">Rank</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtNum(entry.stats.population)}</span>
                <span className="ranking-stat-lbl">Pop</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtNum(entry.stats.monthlyIncome)}</span>
                <span className="ranking-stat-lbl">Income</span>
              </div>
              <div className="ranking-stat">
                <span className="ranking-stat-val">{fmtNum(entry.stats.maxManpower)}</span>
                <span className="ranking-stat-lbl">Manpower</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
