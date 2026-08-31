/**
 * HIS "NOT RELEVANT" TAPS — read and written (issue #325, second half).
 *
 * Founder, 2026-08-31: *"should there be a delete icon next to them so i can
 * close them or remove them myself if they are not relevant?"*
 *
 * # ⚠ THIS MODULE IS HIS HALF OF THE TABLE, AND ONLY HIS HALF
 *
 * `crew_card_intents` has two writers split by column (migration 0059):
 *
 *   * HIS — `intent`, `markedByUserId`, `markedAt`, `withdrawnAt`. This file.
 *   * THE SHIFTS' — `resolution`, `resolutionNote`, `resolvedAt`. Written only
 *     by `scripts/crew-card-intents.mts --resolve`, never from a procedure.
 *
 * **There is deliberately no `resolveCardIntent` here**, and its absence is the
 * control: a mutation that could mark an intent resolved would let the page
 * answer its own question, and the second pair of eyes his card asks for would
 * be the same pair. `server/crewShiftWriterBoundary.test.ts` reddens if either
 * road crosses into the other's columns.
 *
 * # ⚠ AND IT DEGRADES ON AN ABSENT TABLE RATHER THAN THROWING
 *
 * `crew.getState` is the ONE call the whole Crew tab makes. Production takes
 * this table by a ceremony that is a founder act, so there is a real window in
 * which this code is deployed and the table is not there — and an unrescued
 * throw in that window is a blank page for the founder, to report that a tap is
 * missing. `server/db/crewWorkSwitches.ts` made the same call for the same
 * reason (#272, #277); the 2026-07-31 boot-guard incident is the law.
 */
import { and, desc, eq, isNull } from "drizzle-orm";

import { crewCardIntents } from "../../drizzle/schema";
import {
  CREW_CARD_INTENT_KEYS,
  type CrewCardIntentView,
} from "../../shared/crewCardIntents";
import { getDb, type DbInstance } from "./connection";

/** MySQL's "table doesn't exist". */
const ER_NO_SUCH_TABLE = "ER_NO_SUCH_TABLE";

/**
 * Whether the driver's code appears anywhere on this error's `cause` chain.
 *
 * Walks `cause` — the code arrives wrapped at some call sites and bare at
 * others, a chain that has caught this repository before (the driver-error-code
 * memory). A string match on the message is deliberately not used: "doesn't
 * exist" appears in errors that are not this one.
 */
function carriesCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let hop = 0; hop < 5 && current; hop += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** What the page gets. `available: false` is "no table yet", not "he has tapped nothing". */
export type CrewCardIntentState = {
  readonly available: boolean;
  readonly intents: readonly CrewCardIntentView[];
};

async function requireDb(): Promise<DbInstance> {
  const db = await getDb();
  if (!db) throw new Error("no database connection — the card intents cannot be read or written");
  return db;
}

/**
 * Every intent, newest first — an explicit projection (invariant 8).
 *
 * ⚠ **`markedByUserId` IS NOT SELECTED, AND THAT IS DELIBERATE RATHER THAN
 * TIDY.** The Crew tab is admin-gated and he is the only person who can tap,
 * so the id would tell the page nothing it does not already know — and a user
 * id crossing a serialization boundary for decoration is precisely how
 * `passwordHash` once reached `auth.me`. It is written, it is auditable at the
 * row, and it does not travel.
 *
 * ⚠ **A ROW WHOSE `intent` THE VOCABULARY DOES NOT NAME IS SKIPPED**, the same
 * rule `readCrewWorkState` applies to an unknown switch key: an intent nobody
 * can draw could only be noise — a renamed meaning leaving its old row behind,
 * or a hand-written row — and skipping is the direction where nothing acts on
 * something no code understands.
 */
