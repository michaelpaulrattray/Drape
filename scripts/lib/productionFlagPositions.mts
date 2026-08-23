/**
 * WHERE EVERY ROLLOUT FLAG IS SUPPOSED TO STAND ON PRODUCTION — declared here,
 * compared against the service by the deploy rite on every push.
 *
 * # Why this file exists
 *
 * `CLAUDE.md` is the page every seat reads first, and its feature-gated section
 * describes each flag in prose: what it darkens, what its parent is, and — in
 * several paragraphs — an instruction about when it may be flipped or widened.
 * **Nothing ever compared those sentences to what the service actually holds.**
 * Measured 2026-08-23, two of them had gone stale in the worst direction: they
 * read as PROHIBITIONS on things the founder had already authorised and the
 * mailbox had already executed.
 *
 *   CASTING_INK_CUT_SCOPE    the page said *"it should not be flipped for
 *                            anyone until 3a.2(b) lands"*. He had closed the
 *                            frames gate himself — *"yes its acceptable"* — and
 *                            replaced that with a narrower condition of his own,
 *                            HIS ACCOUNT ONLY until the preview ships
 *                            (fable-1257 §1). It was flipped to `users:1` on
 *                            that word (fable-1260) and has stood there since.
 *   CASTING_INK_WORDS_SCOPE  the page said *"do not widen this flag on the
 *                            strength of this paragraph"* and called it armed
 *                            ahead of its own court. The court had run and been
 *                            ratified, he had judged the frames, and the flip to
 *                            `all` went through HIS OWN HAND (fable-1400) — the
 *                            first capability this program has taken from
 *                            `users:1` to `all`.
 *
 * A third seat reading `CLAUDE.md` today would have concluded that production
 * was misconfigured in two places. Both rulings landed in a mailbox message and
 * neither reached the document, which is `PROTOCOL.md`'s own law: *a ruling is
 * landed when it is written where the next person will act on it.*
 *
 * # Why a declared table and not a derivation
 *
 * Working law 4 says derive rather than mirror, and this is the case the law
 * does not cover: **the production environment is not in the repository.** There
 * is nothing here to derive from. So this is a declaration of INTENT, and its
 * whole value is that a machine compares it to reality at the one moment the
 * reality is being read anyway. A row is not documentation — it is the claim
 * that gets tested.
 *
 * # The two directions it fails in, and neither is silent
 *
 *   a row disagrees with the service   either someone flipped a flag without
 *                                      recording it, or the record went stale.
 *                                      Both are one line to fix and both are
 *                                      exactly what this exists to catch.
 *   the service holds a governed
 *   variable this table does not name  the list stopped being the list. Its
 *                                      NAME is reported and never its value.
 *
 * ⚠ **The rite reports these AFTER printing its whole receipt and then exits
 * nonzero.** Deliberate: the deploy has already landed by the time the flags are
 * read, so refusing early would only destroy the receipt. What a mismatch takes
 * away is the ability of a custody block to say `RITE EXIT STATUS: OK`, which is
 * the thing that gets quoted.
 *
 * ⚠ **VALUES ARE PRINTED ONLY FOR NAMES ON THIS TABLE.** The rite's flag block
 * used to filter the service's variables by NAME PREFIX (`CASTING_`, `R7_`,
 * `ENABLE_STORAGE_CLEANUP_WORKER`), which is a rule about what to include rather
 * than a list of what is safe to show — and it had already drifted: a set
 * `ENABLE_EVIDENCE_CANDIDATE_WORKER` would not have matched it. An allowlist of
 * known-harmless names is the only safe shape for anything that prints a
 * production variable's value at all (`never-filter-a-secret-listing`).
 *
 * # Keeping it current
 *
 * `server/productionFlagPositions.test.ts` refuses a table that does not cover
 * every flag the code declares, and refuses a row with no reason. Change a
 * position here in the same commit that flips it, with the ruling that
 * authorised it named — the reason field is where a future seat learns whether
 * a position is a decision or an accident.
 */

export type FlagPosition = {
  /** What the service is expected to hold. `off` means the variable is unset. */
  readonly position: string;
  /** Why it stands there — name the ruling, not the feature. */
  readonly why: string;
};

/**
 * Read off the production service by the deploy rite on 2026-08-23, receipt
 * `output/deploy-receipts/2026-08-22T23-47-05-342Z-22284.txt`, and reconciled
 * row by row against the ruling that put each one where it is.
 */
