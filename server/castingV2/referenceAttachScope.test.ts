/**
 * THE ATTACH DOOR'S FLAG, driven directly.
 *
 * Its siblings' grammar and its siblings' boot guards, and both halves are
 * proven here for invariant 7's reason: a control that is not invoked does not
 * exist, and a boot guard nobody drove is a control nobody has seen refuse.
 *
 * The arm that carries the most weight is the LAST one. This flag keeps whole
 * photographs of people, and the two things standing between that and a leak
 * are the cleanup worker (which eventually deletes the bytes) and the parent
 * scope (without which the picture could never appear on the cast at all). If
 * either guard stopped refusing, nothing would go red anywhere else — the door
 * would simply open onto a road with no sweep at the end of it.
 *
 * ⚠ THAT PARENT HAS MOVED TWICE AND THE ARMS MOVED WITH IT: the repaint scope
 * until #1577 slice 4a, the reference library until slice D5, and
 * `CASTING_V2_SCOPE` now. Each dying gate ENDED in the one that replaced it, so
 * no position production holds ever answered differently — but a fixture left
 * pointing at a retired flag would be a narrowing that no longer narrows, and
 * an arm that passes because its own lever stopped working is worse than a
 * missing arm. That is why every parent value below is a casting scope.
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
  const OPEN = { scope: "users:1", castingScope: "users:1", cleanupWorker: "true" };

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
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, castingScope: undefined }))
      .toThrow(/CASTING_V2_SCOPE is off/);
  });

  it("names the surviving parent in its refusal, not either retired one", () => {
    expect(() => validateCastingReferenceAttachEnvironment({ ...OPEN, castingScope: undefined }))
      .not.toThrow(/CASTING_REFERENCE_LIBRARY_SCOPE|CASTING_REPAINT_SCOPE/);
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
      scope: undefined, castingScope: undefined, cleanupWorker: undefined,
    }).kind).toBe("off");
  });
});

describe("the AND is taken at the point of use, not only at boot", () => {
  it("is closed for everyone while the flag is absent", () => {
    setEnv({ CASTING_V2_SCOPE: "all" });
    expect(captureCastingReferenceAttachEnabled(1)).toBe(false);
    expect(castingReferenceAttachArmed()).toBe(false);
  });

  it("opens only for a named user who is ALSO inside the casting scope", () => {
    /*
      ⚠ THE NARROW FLAG IN THIS FIXTURE HAS BEEN THREE DIFFERENT THINGS: the
      repaint, then the reference library (#1577 slice 4a), and now the casting
      scope (slice D5). Each move mattered rather than being bookkeeping —
      narrowing on a flag the predicate no longer reads makes this arm pass
      because its lever is dead, which is the quietest way a chain assertion
      rots. Here the narrowing is real: user 2 is named by the attach flag and
      is NOT inside `CASTING_V2_SCOPE`.
    */
    setEnv({
      CASTING_V2_SCOPE: "users:1",
      [CASTING_REFERENCE_ATTACH_SCOPE_ENV]: "users:1,2",
    });
    expect(captureCastingReferenceAttachEnabled(1)).toBe(true);
    /*
      USER 2 IS NAMED HERE AND NOT INSIDE THE CASTING SCOPE, and is refused
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
    ⚠ THE BEHAVIOUR EACH RE-PARENT CHANGED, DRIVEN IN THE DIRECTION THAT PROVES
    IT — the attach door hangs off NEITHER retired flag.

    Every arm above would pass just as well if the chain still ran through the
    repaint or the library, because production held both wide enough to hide it.
    This one pins both retired names in the environment at `off` and asserts the
    door ignores them: with `CASTING_V2_SCOPE` open and the attach flag naming
    the user, a dead variable must not close anything. ⚠ It is written with
    STRING keys on purpose — neither env const exists any more, which is the
    whole point — and it reddens the day a predicate reads a retired flag again.
  */
  it("ignores both retired parents — the point of the two re-parents", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      [CASTING_REFERENCE_ATTACH_SCOPE_ENV]: "users:1",
    });
    process.env.CASTING_REPAINT_SCOPE = "off";
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "off";
    try {
      expect(
        captureCastingReferenceAttachEnabled(1),
        "neither retired flag may close the attach door",
      ).toBe(true);
    } finally {
      delete process.env.CASTING_REPAINT_SCOPE;
      delete process.env.CASTING_REFERENCE_LIBRARY_SCOPE;
    }

    /* And the boot fence reads the parent separately from the runtime predicate,
       so it gets its own assertion rather than being assumed to agree. */
    expect(validateCastingReferenceAttachEnvironment({
      scope: "all",
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "all" });
  });
});
