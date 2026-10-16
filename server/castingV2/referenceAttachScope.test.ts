/**
 * THE ATTACH DOOR'S FLAG, driven directly.
 *
 * Its siblings' grammar and its siblings' boot guards, and both halves are
 * proven here for invariant 7's reason: a control that is not invoked does not
 * exist, and a boot guard nobody drove is a control nobody has seen refuse.
 *
 * The arm that carries the most weight is the LAST one. This flag keeps whole
 * photographs of people, and the two things standing between that and a leak
 * are the cleanup worker (which eventually deletes the bytes) and the repaint
 * scope (without which the picture could never appear on her at all). If either
 * guard stopped refusing, nothing would go red anywhere else — the door would
 * simply open onto a road with no sweep at the end of it.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
  CastingReferenceAttachCoverageError,
  CastingReferenceAttachScopeConfigurationError,
  captureCastingReferenceAttachEnabled,
  castingReferenceAttachArmed,
  parseCastingReferenceAttachScope,
  validateCastingReferenceAttachEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
  "CASTING_REFERENCE_LIBRARY_SCOPE",
  "CASTING_V2_SCOPE",
] as const;

const saved = new Map<string, string | undefined>();
function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>): void {
  for (const key of KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe("the grammar is the siblings' grammar", () => {
  it("reads off, all and a user list — and ABSENT is off", () => {
    expect(parseCastingReferenceAttachScope(undefined).kind).toBe("off");
    expect(parseCastingReferenceAttachScope("off").kind).toBe("off");
    expect(parseCastingReferenceAttachScope("all").kind).toBe("all");
    expect(parseCastingReferenceAttachScope("users:1,7")).toEqual({ kind: "users", userIds: [1, 7] });
  });

  it("stops startup on a malformed value rather than half-enabling", () => {
    for (const bad of ["users:", "users:0", "users:1,1", "on", "true", "1"]) {
      expect(() => parseCastingReferenceAttachScope(bad), bad)
        .toThrow(CastingReferenceAttachScopeConfigurationError);
    }
  });
});

describe("the boot guards refuse", () => {
  const OPEN = { scope: "users:1", referenceLibraryScope: "users:1", cleanupWorker: "true" };

  it("admits the configuration that is actually coherent — the carve-out", () => {
    /* Working law 2 again: a validator proven only by its refusals could be
       one that refuses everything, and nobody would find out until a deploy. */
    expect(validateCastingReferenceAttachEnvironment(OPEN)).toEqual({ kind: "users", userIds: [1] });
  });

  it("refuses without the cleanup worker — an attachment is bytes we keep", () => {
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, cleanupWorker: undefined }))
      .toThrow(CastingReferenceAttachCoverageError);
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, cleanupWorker: "yes" }))
      .toThrow(/ENABLE_STORAGE_CLEANUP_WORKER/);
  });

  it("refuses while its parent is off — the door would open onto a wall", () => {
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, referenceLibraryScope: undefined }))
      .toThrow(/CASTING_REFERENCE_LIBRARY_SCOPE is off/);
  });

  it("refuses to reach past its parent, in both of the ways a scope can", () => {
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, scope: "all" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, scope: "users:1,9" }))
      .toThrow(/names users outside/);
  });

  it("says nothing about anything while it is off — the whole chain is skipped", () => {
    /* Off is off: an unconfigured deployment must boot, and a flag that
       refused startup while disabled would make the dark landing impossible. */
    expect(validateCastingReferenceAttachEnvironment({
      scope: undefined, referenceLibraryScope: undefined, cleanupWorker: undefined,
    }).kind).toBe("off");
  });
});

describe("the AND is taken at the point of use, not only at boot", () => {
  it("is closed for everyone while the flag is absent", () => {
    setEnv({ CASTING_V2_SCOPE: "all" });
    expect(captureCastingReferenceAttachEnabled(1)).toBe(false);
    expect(castingReferenceAttachArmed()).toBe(false);
  });

  it("opens only for a named user who is ALSO in the reference library", () => {
    /*
      ⚠ THE NARROW FLAG IN THIS FIXTURE USED TO BE THE REPAINT and is now the
      reference library (#1577 slice 4a). That is not bookkeeping: with the
      library at `users:1,2` and the repaint at `users:1`, user 2 was refused
      before the re-parent and is admitted after it, so leaving the fixture as it
      was would have asserted the OLD chain and gone red — which it did, and is
      how the change got its own control below.
    */
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
      [CASTING_REFERENCE_ATTACH_SCOPE_ENV]: "users:1,2",
    });
    expect(captureCastingReferenceAttachEnabled(1)).toBe(true);
    /*
      USER 2 IS NAMED HERE AND NOT IN THE REFERENCE LIBRARY, and is refused
      anyway. This is the arm that makes the runtime check worth having: the boot
      guard would have caught this configuration, but a boot guard only runs at
      boot, and a variable changed on a live service does not re-run it.
    */
    expect(captureCastingReferenceAttachEnabled(2)).toBe(false);
    expect(captureCastingReferenceAttachEnabled(3)).toBe(false);
    /* Armed is about the flag alone — the retention sweep reads it to decide
       whether a MISSING TABLE is tolerable, which is a different question. */
    expect(castingReferenceAttachArmed()).toBe(true);
  });

  /*
    ⚠ THE ONLY BEHAVIOUR #1577 SLICE 4a CHANGED, DRIVEN IN THE DIRECTION THAT
    PROVES IT — the attach door no longer hangs off the repaint flag.

    Every arm above would pass just as well if the chain still ran through the
    repaint, because production holds both flags wide enough to hide it. So this
    one drives the repaint DARK and asserts the door stays open: after the
    audit's slice 4b deletes that flag, this is the behaviour the three children
    must already have had.
  */
  it("is no longer gated on the repaint flag — the point of the re-parent", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
      [CASTING_REFERENCE_ATTACH_SCOPE_ENV]: "users:1",
    });
    expect(
      captureCastingReferenceAttachEnabled(1),
      "the repaint going dark must NOT close the attach door any more",
    ).toBe(true);

    /* And the boot fence reads the parent separately from the runtime predicate,
       so it gets its own assertion rather than being assumed to agree. */
    expect(validateCastingReferenceAttachEnvironment({
      scope: "all",
      referenceLibraryScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "all" });
  });
});
