import { describe, expect, it, vi } from "vitest";

/**
 * THE FOUR CORNERS of deletion in a shared-sheet world (D-107).
 *
 * §G.6 said "purge source roll lineage" and that sentence was written when one
 * sheet made one Cast. Two Casts can come from one sheet and they share
 * everything behind them — the session, the rolls, and each other's kept faces
 * as Siblings-card content. The corners are where the old sentence breaks:
 *
 *   delete a sheet with 0 signed Casts   everything releases
 *   delete a sheet with 1 signed Cast    she and her siblings survive
 *   delete a sheet with 2 signed Casts   both survive, both sets of siblings
 *   delete 1 of 2 Casts sharing a sheet  the survivor's room stays whole
 *
 * The last one is the founder's edge case and the reason the principle had to
 * be stated: purge what only the deleted thing owns, preserve what anything
 * living still owns.
 */

type Row = Record<string, unknown>;

/** The statements the purge issued, in order, so intent is assertable. */
type Journal = { kind: string; set?: Row; where: string }[];

function fakeTx(state: {
  candidate: Row | null;
  survivor: Row | null;
  sessionStatus?: string;
  journal: Journal;
}) {
  const capture = (kind: string, set?: Row) => ({
    where: (clause: unknown) => {
      state.journal.push({ kind, set, where: String(clause) });
      return { affectedRows: 3 } as unknown as Promise<unknown>;
    },
  });
  let selectShape: "candidate" | "session" | "survivor" = "candidate";
  return {
    select(fields: Row) {
      // The three reads are told apart by the columns they ask for.
      const keys = Object.keys(fields ?? {});
      // Told apart by the columns each read asks for: the candidate wants its
      // session, the session read wants its status, the survivor wants an id.
      selectShape = keys.includes("sessionId")
        ? "candidate"
        : keys.includes("status") ? "session" : "survivor";
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.from = (table: unknown) => {
        // The survivor read is the only one that joins.
        if (String(table).includes("casting_sessions")) selectShape = "session";
        return chain;
      };
      chain.innerJoin = () => { selectShape = "survivor"; return chain; };
      chain.where = self;
      chain.limit = () => {
        if (selectShape === "candidate") return Promise.resolve(state.candidate ? [state.candidate] : []);
        if (selectShape === "survivor") return Promise.resolve(state.survivor ? [state.survivor] : []);
        const session = [{ id: 1, status: state.sessionStatus ?? "open" }];
        return Object.assign(Promise.resolve(session), {
          for: () => Promise.resolve(session),
        });
      };
      return chain;
    },
    update: (_table: unknown) => ({ set: (set: Row) => capture("update", set) }),
  } as never;
}

const { purgeCastLineageIn } = await import("./castLineagePurge");

const readSource = async () => {
  const fs = await import("node:fs/promises");
  return fs.readFile(new URL("./castLineagePurge.ts", import.meta.url), "utf8");
};

async function run(options: {
  candidate: Row | null;
  survivor: Row | null;
  sessionStatus?: string;
  sourceCandidateId?: number | null;
}) {
  const journal: Journal = [];
  const tx = fakeTx({
    candidate: options.candidate,
    survivor: options.survivor,
    sessionStatus: options.sessionStatus,
    journal,
  });
  const result = await purgeCastLineageIn(tx, {
    userId: 1,
    modelId: 900,
    sourceCandidateId: options.sourceCandidateId === undefined ? 55 : options.sourceCandidateId,
  });
  return { result, journal };
}

