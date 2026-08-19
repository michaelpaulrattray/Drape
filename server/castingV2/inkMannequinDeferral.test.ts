/**
 * THE DEFERRAL, DRIVEN AT BOTH PLACES IT HAS TO HOLD — ordered fable-1060.
 *
 * The founder parked the mannequin road (fable-1053 §2) while the ink studio
 * flag was already ON for his account, which left two live ends: every upload
 * still minted a plate with house money, and a plate would still ride into his
 * sign views.
 *
 * Written RED FIRST, and the second arm is the one that matters most, because
 * the sign lane was believed quiet for a reason that turned out not to exist:
 * `RELEASED_INK_TUPLES` has **no caller anywhere outside its own test** — the
 * release gate governs nothing, and what was actually keeping plates out of
 * signed views was the absence of a plate.
 */
import { describe, expect, it, vi } from "vitest";

import { MANNEQUIN_ROAD_DEFERRED } from "../../shared/inkMannequinDeferral";
import { carriedInkPlates, type SignServiceDependencies } from "./signService";

const plateRow = (over: Record<string, unknown> = {}) => ({
  designPublicId: "design-1",
  placement: "neck" as const,
  side: "centre" as const,
  storageKey: "casting-v2/plates/one.png",
  mime: "image/png",
  engine: "fal:nano-banana-pro",
  ...over,
});

const input = { userId: 1, candidateId: 7, operationId: "55555555-5555-4555-8555-555555555555" };

describe("the deferral is one named condition", () => {
  it("is ON, and is a constant rather than a scope", () => {
    /* Not per-user, not configuration, and not turn-off-able by an environment
       variable — a deferral is a decision, and this is where it lives. */
    expect(MANNEQUIN_ROAD_DEFERRED).toBe(true);
  });
});

describe("no plate rides a signed Cast's views while the road is parked", () => {
  it("a NECK plate — the one the visibility table lets through — does not ride", async () => {
    /*
      `neck` is chosen deliberately: `placementRidesPackageViews` excludes the
      upper chest (the scoop-neck court) and the upper arm's own defect is a
      different lane, so the neck is the placement that WOULD have ridden. An
      arm written on `upperChest` would pass without the deferral existing.
    */
    const listInkPlates = vi.fn(async () => [plateRow()] as never);
    const readBytes = vi.fn(async () => ({ bytes: Buffer.from("plate"), contentType: "image/png" }));
    const deps = { listInkPlates, readBytes } as unknown as SignServiceDependencies;

    const outcome = await carriedInkPlates(deps, input);

    expect(outcome.plates).toEqual([]);
    expect(outcome.dispositions).toEqual([
      { designPublicId: "design-1", rode: false, reason: "mannequinDeferred" },
    ]);
    /* And the bytes were never even fetched: a parked road does not read
       storage to decide it is parked. */
    expect(readBytes).not.toHaveBeenCalled();
  });

  it("says WHY per design, rather than going quiet", async () => {
    /* fable-1005 §2's single surface: one line per design, rode or not. A
       deferral that produced no disposition would look identical to a Cast with
       no designs at all. */
    const listInkPlates = vi.fn(async () => [
      plateRow({ designPublicId: "a" }),
      plateRow({ designPublicId: "b", placement: "upperArm", side: "left" }),
    ] as never);
    const deps = { listInkPlates } as unknown as SignServiceDependencies;

    const outcome = await carriedInkPlates(deps, input);
    expect(outcome.dispositions.map((one) => one.designPublicId)).toEqual(["a", "b"]);
    expect(outcome.dispositions.every((one) => one.rode === false)).toBe(true);
  });

  it("is still inert for a Cast with no designs at all", async () => {
    const listInkPlates = vi.fn(async () => [] as never);
    const deps = { listInkPlates } as unknown as SignServiceDependencies;
    expect(await carriedInkPlates(deps, input)).toEqual({ plates: [], dispositions: [] });
  });
});
