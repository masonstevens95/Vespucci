interface OptionsBarProps {
  playersOnly: boolean;
  onPlayersOnlyChange: (value: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  disabled: boolean;
}

export function OptionsBar({
  playersOnly,
  onPlayersOnlyChange,
  title,
  onTitleChange,
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
    </div>
  );
}
