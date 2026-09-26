/**
 * Ceremony — mark legacy author-road identity records `unsent` (#179).
 *
 *   npx tsx scripts/ceremony-author-road-unsent.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-author-road-unsent.mts --production
 *
 * A DATA ceremony, not a schema one: no migration file, no DDL. It repairs the
 * residue PR #178 (#176) deliberately left behind — rows written on the author
 * road BEFORE the compiler learned to mark its per-slice dice output
 * `unsent: true`. Those records describe what was ROLLED, never what was
 * DELIVERED (one authored prompt paints all eight), and the consumers that
 * read the candidate row alone — refine pronouns, relative-ask facet values,
 * the panel routes — still believe them on unmarked rows. The founder followed
 * a visibly Mediterranean man whose record claimed South Asian and got eight
 * Indian "relatives"; that consumer is gated in code, these are not.
 *
 * For every candidate (and variant, if any exist by then) whose roll's
 * `compiledBrief.register.kind = 'author'`: set
 * `internalPrompt.resolved.unsent = true`.
 *
 * After this the mark is the single source and the register-kind gates in code
 * become belt-over-braces.
 *
 * # ⚠ IT ALSO NULLED THE CANDIDATE DISPOSITION UNTIL 2026-09-26, AND THAT
 * # COLUMN NO LONGER EXISTS — THE CEREMONY COULD NOT RUN AT ALL
 *
 * `#1241` (`3100bb7a`) retired the candidate disposition end to end and
 * migration `0068` DROPPED its column from `casting_candidates`. This file kept
 * naming that column in a `SELECT` and an `UPDATE`, so **every invocation on
 * either world died on `Unknown column … in 'field list'` before marking
 * anything** — found by running it (#179, run #383).
 *
 * The name is deliberately not written out here. `server/castingV2/candidateDispositionRetired.test.ts`
 * is the one file allowed to say it, and a history paragraph that spells it out
 * would keep this ceremony on an exemption list forever for the sake of a word
 * (#1367). `git log` and migration `0068` hold the spelling.
 *
 * The half is not merely unrunnable, it is MOOT: a dropped column holds no
 * fiction to null, which is a stronger outcome than the one this ceremony was
 * asking for. Only the `unsent` half remains, and that was always the substance.
 *
 * ⚠ **The class is worth more than the instance.** #1241 swept `server/`,
 * `shared/` and `client/` and did not sweep `scripts/`. Raw SQL is a string, so
 * `pnpm check`, `tsconfig.scripts.json` and the gate are all green over a query
 * that cannot execute — nothing fails until somebody runs it against a
 * database, and nothing in CI does. The other tracked scripts still carrying
 * this dead column are enumerated on the card.
 *
 * # ITS POPULATION IS EMPTY ON BOTH WORLDS AND CANNOT REGROW (measured 2026-09-26)
 *
 * Read at the rows with the readability door proven able to say yes first
 * (law 2 — the door answers null for a marked record AND for a row with no
 * record, so a bare zero does not say which):
 *
 * | | dev | production |
 * |---|---|---|
 * | author-road rolls | 14 | 86 |
 * | their candidates | 1 | 404 |
 * | carrying a `resolved` record | 1 | 404 |
 * | of those, marked `unsent: true` | **1 of 1** | **404 of 404** |
 * | still readable as fact | **0** | **0** |
 * | rolls predating the mark (PR #178) | 10 | 3 |
 * | …of those still holding candidates | **0** | **0** |
 *
 * So the 96 legacy rows this ceremony was written for are GONE rather than
 * fixed: every roll older than the compile-time mark has had its candidates
 * expire and be swept, and every surviving row was written after the compiler
 * learned to mark. Since PR #178 marks at write time, **no new unmarked row can
 * appear** — the population is closed, not merely empty today.
 *
 * It is kept rather than deleted, like the other 37 ceremonies here: a ceremony
 * is the record of what was done to the data, and one that crashes is a trap
 * for whoever reads that record next.
 *
 * # Derive, never mirror (law 4)
 *
 * The author-roll predicate and the read-back instrument are the PRODUCT'S OWN:
 * `rollComposedOnAuthorRoad` decides which rolls are in the population (only
 * `kind: "author"` — the PR #94 `"creative"` register and `"house"` rows
 * composed per-slice prompts from these identities, so their records were
 * genuinely sent and are NOT touched), and `readResolvedIdentity` — the single
 * validated door every consumer uses — must answer null for every row this
 * ceremony marked, or the ceremony failed.
 *
 * # Why `CAST('true' AS JSON)` and never a `?` parameter
 *
 * A JS `true` bound as a parameter arrives as TINYINT 1, and JSON_SET would
 * store the NUMBER 1 — which `readResolvedIdentity`'s strict `unsent === true`
 * does not refuse. The mark must be a JSON boolean, so it is written as a SQL
 * JSON literal and the read-back through the real reader is what proves it.
 *
 * Idempotent: a second run finds nothing to change and says ALREADY APPLIED.
 */
