import { describe, expect, it } from "vitest";
import { dueDatePayload } from "./task-due-date";

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
