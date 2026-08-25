import { afterEach, describe, expect, it } from "vitest";

import {
  CASTING_SEGMENTS_DELIVERED_SCOPE_ENV,
  CASTING_SEGMENTS_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingSegmentsCleanupWorkerError,
  CastingSegmentsDeliveredCoverageError,
  CastingSegmentsDeliveredScopeConfigurationError,
  deliveredAnchoredSegmentsEnabled,
  parseCastingSegmentsDeliveredScope,
  validateCastingSegmentsDeliveredEnvironment,
  CastingSegmentsCoverageError,
  CastingSegmentsScopeConfigurationError,
  CastingV2ValidatorConfigurationError,
  CastingV2CleanupWorkerConfigurationError,
  CastingV2ScopeConfigurationError,
  CastingV2TransportConfigurationError,
  captureCastingSegmentsEnabled,
  castingSegmentsArmed,
  castingV2EnabledForUser,
  parseCastingSegmentsScope,
  parseCastingV2Scope,
  validateCastingSegmentsEnvironment,
  validateCastingV2Environment,
  captureCastingReferenceLibraryEnabled,
  castingReferenceLibraryArmed,
  CastingReferenceLibraryCleanupWorkerError,
  CastingReferenceLibraryCoverageError,
  CastingReferenceLibraryScopeConfigurationError,
  CASTING_REFERENCE_LIBRARY_SCOPE_ENV,
  parseCastingReferenceLibraryScope,
  validateCastingReferenceLibraryEnvironment,
  CASTING_REPAINT_SCOPE_ENV,
  CastingFaceScanCoverageError,
  CastingFaceScanScopeConfigurationError,
  CASTING_FACE_SCAN_SCOPE_ENV,
  captureCastingFaceScanEnabled,
  parseCastingFaceScanScope,
  validateCastingFaceScanEnvironment,
  CastingScanTableCleanupWorkerError,
  CastingScanTableCoverageError,
  CastingScanTableScopeConfigurationError,
  captureCastingScanTableEnabled,
  castingScanTableArmed,
  parseCastingScanTableScope,
  validateCastingScanTableEnvironment,
  CastingRepaintCoverageError,
  CastingSidePhrasingCoverageError,
  CastingSidePhrasingScopeConfigurationError,
  captureCastingSidePhrasingEnabled,
  parseCastingSidePhrasingScope,
  validateCastingSidePhrasingEnvironment,
  CastingRepaintScopeConfigurationError,
  captureCastingRepaintEnabled,
  parseCastingRepaintScope,
  validateCastingRepaintEnvironment,
  CASTING_REFINE_DISPATCH_SCOPE_ENV,
  CastingRefineDispatchScopeConfigurationError,
  CastingRefineDispatchCoverageError,
  parseCastingRefineDispatchScope,
  captureCastingRefineDispatchEnabled,
  validateCastingRefineDispatchEnvironment,
} from "./castingV2Scope";

/**
 * The rollout scope (plan §K M4, flag-forward amendment).
 *
 * This flag guards *spendable* surface, which changes what "correct" means for
 * it: an ambiguous value must stop the server rather than resolve to a guess,
 * and a typo must never be the difference between "off" and "everyone".
 */

describe("grammar", () => {
  it("is off by default, and off is the only silent state", () => {
    expect(parseCastingV2Scope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingV2Scope("")).toEqual({ kind: "off" });
    expect(parseCastingV2Scope("off")).toEqual({ kind: "off" });
  });

  it("admits an explicit user list, order-normalised", () => {
    expect(parseCastingV2Scope("users:9,3")).toEqual({ kind: "users", userIds: [3, 9] });
  });

  it("refuses anything it cannot read exactly", () => {
    // Every one of these is a plausible typo, and every one of them would be a
    // silent production behaviour change if it were tolerated.
    for (const raw of ["all ", "ALL", "user:3", "users:", "users:0", "users:3,3", "users: 3", "users:-1", "true"]) {
      expect(() => parseCastingV2Scope(raw), raw).toThrow(CastingV2ScopeConfigurationError);
    }
  });

  it("gates by user, and demands a real user id", () => {
    const scope = parseCastingV2Scope("users:3");
    expect(castingV2EnabledForUser(scope, 3)).toBe(true);
    expect(castingV2EnabledForUser(scope, 4)).toBe(false);
    expect(castingV2EnabledForUser({ kind: "all" }, 4)).toBe(true);
    expect(castingV2EnabledForUser({ kind: "off" }, 3)).toBe(false);
    expect(() => castingV2EnabledForUser(scope, 0)).toThrow(TypeError);
  });
});

