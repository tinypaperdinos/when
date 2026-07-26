import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class strings with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values", () => {
    expect(cn("a", undefined, null, false, "", "b")).toBe("a b");
  });

  it("returns an empty string when given no truthy classes", () => {
    expect(cn(undefined, null, false)).toBe("");
  });
});
