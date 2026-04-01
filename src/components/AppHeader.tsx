import type { AppTab } from "../App";

const TABS: readonly AppTab[] = ["map", "rankings", "economy", "trade", "military", "wars"];

interface Props {
  showTabs: boolean;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const AppHeader = ({ showTabs, activeTab, onTabChange }: Props) => (
  <header className="app-header">
    <div className="header-row">
      <h1>EU5 Map Maker</h1>
      <div className="header-links">
        <a
          href="https://www.buymeacoffee.com/masoncstevg"
          target="_blank"
          rel="noopener noreferrer"
          className="bmc-link"
        >
          <img
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            alt="Buy Me A Coffee"
            className="bmc-img"
          />
        </a>
        <a
          href="https://github.com/masonstevens95/eu5-map-maker"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
      </div>
    </div>
    {showTabs ? (
      <nav className="app-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`app-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    ) : (
      <></>
    )}
  </header>
);