describe("boot validation", () => {
  const configured = { cleanupWorker: "true", transportConfigured: true, validatorConfigured: true };

  it("lets the default configuration boot untouched", () => {
    // The whole point of shipping dark: an unset flag imposes no new
    // requirements on an existing deployment.
    expect(validateCastingV2Environment({ scope: undefined, cleanupWorker: undefined })).toEqual({
      kind: "off",
    });
  });

  it("refuses to enable without the cleanup worker", () => {
    // §G.6 promises candidate objects are purged. Without the worker nothing
    // ever deletes them, and the promise quietly becomes false.
    expect(() =>
      validateCastingV2Environment({ scope: "all", cleanupWorker: undefined, transportConfigured: true }),
    ).toThrow(CastingV2CleanupWorkerConfigurationError);
  });

  it("refuses to enable without an image transport", () => {
    // Otherwise the first paid roll charges, fails eight times on a missing
    // credential, and refunds — a configuration fault billed to the user.
    expect(() =>
      validateCastingV2Environment({
        scope: "users:3",
        cleanupWorker: "true",
        transportConfigured: false,
        validatorConfigured: true,
      }),
    ).toThrow(CastingV2TransportConfigurationError);
  });

  it("refuses to enable without the view-conformance validator", () => {
    // Sign (M7) is the other spendable surface, and it cannot land a view
    // without a second opinion (§I fail-closed). Unconfigured, every Sign
    // would charge 450, fail all FIVE views closed, and refund the whole 450
    // — the base included, per the founder's 2026-08-02 total-loss ruling — an
    // empty package every time, with the money technically correct throughout.
    // (This said "charge 500 … refund 300" until 2026-08-25: six views, and a
    // refund policy the founder had already reversed. See the docblock on
    // `CastingV2ValidatorConfigurationError`.)
    expect(() =>
      validateCastingV2Environment({
        scope: "all",
        cleanupWorker: "true",
        transportConfigured: true,
        validatorConfigured: false,
      }),
    ).toThrow(CastingV2ValidatorConfigurationError);
  });

  /*
    ⚠ THE ARM THAT TIES THE DOCBLOCK ABOVE TO THE CODE (ruled fable-1654 §3).

    The comment beside this suite quotes three numbers — 450 charged, five
    views, the whole 450 back — and for months it quoted three DIFFERENT ones
    (500 / six / 300) while every arm in the product was green, because **a
    comment cannot be run.** The pins for all three already existed and were
    right: `castViewPackage.test` asserts the view list and derives 450 from its
    length, and `packageOrchestrator.test`'s *"zero of N — the base goes back
    too"* asserts the full 450 with the base under its own reference.

    What did NOT exist is anything joining them to THIS sentence, which is the
    one a reader meets when they ask why the scope refuses to boot. So this
    reads both constants at the place the claim is made. It is deliberately not
    a prose ban: half of this product's "six" sentences are true (a Cast's own
    six frames — the Master plus the package's five — and the six SLOTS a
    signed Cast carries, five bought plus the sealed `frontClose`).
  */
  it("the fail-closed docblock's numbers are the product's: five views, 450, refunded whole", async () => {
    const { CAST_PACKAGE_VIEWS, CASTING_V2_SIGN_PRICE_CREDITS, CAST_PACKAGE_VIEW_PRICE } =
      await import("./castViewPackage");
    const { CASTING_V2_SIGN_COSTS } = await import("../casting/castingCreditCosts");

    expect(CAST_PACKAGE_VIEWS.length).toBe(5);
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(450);
    // The charge the docblock names is the promotion plus EVERY view, and a
    // total loss gives all of it back — so the two numbers in that sentence are
    // one number, and it is this one.
    expect(CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * CAST_PACKAGE_VIEWS.length)
      .toBe(CASTING_V2_SIGN_PRICE_CREDITS);
  });

  it("accepts a fully configured rollout", () => {
    expect(validateCastingV2Environment({ scope: "users:3", ...configured })).toEqual({
      kind: "users",
      userIds: [3],
    });
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_V2_SCOPE_ENV).toBe("CASTING_V2_SCOPE");
  });
});

