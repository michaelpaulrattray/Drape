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
      selectShape = keys.includes("sessionId")
        ? "candidate"
        : keys.length === 1 && keys[0] === "id" ? "session" : "survivor";
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
        return Object.assign(Promise.resolve([{ id: 1 }]), {
          for: () => Promise.resolve([{ id: 1 }]),
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
  sourceCandidateId?: number | null;
}) {
  const journal: Journal = [];
  const tx = fakeTx({ candidate: options.candidate, survivor: options.survivor, journal });
  const result = await purgeCastLineageIn(tx, {
    userId: 1,
    modelId: 900,
    sourceCandidateId: options.sourceCandidateId === undefined ? 55 : options.sourceCandidateId,
  });
  return { result, journal };
}

describe("deletion purges what only the deleted thing owns", () => {
  it("clears her signed linkage before anything asks whether she is protected", async () => {
    /*
      Order is the whole trick. While `signedCastId` still points at this model
      her candidate reads as "signed" to every protection downstream, including
      the release statement's own guard — so the linkage must go first, or her
      own face is the one thing deletion cannot release.
    */
    const { journal } = await run({ candidate: { id: 55, sessionId: 7 }, survivor: null });

    expect(journal).toHaveLength(2);
    expect(journal[0].set).toEqual({ signedCastId: null });
    expect(journal[1].set).toMatchObject({ status: "expired" });
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
    });

    expect(result.siblingCastsSurvive).toBe(true);
    // Still exactly two statements — the linkage clear and one narrowed
    // release. A survivor never earns the purge a second pass.
    expect(journal).toHaveLength(2);
    expect(journal[1].set).toMatchObject({ status: "expired" });
  });

  it("releases the whole unsigned remainder when no Cast survives the sheet", async () => {
    // A sheet that protects nothing protects nothing — the same rule the
    // retention sweep applies, asked the same way.
    const { result } = await run({ candidate: { id: 55, sessionId: 7 }, survivor: null });

    expect(result.siblingCastsSurvive).toBe(false);
    expect(result.candidatesReleased).toBeGreaterThan(0);
  });

  it("guards inside the statement that writes, never in a check before it", async () => {
    /*
      Invariant 1. Read at the source rather than through the mock, because what
      matters is that the protection is part of the UPDATE — a check-then-write
      would pass every behavioural test here and still lose the race.
    */
    const source = await readSource();
    const release = source.slice(source.indexOf("const released = await tx"));
    expect(release).toContain("isNull(castingCandidates.signedCastId)");
    expect(release).toContain("eq(castingCandidates.userId, input.userId)");
    // And the kept-sibling protection is a clause on that same statement.
    expect(release).toContain("keptAt");
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
