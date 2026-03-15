import { describe, expect, it } from "vitest";
import datasetJson from "../../public/data/words.v4.json";
import { parseWordDataset } from "./word-data";

describe("word-data", () => {
  it("accepts the bundled word dataset asset", () => {
    const words = parseWordDataset(datasetJson);

    expect(words.length).toBeGreaterThanOrEqual(8);
    expect(words[0]).toMatchObject({
      id: 1
    });
    expect(typeof words[0].fi).toBe("string");
    expect(typeof words[0].en).toBe("string");
    expect(typeof words[0].fiSimple).toBe("string");
    expect(typeof words[0].enSimple).toBe("string");
    expect(words.some((word) => word.pos === "verb")).toBe(true);
    expect(words.some((word) => word.topic === "work")).toBe(true);
  });

  it("fails fast on invalid word entries", () => {
    expect(() =>
      parseWordDataset([
        {
          id: 1,
          fi: "",
          en: "however",
          fiSimple: "Talla naytetaan pieni vastakohta edelliseen asiaan.",
          enSimple: "This shows a small contrast to the previous thing.",
          topic: "core",
          pos: "other"
        }
      ])
    ).toThrow(/missing required text fields/i);
  });
});
