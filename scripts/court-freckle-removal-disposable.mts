/**
 * THE FRECKLE REMOVAL COURT — V3(b)'s second slot story (fable-537 §2/§3).
 *
 * *"Shave his beard." Does the frame come back without it, is the skin under it
 * clean, and is it still gone after the NEXT edit?*
 *
 * # Why this kind, and why now
 *
 * `facialHair` is departable, has a slot, a question and a guard kind, and
 * until tonight a beard in the ORIGINAL photograph could not be removed at all:
 * the sentence that says a thing is gone lived on the table for things you
 * WEAR, so the ask refused `uncatalogued`. Slice (b) moved that sentence onto a
 * kind-keyed home and gave `facial hair` one. This court is what says whether
 * the sentence works, and it is the first non-accessory departure ever measured.
 *
 * # THE BARS, WRITTEN BEFORE THE FIRST CALL
 *
 * ```
 * SPECIMEN   one production frame of a man with a beard rendered onto it, so
 *            the beard is unmistakably there before anything is asked.
 *
 * CONTROL    3 renders of an unrelated edit with facial hair NEVER mentioned
 *            → the beard is STILL THERE 3/3. Mandatory: a judge that says
 *            "no beard" about a bearded man would pass the removal arm without
 *            anything having been removed.
 * REMOVAL    3 renders carrying the SHIPPED vacancy sentence (imported, never
 *            retyped) → gone 3/3 AND the skin clean 3/3. A shave that leaves a
 *            shadow, a patch or a colour break is the "ghost rim" by another
 *            name.
 * SURVIVAL   each shaved frame + one more unrelated edit, the vacancy restated
 *            as the recipe restates it → still gone 3/3. This is the arm a
 *            born-worn removal has already been measured FAILING (one frame,
 *            then the master paints it back), so a pass here is the finding and
 *            a fail is the reason the slice is not done.
 * ```
 *
 * House money only: no user credits, no rows written, ledger read at both ends.
 *
 *   npx tsx scripts/court-beard-removal-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";
import { buildContactSheet, openLedgerWatch } from "./lib/benchKit.mts";
import { VACANCY_BY_KIND } from "../server/castingV2/vacancyPhrases";

const OUT = "output/freckle-court";
mkdirSync(OUT, { recursive: true });

const FAL_KEY = process.env.FAL_KEY;
const OPENROUTER = process.env.OPENROUTER_API_KEY;
if (!FAL_KEY || !OPENROUTER) throw new Error("FAL_KEY and OPENROUTER_API_KEY are required");

const USD_PER_RENDER = 0.099;
const USD_PER_READ = 0.01;
let renders = 0;
let reads = 0;

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const connection = await openDatabase(resolveDatabaseUrl());
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
const ledger = await openLedgerWatch({ query, userId: 1 });

const { createFalMaskedEditEngine } = await import("../server/providers/falImages.js");
const { createOpenRouterTextEngine } = await import("../server/providers/openrouterText.js");
const engine = createFalMaskedEditEngine({ apiKey: FAL_KEY });
const reader = createOpenRouterTextEngine({ apiKey: OPENROUTER });

const PRESERVE = "Everything else must be identical to the reference photograph: the same "
  + "person, the same hair, the same eyes, the same skin, the same clothing, the same "
  + "lighting, the same framing, the same background.";
const NEXT = "Change only this: her t-shirt is black.";

/**
 * THE SENTENCE UNDER TEST, IMPORTED RATHER THAN TYPED.
 *
 * A court that retyped the phrase would measure a sentence that resembles the
 * shipped one — the harness-supplied-argument trap this program has already
 * paid for twice. If the module's words change, this court is measuring the new
 * ones by construction.
 */
const VACATE = ` ${VACANCY_BY_KIND.freckles!.says}.`;
say(`THE SENTENCE UNDER TEST (imported): ${VACATE.trim()}`);
say("");

async function render(from: Buffer, prompt: string, label: string): Promise<Buffer> {
  const result = await engine.edit({
    prompt: `${prompt} ${PRESERVE}`,
    references: [{ bytes: from, contentType: "image/png" }],
    width: 1024,
    height: 1536,
  });
  renders += 1;
  writeFileSync(`${OUT}/${label}.png`, result.bytes);
  return result.bytes;
}

