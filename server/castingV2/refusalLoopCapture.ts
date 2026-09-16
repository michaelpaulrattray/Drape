/**
 * KEEP THE WORDS THAT WERE REFUSED — the refusal loop's slice 1 (#129).
 *
 * # The bill this pays
 *
 * His order (Crew reply #8): *"log every refused and passed prompt, find
 * trigger words, measured word→replacement pairs into the author's rewrite
 * list."* Measured before a line was built (foreman-20260916-1735, on #129):
 * production held **26 refused slices and the words of none of them.** The
 * sent prompt is written onto the candidate row at creation, but a refused
 * candidate is `failed`, dies with its SESSION on the idle sweep, and takes the
 * words with it; what survives (`generations.errorMessage = 'content_policy'`)
 * carries the class and not the sentence. Every attribution attempt on this
 * brief so far — four of them — had to BUY renders, because there was never a
 * corpus to read.
 *
 * # The design, decided by the relay on #129 (2026-09-16 17:50 AEST)
 *
 * - **Where.** An object per slice in the PRIVATE evidence bucket, never a
 *   column and never `generation_operations` (whose "raw prompts are never
 *   stored here" stands unreversed). The composed prompt is the cast's recipe
 *   in sentences — the `masterPrompt` class — so it goes where a customer
 *   artefact kept for diagnosis goes, beside the refused-frame capture.
 * - **How long.** 30 days, on the existing cleanup manifest, born HELD until
 *   then: the worker's own state machine collects object and row together when
 *   the hold lapses. No new sweeper.
 * - **Which rolls.** Only a roll with at least one REFUSAL. Its refused slices
 *   and its passed slices are both kept, because the patrol needs the pair; a
 *   wholly-passed roll writes nothing. **Both roads that dispatch a slice call
 *   it** (review of PR #1007, finding 1): the roll, including a roll whose
 *   dispatch was partly abandoned (its settled slices are still kept), and the
 *   Retry — a refused retry is kept, and so is a retry that PASSES on words
 *   refused before, which is the pair in its purest form.
 * - **Who reads it.** The patrol (slice 2, not built) and nobody else. No staff
 *   projection — `server/staffImageBoundary.test.ts` holds that by name.
 * - **Deletion.** `collectAccountOwnedStorageItemsIn` adds these keys to the
 *   account-delete manifest, so a deleted account's words go at once rather
 *   than on the 30-day clock.
 *
 * # Two declared departures from the design's letter
 *
 * 1. **No new row table.** The design names "a row carrying the owner, the
 *    operation, the candidate, the outcome, the sha256 and the length". The
 *    manifest's item row already carries the owner (its batch) and the key,
 *    and the key carries the operation, the candidate and the OUTCOME
 *    (`…/<candidate>.refused.json`), so a census of the corpus is a read of
 *    rows that never opens a customer's sentence. The hash and length live in
 *    the object beside the text. That keeps slice 1 free of a migration; if the
 *    patrol finds it needs them as columns, that is its card.
 * 2. **Its own flag is not minted.** It rides `CASTING_DIAGNOSTIC_CAPTURE_SCOPE`
 *    — keep the evidence behind a refused render, on the private bucket, under
 *    the purge promise — because that is exactly what this is, and it already
 *    carries the boot guard this needs (bucket configured, cleanup worker on).
 *    Production holds it at `users:1`, which is his account and the one the
 *    register runs on.
 *
 * # It can never break a roll
 *
 * Every path returns rather than throws. It runs after the slices have settled
 * and their refunds are recorded; a capture failure is logged and dropped.
 */
import { createHash, randomUUID } from "node:crypto";

import { createModuleLogger } from "../logging/logger";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import { parsePrivateEvidenceStorageConfig } from "../casting/evidence/privateEvidenceStorage";
import {
  CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV,
  diagnosticCaptureEnabledFor,
  privateEvidenceWriter,
  type DiagnosticWriter,
} from "./diagnosticCapture";

const log = createModuleLogger("castingV2/refusalLoopCapture");