/**
 * The segment sub-flag.
 *
 * It exists because `CASTING_V2_SCOPE` is already open in production for the
 * founder's own dogfooding, so a store shipped under that flag alone would
 * begin writing on the paid path the moment it deployed. These cases are what
 * make "dark from the first commit" a property rather than an intention.
 */
describe("the segment sub-flag", () => {
  it("shares the casting flag's grammar, including its refusals", () => {
    expect(parseCastingSegmentsScope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingSegmentsScope("users:4,2")).toEqual({ kind: "users", userIds: [2, 4] });
    for (const raw of ["ALL", "user:3", "users:", "users:0", "users:3,3", "true"]) {
      expect(() => parseCastingSegmentsScope(raw), raw).toThrow(CastingSegmentsScopeConfigurationError);
    }
  });

  it("is off by default, so landing the code changes nothing", () => {
    expect(validateCastingSegmentsEnvironment({
      scope: undefined,
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "off" });
  });

  it("refuses to arm without the cleanup worker", () => {
    // A segment writes a mask and a crop of a person's face to the public
    // bucket. Without the worker, the retention this store performs in the same
    // transaction as its writes would be false at the far end.
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "users:1",
      cleanupWorker: undefined,
    })).toThrow(CastingSegmentsCleanupWorkerError);
  });

  it("refuses a scope reaching past the casting scope, in each way it can", () => {
    // Segments belong to candidates, and only Casting V2 makes candidates.
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "off",
      cleanupWorker: "true",
    })).toThrow(CastingSegmentsCoverageError);
    expect(() => validateCastingSegmentsEnvironment({
      scope: "all",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(CastingSegmentsCoverageError);
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1,2",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(/names users outside CASTING_V2_SCOPE: 2/);
  });

  it("accepts a subset, and the same list under an open casting scope", () => {
    expect(validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("reads BOTH flags at the point of use, not just its own", () => {
    const previous = { ...process.env };
    try {
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      expect(captureCastingSegmentsEnabled(1)).toBe(true);
      expect(captureCastingSegmentsEnabled(2)).toBe(false);

      // The boot check refuses this pairing; the point-of-use read refuses it a
      // second time, because the two ways a flag pair goes wrong are a bad
      // value and a boot check nobody invoked.
      process.env[CASTING_V2_SCOPE_ENV] = "users:2";
      expect(captureCastingSegmentsEnabled(1)).toBe(false);

      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "off";
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      expect(captureCastingSegmentsEnabled(1)).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  it("reports armed WITHOUT narrowing to a user — the retention read", () => {
    const previous = { ...process.env };
    try {
      delete process.env[CASTING_SEGMENTS_SCOPE_ENV];
      expect(castingSegmentsArmed()).toBe(false);
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      // Armed is a property of the deployment, not of a user: the sweep must
      // collect segments belonging to anyone who has them, including a user
      // dropped from the list after their rows were written.
      expect(castingSegmentsArmed()).toBe(true);
    } finally {
      process.env = previous;
    }
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_SEGMENTS_SCOPE_ENV).toBe("CASTING_SEGMENTS_SCOPE");
  });
});

/**
 * The silhouette sub-sub-flag.
 *
 * It governs HOW a segment is cut, so it is inert without the segment store —
 * and inert is indistinguishable from mistaken from outside, which is why it
 * refuses rather than quietly doing nothing. Same shape as the flag above it,
 * one level deeper, and driven the same way: every refusing direction driven,
 * not described.
 */
describe("the delivered-anchored sub-flag", () => {
  it("is off by default and asserts nothing", () => {
    expect(parseCastingSegmentsDeliveredScope(undefined)).toEqual({ kind: "off" });
    expect(validateCastingSegmentsDeliveredEnvironment({
      scope: undefined,
      segmentsScope: "off",
    })).toEqual({ kind: "off" });
  });

  it("refuses anything it cannot read exactly", () => {
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "true"]) {
      expect(() => parseCastingSegmentsDeliveredScope(raw), raw)
        .toThrow(CastingSegmentsDeliveredScopeConfigurationError);
    }
  });

  it("refuses a scope reaching past the segment scope, in each way it can", () => {
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1",
      segmentsScope: undefined,
    })).toThrow(CastingSegmentsDeliveredCoverageError);
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "all",
      segmentsScope: "users:1",
    })).toThrow(CastingSegmentsDeliveredCoverageError);
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1,2",
      segmentsScope: "users:1",
    })).toThrow(/names users outside CASTING_SEGMENTS_SCOPE: 2/);
  });

  it("accepts the ask — user 1, inside a segment scope that already covers him", () => {
    expect(validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1",
      segmentsScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("reads the WHOLE chain at the point of use, not just its own flag", () => {
    const previous = { ...process.env };
    try {
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV] = "users:1";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(true);
      expect(deliveredAnchoredSegmentsEnabled(2)).toBe(false);

      /* Each parent turned off on its own must turn this off too — otherwise a
         segment could be cut a way its own store is not even armed for. */
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "off";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_V2_SCOPE_ENV] = "off";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);

      /* And absent is off, which is the state every deployment is in today. */
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      delete process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV];
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_SEGMENTS_DELIVERED_SCOPE_ENV).toBe("CASTING_SEGMENTS_DELIVERED_SCOPE");
  });
});

