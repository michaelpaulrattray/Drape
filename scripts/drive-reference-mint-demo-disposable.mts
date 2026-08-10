/**
 * THE MINT, DRIVEN ON A REAL FACE — and an honest account of what it proves.
 *
 * Fable's shift-28 queue item 2 asked for "the mint demo on his face, with each
 * kind's first crop verified by eye once so it becomes that kind's positive
 * specimen." The first half is this script. **The second half cannot be done
 * this way, and the reason is the point.**
 *
 * # Why a master read cannot produce a completeness specimen
 *
 * With no edit governing the frame, the mint's `applied` mask is the whole
 * picture, so the cut is `region(master)` — the region itself. The guard then
 * scores that crop against a FRESH read of the same region on the same frame.
 * The two reads are of one thing, so coverage lands near 1.0 whatever the
 * cutter did.
 *
 *     coverage = |region ∩ region'| / |region'|  ≈  1.0, by construction
 *
 * That is the identity control (already measured 14 of 14 at 100.0%), and it is
 * a fine control. It is NOT a specimen. A specimen is a crop a human looked at
 * and called complete — `hair`'s 94.6% is the delivered-anchored cut of v#163,
 * which came off a paid render where `applied` was a real edit mask. Adopting
 * a master read's number as a kind's threshold would be a class labelled by
 * what was sent, unable to fail to confirm its own instrument.
 *
 * **So specimens for the remaining kinds are blocked behind a paid render.**
 * Recorded rather than approximated.
 *
 * # What this DOES prove, which is worth its vision calls
 *
 * That the catalogue, the cutter and the guard are wired to a real face
 * correctly: that `lips` cuts her lips and not her mouth's neighbourhood, that
 * a slot with no question files words instead of the nearest bigger region, and
 * that a per-side slot is refused with `noSide` rather than handed a union of
 * both sides. Every crop is written to disk to be LOOKED AT (D-101), which is
 * the only instrument that has ever caught a fringe.
 *
 *   npx tsx scripts/drive-reference-mint-demo-disposable.mts --inventory
 *   npx tsx scripts/drive-reference-mint-demo-disposable.mts --candidate 359
 *
 * `--inventory` buys nothing: it prints the slots, the frame and the exact
 * number of vision calls the real run would spend, before anything spends one.
 *
 * Nothing is written to R2 and no row reaches any database — `store` and
 * `record` are injected. The write path has its own suite against real MySQL
 * (`castingV2-reference-library-db.test.ts`), and a demo that also exercised it
 * would prove neither half more clearly.
 */
import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue";
import { mintReferencesForRender, type SlotSpec } from "../server/castingV2/referenceMint";
import type { RegionReader as MintRegionReader } from "../server/castingV2/referenceCompleteness";
import type { Mask } from "../server/castingV2/maskedComposite";

const INVENTORY = process.argv.includes("--inventory");
const CANDIDATE = (() => {
  const index = process.argv.indexOf("--candidate");
  return index > -1 ? Number(process.argv[index + 1]) : null;
})();
const OUT = path.join("output", "mint-demo");

/**
 * The slots this run asks about.
 *
 * Everything the catalogue can name, so the refusals are part of the
 * demonstration rather than filtered out of it: a `noQuestion` slot and a
 * `noSide` slot each cost nothing and each say something.
 */
function slotsToDrive(): SlotSpec[] {
  return catalogueSlots().map((definition) => ({
    slot: definition.slot,
    tier: definition.tier,
    noun: definition.noun,
    /*
      EMPTY, AND DECLARED. A born read of a master has had nothing said about
      it: the words a real mint files come from the render's own read-back, and
      there is no render here. The subject of this run is the crop and the
      guard's reading; the words column is empty by construction rather than
      invented, which is the difference between a demo and a fiction.
    */
    words: [],
    question: definition.question,
    guardKind: definition.guardKind,
    frame: definition.frame,
  }));
}