/** Keys live under this prefix and nowhere else. */
export const REFUSAL_LOOP_KEY_PREFIX = "casting-v2/refusal-loop";

/** The design's window: 30 days, then the worker collects object and row. */
export const REFUSAL_LOOP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The provider class that means REFUSED, as opposed to failed for any other reason. */
export const REFUSAL_FAILURE_CLASS = "content_policy";

export type RefusalLoopOutcome = "refused" | "passed";

export type RollSliceWords = {
  candidatePublicId: string;
  /** The prompt handed to the engine for this slice, verbatim. */
  prompt: string;
  /** The settlement's outcome — `ready`, `failed`, `expired`, `skipped`. */
  outcome: string;
  failureClass?: string;
};

/** The key for one slice. Owner-scoped, and the outcome is readable without opening it. */
export function refusalLoopKey(input: {
  userId: number;
  operationId: string;
  candidatePublicId: string;
  outcome: RefusalLoopOutcome;
}): string {
  return `${REFUSAL_LOOP_KEY_PREFIX}/${input.userId}/${input.operationId}/${input.candidatePublicId}.${input.outcome}.json`;
}

/**
 * Which slices of this roll are kept, and as what.
 *
 * Nothing unless at least one slice was REFUSED. Then every refused slice and
 * every delivered one. A slice that failed for any other reason (transport, the
 * account, a capability error) is neither a refusal nor a pass and teaches the
 * patrol nothing about words, so it is left out; so is a cancelled one.
 */
export function slicesToKeep(
  slices: readonly RollSliceWords[],
  /**
   * These words were REFUSED on an earlier attempt (a Retry of a refused tile),
   * so a pass now is the other half of the pair even with no refusal in hand.
   */
  refusedBefore = false,
): Array<RollSliceWords & { kept: RefusalLoopOutcome }> {
  const refused = (slice: RollSliceWords) =>
    slice.outcome === "failed" && slice.failureClass === REFUSAL_FAILURE_CLASS;
  if (!refusedBefore && !slices.some(refused)) return [];
  return slices.flatMap((slice): Array<RollSliceWords & { kept: RefusalLoopOutcome }> => {
    if (slice.prompt.length === 0) {
      /* A slice with no words cannot teach the patrol anything — but a corpus
         holding a pass without its refused sibling must not be silent about
         why. Today dispatch reads the same map, so this should never fire. */
      if (refused(slice) || slice.outcome === "ready") {
        log.warn(
          { candidate: slice.candidatePublicId, outcome: slice.outcome },
          "[refusalLoopCapture] a kept slice had no prompt — its words are missing from the corpus",
        );
      }
      return [];
    }
    if (refused(slice)) return [{ ...slice, kept: "refused" as const }];
    if (slice.outcome === "ready") return [{ ...slice, kept: "passed" as const }];
    return [];
  });
}

/** Reserve every key under one held manifest. Injected so a test can drive the failure. */
export type RefusalLoopReserver = (input: {
  userId: number;
  storageKeys: readonly string[];
  heldUntil: Date;
}) => Promise<void>;

const defaultReserver: RefusalLoopReserver = async (input) => {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    userId: input.userId,
    /* Synthetic, like the kept face scan's and the hair carrier's: the column
       is unique and NOT NULL, and the roll's own operation id is in every key.
       Using the roll's id would collide with any manifest that operation ever
       needs for itself. */
    operationId: randomUUID(),
    /* BORN HELD FOR THE WHOLE WINDOW — and the hold is the retention. A held
       batch is unclaimable until it lapses, so the worker neither deletes the
       words early nor needs a rule of its own to delete them late. */
    heldUntil: input.heldUntil,
    kind: "casting_diagnostic_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "private_evidence_r2" as const,
    })),
  }));
};

export type CapturedRollWords = {
  captured: number;
  keys: string[];
  reason?: string;
};

/**
 * Keep the sent words of a roll that had a refusal, if capture is live for
 * this user. Returns what happened; never throws.
 */