export const PRODUCTION_FLAG_POSITIONS: Readonly<Record<string, FlagPosition>> = {
  CASTING_V2_SCOPE: {
    position: "all",
    why: "the program's own door; open to every account since the V2 rollout",
  },
  CASTING_REPAINT_SCOPE: {
    position: "all",
    why: "the compositor swap (D-241), widened past users:1 — fable-1253",
  },
  CASTING_REFERENCE_LIBRARY_SCOPE: {
    position: "all",
    why: "the repaint's parent; a repaint carries features by crop and needs it",
  },
  CASTING_INK_WORDS_SCOPE: {
    position: "all",
    why:
      "his own hand, fable-1400, after the court (opus-960 / fable-1301) and his "
      + "verdicts on the frames and the thirteen styles (fable-1398). The FIRST "
      + "capability this program took from users:1 to all",
  },
  CASTING_INK_STUDIO_SCOPE: {
    position: "users:1",
    why:
      "the widening tripwire (fable-1052 §2) — it does not pass users:1 while "
      + "uploads ride uncropped to the plate mint; the sole account behind it is his",
  },
  CASTING_INK_CUT_SCOPE: {
    position: "users:1",
    why:
      "his verbatim yes, fable-1257 §1 — his account only until the "
      + "customer-facing preview (3a.2(b)) ships; flipped fable-1260",
  },
  CASTING_INK_REFERENCE_SCOPE: {
    position: "users:1",
    why: "flipped with the cut road on the same word, fable-1257 §2b / fable-1260",
  },
  CASTING_INK_REGION_CROP_SCOPE: {
    position: "users:1",
    why:
      "rode with the pair because the object his yes approved is the SURFACE cut, "
      + "which only this flag produces — fable-1260 §2",
  },
  CASTING_INK_TRANSFORM_SCOPE: {
    position: "users:1",
    why: "the transform road (fable-1274), his account while the road settles",
  },
  CASTING_HAIR_REFERENCE_SCOPE: {
    position: "users:1",
    why: "taking hair from an attached picture; his account",
  },
  CASTING_REFERENCE_ATTACH_SCOPE: {
    position: "users:1",
    why: "the door that takes her picture at all; parent of the two reference lanes",
  },
  CASTING_OPEN_LANE_SCOPE: { position: "users:1", why: "the open lane; his account" },
  CASTING_FACE_SCAN_SCOPE: {
    position: "users:1",
    why: "the auto-scan spends house money per version looked at",
  },
  CASTING_SCAN_TABLE_SCOPE: {
    position: "users:1",
    why: "keeps a finished scan (migration 0032, ceremony run)",
  },
  CASTING_SEGMENTS_SCOPE: {
    position: "users:1",
    why: "the segment store (migration 0025, ceremony run)",
  },
  CASTING_SIDE_PHRASING_SCOPE: {
    position: "users:1",
    why: "per-side positional phrasing on the repaint lane",
  },
  CASTING_REFINE_DISPATCH_SCOPE: {
    position: "users:1",
    why: "Landing C — the paid half of a refine stops holding the request",
  },
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE: {
    position: "users:1",
    why: "keeps the frame from a refused render, on the private evidence adapter",
  },
  CASTING_SEGMENTS_DELIVERED_SCOPE: {
    position: "off",
    why: "never flipped on production; additive and inert while off",
  },
  CASTING_TWO_PATHS_SCOPE: {
    position: "off",
    why: "the flip waits on a 320-credit dev court and then his eyes",
  },
  CASTING_BORN_INK_SCOPE: {
    position: "off",
    why:
      "7b(a); widening it re-opens the NOTES_MAX park first (fable-1431 §1) — the "
      + "cap population IS the born-ink population",
  },
  ENABLE_STORAGE_CLEANUP_WORKER: {
    position: "true",
    why: "required by every scope that keeps bytes under a purge path",
  },
  /* ⚠ THESE TWO WERE THIS TABLE'S FIRST TWO ERRORS, AND THE INSTRUMENT CAUGHT
     THEM ON ITS FIRST RUN AGAINST THE REAL SERVICE. Both rows said `off`,
     because I wrote them from the rite's own flag block — and the rite's block
     was the prefix filter this commit replaces, which cannot match either name.
     `opus-204` (2026-08-11) had already read all three `ENABLE_` keys BY A
     SECOND, SEPARATE SWEEP, noting in as many words that *the CASTING pattern
     cannot see them*, and recorded both as `true` and deliberate. That
     knowledge was lost, and `opus-1078` re-derived "not set" from the blind
     block twelve days later — which is how CLAUDE.md came to say it. */
  ENABLE_EVIDENCE_CANDIDATE_WORKER: {
    position: "true",
    why:
      "true since at least 2026-08-11 (opus-204's separate ENABLE_ sweep), and "
      + "inert: R7_EVIDENCE_COMPOSER_SCOPE is off, so the worker has nothing to do",
  },
  ENABLE_FINAL_MODEL_DELETE: {
    position: "true",
    why:
      "permanent Cast deletion, LIVE for every account — it is a boolean with no "
      + "per-user narrowing (assertFinalModelDeleteEnabled, server/routes/models.ts). "
      + "True since at least 2026-08-11 (opus-204), deliberate, and absent from "
      + "CLAUDE.md entirely until 2026-08-23",
  },
  R7_SNAPSHOT_READ_SCOPE: { position: "all", why: "the R7-7B snapshot reader rollout, complete" },
  R7_SNAPSHOT_RESTORE_SCOPE: {
    position: "users:1",
    why: "the restore half; must stay a subset of the read scope",
  },
  R7_EVIDENCE_INGEST_SCOPE: {
    position: "users:1",
    why: "evidence ingest on the private adapter, his account",
  },
  R7_EVIDENCE_COMPOSER_SCOPE: { position: "off", why: "the composer's runtime door, unopened" },
  R7_EVIDENCE_PACKAGE_SCOPE: {
    position: "off",
    why:
      "evidence-aware package sync; evidenceAcceptedAssetMigrationCeremony REFUSES "
      + "to run unless this is off",
  },
  R7_EVIDENCE_COMPOSER_RECIPE: {
    position: "ink.add.front_upper_torso.v1",
    why:
      "WHICH recipe the composer runs. Inert while R7_EVIDENCE_COMPOSER_SCOPE is "
      + "off — the one row here that is not a scope, and it is on the table because "
      + "the service holds it",
  },
};

