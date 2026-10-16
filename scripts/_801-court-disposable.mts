/**
 * #801 — THE REFINE ENGINE COURT. Two roads, one engine, open chains.
 *
 * His word, 2026-10-15 (chat), is the design and it is quoted here rather than
 * summarised, because every choice below is one of its clauses:
 *
 *   "i dont think a table of edits work thats was the old lane we now have a
 *    fully open casting studio so people can cast creatures and all sorts of
 *    things right? like we cant be rigid … obviously if gpt image 2.5 carrys
 *    edits well this isnt as much of a problem also no need to test flare
 *    sunburst is the one."
 *
 * and, the same day: "and obviously everything has to work with the image
 * analyzer which finds and boxs features right."
 *
 * # What is on trial, and what is held still
 *
 * The ENGINE is held still: every cell paints on
 * `openai/gpt-image-2.5/sunburst/edit`, which is what the product's repaint
 * road already sends to and what he settled on 2026-09-26. What varies is the
 * ROAD — where the edit is anchored, what rides with it, and what the words
 * say.
 *
 *   A  control   the real `refineCandidate` entrance, as shipped: anchored on
 *                the PRISTINE MASTER, the whole instruction list replayed, the
 *                reference library carrying earlier edits as crops. Dev
 *                credits and house fal. This is the only cell that is the
 *                product; B–E are the road that does not exist yet.
 *   B  prev      anchored on the PREVIOUS DELIVERED FRAME, that frame the only
 *                reference, the new ask alone.
 *   C  prev+m    the same, with the master riding as a second reference.
 *   D  +state    C plus one short sentence naming what the picture already has.
 *   E  +replay   C plus the whole instruction list replayed.
 *
 *   B vs C   answers his (b): does the master as a second reference help?
 *   C/D/E    answers his (c): do the words have to carry the history?
 *   A vs best(B–E)  is the headline.
 *
 * ⚠ **C, D and E each send one sentence B does not**, because a second picture
 * with nothing said about it is not an arm — the engine blends it. That is a
 * confound and it is named here rather than discovered in the report.
 *
 * # Fixtures
 *
 * Three, open and varied, two human and one creature — his "humans and
 * creatures", and dev held no creature until this card rolled one. The chains
 * are WRITTEN, not replayed from his history, and that is a measurement
 * rather than a preference: production holds **two** refine variants all time,
 * both single-step, so there is no real chain anywhere to copy.
 *
 * Each chain is six asks and includes a REMOVAL of an earlier edit at step 5 —
 * the case the incremental road has no mechanism for, since the thing to be
 * removed exists only in the picture.
 *
 *   npx tsx scripts/_801-court-disposable.mts --control
 *   npx tsx scripts/_801-court-disposable.mts --incremental [cells BCDE]
 *   npx tsx scripts/_801-court-disposable.mts --measure
 */
/* Production's own flag positions (scripts/lib/productionFlagPositions.mts),
   above the imports because module side effects read them at import time. */
process.env.CASTING_V2_SCOPE = "all";
process.env.CASTING_REPAINT_SCOPE = "all";
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "all";
process.env.CASTING_OPEN_LANE_SCOPE = "all";
/* `CASTING_SIDE_PHRASING_SCOPE = "all"` stood here and is removed with the flag
   (#1577 slice D2). It pinned the position production shipped at the time; the
   clause it armed is said on every render now, so a re-run reads the same
   sentence it did. */
process.env.CASTING_FACE_SCAN_SCOPE = "all";
process.env.CASTING_SCAN_TABLE_SCOPE = "all";
process.env.CASTING_BRIEF_FIDELITY_SCOPE = "all";
process.env.CASTING_RETRY_SCOPE = "all";
/*
  THE ONE FLAG DELIBERATELY NOT AT ITS PRODUCTION POSITION, and why.

  `CASTING_REFINE_DISPATCH_SCOPE` is `all` on production and it changes the
  SHAPE OF THE ANSWER, not the picture: the call returns a dispatch receipt the
  moment the render starts, and `imageUrl` on that receipt is the face the
  customer is still looking at. The first control run read those receipts as
  delivered frames and wrote three copies of the master to disk, then met
  "That edit is already being made" on every following step — and when the
  process exited, the lizard's render was abandoned mid-flight (`v557`, still
  `dispatched`). A browser waits; a script has to be told to.

  Off, the call is "one attempt, awaited whole" (`refineService`'s own words),
  which is the same render on the same road. The frame is still read from the
  VARIANT ROW rather than from the response, because the row is the artifact.
*/
process.env.CASTING_REFINE_DISPATCH_SCOPE = "off";

