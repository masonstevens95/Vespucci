import { describe, it, expect, vi } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { AppHeader } from "../AppHeader";

describe("AppHeader", () => {
  it("renders title", () => {
    const { container } = render(<AppHeader showTabs={false} activeTab="map" onTabChange={() => {}} />);
    expect(within(container).getByText("EU5 Map Maker")).toBeInTheDocument();
  });

  it("renders BMC link", () => {
    const { container } = render(<AppHeader showTabs={false} activeTab="map" onTabChange={() => {}} />);
    const bmc = container.querySelector(".bmc-link") as HTMLAnchorElement;
    expect(bmc).toBeInTheDocument();
    expect(bmc.href).toContain("buymeacoffee");
  });

  it("renders GitHub link", () => {
    const { container } = render(<AppHeader showTabs={false} activeTab="map" onTabChange={() => {}} />);
    const gh = container.querySelector(".github-link") as HTMLAnchorElement;
    expect(gh).toBeInTheDocument();
    expect(gh.href).toContain("github.com");
  });

  it("hides tabs when showTabs is false", () => {
    const { container } = render(<AppHeader showTabs={false} activeTab="map" onTabChange={() => {}} />);
    expect(container.querySelector(".app-tabs")).not.toBeInTheDocument();
  });

  it("shows tabs when showTabs is true", () => {
    const { container } = render(<AppHeader showTabs={true} activeTab="map" onTabChange={() => {}} />);
    expect(container.querySelector(".app-tabs")).toBeInTheDocument();
  });

  it("renders all 6 tab buttons", () => {
    const { container } = render(<AppHeader showTabs={true} activeTab="map" onTabChange={() => {}} />);
    const tabs = container.querySelectorAll(".app-tab");
    expect(tabs).toHaveLength(6);
  });

  it("marks active tab", () => {
    const { container } = render(<AppHeader showTabs={true} activeTab="rankings" onTabChange={() => {}} />);
    const active = container.querySelector(".app-tab.active");
    expect(active?.textContent).toBe("Rankings");
  });

  it("calls onTabChange when tab clicked", () => {
    const fn = vi.fn();
    const { container } = render(<AppHeader showTabs={true} activeTab="map" onTabChange={fn} />);
    const tabs = container.querySelectorAll(".app-tab");
    fireEvent.click(tabs[1]); // Rankings
    expect(fn).toHaveBeenCalledWith("rankings");
  });
});
