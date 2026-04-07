import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { fmtTitle, Row, NumRow } from "../ModalRow";

describe("fmtTitle", () => {
  it("returns — for empty string", () => {
    expect(fmtTitle("")).toBe("—");
  });

  it("replaces underscores and title-cases hello_world", () => {
    expect(fmtTitle("hello_world")).toBe("Hello World");
  });

  it("title-cases a plain word", () => {
    expect(fmtTitle("england")).toBe("England");
  });
});

describe("Row", () => {
  it("renders label and value in DOM", () => {
    const { container } = render(<Row label="Country" value="England" />);
    const c = within(container);
    expect(c.getByText("Country")).toBeTruthy();
    expect(c.getByText("England")).toBeTruthy();
  });

  it("shows — when value is empty string", () => {
    const { container } = render(<Row label="Country" value="" />);
    const c = within(container);
    expect(c.getByText("—")).toBeTruthy();
  });

  it("value span has no modal-muted class when muted is absent", () => {
    const { container } = render(<Row label="Country" value="England" />);
    const valueSpan = container.querySelector(".modal-row-value");
    expect(valueSpan?.classList.contains("modal-muted")).toBe(false);
  });

  it("value span has modal-muted class when muted is true", () => {
    const { container } = render(<Row label="Country" value="England" muted={true} />);
    const valueSpan = container.querySelector(".modal-row-value");
    expect(valueSpan?.classList.contains("modal-muted")).toBe(true);
  });
});

describe("NumRow", () => {
  it("renders via fmtNum when decimals is not provided", () => {
    const { container } = render(<NumRow label="Population" value={1500} />);
    // fmtNum(1500) = "1.5K"
    const c = within(container);
    expect(c.getByText("1.5K")).toBeTruthy();
  });

  it("renders toFixed(2) when decimals=2", () => {
    const { container } = render(<NumRow label="Inflation" value={3.14159} decimals={2} />);
    const c = within(container);
    expect(c.getByText("3.14")).toBeTruthy();
  });
});
