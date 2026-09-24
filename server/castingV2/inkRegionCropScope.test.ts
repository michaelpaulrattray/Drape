import { describe, expect, it } from "vitest";

import {
  CASTING_INK_CUT_SCOPE_ENV,
  CASTING_INK_REFERENCE_SCOPE_ENV,
  CASTING_INK_REGION_CROP_SCOPE_ENV,
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
  CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
  CASTING_REPAINT_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingInkRegionCropCoverageError,
  CastingInkRegionCropScopeConfigurationError,
  captureCastingInkRegionCropEnabled,
  parseCastingInkRegionCropScope,
  validateCastingInkRegionCropEnvironment,
} from "./castingV2Scope";

/**
 * THE FLAG THAT DECIDES WHETHER THE CUT IS THE SURFACE OR THE PATCH INSIDE IT
 * (`CASTING_INK_REGION_CROP_SCOPE`, approved fable-1183 §2, countersigned
 * fable-1201).
 *
 * Two controls, and they are not the same control: the BOOT GUARD refuses a
 * configuration that could not work, and the POINT OF USE answers for one
 * account on one request. A boot check nobody invoked is the second way a flag
 * pair goes wrong, and a point-of-use read that trusted the boot check is the
 * first — so both are driven here, exactly as its sibling's are.
 *
 * # Why the parent is the INK REFERENCE road and nothing else
 *
 * ⚠ **IT WAS `CASTING_INK_CUT_SCOPE` UNTIL 2026-09-24 (#1158 slice 4a) AND THE
 * REASON DIED WITH THE STUDIO'S UPLOAD.** The reason read *"the region road is
 * an ESCALATION of the `cut` route: it is reached only after the routing has
 * already decided to cut"* — that routing lived inside `uploadInkDesign`, which
 * #1158 slices 1–2 deleted. The only road that reaches the cut today is the
 * take from her attached picture, and `inkReferenceMint.ts`'s own header says
 * **`CASTING_INK_CUT_SCOPE` IS NOT CONSULTED** there. So the fence refused on a
 * flag the one live caller ignores.
 *
 * The parent is `CASTING_INK_REFERENCE_SCOPE`: arming the surface cut over a
 * user who cannot document a tattoo with a picture would be arming a step of a
 * road they cannot enter — inert, and indistinguishable from mistaken. The
 * attach, repaint, library and transport parents ride in through the reference
 * flag's own check rather than being restated, because two checks of one fact
 * drift apart.
 *
 * # What these arms do NOT prove, said so it is not assumed
 *
 * Nothing here says the road is SAFE to flip. That is two things this file
 * cannot hold: the design floor, and fable-919 §3's founder gate, which is his
 * eyes on the frames and no arm's. Both live in the flag's own docblock.
 *
 * ⚠ The floor sentence here read *"both founder specimens measure 183 and 229
 * against 256, so the road is inert by arithmetic today"* until 2026-08-21, and
 * that was the claim opus-899 falsified on the real reader. **The floor blocks
 * an ARM placement, not the road**: 183 and 229 are both specimens' UPPER ARM,
 * while `upper chest` on S2 answers 720x390 and carries. Armed, a chest
 * placement changes what is stored today. The equality that IS driven in
 * `inkReferenceCutter.test.ts` is the narrower one — where the surface is under
 * the floor the refusal is identical with the flag either way.
 */
