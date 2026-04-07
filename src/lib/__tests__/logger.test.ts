import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeLogRecord, formatLogRecord, createLogger } from "../logger";

describe("makeLogRecord", () => {
  it("returns a record with the given fields", () => {
    const r = makeLogRecord("error", "parser", "section not found");
    expect(r.level).toBe("error");
    expect(r.tag).toBe("parser");
    expect(r.message).toBe("section not found");
  });

  it("works for all four levels", () => {
    for (const level of ["error", "warn", "info", "debug"] as const) {
      expect(makeLogRecord(level, "t", "m").level).toBe(level);
    }
  });
});

describe("formatLogRecord", () => {
  it("formats as [LEVEL][tag] message", () => {
    expect(formatLogRecord({ level: "error", tag: "parser", message: "boom" }))
      .toBe("[ERROR][parser] boom");
  });

  it("uppercases the level", () => {
    expect(formatLogRecord(makeLogRecord("warn", "x", "y"))).toContain("[WARN]");
    expect(formatLogRecord(makeLogRecord("debug", "x", "y"))).toContain("[DEBUG]");
  });

  it("includes the tag in brackets", () => {
    expect(formatLogRecord(makeLogRecord("info", "myModule", "hello"))).toContain("[myModule]");
  });

  it("includes the message text", () => {
    expect(formatLogRecord(makeLogRecord("info", "t", "hello world"))).toContain("hello world");
  });
});

describe("createLogger", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy  = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy  = vi.spyOn(console, "info").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("error() calls console.error with formatted message", () => {
    createLogger("parser").error("section missing");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toBe("[ERROR][parser] section missing");
  });

  it("warn() calls console.warn with formatted message", () => {
    createLogger("parser").warn("unexpected token");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[WARN][parser]");
  });

  it("info() calls console.info with formatted message", () => {
    createLogger("loader").info("save loaded");
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy.mock.calls[0][0]).toContain("[INFO][loader]");
  });

  it("debug() calls console.debug with formatted message", () => {
    createLogger("loader").debug("offset=42");
    expect(debugSpy).toHaveBeenCalledOnce();
    expect(debugSpy.mock.calls[0][0]).toContain("[DEBUG][loader]");
  });

  it("two loggers with different tags produce distinct prefixes", () => {
    const a = createLogger("alpha");
    const b = createLogger("beta");
    a.error("from a");
    b.error("from b");
    expect(errorSpy.mock.calls[0][0]).toContain("[alpha]");
    expect(errorSpy.mock.calls[1][0]).toContain("[beta]");
  });
});
