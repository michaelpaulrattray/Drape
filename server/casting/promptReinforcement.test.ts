import { describe, it, expect } from "vitest";
import { buildEthnicityHint, buildReinforcedPrompt } from "./promptReinforcement";

describe("buildEthnicityHint", () => {
  it("returns undefined when no ethnicity data", () => {
    expect(buildEthnicityHint({})).toBeUndefined();
  });

  it("falls back to flat ethnicity string when no blend", () => {
    expect(buildEthnicityHint({ ethnicity: "Nordic" })).toBe("Nordic");
  });

  it("returns single ethnicity name for single-entry blend", () => {
    expect(
      buildEthnicityHint({ ethnicityBlend: [{ name: "Slavic", pct: 100 }] })
    ).toBe("Slavic");
  });

  it("returns 'with subtle traits' for 85%+ dominant", () => {
    const result = buildEthnicityHint({
      ethnicityBlend: [
        { name: "Nordic", pct: 90 },
        { name: "East Asian", pct: 10 },
      ],
    });
    expect(result).toBe("Nordic with subtle East Asian traits");
  });

  it("returns 'predominantly with visible features' for 65-84% dominant", () => {
    const result = buildEthnicityHint({
      ethnicityBlend: [
        { name: "Slavic", pct: 70 },
        { name: "East Asian", pct: 30 },
      ],
    });
    expect(result).toBe("predominantly Slavic with visible East Asian features");
  });

  it("returns 'evenly mixed' for <65% dominant", () => {
    const result = buildEthnicityHint({
      ethnicityBlend: [
        { name: "Slavic", pct: 60 },
        { name: "East Asian", pct: 40 },
      ],
    });
    expect(result).toBe(
      "evenly mixed Slavic-East Asian, both heritages clearly visible"
    );
  });

  it("sorts by pct descending regardless of input order", () => {
    const result = buildEthnicityHint({
      ethnicityBlend: [
        { name: "East Asian", pct: 40 },
        { name: "Slavic", pct: 60 },
      ],
    });
    expect(result).toBe(
      "evenly mixed Slavic-East Asian, both heritages clearly visible"
    );
  });

  it("prefers ethnicityBlend over flat ethnicity", () => {
    const result = buildEthnicityHint({
      ethnicity: "Nordic",
      ethnicityBlend: [{ name: "Slavic", pct: 100 }],
    });
    expect(result).toBe("Slavic");
  });
});

describe("buildReinforcedPrompt", () => {
  const base = "A model with natural features";

  it("returns original prompt when no overrides needed", () => {
    expect(buildReinforcedPrompt(base, {})).toBe(base);
  });

  it("returns original prompt for default eye colors", () => {
    expect(buildReinforcedPrompt(base, { eyeColor: "Brown" })).toBe(base);
    expect(buildReinforcedPrompt(base, { eyeColor: "Dark" })).toBe(base);
    expect(buildReinforcedPrompt(base, { eyeColor: "Black" })).toBe(base);
  });

  it("returns original prompt for default hair colors", () => {
    expect(buildReinforcedPrompt(base, { hairColor: "Natural" })).toBe(base);
    expect(buildReinforcedPrompt(base, { hairColor: "Off Black" })).toBe(base);
    expect(buildReinforcedPrompt(base, { hairColor: "Dark Brown" })).toBe(base);
  });

  it("prepends CASTING OVERRIDES for non-default eye color", () => {
    const result = buildReinforcedPrompt(base, { eyeColor: "Ice" });
    expect(result).toContain("[CASTING OVERRIDES");
    expect(result).toContain("EYE COLOR: Ice");
    expect(result).toContain(base);
  });

  it("prepends CASTING OVERRIDES for non-default hair color", () => {
    const result = buildReinforcedPrompt(base, { hairColor: "Platinum" });
    expect(result).toContain("[CASTING OVERRIDES");
    expect(result).toContain("HAIR COLOR: Platinum");
    expect(result).toContain(base);
  });

  it("combines both eye and hair overrides", () => {
    const result = buildReinforcedPrompt(base, {
      eyeColor: "Green",
      hairColor: "Platinum",
    });
    expect(result).toContain("EYE COLOR: Green");
    expect(result).toContain("HAIR COLOR: Platinum");
    expect(result.indexOf("[CASTING OVERRIDES")).toBe(0);
    expect(result).toContain(base);
  });

  it("does not add override for empty string values", () => {
    expect(buildReinforcedPrompt(base, { eyeColor: "", hairColor: "" })).toBe(
      base
    );
  });
});
