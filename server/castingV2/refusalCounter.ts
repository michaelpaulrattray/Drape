/**
 * EVERY REFUSAL A USER CAN EXPERIENCE LEAVES A COUNTABLE ARTIFACT
 * (fable-498 §4/§5 — the D-236 sibling).
 *
 * # The finding this closes
 *
 * A free refusal writes no row, deliberately: a zero-credit row is noise in the
 * ledger and a phantom for the recovery sweep. So its only record was a log
 * line — and this shift proved what that is worth. Asked for the rate at which
 * the containment guard refuses honest asks, the answer was that it cannot be
 * read at all: `railway logs --since 12h` returns the eleven lines of the
 * container that started six minutes ago, because ten deploys rotated the
 * window the founder's own refusal happened in.
 *
 * D-236 already ruled that an affirmative needs an artifact. This is its
 * sibling: **a refusal needs one too, or the guard that produces it is
 * unfalsifiable by construction.**
 *
 * # Why the audit log and not a new table
 *
 * A new table is a production migration, and a migration is a founder ceremony.
 * `audit_logs` already exists, is already the home of "something happened that
 * nobody should have to reconstruct", and carries exactly the three fields a
 * count needs: an action, a resource, and a JSON metadata bag. No schema
 * change, no ceremony, countable tonight.
 *
 * # WHAT IT MAY NEVER CARRY, and this is the whole care of it
 *
 * Not the instruction. Not the value the model produced. Staff can read audit
 * logs, and a customer's own words about her own face are the creative content
 * the moderator boundary keeps out of staff surfaces — the same rule that keeps
 * `masterPrompt` out of the admin projections. The REASON and the FACET are
 * enough to count with, and neither is her sentence.
 *
 * A counter that breaks a refusal would be worse than no counter, so every
 * failure here is swallowed and logged: the customer's answer never waits on
 * the bookkeeping.
 */
import { createModuleLogger } from "../logging/logger";
import { logAuditEvent } from "../auditLog";
import { AUDIT_ACTIONS, auditLogs } from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../db/connection";

const log = createModuleLogger("castingV2/refusalCounter");

/** The one action string every casting refusal is filed under. */
export const REFUSAL_ACTION = AUDIT_ACTIONS.CASTING_REFUSAL;

export type RefusalOutcome =
  /** The refusal stood, and the customer read it. */
  | "refused"
  /**
   * THE INVENTION DOOR'S TWO OUTCOMES, first-class (fable-498 §4).
   *
   * `rescued` — containment refused, the door read the value as saying only
   * what she asked, and the ask went through. `upheld` — the door agreed with
   * containment. The ratio between them IS the honest-ask-refused rate the
   * guard's redesign has to be judged on, measured continuously from the day
   * this lands rather than reconstructed afterwards from logs that no longer
   * exist.
   */
  | "rescued"
  | "upheld";

export async function countRefusal(input: {
  userId: number;
  /** The candidate the ask was about — a public id, never a face's contents. */
  candidateId: string;
  /** The refusal's own reason, from the parse or the road. */
  reason: string;
  /** The facet or subject it was raised about, where there is one. */
  facet?: string | null;
  outcome: RefusalOutcome;
}): Promise<void> {
  try {
    await logAuditEvent({
      userId: input.userId,
      action: REFUSAL_ACTION,
      resourceType: "casting_candidate",
      resourceId: input.candidateId,
      /* Reason, facet, outcome — and nothing she typed. */
      metadata: {
        reason: input.reason,
        ...(input.facet ? { facet: input.facet } : {}),
        outcome: input.outcome,
      },
      severity: "info",
    });
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 160), reason: input.reason },
      "[refusalCounter] a refusal could not be counted — the refusal itself is unaffected",
    );
  }
}

/**
 * THE COUNT, READ BACK — what the reliability report asks this table.
 *
 * Grouped by reason and outcome, because the two questions the redesign has to
 * answer are "how often does this guard fire" and "how often was it wrong":
 * `rescued` over `rescued + upheld` IS the honest-ask-refused rate, measured
 * continuously rather than reconstructed from logs that no longer exist.
 */
export type RefusalTally = {
  reason: string;
  outcome: RefusalOutcome;
  count: number;
};

export async function refusalTallies(input: {
  since: Date;
  userId?: number;
}): Promise<RefusalTally[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.action, REFUSAL_ACTION),
      gte(auditLogs.createdAt, input.since),
      ...(input.userId === undefined ? [] : [eq(auditLogs.userId, input.userId)]),
    ));
  const tally = new Map<string, RefusalTally>();
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as { reason?: unknown; outcome?: unknown };
    const reason = typeof meta.reason === "string" ? meta.reason : "unknown";
    const outcome: RefusalOutcome = meta.outcome === "rescued" || meta.outcome === "upheld"
      ? meta.outcome
      : "refused";
    const key = `${reason}:${outcome}`;
    const held = tally.get(key);
    if (held) held.count += 1;
    else tally.set(key, { reason, outcome, count: 1 });
  }
  return Array.from(tally.values()).sort((a, b) => b.count - a.count);
}