describe("the boot guard", () => {
  it("refuses while the reference road is shut — no cut to widen", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "all", referenceScope: "off",
    })).toThrow(/cannot be enabled while CASTING_INK_REFERENCE_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "users:1", referenceScope: "off",
    })).toThrow(CastingInkRegionCropCoverageError);
  });

  it("refuses `all` while the reference road is limited to named users", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "all", referenceScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the reference road does not cover, and NAMES them", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "users:1,7", referenceScope: "users:1",
    })).toThrow(/names users outside CASTING_INK_REFERENCE_SCOPE: 7/);
  });

  it("admits a covered user", () => {
    expect(validateCastingInkRegionCropEnvironment({
      scope: "users:1", referenceScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("admits `all` under an `all` parent", () => {
    expect(validateCastingInkRegionCropEnvironment({
      scope: "all", referenceScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* THE NEGATIVE CONTROL. A validator that refused everything would pass
       every arm above and be useless. */
    expect(validateCastingInkRegionCropEnvironment({
      scope: undefined, referenceScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkRegionCropEnvironment({
      scope: "off", referenceScope: "off",
    })).toEqual({ kind: "off" });
  });

  it("⚠ ADMITS PRODUCTION'S OWN POSITIONS — the re-parent's claim at the boot fence", () => {
    /*
      The service carries reference `users:1` and region crop `users:1`
      (`scripts/lib/productionFlagPositions.mts`), which is the same pair it
      carried under the cut parent, because the cut flag stands at `users:1`
      too. So this fence admits today's configuration exactly as the old one
      did — and the second line is what actually changed: an account inside the
      reference road that was never inside the retired tattoo studio now boots,
      where the studio parent made it impossible.
    */
    expect(validateCastingInkRegionCropEnvironment({
      scope: "users:1", referenceScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingInkRegionCropEnvironment({
      scope: "users:7", referenceScope: "users:7",
    })).toEqual({ kind: "users", userIds: [7] });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkRegionCropScope("everyone"))
      .toThrow(CastingInkRegionCropScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkRegionCropScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    const before = process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    try {
      expect(captureCastingInkRegionCropEnabled(1)).toBe(false);
      expect(captureCastingInkRegionCropEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
      else process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = before;
    }
  });

  it("⚠ stays off for a named user when the PARENT is shut, at the point of use", () => {
    /*
      The AND of the whole chain, answered where it is asked rather than trusted
      from boot. This is the arm that would go red if
      `captureCastingInkRegionCropEnabled` were ever simplified to read its own
      variable alone — which is how a sub-flag comes to be armed over a road its
      user cannot enter.
    */
    const before = process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    const beforeReference = process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
    process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
    try {
      expect(captureCastingInkRegionCropEnabled(1)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
      else process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = before;
      if (beforeReference === undefined) delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
      else process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = beforeReference;
    }
  });

  it("⚠ FOLLOWS THE REFERENCE ROAD AND NO LONGER ASKS THE RETIRED CUT FLAG", () => {
    /*
      THE RE-PARENT, STATED AS THE ONLY TWO READINGS THAT DISTINGUISH IT
      (#1158 slice 4a).

      Line 1: the cut flag UNSET and the reference road open — the point of use
      says yes. Under the old chain this was false, and it is the whole change:
      the surface cut stops depending on a door that no longer exists.

      Line 2: the reference road shut and the cut flag set — still no. The new
      parent is a real AND term rather than a widening, which is the reading a
      re-parent that quietly opened a road would fail.

      ⚠ **And nothing moved for any account**, which is arithmetic rather than
      an arm's business: the service carries reference, cut and region crop all
      at `users:1` (`scripts/lib/productionFlagPositions.mts`), so both chains
      answer true for his account and false for every other. That claim was
      driven at the real predicate on the tree before and after the change.
    */
    const saved = {
      regionCrop: process.env[CASTING_INK_REGION_CROP_SCOPE_ENV],
      reference: process.env[CASTING_INK_REFERENCE_SCOPE_ENV],
      attach: process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV],
      repaint: process.env[CASTING_REPAINT_SCOPE_ENV],
      library: process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV],
      casting: process.env[CASTING_V2_SCOPE_ENV],
      cut: process.env[CASTING_INK_CUT_SCOPE_ENV],
    };
    try {
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "all";
      process.env[CASTING_REPAINT_SCOPE_ENV] = "all";
      process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV] = "users:1";
      process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = "users:1";

      process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = "users:1";
      delete process.env[CASTING_INK_CUT_SCOPE_ENV];
      expect(captureCastingInkRegionCropEnabled(1)).toBe(true);
      expect(captureCastingInkRegionCropEnabled(2)).toBe(false);

      delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
      process.env[CASTING_INK_CUT_SCOPE_ENV] = "users:1";
      expect(captureCastingInkRegionCropEnabled(1)).toBe(false);
    } finally {
      for (const [name, value] of [
        [CASTING_INK_REGION_CROP_SCOPE_ENV, saved.regionCrop],
        [CASTING_INK_REFERENCE_SCOPE_ENV, saved.reference],
        [CASTING_REFERENCE_ATTACH_SCOPE_ENV, saved.attach],
        [CASTING_REPAINT_SCOPE_ENV, saved.repaint],
        [CASTING_REFERENCE_LIBRARY_SCOPE_ENV, saved.library],
        [CASTING_V2_SCOPE_ENV, saved.casting],
        [CASTING_INK_CUT_SCOPE_ENV, saved.cut],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