/**
 * The reference-library sub-flag (migration 0028).
 *
 * Its table lands on the production database by ceremony, so the flag is the
 * ordering device: the writers deploy dark, the table arrives, then the switch.
 * Every arm below is driven at a value it must REFUSE — a boot guard proved
 * only by the settings that pass it is a guard nobody has seen work, and this
 * codebase has crash-looped production on exactly that lesson from the other
 * direction.
 */
describe("the reference-library sub-flag", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingReferenceLibraryScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "true"]) {
      expect(() => parseCastingReferenceLibraryScope(raw), raw)
        .toThrow(CastingReferenceLibraryScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingReferenceLibraryEnvironment({
      scope: undefined,
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "off" });
  });

  it("refuses to arm without the cleanup worker", () => {
    /* A library row is a crop of a person's face at a permanently public URL.
       Without the worker, the purge its own write transaction promises would
       never actually happen. */
    expect(() => validateCastingReferenceLibraryEnvironment({
      scope: "users:1",
      castingScope: "users:1",
      cleanupWorker: undefined,
    })).toThrow(CastingReferenceLibraryCleanupWorkerError);
  });

  it("refuses to reach past the casting scope", () => {
    expect(() => validateCastingReferenceLibraryEnvironment({
      scope: "users:1",
      castingScope: "off",
      cleanupWorker: "true",
    })).toThrow(CastingReferenceLibraryCoverageError);
    expect(() => validateCastingReferenceLibraryEnvironment({
      scope: "all",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(CastingReferenceLibraryCoverageError);
    expect(() => validateCastingReferenceLibraryEnvironment({
      scope: "users:1,2",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingReferenceLibraryEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is enabled only when BOTH flags name the user", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    expect(captureCastingReferenceLibraryEnabled(1)).toBe(true);
    expect(captureCastingReferenceLibraryEnabled(2)).toBe(false);

    /* The point-of-use AND, which closes the second way a flag pair goes
       wrong: a boot check that was never invoked. */
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(captureCastingReferenceLibraryEnabled(1)).toBe(false);
  });

  it("reports armed without asking about a user — the retention sweep's read", () => {
    delete process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV];
    expect(castingReferenceLibraryArmed()).toBe(false);
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:7";
    expect(castingReferenceLibraryArmed()).toBe(true);
  });
});

describe("the compositor-swap sub-flag", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingRepaintScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "true"]) {
      expect(() => parseCastingRepaintScope(raw), raw)
        .toThrow(CastingRepaintScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingRepaintEnvironment({
      scope: undefined,
      libraryScope: undefined,
    })).toEqual({ kind: "off" });
  });

  it("refuses to repaint for a user who keeps no library", () => {
    /*
      The whole reason this flag hangs off the library rather than off the
      casting scope. A repaint pastes nothing back: a feature survives because
      the library holds a crop and the recipe carries it. Armed without one,
      every paid refine quietly forgets her features.
    */
    expect(() => validateCastingRepaintEnvironment({
      scope: "users:1",
      libraryScope: undefined,
    })).toThrow(CastingRepaintCoverageError);
    expect(() => validateCastingRepaintEnvironment({
      scope: "all",
      libraryScope: "users:1",
    })).toThrow(CastingRepaintCoverageError);
    expect(() => validateCastingRepaintEnvironment({
      scope: "users:1,2",
      libraryScope: "users:1",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingRepaintEnvironment({
      scope: "users:1",
      libraryScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingRepaintEnvironment({
      scope: "users:1",
      libraryScope: "all",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is enabled only when the WHOLE chain names the user", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    process.env[CASTING_REPAINT_SCOPE_ENV] = "users:1";
    expect(captureCastingRepaintEnabled(1)).toBe(true);
    expect(captureCastingRepaintEnabled(2)).toBe(false);

    /* Point-of-use, each link driven on its own: a boot check that was never
       invoked is the second way a flag pair goes wrong, and here there are
       three links rather than two. */
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "off";
    expect(captureCastingRepaintEnabled(1)).toBe(false);

    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(captureCastingRepaintEnabled(1)).toBe(false);

    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_REPAINT_SCOPE_ENV];
    expect(captureCastingRepaintEnabled(1)).toBe(false);
  });
});

describe("the auto-scan sub-flag", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingFaceScanScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "true"]) {
      expect(() => parseCastingFaceScanScope(raw), raw)
        .toThrow(CastingFaceScanScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingFaceScanEnvironment({
      scope: undefined,
      libraryScope: undefined,
    })).toEqual({ kind: "off" });
  });

  it("refuses to read a face for a user whose panel does not render", () => {
    /*
      The scan produces panel furniture and nothing else. Armed past the panel's
      own flag it is fourteen segmenter calls whose answer nobody can see —
      inert, and inert is indistinguishable from mistaken from outside.
    */
    expect(() => validateCastingFaceScanEnvironment({
      scope: "users:1",
      libraryScope: undefined,
    })).toThrow(CastingFaceScanCoverageError);
    expect(() => validateCastingFaceScanEnvironment({
      scope: "all",
      libraryScope: "users:1",
    })).toThrow(CastingFaceScanCoverageError);
    expect(() => validateCastingFaceScanEnvironment({
      scope: "users:1,2",
      libraryScope: "users:1",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingFaceScanEnvironment({
      scope: "users:1",
      libraryScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingFaceScanEnvironment({
      scope: "users:1",
      libraryScope: "all",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is enabled only when the WHOLE chain names the user", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    process.env[CASTING_FACE_SCAN_SCOPE_ENV] = "users:1";
    expect(captureCastingFaceScanEnabled(1)).toBe(true);
    expect(captureCastingFaceScanEnabled(2)).toBe(false);

    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "off";
    expect(captureCastingFaceScanEnabled(1)).toBe(false);

    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(captureCastingFaceScanEnabled(1)).toBe(false);

    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_FACE_SCAN_SCOPE_ENV];
    expect(captureCastingFaceScanEnabled(1)).toBe(false);
  });
});

/**
 * SAYING WHICH SIDE TWICE — the clause that names her side AND the half of the
 * picture it appears in (`V4_SIDE_INFERENCE_COURT.md` §3b).
 *
 * Every arm is driven directly rather than through a caller: a guard proved
 * only through the thing that uses it is a guard nobody has tested.
 */
describe("the side-phrasing scope", () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
  });

  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingSidePhrasingScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "on"]) {
      expect(() => parseCastingSidePhrasingScope(raw), raw)
        .toThrow(CastingSidePhrasingScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingSidePhrasingEnvironment({
      scope: undefined,
      repaintScope: undefined,
    })).toEqual({ kind: "off" });
  });

  it("refuses to place a side for a user whose renders are not repainted", () => {
    /*
      The clause is written by the repaint recipe and nothing else says it, so a
      user named here and not there would be armed for a sentence they cannot
      reach — an arming that changes nothing, which is indistinguishable from a
      mistake.
    */
    expect(() => validateCastingSidePhrasingEnvironment({
      scope: "users:1",
      repaintScope: undefined,
    })).toThrow(CastingSidePhrasingCoverageError);
    expect(() => validateCastingSidePhrasingEnvironment({
      scope: "all",
      repaintScope: "users:1",
    })).toThrow(CastingSidePhrasingCoverageError);
    expect(() => validateCastingSidePhrasingEnvironment({
      scope: "users:1,2",
      repaintScope: "users:1",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingSidePhrasingEnvironment({
      scope: "users:1",
      repaintScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is an AND of the whole chain where it is USED, not only at boot", () => {
    /* The boot check can only see the variables; this one sees the user, and a
       boot check that was never invoked is the second way a flag pair fails. */
    process.env.CASTING_SIDE_PHRASING_SCOPE = "users:1";
    process.env.CASTING_REPAINT_SCOPE = "users:1";
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "users:1";
    process.env.CASTING_V2_SCOPE = "all";
    expect(captureCastingSidePhrasingEnabled(1)).toBe(true);
    expect(captureCastingSidePhrasingEnabled(2)).toBe(false);

    process.env.CASTING_REPAINT_SCOPE = "off";
    expect(captureCastingSidePhrasingEnabled(1), "the parent going dark takes the child with it").toBe(false);
  });
});

/**
 * THE KEPT SCAN'S SCOPE (migration 0032).
 *
 * Two preconditions and one chain, each driven directly rather than through a
 * caller: a guard proved only through the thing that uses it is a guard nobody
 * has tested.
 */
describe("the scan-table scope", () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
  });

  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingScanTableScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "yes"]) {
      expect(() => parseCastingScanTableScope(raw), raw)
        .toThrow(CastingScanTableScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingScanTableEnvironment({
      scope: undefined,
      scanScope: undefined,
      cleanupWorker: undefined,
    })).toEqual({ kind: "off" });
  });

  it("refuses to keep a scan without the worker that would sweep its stencils", () => {
    /*
      A kept scan owns one small object per feature it found. A persisted
      artifact class whose purge is not running is precisely what the founder's
      storage condition forbids, and the segment store's precondition exists for
      the identical reason.
    */
    expect(() => validateCastingScanTableEnvironment({
      scope: "users:1",
      scanScope: "users:1",
      cleanupWorker: undefined,
    })).toThrow(CastingScanTableCleanupWorkerError);
    expect(() => validateCastingScanTableEnvironment({
      scope: "users:1",
      scanScope: "users:1",
      cleanupWorker: "TRUE",
    })).toThrow(CastingScanTableCleanupWorkerError);
  });

  it("refuses to keep scans for a user who produces none", () => {
    expect(() => validateCastingScanTableEnvironment({
      scope: "users:1",
      scanScope: undefined,
      cleanupWorker: "true",
    })).toThrow(CastingScanTableCoverageError);
    expect(() => validateCastingScanTableEnvironment({
      scope: "all",
      scanScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(CastingScanTableCoverageError);
    expect(() => validateCastingScanTableEnvironment({
      scope: "users:1,2",
      scanScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingScanTableEnvironment({
      scope: "users:1",
      scanScope: "users:1,2",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingScanTableEnvironment({
      scope: "users:1",
      scanScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is enabled only when the WHOLE chain names the user", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "users:1";
    process.env[CASTING_FACE_SCAN_SCOPE_ENV] = "users:1";
    process.env.CASTING_SCAN_TABLE_SCOPE = "users:1";
    expect(captureCastingScanTableEnabled(1)).toBe(true);
    expect(captureCastingScanTableEnabled(2)).toBe(false);

    process.env[CASTING_FACE_SCAN_SCOPE_ENV] = "off";
    expect(captureCastingScanTableEnabled(1), "no scan to keep").toBe(false);

    process.env[CASTING_FACE_SCAN_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFERENCE_LIBRARY_SCOPE_ENV] = "off";
    expect(captureCastingScanTableEnabled(1), "the grandparent going dark takes it too").toBe(false);
  });

  it("is ARMED by its own flag alone — the purge may not narrow with the chain", () => {
    /*
      The sweep reads `castingScanTableArmed` only to decide whether a MISSING
      table is tolerable, and it must answer for the flag itself rather than for
      the chain above it. Rows written while the parent was on have to be
      collectable after the parent goes off; a purge that narrows with a feature
      flag is how objects outlive the sheet that promised to destroy them.
    */
    process.env.CASTING_SCAN_TABLE_SCOPE = "users:1";
    process.env[CASTING_FACE_SCAN_SCOPE_ENV] = "off";
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(castingScanTableArmed()).toBe(true);

    process.env.CASTING_SCAN_TABLE_SCOPE = "off";
    expect(castingScanTableArmed()).toBe(false);
  });
});

describe("the refine dispatch scope — whether the paid half stops holding the request", () => {
  it("is off by default and refuses anything it cannot read exactly", () => {
    expect(parseCastingRefineDispatchScope(undefined)).toEqual({ kind: "off" });
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "true"]) {
      expect(() => parseCastingRefineDispatchScope(raw), raw)
        .toThrow(CastingRefineDispatchScopeConfigurationError);
    }
  });

  it("asserts nothing while absent", () => {
    expect(validateCastingRefineDispatchEnvironment({
      scope: undefined,
      castingScope: undefined,
    })).toEqual({ kind: "off" });
  });

  it("refuses to dispatch for a user who cannot reach a refine at all", () => {
    /*
      Its parent is the CASTING scope and not the repaint one, and the
      difference is deliberate: the swap is road-independent — it moves WHEN the
      answer arrives, never what is painted — so a paste-road user is a
      legitimate subject. What it cannot be is a user with no refine to
      dispatch, which is a flag armed over a door that is shut.
    */
    expect(() => validateCastingRefineDispatchEnvironment({
      scope: "users:1",
      castingScope: undefined,
    })).toThrow(CastingRefineDispatchCoverageError);
    expect(() => validateCastingRefineDispatchEnvironment({
      scope: "all",
      castingScope: "users:1",
    })).toThrow(CastingRefineDispatchCoverageError);
    expect(() => validateCastingRefineDispatchEnvironment({
      scope: "users:1,2",
      castingScope: "users:1",
    })).toThrow(/names users outside/);
  });

  it("accepts a scope its parent already covers", () => {
    expect(validateCastingRefineDispatchEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingRefineDispatchEnvironment({
      scope: "users:1",
      castingScope: "all",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("is enabled only when the whole chain names the user", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "users:1";
    process.env[CASTING_REFINE_DISPATCH_SCOPE_ENV] = "users:1";
    expect(captureCastingRefineDispatchEnabled(1)).toBe(true);
    expect(captureCastingRefineDispatchEnabled(2)).toBe(false);

    /* The point-of-use AND, driven on its own link: a boot check nobody
       invoked is the second way a flag pair goes wrong. */
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(captureCastingRefineDispatchEnabled(1)).toBe(false);
  });
});
