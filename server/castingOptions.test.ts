/**
 * Randomizer distribution guards (VC-R6 final fix 2): the old uniform hair
 * pick gave Silver+Platinum a combined 25% — randomized casts read grey far
 * too often. The weighted table keeps silver-class possible but rare.
 */
import { describe, expect, it } from "vitest";
import { generateRandomPreferences, RANDOM_HAIR_WEIGHTS } from "../shared/castingOptions";

describe("generateRandomPreferences hair distribution", () => {
  it("keeps the silver class rare by construction (weight table)", () => {
    const total = RANDOM_HAIR_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    const silverClass = RANDOM_HAIR_WEIGHTS.filter((w) =>
      ["Silver", "Platinum"].includes(w.color),
    ).reduce((s, w) => s + w.weight, 0);
    expect(silverClass / total).toBeLessThan(0.1);
  });

  it("samples match the weights — silver class stays rare, darks dominate", () => {
    const N = 4000;
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const hair = generateRandomPreferences().hairColor as string;
      counts.set(hair, (counts.get(hair) ?? 0) + 1);
    }
    const silverish = ((counts.get("Silver") ?? 0) + (counts.get("Platinum") ?? 0)) / N;
    // Weighted expectation ~7%; 4000 samples put the 3σ band well under 12%
    expect(silverish).toBeLessThan(0.12);
    // Natural darks must dominate the pool the way a real casting pool does
    const darks = ((counts.get("Jet Black") ?? 0) + (counts.get("Dark Brown") ?? 0)) / N;
    expect(darks).toBeGreaterThan(0.3);
    // Every weighted color remains reachable
    for (const { color } of RANDOM_HAIR_WEIGHTS) {
      expect(counts.get(color) ?? 0).toBeGreaterThan(0);
    }
  });
});