export async function readCrewCardIntents(): Promise<CrewCardIntentState> {
  const db = await getDb();
  /* No database at all is a configuration fault rather than an absent table —
     but it is also not something to take the whole Crew tab down for, since the
     briefing renders from a file and his replies would have failed first.
     `listCrewShiftRuns` makes the same call for the same reason.

     ⚠ The WRITER below deliberately does NOT do this: a tap that silently did
     nothing and returned success is the lie this whole panel exists to avoid. */
  if (!db) return { available: false, intents: [] };

  try {
    const rows = await db
      .select({
        issueNumber: crewCardIntents.issueNumber,
        intent: crewCardIntents.intent,
        markedAt: crewCardIntents.markedAt,
        withdrawnAt: crewCardIntents.withdrawnAt,
        resolution: crewCardIntents.resolution,
        resolutionNote: crewCardIntents.resolutionNote,
        resolvedAt: crewCardIntents.resolvedAt,
      })
      .from(crewCardIntents)
      .orderBy(desc(crewCardIntents.markedAt));

    return {
      available: true,
      intents: rows
        .filter((row) => (CREW_CARD_INTENT_KEYS as readonly string[]).includes(row.intent))
        .map((row) => ({
          issueNumber: row.issueNumber,
          intent: row.intent,
          markedAt: row.markedAt,
          withdrawnAt: row.withdrawnAt ?? null,
          /* A resolution the vocabulary does not name reads as "not answered
             yet" rather than as an answer nobody can render — the failure
             direction where he is told a shift looked when none did is the one
             that matters. */
          resolution:
            row.resolution === "closed" || row.resolution === "declined" ? row.resolution : null,
          resolutionNote: row.resolutionNote ?? null,
          resolvedAt: row.resolvedAt ?? null,
        })),
    };
  } catch (error) {
    if (carriesCode(error, ER_NO_SUCH_TABLE)) return { available: false, intents: [] };
    throw error;
  }
}

/**
 * Record his tap, or take it back — an upsert on `issueNumber`.
 *
 * ⚠ **TAKING IT BACK IS AN UPDATE, NEVER A DELETE.** His card's rule for cards
 * is *"CLOSE, never DELETE"*; the same is applied to the intent, so a tap he
 * withdrew is still a thing he once said about that card and a shift that
 * already acted keeps its reason beside it.
 *
 * ⚠ **AND A WITHDRAWAL DOES NOT UNDO A SHIFT'S ANSWER.** If a shift has already
 * resolved the row, `withdrawnAt` is still set — he is entitled to say he no
 * longer wants it — but `resolution` is left exactly as the shift wrote it. The
 * alternative would let a tap erase the record of what was done and why, on a
 * page whose whole job is telling him what happened.
 *
 * ⚠ **RE-TAPPING A RESOLVED ROW CLEARS THE RESOLUTION**, and that is the one
 * place this writer touches a shift's column. It has to: the row is unique per
 * card, so without it a card a shift declined could never be tapped again and
 * his second ask would land nowhere. The clearing is total — note and timestamp
 * with it — so no half of a stale answer survives beside a fresh intent.
 */
export async function setCrewCardIntent(input: {
  issueNumber: number;
  /** `null` withdraws. */
  intent: string | null;
  markedByUserId: number;
}): Promise<CrewCardIntentView | null> {
  const db = await requireDb();

  if (input.intent === null) {
    await db
      .update(crewCardIntents)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          eq(crewCardIntents.issueNumber, input.issueNumber),
          /* Withdrawing twice must not move the timestamp: the moment he first
             took it back is the fact, and a second tap is a no-op rather than a
             fresh one. */
          isNull(crewCardIntents.withdrawnAt),
        ),
      );
  } else {
    const fresh = {
      intent: input.intent,
      markedByUserId: input.markedByUserId,
      markedAt: new Date(),
      withdrawnAt: null,
      resolution: null,
      resolutionNote: null,
      resolvedAt: null,
    };
    await db
      .insert(crewCardIntents)
      .values({ issueNumber: input.issueNumber, ...fresh })
      .onDuplicateKeyUpdate({ set: fresh });
  }

  const [row] = await db
    .select({
      issueNumber: crewCardIntents.issueNumber,
      intent: crewCardIntents.intent,
      markedAt: crewCardIntents.markedAt,
      withdrawnAt: crewCardIntents.withdrawnAt,
      resolution: crewCardIntents.resolution,
      resolutionNote: crewCardIntents.resolutionNote,
      resolvedAt: crewCardIntents.resolvedAt,
    })
    .from(crewCardIntents)
    .where(eq(crewCardIntents.issueNumber, input.issueNumber))
    .limit(1);

  /* Null only where he withdrew a tap that was never recorded — the page
     already draws that card as untouched, so there is nothing to say. */
  if (!row) return null;

  return {
    issueNumber: row.issueNumber,
    intent: row.intent,
    markedAt: row.markedAt,
    withdrawnAt: row.withdrawnAt ?? null,
    resolution: row.resolution === "closed" || row.resolution === "declined" ? row.resolution : null,
    resolutionNote: row.resolutionNote ?? null,
    resolvedAt: row.resolvedAt ?? null,
  };
}
