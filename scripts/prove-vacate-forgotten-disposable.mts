/**
 * DOES A REMOVAL GOVERN THE NEXT FRAME, OR ONLY ITS OWN? (fable-323's proof,
 * asked on the specimen that can actually answer it.)
 *
 * Fable ordered the hair-up proof on the occluded branch: if the charge for an
 * unreadable removal bought a STATE CHANGE rather than a patch of pixels, then
 * the next frame where the site is visible must show the ears bare. That is the
 * right question and the wrong specimen — on a face whose lobes are behind her
 * hair, bare ears are also what you get from a branch with no state at all, and
 * a null result whose fixture could not have produced the other answer proves
 * nothing (the campaign's own instrument law).
 *
 * So the same question is put to a BORN-WORN thing that is plainly in the
 * master: her glasses. The master is reference 1 of every render on this road,
 * and it has her glasses on it, forever. If the next step's recipe does not say
 * the absence, the master paints them straight back on — and the removal she
 * paid for lasted exactly one frame.
 *
 * # What the code predicts before a pixel is bought
 *
 * `refineService` calls `repaintAsksFor({ delta: editDelta })` with THIS step's
 * delta. A departure is `delta.absent`, authored by the step that asked for it,
 * and nothing re-derives it from the branch's composed state. `assembleRecipe`
 * is handed `{master, pronouns, library, asks}` — no branch state — and a
 * born-worn departure leaves no library row to carry a standing sentence
 * (`LIBRARY_REMOVAL_DESIGN.md` §4: a vacate RETIRES a carry; where there was
 * never a carry, "the slot goes quiet"). So the prediction is that step B
 * cannot mention her glasses at all.
 *
 * This buys the picture that settles it.
 *
 *   step A   vacate glasses            → expect: gone (16/16 tonight)
 *   step B   an ordinary later ask, composed the way the product composes it:
 *            pristine master + branch library + step B's own delta
 *            → the question: are the glasses back?
 *
 * Off the ledger: no refine, no credits, no rows, no storage writes.
 *
 *   npx tsx scripts/prove-vacate-forgotten-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { deriveLibrary, libraryWithoutEditedCrops, supersededCarrySlots, type StoredReference } from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { verifyRender, isRefusableMiss } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift63-vacate-persistence";
/** Library 0, born-worn glasses, 2/2 removed tonight — the cleanest specimen. */
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const REMOVE = { absent: { statedAccessories: ["glasses"] } } as any;
/** Step B: an ordinary later ask that says nothing whatever about her eyes. */
const LATER = { hairColour: "copper" } as any;
const ASKED = "no glasses — they have been taken off and are not in the picture";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
await mkdir(OUT, { recursive: true });

const judge = async (bytes: Buffer): Promise<any> => {
  const verdict = await verifyRender({
    bytes, contentType: "image/png",
    facts: [{ facet: facetOfSubject("statedAccessories"), asked: ASKED, binding: true, absenceIsTheAsk: true }],
  });
  const check = verdict.checks[0];
  return {
    gone: check?.verified === true, saw: check?.saw ?? "(nothing named)",
    occluded: check?.occluded === true, refusable: check ? isRefusableMiss(check) : null,
  };
};

const face = (await query("SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE]))[0];
const rows = (await query(
  `SELECT id, publicId, candidateId, variantId, role, slot, tier, noun, words,
          storageKey, maskKey, digest, refusedReason, version, retiredAt, createdAt
     FROM casting_reference_library WHERE candidateId = ? AND retiredAt IS NULL ORDER BY id`,
  [face.id],
)).map((entry): StoredReference => ({
  id: entry.id, publicId: entry.publicId, candidateId: entry.candidateId,
  variantId: entry.variantId, role: entry.role, slot: entry.slot, tier: entry.tier,
  noun: entry.noun,
  words: typeof entry.words === "string" ? JSON.parse(entry.words) : (entry.words ?? []),
  storageKey: entry.storageKey, maskKey: entry.maskKey, digest: entry.digest,
  geometry: null, guard: null,
  refusal: entry.refusedReason ? { reason: entry.refusedReason, kind: "", coverage: null, contentKey: null, maskKey: null, geometry: null } : null,
  version: entry.version, retiredAt: entry.retiredAt, createdAt: new Date(entry.createdAt),
}));

const masterBytes = await storageReadBytes(face.imageKey);
const sharpModule = (await import("sharp")).default;
const meta = await sharpModule(masterBytes.bytes).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1536;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });

const control = await judge(masterBytes.bytes);
console.log(`CONTROL −  her master: ${control.gone ? "READ AS REMOVED — stop, nothing below counts" : "still wearing them"} — "${control.saw}"`);
if (control.gone) { await connection.end(); process.exit(1); }

const paint = async (label: string, delta: any) => {
  const asks = repaintAsksFor({ delta, prose: EDIT_PROSE, restore: { state: delta, slots: supersededCarrySlots(rows) } });
  if (!asks.ok) throw new Error(`${label}: the asks refused — ${asks.reason}: ${asks.detail}`);
  const recipe = assembleRecipe({
    master: { key: face.imageKey },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((a) => a.slot))),
    asks: asks.asks,
  });
  if (!recipe.ok) throw new Error(`${label}: the recipe refused — ${recipe.reason}`);
  /* THE WHOLE POINT, PRINTED: does this step's outgoing sentence mention the
     glasses at all? Read off the recipe that is about to be sent, not off a
     variable near it. */
  const mentions = /glasses|frames|lenses/i.test(recipe.prompt);
  console.log(`\n${label}: ${recipe.references.length} references · the sentence ${mentions ? "MENTIONS" : "says NOTHING about"} her glasses`);
  console.log(`  "${recipe.prompt.replace(/\s+/g, " ").slice(0, 260)}…"`);
  const painted = await repaint({
    recipe, engine, width, height,
    load: async (image): Promise<ReferenceBytes> => await storageReadBytes(image.key),
  });
  if (!painted.ok) throw new Error(`${label}: refused at the door — ${painted.reason}`);
  const verdict = await judge(painted.frame.bytes);
  const file = path.join(OUT, `${label}-${verdict.gone ? "no-glasses" : "GLASSES-BACK"}.png`);
  await writeFile(file, painted.frame.bytes);
  console.log(`  → ${verdict.gone ? "no glasses" : "GLASSES ARE THERE"} — "${verdict.saw}" → ${file}`);
  return { label, mentions, verdict, file };
};

const stepA = await paint("stepA-remove-glasses", REMOVE);
const stepB = await paint("stepB-later-ask", LATER);

console.log(`\n${"=".repeat(96)}`);
console.log(`step A said the absence: ${stepA.mentions} · glasses gone: ${stepA.verdict.gone}`);
console.log(`step B said the absence: ${stepB.mentions} · glasses gone: ${stepB.verdict.gone}`);
console.log(
  stepA.verdict.gone && !stepB.verdict.gone
    ? "\nTHE REMOVAL LASTED ONE FRAME. The next paid step re-anchors on the pristine master,\nnothing re-says the absence, and her glasses are painted back on."
    : "\nNot the predicted shape — read the frames before concluding anything.",
);
console.log("=".repeat(96));
await writeFile(path.join(OUT, "result.json"), JSON.stringify({ control, stepA, stepB }, null, 2));
await connection.end();
process.exit(0);
