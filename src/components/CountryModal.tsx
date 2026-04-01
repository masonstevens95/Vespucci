import { useState } from "react";
import type { CountryInfo } from "../lib/country-info";
import { resolveDisplayName } from "../lib/country-info";
import { fmtNum, fmtLanguage, fmtGovType } from "../lib/format";
import { isGreatPower } from "../lib/ranking-sort";

interface Props {
  info: CountryInfo;
  countryNames: Readonly<Record<string, string>>;
  onClose: () => void;
}

export const CountryModal = ({ info, countryNames, onClose }: Props) => {
  const { stats } = info;
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ borderColor: info.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>x</button>

        <div className="modal-header" style={{ borderBottomColor: info.color }}>
          <span className="modal-swatch" style={{ backgroundColor: info.color }} />
          <div className="modal-titles">
            <h2 className="modal-name">{info.displayName}</h2>
            <span className="modal-tag">{info.tag}</span>
          </div>
        </div>

        <div className="modal-body">
          {/* Identity */}
          {info.players.length > 0 ? (
            <div className="modal-field">
              <span className="modal-label">Player{info.players.length > 1 ? "s" : ""}</span>
              <span className="modal-value">{info.players.join(", ")}</span>
            </div>
          ) : (
            <div className="modal-field">
              <span className="modal-label">Player</span>
              <span className="modal-value modal-muted">AI</span>
            </div>
          )}

          {stats.govType !== "" ? (
            <div className="modal-field">
              <span className="modal-label">Government</span>
              <span className="modal-value">{fmtGovType(stats.govType)}</span>
            </div>
          ) : (<></>)}

          {stats.courtLanguage !== "" ? (
            <div className="modal-field">
              <span className="modal-label">Language</span>
              <span className="modal-value">{fmtLanguage(stats.courtLanguage)}</span>
            </div>
          ) : (<></>)}

          {stats.score > 0 ? (
            <div className="modal-field">
              <span className="modal-label">Rank</span>
              <span className="modal-value">
                #{stats.score}{isGreatPower(stats.score) ? " (Great Power)" : ""}
              </span>
            </div>
          ) : (<></>)}

          {/* Diplomacy */}
          {info.overlord !== "" ? (
            <div className="modal-field">
              <span className="modal-label">Overlord</span>
              <span className="modal-value">{resolveDisplayName(info.overlord, countryNames)} ({info.overlord})</span>
            </div>
          ) : (<></>)}

          {info.subjects.length > 0 ? (
            <div className="modal-field">
              <span
                className="modal-label modal-collapsible"
                onClick={() => setSubjectsOpen(!subjectsOpen)}
              >
                {subjectsOpen ? "▾" : "▸"} Subjects ({info.subjects.length})
              </span>
              {subjectsOpen ? (
                <div className="modal-subject-list">
                  {info.subjects.map((sub) => (
                    <span key={sub} className="modal-subject-tag">
                      {resolveDisplayName(sub, countryNames)} ({sub})
                    </span>
                  ))}
                </div>
              ) : (<></>)}
            </div>
          ) : (<></>)}

          {/* Divider */}
          <div className="modal-divider" />

          {/* Economy */}
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.gold)}</span>
              <span className="modal-stat-label">Treasury</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.monthlyIncome)}</span>
              <span className="modal-stat-label">Monthly Income</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.monthlyTradeValue)}</span>
              <span className="modal-stat-label">Trade Value</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.population)}</span>
              <span className="modal-stat-label">Population</span>
            </div>
          </div>

          {/* Military — Army */}
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.armyFrontage)}</span>
              <span className="modal-stat-label">Army Frontage</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{stats.infantry}/{stats.cavalry}/{stats.artillery}</span>
              <span className="modal-stat-label">Inf/Cav/Art</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.levyInfantry + stats.levyCavalry)}</span>
              <span className="modal-stat-label">Levies</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.maxManpower)}</span>
              <span className="modal-stat-label">Manpower</span>
            </div>
          </div>

          {/* Military — Navy */}
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.navyFrontage)}</span>
              <span className="modal-stat-label">Navy Frontage</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{stats.heavyShips}/{stats.lightShips}/{stats.galleys}</span>
              <span className="modal-stat-label">Heavy/Light/Galley</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.transports)}</span>
              <span className="modal-stat-label">Transports</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{fmtNum(stats.maxSailors)}</span>
              <span className="modal-stat-label">Sailors</span>
            </div>
          </div>

          <div className="modal-field">
            <span className="modal-label">Provinces</span>
            <span className="modal-value">{info.provinceCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
