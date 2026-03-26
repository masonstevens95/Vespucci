import type { MapStyle } from "../lib/types";

interface OptionsBarProps {
  playersOnly: boolean;
  onPlayersOnlyChange: (value: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  mapStyle: MapStyle;
  onMapStyleChange: (value: MapStyle) => void;
  disabled: boolean;
}

export function OptionsBar({
  playersOnly,
  onPlayersOnlyChange,
  title,
  onTitleChange,
  mapStyle,
  onMapStyleChange,
  disabled,
}: OptionsBarProps) {
  return (
    <div className="options-bar">
      <label className="option">
        <input
          type="checkbox"
          checked={playersOnly}
          onChange={(e) => onPlayersOnlyChange(e.target.checked)}
          disabled={disabled}
        />
        Players only
      </label>
      <label className="option">
        Title:
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          className="title-input"
        />
      </label>
      <label className="option">
        Style:
        <select
          value={mapStyle}
          onChange={(e) => onMapStyleChange(e.target.value as MapStyle)}
          disabled={disabled}
          className="style-select"
        >
          <option value="parchment">Parchment</option>
          <option value="modern">Modern</option>
        </select>
      </label>
    </div>
  );
}
