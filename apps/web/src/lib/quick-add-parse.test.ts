import { afterEach, describe, expect, it, vi } from "vitest";
import { parseQuickAdd } from "./quick-add-parse";

afterEach(() => {
  vi.useRealTimers();
});

describe("parseQuickAdd", () => {
  it("returns the text unchanged when there is no date phrase or tag", () => {
    const referenceDate = new Date(2026, 7, 20);

    expect(parseQuickAdd("Buy milk", referenceDate)).toEqual({
      title: "Buy milk",
      tags: [],
      dueDate: undefined,
      dueDateHasTime: false,
    });
  });

  it("resolves 'tomorrow' to the next calendar day with no time set", () => {
    const referenceDate = new Date(2026, 7, 20);

    const result = parseQuickAdd("tomorrow", referenceDate);

    expect(result.title).toBe("");
    expect(result.dueDateHasTime).toBe(false);
    expect(result.dueDate).toEqual(new Date(2026, 7, 21));
  });

  it("resolves 'tomorrow at 5pm' with the time marked certain", () => {
    const referenceDate = new Date(2026, 7, 20);

    const result = parseQuickAdd("tomorrow at 5pm", referenceDate);

    expect(result.dueDateHasTime).toBe(true);
    expect(result.dueDate?.getHours()).toBe(17);
    expect(result.dueDate?.getMinutes()).toBe(0);
    expect(result.dueDate?.getDate()).toBe(21);
  });

  it("resolves 'next monday' to the following Monday when referenceDate is itself a Monday", () => {
    const referenceDate = new Date(2026, 7, 17); // a Monday
    expect(referenceDate.getDay()).toBe(1);

    const result = parseQuickAdd("next monday", referenceDate);

    expect(result.dueDate?.getDate()).toBe(24);
    expect(result.dueDate?.getMonth()).toBe(7);
  });

  it("resolves 'in 3 days' to the correct day offset", () => {
    const referenceDate = new Date(2026, 7, 20);

    const result = parseQuickAdd("in 3 days", referenceDate);

    expect(result.dueDate).toEqual(new Date(2026, 7, 23));
  });

  it("resolves a bare, non-relative phrase forward into the following year when it has already passed this year", () => {
    const referenceDate = new Date(2026, 7, 20); // August 20, 2026 — after June 3

    const result = parseQuickAdd("june 3", referenceDate);

    expect(result.dueDate?.getFullYear()).toBe(2027);
    expect(result.dueDate?.getMonth()).toBe(5);
    expect(result.dueDate?.getDate()).toBe(3);
  });

  it("strips the date phrase from the title and collapses whitespace", () => {
    const referenceDate = new Date(2026, 7, 20);

    const result = parseQuickAdd("Call mom tomorrow at 5pm", referenceDate);

    expect(result.title).toBe("Call mom");
    expect(result.dueDateHasTime).toBe(true);
    expect(result.dueDate?.getDate()).toBe(21);
    expect(result.dueDate?.getHours()).toBe(17);
  });

  it("collects a single #tag and strips it from the title", () => {
    const result = parseQuickAdd("Buy milk #errand", new Date(2026, 7, 20));

    expect(result.tags).toEqual(["errand"]);
    expect(result.title).toBe("Buy milk");
  });

  it("collects multiple #tags in different positions, in order, collapsing whitespace at both ends and the gap", () => {
    const result = parseQuickAdd("#urgent renew passport #home", new Date(2026, 7, 20));

    expect(result.tags).toEqual(["urgent", "home"]);
    expect(result.title).toBe("renew passport");
  });

  it("dedupes tags case-insensitively, keeping the first-seen casing", () => {
    const result = parseQuickAdd("#Home water plants #home", new Date(2026, 7, 20));

    expect(result.tags).toEqual(["Home"]);
    expect(result.title).toBe("water plants");
  });

  it("combines a date phrase and a tag in one input", () => {
    const result = parseQuickAdd("Call mom tomorrow at 5pm #family", new Date(2026, 7, 20));

    expect(result.title).toBe("Call mom");
    expect(result.dueDateHasTime).toBe(true);
    expect(result.dueDate?.getDate()).toBe(21);
    expect(result.tags).toEqual(["family"]);
  });

  it("returns an empty title when the input is only a date phrase", () => {
    const result = parseQuickAdd("tomorrow", new Date(2026, 7, 20));

    expect(result.title).toBe("");
    expect(result.dueDate).toBeDefined();
  });

  it("returns an empty title when the input is only a tag", () => {
    const result = parseQuickAdd("#chores", new Date(2026, 7, 20));

    expect(result.title).toBe("");
    expect(result.tags).toEqual(["chores"]);
  });

  it("does not treat a bare trailing '#' as a tag", () => {
    const result = parseQuickAdd("Section #", new Date(2026, 7, 20));

    expect(result.tags).toEqual([]);
    expect(result.title).toBe("Section #");
  });

  it("does not treat '# tag' (space right after #) as a tag", () => {
    const result = parseQuickAdd("Section # tag", new Date(2026, 7, 20));

    expect(result.tags).toEqual([]);
    expect(result.title).toBe("Section # tag");
  });

  it("does not treat 'C#' as a tag", () => {
    const result = parseQuickAdd("Learn C#", new Date(2026, 7, 20));

    expect(result.tags).toEqual([]);
    expect(result.title).toBe("Learn C#");
  });

  it("short-circuits an empty string to the all-empty result", () => {
    expect(parseQuickAdd("", new Date(2026, 7, 20))).toEqual({
      title: "",
      tags: [],
      dueDate: undefined,
      dueDateHasTime: false,
    });
  });

  it("short-circuits a whitespace-only string to the all-empty result", () => {
    expect(parseQuickAdd("   ", new Date(2026, 7, 20))).toEqual({
      title: "",
      tags: [],
      dueDate: undefined,
      dueDateHasTime: false,
    });
  });

  it("defaults referenceDate to the current system time when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20));

    const result = parseQuickAdd("tomorrow");

    expect(result.dueDate).toEqual(new Date(2026, 7, 21));
  });
});