import { rollComposedOnAuthorRoad } from "../server/castingV2/rollProjection";
import { readResolvedIdentity } from "../server/castingV2/rollService";
import { closeCeremony, openCeremonyWorld, proveTheReader } from "./lib/ceremony.mts";

function parsedJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Does this row's record still read as fact through the product's own door? */
function recordStillReadable(internalPrompt: unknown): boolean {
  return readResolvedIdentity(parsedJson(internalPrompt)) !== null;
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  /* The population: every roll, filtered through the product's own predicate.
     No SQL JSON filter stands in for it — a filter with a blind spot would
     report the rows it missed as already clean. */
  const [rolls] = await world.connection.query<any[]>(
    "SELECT id, publicId, compiledBrief FROM casting_rolls",
  );
  const authorRollIds = rolls
    .filter((roll) => rollComposedOnAuthorRoad(parsedJson(roll.compiledBrief)))
    .map((roll) => roll.id as number);
  console.log(`rolls: ${rolls.length} total · ${authorRollIds.length} composed on the author road`);

  if (authorRollIds.length === 0) {
    console.log("ALREADY APPLIED — no author-road rolls in this world, nothing to mark");
  } else {
    const [candidates] = await world.connection.query<any[]>(
      "SELECT id, publicId, internalPrompt FROM casting_candidates WHERE rollId IN (?)",
      [authorRollIds],
    );
    const [variants] = await world.connection.query<any[]>(
      `SELECT v.id, v.publicId, v.internalPrompt
         FROM casting_candidate_variants v
         JOIN casting_candidates c ON v.candidateId = c.id
        WHERE c.rollId IN (?)`,
      [authorRollIds],
    );

    const unreadCandidates = candidates.filter((row) => recordStillReadable(row.internalPrompt));
    const unreadVariants = variants.filter((row) => recordStillReadable(row.internalPrompt));
    console.log(
      `candidates on author rolls: ${candidates.length} · records still readable: ${unreadCandidates.length}`,
    );
    console.log(
      `variants on author rolls: ${variants.length} · records still readable: ${unreadVariants.length}`,
    );

    if (unreadCandidates.length === 0 && unreadVariants.length === 0) {
      console.log("ALREADY APPLIED — every author-road record refuses through readResolvedIdentity");
    } else {
      const dirtyCandidateIds = new Set<number>(unreadCandidates.map((row) => row.id as number));
      for (const id of dirtyCandidateIds) {
        await world.connection.query(
          `UPDATE casting_candidates
              SET internalPrompt = JSON_SET(internalPrompt, '$.resolved.unsent', CAST('true' AS JSON))
            WHERE id = ?`,
          [id],
        );
      }
      for (const row of unreadVariants) {
        await world.connection.query(
          `UPDATE casting_candidate_variants
              SET internalPrompt = JSON_SET(internalPrompt, '$.resolved.unsent', CAST('true' AS JSON))
            WHERE id = ?`,
          [row.id],
        );
      }
      console.log(
        `APPLIED — marked ${dirtyCandidateIds.size} candidate row(s) and ${unreadVariants.length} variant row(s)`,
      );
    }

    /* READ BACK, through the door the consumers use (law 1: the changed bytes
       are the fact). Every author-road record must now refuse, and no
       candidate may still carry a persona caption. */
    console.log("read back from the live tables:");
    const [candidatesAfter] = await world.connection.query<any[]>(
      "SELECT id, publicId, internalPrompt FROM casting_candidates WHERE rollId IN (?)",
      [authorRollIds],
    );
    const [variantsAfter] = await world.connection.query<any[]>(
      `SELECT v.id, v.publicId, v.internalPrompt
         FROM casting_candidate_variants v
         JOIN casting_candidates c ON v.candidateId = c.id
        WHERE c.rollId IN (?)`,
      [authorRollIds],
    );
    const stillReadable = [
      ...candidatesAfter.filter((row) => recordStillReadable(row.internalPrompt)),
      ...variantsAfter.filter((row) => recordStillReadable(row.internalPrompt)),
    ];
    if (stillReadable.length > 0) {
      throw new Error(
        `readResolvedIdentity still answers on ${stillReadable.length} author-road row(s) after the apply `
        + `(first: ${stillReadable[0].publicId}) — stop and investigate; do not run production`,
      );
    }
    console.log(
      `  readResolvedIdentity refuses all ${candidatesAfter.length} candidate + ${variantsAfter.length} variant record(s)`,
    );
  }
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
