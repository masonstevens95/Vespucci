import { useState } from "react";
import type { ParsedSave, WarData, WarParticipantData, PastWarData, WarReparationData, AnnulledTreatyData, RoyalMarriageData, ActiveCBData } from "../lib/types";

interface Props {
  parsed: ParsedSave;
}

/** Format a casus belli string for display. */
const fmtCb = (cb: string): string =>
  cb !== ""
    ? cb.replace(/^cb_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Unknown";

/** Resolve a tag to its display name. */
const resolveName = (tag: string, names: Readonly<Record<string, string>>): string =>
  names[tag] ?? tag;

/** Get attackers from participants. */
const attackers = (war: WarData): readonly WarParticipantData[] =>
  war.participants.filter(p => p.side === "attacker");

/** Get defenders from participants. */
const defenders = (war: WarData): readonly WarParticipantData[] =>
  war.participants.filter(p => p.side === "defender");

/** Describe war momentum from direction value. */
const momentumLabel = (dir: number): string =>
  dir <= -10 ? "Losing badly"
    : dir < -2 ? "Losing"
    : dir < 2 ? "Stalemate"
    : dir < 10 ? "Winning"
    : "Winning decisively";

/** War type label. */
const warTypeLabel = (war: WarData): string =>
  war.isCivilWar ? "Civil War"
    : war.isRevolt ? "Revolt"
    : "";

/** Number of past wars to show initially. */
const PAST_WARS_INITIAL = 50;

/** Check if a war involves a player country. */
const warInvolvesPlayer = (war: WarData, playerTags: ReadonlySet<string>): boolean =>
  war.participants.some(p => playerTags.has(p.tag));

/** Check if a past war involves a player country. */
const pastWarInvolvesPlayer = (pw: PastWarData, playerTags: ReadonlySet<string>): boolean =>
  playerTags.has(pw.countryATag) || playerTags.has(pw.countryBTag);

export const WarsTab = ({ parsed }: Props) => {
  const { wars, pastWars, countryNames, tagToPlayers } = parsed;
  const [selectedWar, setSelectedWar] = useState<WarData | undefined>(undefined);
  const [selectedPastWar, setSelectedPastWar] = useState<PastWarData | undefined>(undefined);
  const [showAllPast, setShowAllPast] = useState(false);
  const [playersOnly, setPlayersOnly] = useState(false);

  const playerTags = new Set(Object.keys(tagToPlayers));

  const active = wars.filter(w => !w.isEnded && (!playersOnly || warInvolvesPlayer(w, playerTags)));
  const ended = wars.filter(w => w.isEnded && (!playersOnly || warInvolvesPlayer(w, playerTags)));
  const filteredPast = playersOnly ? pastWars.filter(pw => pastWarInvolvesPlayer(pw, playerTags)) : pastWars;
  const visiblePast = showAllPast ? filteredPast : filteredPast.slice(0, PAST_WARS_INITIAL);

  return (
    <div className="rankings-tab">
      <div className="rankings-controls">
        <label className="option">
          <input type="checkbox" checked={playersOnly} onChange={(e) => setPlayersOnly(e.target.checked)} />
          Player wars only
        </label>
      </div>
      {wars.length === 0 && pastWars.length === 0 ? (
        <div className="tab-placeholder">
          <h2>No Wars</h2>
          <p>There are no wars in this save.</p>
        </div>
      ) : (
        <div className="wars-grid">
          {active.length > 0 ? (
            <span className="war-section-label">Active Wars ({active.length})</span>
          ) : (<></>)}
          {active.map((war, i) => (
            <WarCard key={`a${i}`} war={war} countryNames={countryNames} onClick={() => setSelectedWar(war)} />
          ))}
          {ended.length > 0 ? (
            <span className="war-section-label war-section-ended">Recently Ended ({ended.length})</span>
          ) : (<></>)}
          {ended.map((war, i) => (
            <WarCard key={`e${i}`} war={war} countryNames={countryNames} onClick={() => setSelectedWar(war)} />
          ))}
          {filteredPast.length > 0 ? (
            <>
              <span className="war-section-label war-section-ended">War History ({filteredPast.length})</span>
              {visiblePast.map((pw, i) => (
                <PastWarCard key={`pw${i}`} pw={pw} countryNames={countryNames} onClick={() => setSelectedPastWar(pw)} />
              ))}
              {!showAllPast && filteredPast.length > PAST_WARS_INITIAL ? (
                <button className="war-show-more" onClick={() => setShowAllPast(true)}>
                  Show all {filteredPast.length} past wars
                </button>
              ) : (<></>)}
            </>
          ) : (<></>)}
        </div>
      )}

      {selectedWar !== undefined ? (
        <WarModal war={selectedWar} countryNames={countryNames} onClose={() => setSelectedWar(undefined)} />
      ) : (<></>)}
      {selectedPastWar !== undefined ? (
        <PastWarModal pw={selectedPastWar} countryNames={countryNames} tagToPlayers={tagToPlayers}
          reparations={parsed.warReparations} annulledTreaties={parsed.annulledTreaties}
          royalMarriages={parsed.royalMarriages} activeCBs={parsed.activeCBs}
          onClose={() => setSelectedPastWar(undefined)} />
      ) : (<></>)}
    </div>
  );
};

const WarCard = ({ war, countryNames, onClick }: { war: WarData; countryNames: Readonly<Record<string, string>>; onClick: () => void }) => {
  const att = attackers(war);
  const def = defenders(war);
  const attackerName = resolveName(war.attackerTag, countryNames);
  const defenderName = resolveName(war.defenderTag, countryNames);
  const wType = warTypeLabel(war);

  return (
    <div className={`war-card${war.isEnded ? " war-card-ended" : ""}`} onClick={onClick}>
      <div className="war-header">
        <span className="war-title">{attackerName} vs {defenderName}</span>
        <span className="war-cb">
          {fmtCb(war.casusBelli)}
          {wType !== "" ? ` (${wType})` : ""}
        </span>
      </div>
      <div className="war-sides">
        <div className="war-side war-side-attacker">
          <span className="war-side-label">Attackers ({att.length})</span>
          <span className="war-side-score">Score: {war.attackerScore}</span>
        </div>
        <div className="war-side war-side-defender">
          <span className="war-side-label">Defenders ({def.length})</span>
          <span className="war-side-score">Score: {war.defenderScore}</span>
        </div>
      </div>
      <div className="war-footer">
        {war.battles.length > 0 ? (
          <span>{war.battles.length} battle{war.battles.length !== 1 ? "s" : ""}</span>
        ) : (<></>)}
        {!war.isEnded && war.warDirectionQuarter !== 0 ? (
          <span className={`war-momentum${war.warDirectionQuarter > 0 ? " war-momentum-att" : " war-momentum-def"}`}>
            {war.warDirectionQuarter > 0 ? "Attacker" : "Defender"}: {momentumLabel(war.warDirectionQuarter)}
          </span>
        ) : (<></>)}
      </div>
    </div>
  );
};

const WarModal = ({ war, countryNames, onClose }: { war: WarData; countryNames: Readonly<Record<string, string>>; onClose: () => void }) => {
  const att = attackers(war);
  const def = defenders(war);
  const attackerName = resolveName(war.attackerTag, countryNames);
  const defenderName = resolveName(war.defenderTag, countryNames);

  const totalAttLosses = war.battles.reduce((sum, b) => sum + b.attackerLosses, 0);
  const totalDefLosses = war.battles.reduce((sum, b) => sum + b.defenderLosses, 0);
  const attWins = war.battles.filter(b => b.attackerWon).length;
  const defWins = war.battles.length - attWins;
  const wType = warTypeLabel(war);
  const occupiedCount = war.occupiedLocations.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ borderColor: "#c44", maxWidth: "700px" }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>x</button>

        <div className="modal-header" style={{ borderBottomColor: "#c44" }}>
          <div className="modal-titles">
            <h2 className="modal-name">{attackerName} vs {defenderName}</h2>
            <span className="modal-tag">
              {fmtCb(war.casusBelli)}
              {wType !== "" ? ` · ${wType}` : ""}
              {war.isEnded ? " · Ended" : ""}
            </span>
          </div>
        </div>

        <div className="modal-body">
          {/* Scores & Stats */}
          <div className="modal-rows">
            <div className="modal-row">
              <span className="modal-row-label">Attacker Score</span>
              <span className="modal-row-value">{war.attackerScore}</span>
            </div>
            <div className="modal-row">
              <span className="modal-row-label">Defender Score</span>
              <span className="modal-row-value">{war.defenderScore}</span>
            </div>
            {!war.isEnded && war.warDirectionQuarter !== 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-row">
                  <span className="modal-row-label">Quarterly Momentum</span>
                  <span className={`modal-row-value${war.warDirectionQuarter > 0 ? " trade-surplus-pos" : war.warDirectionQuarter < 0 ? " trade-surplus-neg" : ""}`}>
                    {war.warDirectionQuarter > 0 ? "+" : ""}{war.warDirectionQuarter} ({momentumLabel(war.warDirectionQuarter)})
                  </span>
                </div>
                {war.warDirectionYear !== 0 ? (
                  <div className="modal-row">
                    <span className="modal-row-label">Yearly Momentum</span>
                    <span className={`modal-row-value${war.warDirectionYear > 0 ? " trade-surplus-pos" : war.warDirectionYear < 0 ? " trade-surplus-neg" : ""}`}>
                      {war.warDirectionYear > 0 ? "+" : ""}{war.warDirectionYear}
                    </span>
                  </div>
                ) : (<></>)}
              </>
            ) : (<></>)}
            {war.stalledYears > 0 ? (
              <div className="modal-row">
                <span className="modal-row-label">Stalled</span>
                <span className="modal-row-value">{war.stalledYears} year{war.stalledYears !== 1 ? "s" : ""}</span>
              </div>
            ) : (<></>)}
            {occupiedCount > 0 ? (
              <div className="modal-row">
                <span className="modal-row-label">Occupied Provinces</span>
                <span className="modal-row-value">{occupiedCount} province{occupiedCount !== 1 ? "s" : ""} occupied</span>
              </div>
            ) : (<></>)}
            {war.battles.length > 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-row">
                  <span className="modal-row-label">Battles</span>
                  <span className="modal-row-value">{attWins}W / {defWins}L ({war.battles.length} total)</span>
                </div>
                <div className="modal-row">
                  <span className="modal-row-label">Attacker Losses</span>
                  <span className="modal-row-value">{totalAttLosses.toFixed(0)}</span>
                </div>
                <div className="modal-row">
                  <span className="modal-row-label">Defender Losses</span>
                  <span className="modal-row-value">{totalDefLosses.toFixed(0)}</span>
                </div>
              </>
            ) : (<></>)}
          </div>

          <div className="modal-divider" />

          {/* Participants */}
          <div className="war-modal-sides">
            <div className="war-modal-side">
              <span className="war-side-label" style={{ color: "#c44" }}>Attackers ({att.length})</span>
              <div className="war-modal-members">
                {att.map(p => (
                  <div key={p.tag} className="war-modal-member">
                    <span className="war-modal-member-name">{resolveName(p.tag, countryNames)}</span>
                    {p.reason !== "" ? (
                      <span className="war-modal-member-reason">{p.reason}</span>
                    ) : (<></>)}
                  </div>
                ))}
              </div>
            </div>
            <div className="war-modal-side">
              <span className="war-side-label" style={{ color: "#48a" }}>Defenders ({def.length})</span>
              <div className="war-modal-members">
                {def.map(p => (
                  <div key={p.tag} className="war-modal-member">
                    <span className="war-modal-member-name">{resolveName(p.tag, countryNames)}</span>
                    {p.reason !== "" ? (
                      <span className="war-modal-member-reason">{p.reason}</span>
                    ) : (<></>)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Battles */}
          {war.battles.length > 0 ? (
            <>
              <div className="modal-divider" />
              <div className="war-battles">
                <span className="war-side-label" style={{ color: "#aaa" }}>Battle History</span>
                {war.battles.map((b, i) => {
                  const attName = b.attackerCountryTag !== "" ? resolveName(b.attackerCountryTag, countryNames) : "Attacker";
                  const defName = b.defenderCountryTag !== "" ? resolveName(b.defenderCountryTag, countryNames) : "Defender";
                  const totalPrisoners = b.attackerPrisoners + b.defenderPrisoners;
                  return (
                    <div key={i} className={`war-battle ${b.attackerWon ? "war-battle-att-win" : "war-battle-def-win"}`}>
                      <div className="war-battle-header">
                        <span className="war-battle-result">{b.attackerWon ? `${attName} won` : `${defName} won`}</span>
                        {b.battleWarScore > 0 ? <span className="war-battle-score">+{b.battleWarScore.toFixed(1)} WS</span> : <></>}
                      </div>
                      <div className="war-battle-detail">
                        <span>{attName}: {b.attackerTotal.toFixed(0)} troops, {b.attackerLosses.toFixed(0)} lost</span>
                        <span>{defName}: {b.defenderTotal.toFixed(0)} troops, {b.defenderLosses.toFixed(0)} lost</span>
                        {totalPrisoners > 0 ? (
                          <span className="modal-muted">Prisoners: {totalPrisoners.toFixed(0)}</span>
                        ) : (<></>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (<></>)}
        </div>
      </div>
    </div>
  );
};

const PastWarCard = ({ pw, countryNames, onClick }: { pw: PastWarData; countryNames: Readonly<Record<string, string>>; onClick: () => void }) => {
  const nameA = resolveName(pw.countryATag, countryNames);
  const nameB = resolveName(pw.countryBTag, countryNames);

  return (
    <div className="war-card war-card-ended war-card-past" onClick={onClick}>
      <div className="war-header">
        <span className="war-title">{nameA} vs {nameB}</span>
        <span className="war-cb">War Score: {pw.warScore}</span>
      </div>
    </div>
  );
};

const PastWarModal = ({ pw, countryNames, tagToPlayers, reparations, annulledTreaties, royalMarriages, activeCBs, onClose }: {
  pw: PastWarData;
  countryNames: Readonly<Record<string, string>>;
  tagToPlayers: Readonly<Record<string, string[]>>;
  reparations: readonly WarReparationData[];
  annulledTreaties: readonly AnnulledTreatyData[];
  royalMarriages: readonly RoyalMarriageData[];
  activeCBs: readonly ActiveCBData[];
  onClose: () => void;
}) => {
  const nameA = resolveName(pw.countryATag, countryNames);
  const nameB = resolveName(pw.countryBTag, countryNames);
  const playersA = tagToPlayers[pw.countryATag] ?? [];
  const playersB = tagToPlayers[pw.countryBTag] ?? [];

  // Find reparations between these two countries
  const relatedReps = reparations.filter(r =>
    (r.winnerTag === pw.countryATag && r.loserTag === pw.countryBTag) ||
    (r.winnerTag === pw.countryBTag && r.loserTag === pw.countryATag)
  );

  // Find annulled treaties between these two countries
  const relatedAnnul = annulledTreaties.filter(a =>
    (a.enforcerTag === pw.countryATag && a.targetTag === pw.countryBTag) ||
    (a.enforcerTag === pw.countryBTag && a.targetTag === pw.countryATag)
  );

  // Find royal marriages between these two countries
  const relatedMarriages = royalMarriages.filter(rm =>
    (rm.countryATag === pw.countryATag && rm.countryBTag === pw.countryBTag) ||
    (rm.countryATag === pw.countryBTag && rm.countryBTag === pw.countryATag)
  );

  // Find active CBs between these two countries
  const relatedCBs = activeCBs.filter(cb =>
    (cb.holderTag === pw.countryATag && cb.targetTag === pw.countryBTag) ||
    (cb.holderTag === pw.countryBTag && cb.targetTag === pw.countryATag)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ borderColor: "#555", maxWidth: "550px" }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>x</button>
        <div className="modal-header" style={{ borderBottomColor: "#555" }}>
          <div className="modal-titles">
            <h2 className="modal-name">{nameA} vs {nameB}</h2>
            <span className="modal-tag">Past Conflict</span>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-rows">
            <div className="modal-row">
              <span className="modal-row-label">{nameA}</span>
              <span className={`modal-row-value${playersA.length === 0 ? " modal-muted" : ""}`}>
                {playersA.length > 0 ? playersA.join(", ") : "AI"}
              </span>
            </div>
            <div className="modal-row">
              <span className="modal-row-label">{nameB}</span>
              <span className={`modal-row-value${playersB.length === 0 ? " modal-muted" : ""}`}>
                {playersB.length > 0 ? playersB.join(", ") : "AI"}
              </span>
            </div>
            <div className="modal-row-divider" />
            <div className="modal-row">
              <span className="modal-row-label">War Score</span>
              <span className="modal-row-value">{pw.warScore}</span>
            </div>

            {relatedReps.length > 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-section-label">War Reparations</div>
                {relatedReps.map((rep, i) => (
                  <div key={`rep${i}`} className="modal-row">
                    <span className="modal-row-label">
                      {resolveName(rep.loserTag, countryNames)} pays {resolveName(rep.winnerTag, countryNames)}
                    </span>
                    <span className="modal-row-value modal-muted">Active</span>
                  </div>
                ))}
              </>
            ) : (<></>)}

            {relatedAnnul.length > 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-section-label">Annulled Treaties</div>
                {relatedAnnul.map((ann, i) => (
                  <div key={`ann${i}`} className="modal-row">
                    <span className="modal-row-label">
                      {resolveName(ann.enforcerTag, countryNames)} forced {resolveName(ann.targetTag, countryNames)}
                    </span>
                    <span className="modal-row-value modal-muted">Active</span>
                  </div>
                ))}
              </>
            ) : (<></>)}

            {relatedMarriages.length > 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-section-label">Royal Marriages</div>
                {relatedMarriages.map((rm, i) => (
                  <div key={`rm${i}`} className="modal-row">
                    <span className="modal-row-label">
                      {resolveName(rm.countryATag, countryNames)} and {resolveName(rm.countryBTag, countryNames)}
                    </span>
                    <span className="modal-row-value modal-muted">Active</span>
                  </div>
                ))}
              </>
            ) : (<></>)}

            {relatedCBs.length > 0 ? (
              <>
                <div className="modal-row-divider" />
                <div className="modal-section-label">Active Casus Belli</div>
                {relatedCBs.map((cb, i) => (
                  <div key={`cb${i}`} className="modal-row">
                    <span className="modal-row-label">
                      {resolveName(cb.holderTag, countryNames)} vs {resolveName(cb.targetTag, countryNames)}
                    </span>
                    <span className="modal-row-value modal-muted">Active</span>
                  </div>
                ))}
              </>
            ) : (<></>)}
          </div>
        </div>
      </div>
    </div>
  );
};
