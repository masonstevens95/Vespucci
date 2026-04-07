import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SubjectsSection } from "../SubjectsSection";

describe("SubjectsSection", () => {
  it("renders nothing when subjects is empty", () => {
    const { container } = render(
      <SubjectsSection subjects={[]} open={false} onToggle={() => { /* noop */ }} countryNames={{}} />
    );
    expect(container.textContent).toBe("");
  });

  it("shows subject count when subjects are present and closed", () => {
    const { container } = render(
      <SubjectsSection subjects={["FRA", "SPA"]} open={false} onToggle={() => { /* noop */ }} countryNames={{ FRA: "France", SPA: "Spain" }} />
    );
    expect(container.textContent).toContain("Subjects (2)");
    expect(container.querySelector(".modal-subject-list")).toBeNull();
  });

  it("shows subject list when open=true", () => {
    const { container } = render(
      <SubjectsSection subjects={["FRA", "SPA"]} open={true} onToggle={() => { /* noop */ }} countryNames={{ FRA: "France", SPA: "Spain" }} />
    );
    expect(container.querySelector(".modal-subject-list")).not.toBeNull();
    expect(container.textContent).toContain("France");
    expect(container.textContent).toContain("Spain");
  });

  it("shows ▾ when open and ▸ when closed", () => {
    const { container: openContainer } = render(
      <SubjectsSection subjects={["FRA"]} open={true} onToggle={() => { /* noop */ }} countryNames={{}} />
    );
    expect(openContainer.textContent).toContain("▾");

    const { container: closedContainer } = render(
      <SubjectsSection subjects={["FRA"]} open={false} onToggle={() => { /* noop */ }} countryNames={{}} />
    );
    expect(closedContainer.textContent).toContain("▸");
  });

  it("calls onToggle when label is clicked", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <SubjectsSection subjects={["FRA"]} open={false} onToggle={onToggle} countryNames={{}} />
    );
    const label = container.querySelector(".modal-collapsible") as HTMLElement;
    fireEvent.click(label);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("uses tag as display name when tag not in countryNames", () => {
    const { container } = render(
      <SubjectsSection subjects={["UNK"]} open={true} onToggle={() => { /* noop */ }} countryNames={{}} />
    );
    expect(container.textContent).toContain("UNK");
  });
});