/** Absent from the service means off — every scope paragraph says so. */
export const UNSET = "off";

export type FlagReading = { readonly name: string; readonly value: string };

/**
 * Parse `railway variables --kv` output into readings.
 *
 * Only the NAME is taken from every line; the value is kept, but nothing here
 * decides what is printed — {@link PRODUCTION_FLAG_POSITIONS} is the allowlist
 * and the caller prints from that.
 */
export function parseVariableLines(raw: string): FlagReading[] {
  const readings: FlagReading[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const split = trimmed.indexOf("=");
    if (split <= 0) continue;
    const name = trimmed.slice(0, split);
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    readings.push({ name, value: trimmed.slice(split + 1) });
  }
  return readings;
}

/** Anything the service could be holding that this table ought to govern. */
const GOVERNED_NAME = /^[A-Z0-9_]*(SCOPE|STAGE)[A-Z0-9_]*$/;

export type PositionVerdict = {
  /** One line per governed flag, in table order, for the receipt. */
  readonly block: string[];
  /** Empty when the service stands where this file says it does. */
  readonly mismatches: string[];
};

/**
 * Compare the service's readings against the declared positions.
 *
 * Returns rather than throws: the caller prints its receipt first and carries
 * the verdict in its exit status, because the deploy has already landed by the
 * time anyone can read a flag.
 */
export function comparePositions(readings: readonly FlagReading[]): PositionVerdict {
  const held = new Map(readings.map((reading) => [reading.name, reading.value]));
  const block: string[] = [];
  const mismatches: string[] = [];

  for (const [name, expected] of Object.entries(PRODUCTION_FLAG_POSITIONS)) {
    const actual = held.get(name) ?? UNSET;
    block.push(`  ${name}=${held.has(name) ? actual : "<unset>"}`);
    if (actual !== expected.position) {
      mismatches.push(
        `${name}: the service holds \`${actual}\`, this record says \`${expected.position}\` (${expected.why})`,
      );
    }
  }

  /* The other direction: a governed variable nobody wrote down. Its NAME only —
     an unrecognised variable is exactly the one whose value must not be shown. */
  for (const reading of readings) {
    if (reading.name in PRODUCTION_FLAG_POSITIONS) continue;
    if (!GOVERNED_NAME.test(reading.name)) continue;
    mismatches.push(
      `${reading.name}: set on the service and absent from this table — a flag that exists and is not on the list is how the list stops being the list (value deliberately not printed)`,
    );
  }

  return { block, mismatches };
}