export async function captureRollWords(input: {
  userId: number;
  operationId: string;
  rollPublicId: string;
  slices: readonly RollSliceWords[];
  /** A Retry of a tile whose words were refused before — see `slicesToKeep`. */
  refusedBefore?: boolean;
  /** Injected by tests; production builds one from the private bucket config. */
  writer?: DiagnosticWriter;
  /** Injected by tests; production reserves a real held manifest. */
  reserve?: RefusalLoopReserver;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}): Promise<CapturedRollWords> {
  try {
    const env = input.env ?? process.env;
    if (!diagnosticCaptureEnabledFor(input.userId, env[CASTING_DIAGNOSTIC_CAPTURE_SCOPE_ENV])) {
      return { captured: 0, keys: [], reason: "not in scope" };
    }
    const kept = slicesToKeep(input.slices, input.refusedBefore === true);
    if (kept.length === 0) return { captured: 0, keys: [], reason: "no refusal" };

    let writer = input.writer;
    if (!writer) {
      const config = parsePrivateEvidenceStorageConfig(env);
      if (!config) {
        log.error(
          { operationId: input.operationId },
          "[refusalLoopCapture] in scope with no private bucket — the boot guard was bypassed",
        );
        return { captured: 0, keys: [], reason: "unconfigured" };
      }
      writer = privateEvidenceWriter(config, "application/json");
    }

    const now = input.now ?? new Date();
    const planned = kept.map((slice) => ({
      slice,
      key: refusalLoopKey({
        userId: input.userId,
        operationId: input.operationId,
        candidatePublicId: slice.candidatePublicId,
        outcome: slice.kept,
      }),
    }));

    /*
      RESERVED BEFORE ANYTHING IS WRITTEN, all at once — the refused-frame
      capture's ordering, for its reason: an object can never exist without a
      row instructed to delete it. If the reservation fails nothing is put.
    */
    try {
      await (input.reserve ?? defaultReserver)({
        userId: input.userId,
        storageKeys: planned.map((entry) => entry.key),
        heldUntil: new Date(now.getTime() + REFUSAL_LOOP_RETENTION_MS),
      });
    } catch (error) {
      log.warn(
        { err: error, operationId: input.operationId },
        "[refusalLoopCapture] could not reserve the words for cleanup — NOT storing them",
      );
      return { captured: 0, keys: [], reason: "unreserved" };
    }

    const written = await Promise.all(planned.map(async ({ slice, key }) => {
      const body = {
        version: 1,
        userId: input.userId,
        operationId: input.operationId,
        rollPublicId: input.rollPublicId,
        candidatePublicId: slice.candidatePublicId,
        outcome: slice.kept,
        failureClass: slice.kept === "refused" ? slice.failureClass : null,
        promptSha256: createHash("sha256").update(slice.prompt, "utf8").digest("hex"),
        promptLength: slice.prompt.length,
        prompt: slice.prompt,
        capturedAt: now.toISOString(),
      };
      try {
        await writer({ key, bytes: Buffer.from(JSON.stringify(body), "utf8") });
        return key;
      } catch (error) {
        log.warn(
          { err: error, operationId: input.operationId, candidate: slice.candidatePublicId },
          "[refusalLoopCapture] could not store a slice's words — dropping them",
        );
        return null;
      }
    }));
    const keys = written.filter((key): key is string => key !== null);

    /* Counts only. The words themselves never reach a log line. */
    log.info(
      {
        operationId: input.operationId,
        refused: kept.filter((slice) => slice.kept === "refused").length,
        passed: kept.filter((slice) => slice.kept === "passed").length,
        stored: keys.length,
      },
      "[refusalLoopCapture] kept the words behind a refusal",
    );
    return { captured: keys.length, keys };
  } catch (error) {
    log.warn(
      { err: error, operationId: input.operationId },
      "[refusalLoopCapture] capture failed — the roll is unaffected",
    );
    return { captured: 0, keys: [], reason: "error" };
  }
}
