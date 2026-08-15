/**
 * A'S COURT — DOES POINTING BEAT DESCRIBING? (fable-598 §4, his exact case.)
 *
 * The founder's #193 delivered a matched pair of cross earrings; his #194 asked
 * for a red eye, carried both crops at full geometry, and the right cross came
 * back visibly different. `court-carried-words-baseline-disposable.mts` put a
 * number on that, per side, from geometry alone:
 *
 *   PRODUCTION #193 → #194   left 5.2% extent drift · RIGHT 25.3% · worst 26.9%
 *
 * — and 26% is the arm's calibrated reading for *two different deliveries of
 * the same kind*, while one object photographed twice reads 0%. So his right
 * earring was re-painted, not carried, and the only thing that differed between
 * his two sides was the SENTENCE riding beside each crop.
 *
 * # The court, and why it is paired
 *
 * A cross-face comparison would be an anecdote: his frames and a fixture's are
 * two different women, two different crosses. So this runs BOTH arms on ONE
 * face, from ONE born pair, with ONE ask — and the only difference between the
 * two step-2 renders is whether the carried crops arrive with a description
 * beside them or with the fix's pointing sentence.
 *
 * ```
 * born            "give her dangly cross earrings"   the pair delivers, crops file
 * after point     "her right eye — fiery red"        the deployed fix (POINT)
 * after words     the same ask, same parent, same    the pre-fix describe()
 *                 crops                              (restored by hand for the arm)
 * judge           per-side constancy, born → each arm, worst side is the verdict
 * ```
 *
 * Between the arms the fixture is put back exactly as the born render left it:
 * the selection returns to the born version, the arm's variant row is deleted so
 * the repeat-offer door does not answer instead of the engine, and any library
 * row minted after the snapshot is removed so BOTH arms carry the same crops.
 *
 * Dev only, and it SPENDS: 25 credits a render, three renders, ~$0.9 of house
 * money on the segmenter and the engine.
 *
 *   npx tsx scripts/court-carried-crop-vs-words-disposable.mts born
 *   npx tsx scripts/court-carried-crop-vs-words-disposable.mts after point
 *   (restore the pre-fix describe() by hand, then)
 *   npx tsx scripts/court-carried-crop-vs-words-disposable.mts after words
 *   npx tsx scripts/court-carried-crop-vs-words-disposable.mts judge
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue.js";

import { readConstancy } from "./lib/constancyArm.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const BORN_ASK = "give her dangly cross earrings";
const AFTER_ASK = "her right eye — fiery red";

const OUT = "output/court-carried-words";
const STATE = `${OUT}/state.json`;
mkdirSync(OUT, { recursive: true });

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("dev only — this SPENDS and renders");
}

type State = {
  userId: number;
  candidatePublicId: string;
  candidateId: number;
  bornVariantId: number;
  bornImageKey: string;
  librarySnapshotMaxId: number;
  arms: Record<string, { variantId: number; imageKey: string; prompt: string; carried: unknown; edited: unknown }>;
};

const mode = process.argv[2] ?? "";
const label = process.argv[3] ?? "";
const readState = (): State => JSON.parse(readFileSync(STATE, "utf8")) as State;
const writeState = (state: State) => writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

const outsider = await ensureOutsider();
process.env.CASTING_REPAINT_SCOPE = `users:${outsider.id}`;
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${outsider.id}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";

const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

async function ask(candidatePublicId: string, instruction: string): Promise<void> {
  const { refineCandidate } = await import("../server/castingV2/refineService.js");
  const before = await balance();
  const started = Date.now();
  const result = await refineCandidate({}, {
    userId: outsider.id, clientRequestId: randomUUID(), candidatePublicId, instruction,
  });
  const after = await balance();
  console.log(`  "${instruction}" → ${result.kind ?? "?"} · ${before - after} credits`
    + ` · ${Math.round((Date.now() - started) / 1000)}s`);
  if (result.kind !== "rendered") {
    throw new Error(`the arm did not render: ${JSON.stringify(result).slice(0, 300)}`);
  }
}

/** The newest variant of the candidate — the render that just happened. */
async function newestVariant(candidateId: number) {
  const [rows] = await conn.execute(
    `SELECT id, imageKey, status,
            JSON_EXTRACT(internalPrompt, '$.repaint.carried') AS carried,
            JSON_EXTRACT(internalPrompt, '$.repaint.edited') AS edited,
            JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint.prompt')) AS prompt
       FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id DESC LIMIT 1`,
    [candidateId],
  );
  return (rows as Array<Record<string, never>>)[0]! as unknown as {
    id: number; imageKey: string; status: string; carried: unknown; edited: unknown; prompt: string;
  };
}