import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { readFalBalance } from "./lib/falSpend.mts";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { refineCandidate } from "../server/castingV2/refineService";

assertOneWorld(["DATABASE_URL"]);
if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this spends dev credits and house fal");

const OUT = "output/801";
const FRAMES = `${OUT}/frames`;
const MANIFEST = `${OUT}/manifest.json`;
mkdirSync(FRAMES, { recursive: true });

type Step = {
  /** What a customer types. */
  ask: string;
  /** What the picture holds AFTER this step — hand-declared so the state
   *  sentence cell D sends is the best case rather than a parse. */
  stateAfter: string[];
};

type Fixture = {
  id: string;
  what: string;
  userId: number;
  candidatePublicId: string;
  candidateId: number;
  imageKey: string;
  steps: Step[];
};

const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1].split(",")
  : null;

const ALL_FIXTURES: Fixture[] = [
  {
    id: "fisherman",
    what: "A weathered fisherman, north Atlantic, sixty (human)",
    userId: 823,
    candidatePublicId: "f4783727-f423-473a-945e-c3090f862493",
    candidateId: 728,
    imageKey: "casting-v2/candidates/2fb6302e-b0d5-4125-be14-a520ee7de144.png",
    steps: [
      { ask: "make the beard shorter and neater", stateAfter: ["a short neat beard"] },
      { ask: "a scar through the left eyebrow", stateAfter: ["a short neat beard", "a scar through the left eyebrow"] },
      { ask: "the eyes grey-green", stateAfter: ["a short neat beard", "a scar through the left eyebrow", "grey-green eyes"] },
      { ask: "small gold hoop earrings, one in each ear", stateAfter: ["a short neat beard", "a scar through the left eyebrow", "grey-green eyes", "small gold hoop earrings"] },
      { ask: "take the scar off", stateAfter: ["a short neat beard", "grey-green eyes", "small gold hoop earrings"] },
      { ask: "the hair darker, more salt than pepper", stateAfter: ["a short neat beard", "grey-green eyes", "small gold hoop earrings", "darker hair"] },
    ],
  },
  {
    /*
      A STREET CASTING, AND IT IS A FRESH ROLL BECAUSE THE OLD ONE WAS A GHOST.
      Roll 132's eight candidates all carry ONE imageKey and that object is not
      in the bucket — the fetch comes back as an HTML 404 page. A latency
      fixture, not a cast. Looked at rather than trusted.
    */
    id: "casting",
    what: "A street casting, mid 20s (human)",
    userId: 823,
    candidatePublicId: "5fff979a-5ebb-49bf-8759-ad5d9941512c",
    candidateId: 744,
    imageKey: "casting-v2/candidates/72b8ad3e-9608-41c9-beee-37bb4e5e45eb.png",
    steps: [
      { ask: "cut the hair into a short crop", stateAfter: ["a short cropped haircut"] },
      { ask: "a small sparrow tattoo on the side of the neck", stateAfter: ["a short cropped haircut", "a small sparrow tattoo on the side of the neck"] },
      { ask: "wire-frame glasses", stateAfter: ["a short cropped haircut", "a small sparrow tattoo on the side of the neck", "wire-frame glasses"] },
      { ask: "freckles across the nose and cheeks", stateAfter: ["a short cropped haircut", "a small sparrow tattoo on the side of the neck", "wire-frame glasses", "freckles across the nose and cheeks"] },
      { ask: "take the glasses off", stateAfter: ["a short cropped haircut", "a small sparrow tattoo on the side of the neck", "freckles across the nose and cheeks"] },
      { ask: "the eyes pale grey", stateAfter: ["a short cropped haircut", "a small sparrow tattoo on the side of the neck", "freckles across the nose and cheeks", "pale grey eyes"] },
    ],
  },
  {
    id: "lizard",
    what: "A lizard man with emerald scales, a heavy brow and amber eyes, in their 40s (creature)",
    userId: 823,
    /*
      THE SECOND LIZARD, and the first one is why. The control run was killed
      at its background time limit mid-chain, the resumed run could not see the
      rows the other writer had clobbered out of the manifest, and it replayed
      step 1 onto a LIVE chain — the variant rows read
      "deeper emerald … horns … deeper emerald …". An arm whose road is not the
      road it claims is VOID rather than failed, so cand 735 is abandoned and
      the creature runs again, clean, on a sibling from the same roll.
    */
    candidatePublicId: "7dc26b57-cd4c-4064-91a6-343a0f80efed",
    candidateId: 736,
    imageKey: "casting-v2/candidates/1388d843-f3d1-4d5b-acfb-89507f823c0c.png",
    steps: [
      { ask: "make the scales a deeper emerald", stateAfter: ["deeper emerald scales"] },
      { ask: "a pair of short curved horns", stateAfter: ["deeper emerald scales", "a pair of short curved horns"] },
      { ask: "amber eyes with slit pupils", stateAfter: ["deeper emerald scales", "a pair of short curved horns", "amber eyes with slit pupils"] },
      { ask: "a notch missing from the left ear", stateAfter: ["deeper emerald scales", "a pair of short curved horns", "amber eyes with slit pupils", "a notch missing from the left ear"] },
      { ask: "take the horns off", stateAfter: ["deeper emerald scales", "amber eyes with slit pupils", "a notch missing from the left ear"] },
      { ask: "a heavier brow", stateAfter: ["deeper emerald scales", "amber eyes with slit pupils", "a notch missing from the left ear", "a heavier brow"] },
    ],
  },
];

