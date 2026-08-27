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
 * `compiledBrief.register.kind = 'author'`:
 *   - set `internalPrompt.resolved.unsent = true`
 *   - null the stored `personaLine` (dice fiction under tiles), candidates only
 *
 * After this the mark is the single source and the register-kind gates in code
 * become belt-over-braces.
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
      "SELECT id, publicId, personaLine, internalPrompt FROM casting_candidates WHERE rollId IN (?)",
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
    const personaRows = candidates.filter((row) => row.personaLine !== null);
    const unreadVariants = variants.filter((row) => recordStillReadable(row.internalPrompt));
    console.log(
      `candidates on author rolls: ${candidates.length} · records still readable: ${unreadCandidates.length} · personaLine set: ${personaRows.length}`,
    );
    console.log(
      `variants on author rolls: ${variants.length} · records still readable: ${unreadVariants.length}`,
    );

    if (unreadCandidates.length === 0 && personaRows.length === 0 && unreadVariants.length === 0) {
      console.log("ALREADY APPLIED — every author-road record refuses through readResolvedIdentity and no personaLine remains");
    } else {
      const dirtyCandidateIds = new Set<number>([
        ...unreadCandidates.map((row) => row.id as number),
        ...personaRows.map((row) => row.id as number),
      ]);
      for (const id of dirtyCandidateIds) {
        await world.connection.query(
          `UPDATE casting_candidates
              SET internalPrompt = JSON_SET(internalPrompt, '$.resolved.unsent', CAST('true' AS JSON)),
                  personaLine = NULL
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
      "SELECT id, publicId, personaLine, internalPrompt FROM casting_candidates WHERE rollId IN (?)",
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
    const stillCaptioned = candidatesAfter.filter((row) => row.personaLine !== null);
    if (stillCaptioned.length > 0) {
      throw new Error(
        `${stillCaptioned.length} author-road candidate(s) still carry a personaLine after the apply `
        + `(first: ${stillCaptioned[0].publicId})`,
      );
    }
    console.log(
      `  readResolvedIdentity refuses all ${candidatesAfter.length} candidate + ${variantsAfter.length} variant record(s); no personaLine remains`,
    );
  }
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
