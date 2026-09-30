/**
 * THE REPLY MIRROR'S SWEEP — one pass over the replies nobody has carried to
 * GitHub yet (#1539).
 *
 * This is a MODULE — no I/O of its own, no exits, no clock. GitHub and the
 * state file are injected, so `server/crewReplyMirror.test.ts` drives the
 * awkward shapes (a post that throws, a crash between posting and recording, a
 * card the briefing no longer holds) without a network or a database.
 * `scripts/crew-mirror-replies.mts` is the only thing that can fail.
 *
 * # THE WATERLINE, AND WHY IT IS NOT THE GUARD
 *
 * The state file carries `lastMirroredId`: every reply at or below it is
 * settled, one way or another. It exists so a run that has nothing to do costs
 * one indexed `SELECT` a minute and not a walk of the whole thread.
 *
 * ⚠ **IT IS AN INDEX AND NEVER THE IDEMPOTENCY GUARD.** The file lives on one
 * machine. The guard is the marker in the comment itself
 * (`crewReplyMirrorMarker`), read back off the card before anything is posted —
 * so *did this already post* is answered by the artifact rather than by our
 * record of the artifact. The two disagree in exactly one real case and it is
 * the one that matters: the post lands, the process dies before the file is
 * written, and the next run finds the marker and advances instead of
 * double-posting his words.
 *
 * # ORDER IS KEPT, AND A FAILURE STOPS THE PASS
 *
 * His replies arrive in order and read in order, so the sweep works ascending
 * and **stops at the first reply it could not settle** rather than skipping
 * ahead. The next run retries that same reply. A pass that jumped the failure
 * would put reply #241 on a card above #240 and leave the gap to be filled
 * later, out of sequence, which is a worse record than a minute's delay.
 *
 * # ⚠ AND IT CANNOT WEDGE, WHICH IS THE OTHER HALF OF THAT DECISION
 *
 * A target that will NEVER accept a comment — an issue deleted, transferred,
 * or a number typed into `cardId` that was never a card — would otherwise hold
 * the waterline forever and silence every reply behind it. So a reply that has
 * failed `maxAttempts` times is ABANDONED: recorded in the state with its
 * reason and the time, reported to the caller, and stepped over. Nothing is
 * ever dropped quietly — the CLI prints the abandoned list on every run and
 * exits 2 while it is non-empty, which is this repository's "this is a finding"
 * code rather than a failure.
 *
 * At the one-minute cadence the default of 30 attempts means a GitHub outage
 * under half an hour costs nothing at all, and a genuinely dead target costs
 * half an hour of retries nobody notices.
 */
import {
  crewReplyIsMirrored,
  crewReplyMirrorComment,
  crewReplyMirrorTarget,
  type CrewReplyForMirror,
} from "../../shared/crewReplyMirror.js";

/** A reply as the sweep needs it: the comment's ingredients plus its address. */
export type SweepReply = CrewReplyForMirror & { readonly cardId: string | null };

/** One reply the mirror has given up on, kept so it can never vanish. */
export type AbandonedReply = {
  readonly replyId: number;
  readonly issueNumber: number;
  readonly attempts: number;
  readonly reason: string;
  readonly at: string;
};

/**
 * What the machine remembers between runs.
 *
 * `seededAt` records the INSTALLATION, not a run: a fresh state starts at the
 * newest reply because the card's scope says *no mirroring of OLD replies*,
 * and the day that happened is a fact a later reader will want rather than
 * have to infer from a gap.
 */
export type MirrorState = {
  readonly lastMirroredId: number;
  /** replyId (as a string key, because JSON) → consecutive failures. */
  readonly attempts: Readonly<Record<string, number>>;
  readonly abandoned: readonly AbandonedReply[];
  readonly seededAt: string | null;
};

/** The outside world, injected so the arms can be unkind to it. */
export type SweepIo = {
  /** Every comment body on a card, for the marker check. */
  readonly readComments: (issueNumber: number) => Promise<readonly string[]>;
  readonly postComment: (issueNumber: number, body: string) => Promise<void>;
  /** ISO 8601, for the abandonment record. Injected so an arm is not a clock. */
  readonly now: () => string;
};