const FIXTURES = ALL_FIXTURES.filter((f) => !ONLY || ONLY.includes(f.id));

type Record_ = {
  fixture: string;
  cell: string;
  step: number;
  ask: string;
  file: string | null;
  ms: number;
  outcome: "delivered" | "refused" | "failed";
  why?: string;
  model?: string;
  prompt?: string;
  /** What the entrance said, verbatim — a FREE ANSWER has no variant row and
   *  is indistinguishable from a crash without it. */
  answer?: string;
};

type Manifest = { records: Record_[]; notes: string[] };

const manifest: Manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : { records: [], notes: [] };
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
const already = (fixture: string, cell: string, step: number) =>
  manifest.records.find((r) => r.fixture === fixture && r.cell === cell && r.step === step);

const db = await getDb();
if (!db) throw new Error("no database");
const client = (db as unknown as {
  session: { client: { query: (s: string, p?: unknown[]) => Promise<[any[], unknown]> } };
}).session.client;
const q = async (s: string, p: unknown[] = []) => (await client.query(s, p))[0];

async function masterBytes(fixture: Fixture): Promise<Buffer> {
  const local = `${FRAMES}/${fixture.id}/master.png`;
  if (existsSync(local)) return readFileSync(local);
  mkdirSync(`${FRAMES}/${fixture.id}`, { recursive: true });
  const key = fixture.imageKey
    || (await q("select imageKey from casting_candidates where id=?", [fixture.candidateId]))[0]?.imageKey;
  const res = await fetch(`${process.env.R2_PUBLIC_URL}/${key}`);
  if (!res.ok) throw new Error(`master ${fixture.id} → ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(local, bytes);
  return bytes;
}

/* ── A · the control, through the real entrance ───────────────────────────── */

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The newest variant row on this candidate, which is the artifact the court
 *  reads — never the response, which under the dispatch road is a receipt. */
async function newestVariant(candidateId: number): Promise<any | undefined> {
  return (await q(
    `select id, status, providerModel, imageKey, parentVariantId, json_length(instructions) steps
       from casting_candidate_variants where candidateId = ? order by id desc limit 1`,
    [candidateId],
  ))[0];
}

async function runControl(): Promise<void> {
  for (const fixture of FIXTURES) {
    await masterBytes(fixture);
    const before = (await q("select balance from points where userId=?", [fixture.userId]))[0]?.balance;
    console.log(`\n== A control · ${fixture.id} · cand ${fixture.candidateId} · dev balance ${before}`);
    for (const [index, step] of fixture.steps.entries()) {
      const at = index + 1;
      if (already(fixture.id, "A", at)) { console.log(`  ${at}. (already)`); continue; }
      const started = Date.now();
      const record: Record_ = {
        fixture: fixture.id, cell: "A", step: at, ask: step.ask, file: null, ms: 0, outcome: "failed",
      };
      const before_ = await newestVariant(fixture.candidateId);
      try {
        /* A CONFLICT is the panel's own "wait and press again", so the court
           waits exactly as a person would rather than scoring it a failure. */
        for (let attempt = 0; ; attempt += 1) {
          try {
            record.answer = JSON.stringify(await refineCandidate({}, {
              userId: fixture.userId,
              clientRequestId: randomUUID(),
              candidatePublicId: fixture.candidatePublicId,
              instruction: step.ask,
            }));
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (attempt >= 20 || !/already being made|already changing/i.test(message)) throw error;
            await sleep(15_000);
          }
        }
        record.ms = Date.now() - started;
      } catch (error) {
        record.ms = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);
        record.outcome = /Nothing was charged|Nothing extra was charged/i.test(message) ? "refused" : "failed";
        record.why = message;
      }

      /* Whatever the call said, the row is what happened. */
      if (record.outcome !== "refused") {
        let row = await newestVariant(fixture.candidateId);
        for (let waited = 0; waited < 8 * 60 && row && row.id !== before_?.id
          && row.status !== "ready" && row.status !== "failed"; waited += 10) {
          await sleep(10_000);
          row = await newestVariant(fixture.candidateId);
        }
        if (!row || row.id === before_?.id) {
          record.outcome = "failed";
          record.why = record.why ?? "no new variant row";
        } else {
          record.model = row.providerModel ?? undefined;
          record.why = record.why ?? `variant ${row.id} ${row.status} parent=${row.parentVariantId ?? "none"} steps=${row.steps}`;
          if (row.status === "ready" && row.imageKey) {
            const res = await fetch(`${process.env.R2_PUBLIC_URL}/${row.imageKey}`);
            const file = `${FRAMES}/${fixture.id}/A-${at}.png`;
            writeFileSync(file, Buffer.from(await res.arrayBuffer()));
            record.file = file;
            record.outcome = "delivered";
          } else {
            record.outcome = "failed";
          }
        }
        record.ms = Date.now() - started;
      }
      manifest.records.push(record);
      save();
      console.log(`  ${at}. ${record.outcome.padEnd(9)} ${(record.ms / 1000).toFixed(0)}s  "${step.ask}"`
        + (record.why ? `\n       ${record.why}` : ""));
    }
    const after = (await q("select balance from points where userId=?", [fixture.userId]))[0]?.balance;
    console.log(`   dev credits spent on ${fixture.id}: ${before - after}`);
  }
}

/* ── B–E · the incremental road, driven on the same engine ────────────────── */

const PRESERVE = "Change nothing else: keep the same person, the same pose, the same framing,"
  + " the same lighting and the same background exactly as they are.";
const SECOND = "The first image is the picture to edit. The second image is the original"
  + " photograph of the same person, for likeness only — do not copy its pose or its framing.";

type Cell = {
  id: "B" | "C" | "D" | "E" | "F" | "G";
  label: string;
  withMaster: boolean;
  prompt: (fixture: Fixture, at: number) => string;
};

const CELLS: Cell[] = [
  {
    id: "B",
    label: "previous frame only, the new ask alone",
    withMaster: false,
    prompt: (f, at) => `Edit the photograph. ${f.steps[at - 1].ask}. ${PRESERVE}`,
  },
  {
    id: "C",
    label: "previous frame + master, the new ask alone",
    withMaster: true,
    prompt: (f, at) => `${SECOND} ${f.steps[at - 1].ask}. ${PRESERVE}`,
  },
  {
    id: "D",
    label: "previous frame + master, the new ask and a one-line state note",
    withMaster: true,
    prompt: (f, at) => {
      const had = at === 1 ? [] : f.steps[at - 2].stateAfter;
      const note = had.length === 0 ? "" : ` The person already has ${had.join(", ")}.`;
      return `${SECOND}${note} ${f.steps[at - 1].ask}. ${PRESERVE}`;
    },
  },
  {
    id: "E",
    label: "previous frame + master, the whole instruction list replayed",
    withMaster: true,
    prompt: (f, at) => {
      const all = f.steps.slice(0, at).map((s) => s.ask);
      return `${SECOND} Edit the photograph so that all of this is true: ${all.join("; ")}. ${PRESERVE}`;
    },
  },
  /*
    THE FLOOR, AND IT IS BOUGHT BEFORE ANY CELL IS RANKED AGAINST ANOTHER.

    F and G are C, byte for byte — same references, same words, same engine.
    Two renders of one face differ for reasons that are not the ask, and a
    chain of six compounds that six times, so the spread between C, F and G at
    step 6 is what any C-vs-D-vs-E claim has to clear. Without it the court can
    crown a cell that is inside its own noise (`carry-noise-floor`).
  */
  {
    id: "F",
    label: "floor — identical to C",
    withMaster: true,
    prompt: (f, at) => `${SECOND} ${f.steps[at - 1].ask}. ${PRESERVE}`,
  },
  {
    id: "G",
    label: "floor — identical to C",
    withMaster: true,
    prompt: (f, at) => `${SECOND} ${f.steps[at - 1].ask}. ${PRESERVE}`,
  },
];

async function runIncremental(which: string[]): Promise<void> {
  const sharpLib = (await import("sharp")).default;
  const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
  console.log(`engine: ${engine.id}`);

  const jobs: Array<() => Promise<void>> = [];
  for (const fixture of FIXTURES) {
    for (const cell of CELLS) {
      if (!which.includes(cell.id)) continue;
      jobs.push(async () => {
        const master = await masterBytes(fixture);
        const size = await sharpLib(master).metadata();
        let anchor = master;
        for (const [index] of fixture.steps.entries()) {
          const at = index + 1;
          const file = `${FRAMES}/${fixture.id}/${cell.id}-${at}.png`;
          const done = already(fixture.id, cell.id, at);
          if (done && done.file && existsSync(done.file)) {
            anchor = readFileSync(done.file);
            console.log(`  ${fixture.id} ${cell.id}${at} (already)`);
            continue;
          }
          const prompt = cell.prompt(fixture, at);
          const references = cell.withMaster
            ? [{ bytes: anchor, contentType: "image/png" }, { bytes: master, contentType: "image/png" }]
            : [{ bytes: anchor, contentType: "image/png" }];
          const started = Date.now();
          const record: Record_ = {
            fixture: fixture.id, cell: cell.id, step: at, ask: fixture.steps[index].ask,
            file: null, ms: 0, outcome: "failed", prompt,
          };
          try {
            const painted = await engine.edit({
              prompt,
              references,
              width: size.width!,
              height: size.height!,
            });
            record.ms = Date.now() - started;
            writeFileSync(file, painted.bytes);
            record.file = file;
            record.outcome = "delivered";
            record.model = painted.provenance.model;
            anchor = painted.bytes;
          } catch (error) {
            record.ms = Date.now() - started;
            record.why = error instanceof Error ? error.message : String(error);
            record.outcome = "failed";
          }
          manifest.records.push(record);
          save();
          console.log(`  ${fixture.id} ${cell.id}${at} ${record.outcome} ${(record.ms / 1000).toFixed(0)}s`
            + (record.why ? ` — ${record.why}` : ""));
          /* A chain cannot step over a hole: the next anchor would be the one
             before, which silently turns a six-step chain into a five. */
          if (record.outcome !== "delivered") break;
        }
      });
    }
  }

  /* Four at a time: the fal account ceiling is 20 concurrent and nothing else
     of ours is running, but a chain is serial inside itself. */
  const CONCURRENCY = 4;
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const mine = next;
      next += 1;
      if (mine >= jobs.length) return;
      await jobs[mine]();
    }
  }));
}

/* ── the run ──────────────────────────────────────────────────────────────── */

const openingBalance = await readFalBalance();
console.log("fal balance at the start:", JSON.stringify(openingBalance));
manifest.notes.push(`fal balance at ${new Date().toISOString()}: ${JSON.stringify(openingBalance)}`);
save();

if (process.argv.includes("--control")) await runControl();
if (process.argv.includes("--incremental")) {
  const at = process.argv.indexOf("--incremental");
  const arg = process.argv[at + 1];
  const cells = arg && /^[BCDEFG]+$/.test(arg) ? arg.split("") : ["B", "C", "D", "E"];
  await runIncremental(cells);
}

const closing = await readFalBalance();
console.log("fal balance at the end:  ", JSON.stringify(closing));
manifest.notes.push(`fal balance at ${new Date().toISOString()}: ${JSON.stringify(closing)}`);
save();
console.log(`\n${manifest.records.length} records in ${MANIFEST}`);
process.exit(0);
