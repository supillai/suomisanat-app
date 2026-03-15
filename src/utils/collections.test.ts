import { afterEach, describe, expect, it, vi } from "vitest";
import { randomFrom, shuffle } from "./collections";

describe("collections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects an item based on Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.51);

    expect(randomFrom(["a", "b", "c", "d"])).toBe("c");
  });

  it("shuffles without mutating the original list", () => {
    const values = [1, 2, 3, 4];
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);

    expect(shuffle(values)).toEqual([3, 4, 2, 1]);
    expect(values).toEqual([1, 2, 3, 4]);
  });
});