async function main(): Promise<void> {
  assertOneWorld();
  mkdirSync(OUT, { recursive: true });

  const slots = slotsToDrive();
  const cuttable = slots.filter((slot) => (
    slot.tier !== "surface" && slot.question !== null && slot.frame === "wholeFrame"
  ));
  const questions = Array.from(new Set(cuttable.map((slot) => slot.question!)));

  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.query(
    CANDIDATE === null
      ? "select id, publicId, imageKey from casting_candidates where userId=1 and imageKey is not null order by id desc limit 1"
      : "select id, publicId, imageKey from casting_candidates where userId=1 and id=? and imageKey is not null",
    CANDIDATE === null ? [] : [CANDIDATE],
  ) as [Array<{ id: number; publicId: string; imageKey: string }>, unknown];
  await connection.end();

  const candidate = rows[0];
  if (!candidate) throw new Error("no candidate of user 1 with a master image");

  console.log(`candidate    ${candidate.id} (${candidate.publicId})`);
  console.log(`master       ${candidate.imageKey}`);
  console.log(`slots        ${slots.length} catalogued`);
  console.log(`cuttable     ${cuttable.length} — ${cuttable.map((slot) => slot.slot).join(", ")}`);
  console.log(`refused free ${slots.length - cuttable.length} (no question, per-side, or surface)`);
  /* Each cuttable slot buys one region read for the cut and one for the guard's
     independent second look. A bilateral question would buy a face read on top,
     and none of them are cuttable here — which is the `noSide` rule paying its
     own way. */
  console.log(`vision calls ${questions.length} for the cut + ${cuttable.length} for the guard = ${questions.length + cuttable.length}`);
  if (INVENTORY) {
    console.log("\n--inventory: nothing bought.");
    return;
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is required — a demo that cannot segment proves nothing");
  const reader = createFalRegionReader({ apiKey });

  const master = await fetchImageBytes(`${process.env.R2_PUBLIC_URL}/${candidate.imageKey}`);
  writeFileSync(path.join(OUT, "master.png"), master.bytes);
  console.log(`\nmaster fetched — ${master.bytes.length} bytes, ${master.mime}\n`);

  /* The cut's regions, read once each. The guard reads its own, through the
     mint, which is the independence the door depends on. */
  const masterRegions = new Map<string, Mask>();
  for (const question of questions) {
    try {
      const mask = await reader.region({ image: master.bytes, name: question, absentIsAnswer: true });
      const pixels = mask.data.reduce((total, byte) => total + (byte > 0 ? 1 : 0), 0);
      masterRegions.set(question, mask);
      console.log(`read   ${question.padEnd(14)} ${pixels} px`);
    } catch (error) {
      console.log(`read   ${question.padEnd(14)} DID NOT SETTLE — ${(error as Error).message}`);
    }
  }

  const guardRead: MintRegionReader = async ({ frame, question }) => (
    reader.region({ image: frame, name: question, absentIsAnswer: true })
  );

  const written: string[] = [];
  const result = await mintReferencesForRender({
    userId: 1,
    variantId: null,
    candidateId: candidate.id,
    frame: { bytes: master.bytes },
    /* NULL is the born read: no edit governed this frame, so a slot owns its
       whole region. See the header for why that makes coverage a control
       rather than a specimen. */
    applied: null,
    masterRegions,
    slots,
    dependencies: {
      read: guardRead,
      enabledFor: () => true,
      store: async ({ key, bytes }) => {
        /* A crop and its mask are one thing looked at two ways, so they share
           an index — otherwise the pair reads as two unrelated files and the
           eye has to reconstruct which mask belongs to which crop. */
        const mask = key.endsWith("-mask.png");
        const pair = Math.floor(written.length / 2);
        const name = mask ? `${pair}-mask.png` : `${pair}.png`;
        writeFileSync(path.join(OUT, name), bytes);
        written.push(name);
        return { key };
      },
      manifest: async () => undefined,
      record: (async (input: { rows: readonly { slot: string }[] }) => input.rows.map((row, index) => ({
        id: index + 1,
        publicId: `demo-${index}`,
        candidateId: candidate.id,
        slot: row.slot,
        role: "carry" as const,
        version: 1,
      }))) as never,
    },
  });

  console.log(`\noutcome ${result.outcome}\n`);
  const width = Math.max(...result.slots.map((slot) => slot.slot.length));
  for (const slot of result.slots) {
    console.log(slot.outcome === "stored"
      ? `  ${slot.slot.padEnd(width)}  STORED      ${(slot.coverage * 100).toFixed(1)}%`
      : `  ${slot.slot.padEnd(width)}  words-only  ${slot.reason}${slot.detail ? ` — ${slot.detail}` : ""}`);
  }
  console.log(`\ncrops written to ${OUT} — LOOK AT THEM. ${written.length} file(s).`);
}

await main();
process.exit(0);
