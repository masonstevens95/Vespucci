import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { OptionsBar } from "../OptionsBar";

function renderBar(overrides = {}) {
  const props = {
    playersOnly: true,
    onPlayersOnlyChange: vi.fn(),
    title: "EU5 Map",
    onTitleChange: vi.fn(),
    mapStyle: "parchment" as const,
    onMapStyleChange: vi.fn(),
    disabled: false,
    ...overrides,
  };
  const { container } = render(<OptionsBar {...props} />);
  const root = container.querySelector(".options-bar")!;
  return { root, view: within(root as HTMLElement), props };
}

describe("OptionsBar", () => {
  it("renders checkbox checked when playersOnly=true", () => {
    const { view } = renderBar({ playersOnly: true });
    expect(view.getByRole("checkbox")).toBeChecked();
  });

  it("renders checkbox unchecked when playersOnly=false", () => {
    const { view } = renderBar({ playersOnly: false });
    expect(view.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls onPlayersOnlyChange when checkbox clicked", async () => {
    const fn = vi.fn();
    const { view } = renderBar({ playersOnly: true, onPlayersOnlyChange: fn });
    await userEvent.click(view.getByRole("checkbox"));
    expect(fn).toHaveBeenCalledWith(false);
  });

  it("renders title input with value", () => {
    const { view } = renderBar({ title: "My Map" });
    expect(view.getByDisplayValue("My Map")).toBeInTheDocument();
  });

  it("calls onTitleChange when title edited", async () => {
    const fn = vi.fn();
    const { view } = renderBar({ title: "", onTitleChange: fn });
    await userEvent.type(view.getByRole("textbox"), "X");
    expect(fn).toHaveBeenCalledWith("X");
  });

  it("disables inputs when disabled=true", () => {
    const { view } = renderBar({ disabled: true });
    expect(view.getByRole("checkbox")).toBeDisabled();
    expect(view.getByRole("textbox")).toBeDisabled();
    expect(view.getByRole("combobox")).toBeDisabled();
  });

  it("enables inputs when disabled=false", () => {
    const { view } = renderBar({ disabled: false });
    expect(view.getByRole("checkbox")).not.toBeDisabled();
    expect(view.getByRole("textbox")).not.toBeDisabled();
    expect(view.getByRole("combobox")).not.toBeDisabled();
  });

  it("renders style dropdown with parchment selected", () => {
    const { view } = renderBar({ mapStyle: "parchment" });
    expect(view.getByRole("combobox")).toHaveValue("parchment");
  });

  it("renders style dropdown with modern selected", () => {
    const { view } = renderBar({ mapStyle: "modern" });
    expect(view.getByRole("combobox")).toHaveValue("modern");
  });

  it("calls onMapStyleChange when style changed", async () => {
    const fn = vi.fn();
    const { view } = renderBar({ mapStyle: "parchment", onMapStyleChange: fn });
    await userEvent.selectOptions(view.getByRole("combobox"), "modern");
    expect(fn).toHaveBeenCalledWith("modern");
  });
});