describe("deletion purges what only the deleted thing owns", () => {
  it("puts her back on a live sheet, ready to be signed again", async () => {
    /*
      THE FOUNDER'S QUESTION, and it was the right one: why can't deleting a
      Cast just remove her being signed, so you could go into the same sheet and
      sign her again?

      Nothing about the candidate belonged to the Cast. Sign COPIES the chosen
      image to a Cast-owned object, so deleting the Cast destroys the copy and
      leaves the sheet's own face untouched. The row, the image and the 20
      credits that produced it belong to the SHEET — bought with the roll, not
      with the Sign. Deleting a Cast undoes the Sign; it does not spend the
      candidate twice.
    */
    const { journal } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "open",
    });

    // ONE statement, and it restores rather than releases.
    expect(journal).toHaveLength(1);
    expect(journal[0].set).toEqual({
      signedCastId: null, status: "ready", expiredReason: null,
    });
  });

  it("keeps a surviving Cast's siblings when another Cast shares the sheet", async () => {
    /*
      THE FOUNDER'S EDGE CASE. Two Casts from one sheet, delete one: the
      survivor's Siblings card is made of kept candidates on that same sheet,
      and purging "the lineage" would empty her room for a deletion that had
      nothing to do with her.
    */
    const { result, journal } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: { id: 56 },
      sessionStatus: "open",
    });

    expect(result.siblingCastsSurvive).toBe(true);
    // Nothing is released at all: one restore, no expiry.
    expect(journal).toHaveLength(1);
    expect(journal[0].set).toMatchObject({ status: "ready" });
  });

  it("LEAVES A LIVE SHEET ALONE, even when no Cast survives it", async () => {
    /*
      THE DEFECT THIS REPLACES, and it reached the founder's own roster.

      The first version released every unsigned candidate on the session
      whenever no sibling Cast survived — borrowing the rule from
      `expireSessionCandidates`, which is written for a sheet that is EXPIRING.
      Applied on Cast deletion it emptied sheets the founder was still working
      on: seven of eight tiles on one roll flipped to "Didn't arrive ·
      refunded", which was false twice over. They HAD arrived, and nothing was
      refunded.

      D-107's own words are the correction: preserve what anything living still
      owns. An OPEN sheet is a living thing and its candidates belong to it.
    */
    const { result, journal } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "open",
    });

    expect(result.siblingCastsSurvive).toBe(false);
    // Nothing is expired. She simply becomes available again.
    expect(journal).toHaveLength(1);
    expect(journal[0].set).toMatchObject({ status: "ready" });
    expect(result.candidatesReleased).toBe(0);
  });

  it("releases the remainder only when the sheet is dead too", async () => {
    /*
      The genuine §G.6 case: an expired or abandoned session whose candidates
      survived only because a Cast was keeping them alive. Now she is gone and
      nothing is left to protect them.
    */
    const { result } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "expired",
    });

    expect(result.siblingCastsSurvive).toBe(false);
    expect(result.candidatesReleased).toBeGreaterThan(0);
  });

  it("RETIRES her when the sheet is dead — a signed row with no Cast is a ghost", async () => {
    /*
      THE FOUNDER'S GHOST SIBLING (fable-367 §1), and it was in his own data:
      candidate `ea5b4811` on Shina's expired sheet, `status = 'signed'`,
      `signedCastId = NULL`, and no `models` row anywhere claiming it.

      The dead-sheet branch used to clear the link and leave the status alone,
      which left a row claiming a Cast that had just been deleted. She kept
      appearing on Shina's SIBLINGS card, her tile fell through to the viewer
      because the destination reads `signedCastId`, and — worst of the three —
      no sweep could ever collect her: every release lists
      ready/queued/dispatched/failed/discarded, and `signed` is in none of them.
      The release below says "her own candidate always goes" and she was the one
      row that could not.
    */
    const { journal } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "expired",
    });

    expect(journal[0].set).toEqual({
      signedCastId: null, status: "expired", expiredReason: "retention",
    });
    /* `retention` and not the refundable flavour: she was delivered, looked at,
       and signed. The money question was settled long before the deletion. */
    expect(journal[0].set).toMatchObject({ expiredReason: "retention" });
  });

  it("retires her to a status the siblings card cannot show", async () => {
    /*
      The cross-check that makes the fix mean what it claims, read from the
      sibling query's OWN list rather than from a second copy of it. If anyone
      ever widens what a siblings card shows, this reddens here — which is the
      only place that would notice.
    */
    const { SIBLING_VISIBLE_STATUSES } = await import("../db/castingV2Sign");
    const { journal } = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "expired",
    });

    const retired = (journal[0].set as { status?: string }).status;
    expect(retired).toBeTruthy();
    expect(SIBLING_VISIBLE_STATUSES).not.toContain(retired);
    /* And the live-sheet path deliberately DOES land on a visible one — she
       goes back in the tray and can be signed again. A test that only proved
       the exclusion would pass if this ceremony retired everybody. */
    const live = await run({
      candidate: { id: 55, sessionId: 7 },
      survivor: null,
      sessionStatus: "open",
    });
    expect(SIBLING_VISIBLE_STATUSES).toContain((live.journal[0].set as { status?: string }).status);
  });

  it("collects her with the rest of the sheet rather than leaving one row behind", async () => {
    /*
      The release's status list and the status she is retired to are two halves
      of one promise — "her own candidate always goes". Asserted at the source,
      because what matters is that no reachable status sits outside every
      sweep's list: that is the shape that made her immortal.
    */
    const source = await readSource();
    const release = source.slice(source.indexOf("const released = releaseWholeSheet"));
    /* Whatever she is set to must be a TERMINAL state — one the release does
       not need to touch — rather than a live one it silently skips. */
    expect(release).toContain('inArray(castingCandidates.status, ["queued", "dispatched", "ready", "failed", "discarded"])');
    expect(source).not.toMatch(/:\s*\{\s*signedCastId:\s*null\s*\}\)/);
  });

  it("guards inside the statement that writes, never in a check before it", async () => {
    /*
      Invariant 1. Read at the source rather than through the mock, because what
      matters is that the protection is part of the UPDATE — a check-then-write
      would pass every behavioural test here and still lose the race.
    */
    const source = await readSource();
    const release = source.slice(source.indexOf("const released = releaseWholeSheet"));
    expect(release).toContain("isNull(castingCandidates.signedCastId)");
    expect(release).toContain("eq(castingCandidates.userId, input.userId)");
    // And it only runs at all when the sheet is dead — a live sheet never
    // reaches this statement.
    expect(release).toContain("releaseWholeSheet");
  });

  it("does nothing at all for a Cast with no V2 lineage", async () => {
    /*
      A legacy Cast has no candidate. This is an EXTENSION to one deletion
      authority, so the legacy path must pass through it untouched rather than
      having to survive a new step.
    */
    const { result, journal } = await run({
      candidate: null,
      survivor: null,
      sourceCandidateId: null,
    });

    expect(result).toEqual({ sessionId: null, siblingCastsSurvive: false, candidatesReleased: 0 });
    expect(journal).toHaveLength(0);
  });

  it("takes the session lock the Sign ceremony takes", async () => {
    /*
      The serialization point. `signCandidateIntoCast` selects the session row
      FOR UPDATE, so a Sign racing this either committed first — and is visible
      to the liveness test — or waits behind us and finds its candidate no
      longer `ready`, failing cleanly with its money refunded.
    */
    const source = await readSource();
    expect(source).toContain('.for("update")');
    /*
      Liveness is `deletedAt IS NULL`, never `availableModelWhere()` — a sibling
      Cast mid-package is `provisioning`, which that helper excludes, and
      counting her as dead would purge the faces her room is about to show.
      Asserted on the IMPORTS, since the prose above names the helper precisely
      in order to warn about it.
    */
    expect(source).toContain("isNull(models.deletedAt)");
    const imports = source.slice(0, source.indexOf("export type"));
    expect(imports).not.toContain("modelAvailability");
  });
});