/** What happened to one reply on this pass. */
export type SweepOutcome =
  | { readonly kind: "posted"; readonly replyId: number; readonly issueNumber: number; readonly body: string }
  | { readonly kind: "already"; readonly replyId: number; readonly issueNumber: number }
  | { readonly kind: "skipped"; readonly replyId: number; readonly reason: string }
  | {
    readonly kind: "retry";
    readonly replyId: number;
    readonly issueNumber: number;
    readonly attempt: number;
    readonly reason: string;
  }
  | { readonly kind: "abandoned"; readonly replyId: number; readonly issueNumber: number; readonly reason: string };

export type SweepResult = {
  readonly state: MirrorState;
  readonly outcomes: readonly SweepOutcome[];
  /** The reply the pass stopped on, or null when it reached the end. */
  readonly stoppedAt: number | null;
};

/** An empty machine memory — `lastMirroredId` 0 means *nothing settled yet*. */
export function emptyMirrorState(): MirrorState {
  return { lastMirroredId: 0, attempts: {}, abandoned: [], seededAt: null };
}

const errorText = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * One pass.
 *
 * Ascending by id, defensively sorted rather than trusted: the waterline is
 * only correct if the walk is ordered, and a caller's `ORDER BY` is one edit
 * away from being the bug. Replies at or below the waterline are dropped here
 * too, so a caller that over-selects cannot re-post.
 */
export async function sweepReplyMirror(
  replies: readonly SweepReply[],
  issueNumberByCardId: ReadonlyMap<string, number | null>,
  state: MirrorState,
  io: SweepIo,
  maxAttempts = 30,
): Promise<SweepResult> {
  const pending = [...replies]
    .filter((reply) => reply.id > state.lastMirroredId)
    .sort((left, right) => left.id - right.id);

  const outcomes: SweepOutcome[] = [];
  const attempts: Record<string, number> = { ...state.attempts };
  const abandoned: AbandonedReply[] = [...state.abandoned];
  let waterline = state.lastMirroredId;
  let stoppedAt: number | null = null;

  for (const reply of pending) {
    const target = crewReplyMirrorTarget(reply.cardId, issueNumberByCardId);

    if (target.kind === "skip") {
      outcomes.push({ kind: "skipped", replyId: reply.id, reason: target.reason });
      waterline = reply.id;
      continue;
    }

    const { issueNumber } = target;
    try {
      const comments = await io.readComments(issueNumber);
      if (crewReplyIsMirrored(comments, reply.id)) {
        /* The crash-between-post-and-record case, and the only reason the read
           above is worth its API call. */
        outcomes.push({ kind: "already", replyId: reply.id, issueNumber });
        waterline = reply.id;
        continue;
      }

      const body = crewReplyMirrorComment(reply);
      await io.postComment(issueNumber, body);
      outcomes.push({ kind: "posted", replyId: reply.id, issueNumber, body });
      waterline = reply.id;
    } catch (cause) {
      const attempt = (attempts[String(reply.id)] ?? 0) + 1;
      const reason = errorText(cause);
      if (attempt >= maxAttempts) {
        abandoned.push({ replyId: reply.id, issueNumber, attempts: attempt, reason, at: io.now() });
        outcomes.push({ kind: "abandoned", replyId: reply.id, issueNumber, reason });
        /* Stepped over rather than retried forever — see the header. The
           waterline moves so the replies behind it are not silenced too. */
        delete attempts[String(reply.id)];
        waterline = reply.id;
        continue;
      }
      attempts[String(reply.id)] = attempt;
      outcomes.push({ kind: "retry", replyId: reply.id, issueNumber, attempt, reason });
      stoppedAt = reply.id;
      break;
    }
    /* A reply that settled has no failure history worth keeping. */
    delete attempts[String(reply.id)];
  }

  /* Any counter left below the waterline belongs to a reply that has since
     settled or been abandoned; dropping them stops the file growing forever
     with keys nothing will ever read again. */
  for (const key of Object.keys(attempts)) {
    if (Number(key) <= waterline) delete attempts[key];
  }

  return {
    state: { lastMirroredId: waterline, attempts, abandoned, seededAt: state.seededAt },
    outcomes,
    stoppedAt,
  };
}