if (mode === "fresh") {
  /*
    A PRISTINE FACE FOR THE COURT. The fixture reuses its newest ready cast, and
    that cast already wears cross earrings from an earlier run — the already-true
    door refuses the born ask (correctly, and free). The court needs bare lobes
    and an empty library, so the fixture's own tree is dropped and re-cloned.
    Fixture rows only: the donor is another account and is never touched.
  */
  const [casts] = await conn.execute(
    `SELECT id FROM casting_candidates WHERE userId = ?`, [outsider.id]);
  const ids = (casts as Array<{ id: number }>).map((row) => row.id);
  for (const id of ids) {
    await conn.execute(`DELETE FROM casting_reference_library WHERE candidateId = ?`, [id]);
    await conn.execute(`DELETE FROM casting_candidate_variants WHERE candidateId = ?`, [id]);
    await conn.execute(`UPDATE casting_candidates SET selectedVariantId = NULL WHERE id = ?`, [id]);
    await conn.execute(`DELETE FROM casting_candidates WHERE id = ?`, [id]);
  }
  console.log(`dropped ${ids.length} fixture cast(s) — the next run clones a fresh one`);
} else if (mode === "born") {
  const [casts] = await conn.execute(
    `SELECT c.id, c.publicId, COUNT(v.id) AS versions
       FROM casting_candidates c LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
      WHERE c.userId = ? AND c.status = 'ready'
      GROUP BY c.id ORDER BY versions DESC LIMIT 1`,
    [outsider.id],
  );
  const cast = (casts as Array<{ id: number; publicId: string }>)[0]!;
  console.log(`outsider ${outsider.id} · cast ${cast.publicId} · ${await balance()} credits`);
  console.log("BORN — the pair");
  await ask(cast.publicId, BORN_ASK);
  const born = await newestVariant(cast.id);

  const [library] = await conn.execute(
    `SELECT id, slot, storageKey IS NOT NULL AS crop, digest, refusedReason
       FROM casting_reference_library WHERE userId = ? ORDER BY id DESC LIMIT 6`,
    [outsider.id],
  );
  console.log("  the library now holds:");
  let maxId = 0;
  for (const row of library as Array<Record<string, unknown>>) {
    maxId = Math.max(maxId, Number(row.id));
    console.log(`    ${String(row.slot).padEnd(16)} ${row.refusedReason ? `REFUSED ${row.refusedReason}` : "filed"}`
      + ` · crop ${row.crop ? "yes" : "no"} · digest ${String(row.digest ?? "-").slice(0, 8)}`);
  }
  writeState({
    userId: outsider.id,
    candidatePublicId: cast.publicId,
    candidateId: cast.id,
    bornVariantId: born.id,
    bornImageKey: born.imageKey,
    librarySnapshotMaxId: maxId,
    arms: {},
  });
  console.log(`born variant ${born.id} → ${born.imageKey}`);
} else if (mode === "after") {
  /* A replicate is the same arm with a suffix — `point2`, `words2` — because a
     single paired trial with a threefold gap is suggestive and two are a
     reading. The label only names the output; the arm is the code in place. */
  if (!/^(point|words)\d*$/.test(label)) throw new Error("say which arm: point[N] | words[N]");
  const state = readState();

  /* PUT THE FIXTURE BACK WHERE THE BORN RENDER LEFT IT. Anything the previous
     arm added — its own variant, any library row minted from its delivery —
     would otherwise make the two arms carry different crops, or make the
     repeat-offer door answer instead of the engine. */
  const [dropped] = await conn.execute(
    `DELETE FROM casting_candidate_variants WHERE candidateId = ? AND id > ?`,
    [state.candidateId, state.bornVariantId],
  );
  const [unfiled] = await conn.execute(
    `DELETE FROM casting_reference_library WHERE userId = ? AND id > ?`,
    [state.userId, state.librarySnapshotMaxId],
  );
  await conn.execute(`UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?`,
    [state.bornVariantId, state.candidateId]);
  console.log(`restored to born ${state.bornVariantId}`
    + ` · dropped ${(dropped as { affectedRows: number }).affectedRows} variant(s)`
    + ` · ${(unfiled as { affectedRows: number }).affectedRows} library row(s)`);

  console.log(`AFTER (${label}) — the unrelated edit`);
  await ask(state.candidatePublicId, AFTER_ASK);
  const after = await newestVariant(state.candidateId);
  console.log(`  edited ${JSON.stringify(after.edited)} · carried ${JSON.stringify(after.carried)}`);
  const references = after.prompt.split("\n").filter((line) => line.includes("Reference"));
  for (const line of references) console.log(`  ${line.slice(0, 190)}`);
  state.arms[label] = {
    variantId: after.id, imageKey: after.imageKey, prompt: after.prompt,
    carried: after.carried, edited: after.edited,
  };
  writeState(state);
  writeFileSync(`${OUT}/prompt-${label}.txt`, `${after.prompt}\n`);
} else if (mode === "judge") {
  const state = readState();
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) throw new Error("FAL_KEY is required — this reads regions");
  const question = catalogueSlots()
    .find((definition) => definition.feature === "earring" && definition.question !== null)!.question as string;
  const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
  const reader = createFalRegionReader({ apiKey: FAL_KEY }) as never;
  const { fetchImageBytes } = await import("./lib/imageBytes.mts");
  const base = process.env.R2_PUBLIC_URL!;

  const grab = async (key: string, name: string) => {
    const local = `${OUT}/${name}.png`;
    if (existsSync(local)) return readFileSync(local);
    const bytes = (await fetchImageBytes(`${base}/${key}`)).bytes;
    writeFileSync(local, bytes);
    return bytes;
  };
  const parent = await grab(state.bornImageKey, "born");

  for (const [name, arm] of Object.entries(state.arms)) {
    const child = await grab(arm.imageKey, `after-${name}`);
    const reading = await readConstancy({ reader, question, bilateral: true, noun: "earring", parent, child });
    console.log("");
    console.log(`ARM ${name.toUpperCase()}`);
    if (reading.sides.length === 0) {
      console.log(`  VOID — ${reading.why ?? "nothing read"}`);
    } else {
      for (const side of reading.sides) {
        console.log(`  ${side.side.padEnd(6)} extent ${(side.parentExtent * 100).toFixed(3)}%`
          + ` → ${(side.childExtent * 100).toFixed(3)}%  drift ${(side.extentDrift * 100).toFixed(1)}%`
          + `   aspect drift ${(side.aspectDrift * 100).toFixed(1)}%`);
      }
      console.log(`  WORST SIDE: ${((reading.worstDrift ?? 0) * 100).toFixed(1)}%`);
    }
    writeFileSync(`${OUT}/reading-${name}.json`, `${JSON.stringify(reading, null, 2)}\n`);
  }
  console.log("");
  console.log("for comparison — the founder's own #193 → #194: left 5.2% · right 25.3% · worst 26.9%");
} else {
  throw new Error("modes: fresh | born | after point | after words | judge");
}

console.log(`ledger: ${await balance()} credits`);
await conn.end();
process.exit(0);
