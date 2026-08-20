import { describe, expect, it } from "vitest";
import {
  dueDatePayload,
  dueDatePayloadForUpdate,
  dueDateValueFromWireDate,
  wireDateTimeStringFromDate,
} from "./task-due-date";

describe("dueDatePayload", () => {
  it("returns undefined for an empty date", () => {
    expect(dueDatePayload({ date: "" })).toBeUndefined();
  });

  it("returns the date unchanged when there is no time", () => {
    expect(dueDatePayload({ date: "2026-07-26" })).toBe("2026-07-26");
  });

  it("joins date and time with 'T'", () => {
    expect(dueDatePayload({ date: "2026-07-26", time: "14:30" })).toBe(
      "2026-07-26T14:30",
    );
  });

  it("returns undefined for a time with no date (deliberate drop, not a validation error)", () => {
    expect(dueDatePayload({ date: "", time: "14:30" })).toBeUndefined();
  });
});

describe("dueDateValueFromWireDate", () => {
  it("returns an empty date for null", () => {
    expect(dueDateValueFromWireDate(null)).toEqual({ date: "" });
  });

  it("returns an empty date for undefined (partial/legacy fixture)", () => {
    expect(dueDateValueFromWireDate(undefined)).toEqual({ date: "" });
  });

  it("round-trips a date-only wire string", () => {
    expect(dueDateValueFromWireDate("2026-07-26")).toEqual({ date: "2026-07-26" });
  });

  it("round-trips a date+time wire string", () => {
    expect(dueDateValueFromWireDate("2026-07-26T14:30")).toEqual({
      date: "2026-07-26",
      time: "14:30",
    });
  });

  it("treats an explicit midnight time as date-only (documented heuristic limitation)", () => {
    expect(dueDateValueFromWireDate("2026-07-26T00:00")).toEqual({ date: "2026-07-26" });
  });
});

describe("dueDatePayloadForUpdate", () => {
  it("returns null (explicit clear) for an empty date, unlike dueDatePayload's undefined", () => {
    expect(dueDatePayloadForUpdate({ date: "" })).toBeNull();
  });

  it("returns the date unchanged when there is no time", () => {
    expect(dueDatePayloadForUpdate({ date: "2026-07-26" })).toBe("2026-07-26");
  });

  it("joins date and time with 'T'", () => {
    expect(dueDatePayloadForUpdate({ date: "2026-07-26", time: "14:30" })).toBe(
      "2026-07-26T14:30",
    );
  });
});

describe("wireDateTimeStringFromDate", () => {
  it("returns a date-only string when hasTime is false, ignoring the Date's own clock fields", () => {
    const date = new Date(2026, 6, 26, 14, 30);
    expect(wireDateTimeStringFromDate(date, false)).toBe("2026-07-26");
  });

  it("returns a date+time string with zero-padded hour and minute when hasTime is true", () => {
    const date = new Date(2026, 6, 26, 9, 5);
    expect(wireDateTimeStringFromDate(date, true)).toBe("2026-07-26T09:05");
  });
});