/** Is it gone, and is the skin under it clean? */
async function judge(bytes: Buffer, label: string): Promise<{ beard: boolean; clean: boolean; saw: string }> {
  const answer = await reader.complete({
    system: "You are looking at one photograph and answering two questions. JSON only.",
    user: "Answer as {\"freckles\": true|false, \"artefact\": true|false, \"saw\": \"<a few words>\"}. "
      + "freckles: does this person have visible freckles on their nose or cheeks? "
      + "artefact: does the skin look wrong where freckles would be — flattened, waxy, "
      + "airbrushed, blurred, or a different tone from the rest of the face?",
    images: [{ bytes, contentType: "image/png" }],
    json: true,
  });
  reads += 1;
  const parsed = (() => {
    try { return JSON.parse(answer.text.replace(/```json|```/g, "").trim()); } catch { return null; }
  })();
  const saw = typeof parsed?.saw === "string" ? parsed.saw : "";
  /* An affirmative with no `saw` is not a reading (D-235). */
  const seen = saw.trim().length > 0;
  const beard = parsed?.freckles === true && seen;
  const clean = parsed?.artefact === false && seen;
  say(`    judge ${label.padEnd(20)} freckles=${beard ? "YES" : "no "} clean=${clean ? "YES" : "no "}  ${saw.slice(0, 62)}`);
  return { beard, clean, saw };
}

/* ---- the specimen: a beard, rendered once, so it is unmistakably there ---- */
const candidate = readFileSync(`${OUT}/candidate.png`);
say("SPECIMEN — freckling her first, so the removal has something to remove");
const master = await render(
  candidate,
  "Change only this: she has clear freckles scattered across her nose and cheeks.",
  "master",
);
const grown = await judge(master, "master");
if (!grown.beard) {
  say("");
  say("THE SPECIMEN FAILED: the freckles did not arrive, so nothing below could measure a removal.");
  await connection.end();
  process.exit(1);
}

const N = 3;
const labels = Array.from({ length: N }, (_, at) => `${at + 1}`);

/* ---- the control: an unrelated edit, facial hair never mentioned ---- */
say("");
say(`CONTROL ARM — ${N} renders, the freckles never mentioned`);
let controlKept = 0;
for (const label of labels) {
  const after = await render(master, NEXT, `control-${label}`);
  const read = await judge(after, `control/${label}`);
  if (read.beard) controlKept += 1;
}

/* ---- the removal ---- */
say("");
say(`REMOVAL ARM — ${N} renders carrying the shipped vacancy sentence`);
let gone = 0;
let clean = 0;
const shaved: { label: string; bytes: Buffer }[] = [];
for (const label of labels) {
  const after = await render(master, `${NEXT}${VACATE}`, `removal-${label}`);
  const read = await judge(after, `removal/${label}`);
  if (!read.beard) gone += 1;
  if (read.clean) clean += 1;
  shaved.push({ label, bytes: after });
}

/* ---- survival of the ABSENCE: one more edit, the vacancy restated ---- */
say("");
say(`SURVIVAL ARM — ${N} renders, one more edit with the vacancy restated`);
let held = 0;
for (const frame of shaved) {
  const after = await render(
    frame.bytes,
    `Change only this: she is wearing a grey scarf.${VACATE}`,
    `survival-${frame.label}`,
  );
  const read = await judge(after, `survival/${frame.label}`);
  if (!read.beard) held += 1;
}

say("");
say("=".repeat(78));
say(`CONTROL   freckles still there ${controlKept} of ${N}   (the bar is ${N} — the judge can SEE freckles)`);
say(`REMOVAL   gone                ${gone} of ${N}`);
say(`          skin clean          ${clean} of ${N}`);
say(`SURVIVAL  still gone          ${held} of ${N}   (THE DECIDING ARM — the tan's own class)`);
const verdict = controlKept === N && gone === N && clean === N && held === N
  ? "PASS — freckles in the master can be removed, cleanly, and stay removed"
  : "SHORT — see the arms above; the capability WAITS for the surface carrier work (fable-537 §3)";
say(verdict);
say("=".repeat(78));

const read = (path: string): Buffer | null => {
  try { return readFileSync(path); } catch { return null; }
};
const sheet = await buildContactSheet({
  columns: ["freckled master", "control (no mention)", "removal", "survival"],
  rows: labels.map((label) => ({
    label,
    cells: [
      { bytes: master },
      { bytes: read(`${OUT}/control-${label}.png`) },
      { bytes: read(`${OUT}/removal-${label}.png`) },
      { bytes: read(`${OUT}/survival-${label}.png`) },
    ],
  })),
  tile: { width: 240, height: 350 },
});
writeFileSync(`${OUT}/removal-sheet.png`, sheet.bytes);

const spend = await ledger.close();
await connection.end();
say("");
say(`SPEND: ${renders} renders × $${USD_PER_RENDER} + ${reads} reads × $${USD_PER_READ} = `
  + `$${(renders * USD_PER_RENDER + reads * USD_PER_READ).toFixed(2)}`);
say(spend.line);
writeFileSync(`${OUT}/removal.txt`, `${lines.join("\n")}\n`);
writeFileSync(
  `${OUT}/removal.json`,
  `${JSON.stringify({ controlKept, gone, clean, held, n: N, verdict, sentence: VACATE.trim() }, null, 2)}\n`,
);
process.exit(0);
