/**
 * THE ONE PART OF THE WORDS ROAD ONLY A DATABASE CAN PROVE — driven against
 * dev, because the unit suite has no database and three of these facts are DDL
 * rather than code (migration 0050, ruled fable-1197 §1).
 *
 *   npx tsx scripts/arm-words-only-crop-row-disposable.mts --dev
 *
 * DEV ONLY. It writes one row and deletes it, and it reads the row back through
 * the product's own reader rather than through a query it wrote itself.
 *
 * # The three facts, and each one fails silently without this arm
 *
 * 1. **`designId` is genuinely NULLABLE.** If the `MODIFY` did not take, the
 *    first words-only mint fails at the insert with a constraint error, the
 *    mint catches its own failure by design, and the crop is simply never kept
 *    — a tattoo that quietly goes on vanishing, with nothing red anywhere.
 * 2. **`listInkDeliveryCrops` is a LEFT join.** It joined the design table
 *    INNER until 0050. An inner join drops every row whose `designId` is NULL,
 *    which is every words-only delivery — the row would be written correctly
 *    and never read, which is the same outcome as not writing it and is harder
 *    to find.
 * 3. **The writer honours the name the chain minted.** The carry looks a crop
 *    up by `publicId` and nothing else, so a writer that generated its own
 *    would file a row nothing can ever find while logging `minted`.
 *
 * # And a fourth, which is the whole re-key
 *
 * A SECOND words-only crop at the SAME placement on the SAME Cast, from a
 * DIFFERENT frame, must be accepted. Under the old key it could not exist —
 * NULLs repeat inside a MySQL unique index, so the design lane's minted-once
 * rule silently stopped applying to the words lane. Under the new key each
 * delivering frame owns its own row, and a re-mint from the SAME frame is
 * still refused. Both are asserted.
 *
 * # It cleans up after itself, on every exit
 *
 * The rows it writes point at storage keys with no bytes behind them, so they
 * are deleted in a `finally` whether the arm passes, fails or throws. The
 * manifest is deliberately not used: nothing is uploaded, so there is nothing
 * for the cleanup worker to hold.
 */
import { randomUUID } from "node:crypto";

import { closeCeremony, openCeremonyWorld } from "./lib/ceremony.mts";

const TABLE = "casting_ink_delivery_crops";
const SLOT = "ink:neck";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
const written: string[] = [];
try {
  if (world.world !== "dev") {
    throw new Error(`this arm writes rows and runs on DEV alone — got ${world.world}`);
  }

  /* The product's own modules, imported after the world is named so that
     `dotenv` has already run and they connect to the same database. */
  const { listInkDeliveryCrops, recordInkDeliveryCrop } =
    await import("../server/db/castingV2InkDeliveryCrops.ts");

  /*
    A REAL Cast and TWO REAL FRAMES of it, read out of the database rather than
    invented: the writer re-proves the candidate and the variant inside its own
    transaction, so made-up ids would prove the ownership check and nothing
    else.
  */
  /*
    ⚠ AND NEITHER FRAME MAY ALREADY HOLD A CROP AT THIS PLACEMENT — the first
    version of this arm omitted that clause and scored FAIL on arm 4a, because
    the newest frame in dev is the one the carry court minted a real neck crop
    from. `already` was the CORRECT answer to a fixture that had asked the
    wrong question. The exclusion is what makes a refusal here mean the key.
  */
  const [pairs] = await world.connection.query<any[]>(
    `SELECT c.publicId AS cand, c.userId AS userId, v.publicId AS variant
       FROM casting_candidates c
       JOIN casting_candidate_variants v ON v.candidateId = c.id
      WHERE NOT EXISTS (
        SELECT 1 FROM \`${TABLE}\` d WHERE d.variantId = v.id AND d.slot = ?
      )
      ORDER BY v.id DESC LIMIT 2`,
    [SLOT],
  );
  if (pairs.length < 2) throw new Error("dev has fewer than two variants — nothing to write against");
  const [first, second] = pairs as Array<{ cand: string; userId: number; variant: string }>;
  if (first!.cand !== second!.cand) throw new Error("the two newest frames are not the same Cast");
  console.log(`subject     cast ${first!.cand} · user ${first!.userId}`);

  const row = (publicId: string, variantPublicId: string) => ({
    userId: first!.userId,
    candidatePublicId: first!.cand,
    publicId,
    /* NO `designPublicId`. This is the whole point: D-137's road has none. */
    variantPublicId,
    slot: SLOT,
    region: "tattooed skin",
    storageKey: `casting-v2/ink-delivery/${publicId}.png`,
    digest: "0".repeat(64),
    mime: "image/png",
    byteSize: 1,
    width: 10,
    height: 10,
    bboxX: 1,
    bboxY: 2,
    bboxW: 10,
    bboxH: 10,
    frameWidth: 100,
    frameHeight: 200,
    maskPixels: 60,
    keptPixels: 50,
  });

  /* ---- 1 + 3: it writes, with no design, under the name it was given. ---- */
  const nameOne = randomUUID();
  const one = await recordInkDeliveryCrop(row(nameOne, first!.variant));
  written.push(nameOne);
  const wroteIt = one.outcome === "minted" && one.publicId === nameOne;
  console.log(`  arm 1+3   a crop with NO design, under the chain's own name  ${wroteIt ? "PASS" : "FAIL"}  (${one.outcome})`);

  /* ---- 2: and the reader gives it back. ---- */
  const listed = await listInkDeliveryCrops({ userId: first!.userId, candidatePublicId: first!.cand });
  const found = listed.find((crop) => crop.publicId === nameOne);
  const readBack = found !== undefined && found.designPublicId === null && found.slot === SLOT;
  console.log(
    `  arm 2     the reader returns it, with a NULL design  ${readBack ? "PASS" : "FAIL"}`
    + `  (found: ${found !== undefined}, design: ${JSON.stringify(found?.designPublicId ?? "—")})`,
  );

  /* ---- 4: a second frame's crop at the same placement is ACCEPTED... ---- */
  const nameTwo = randomUUID();
  const two = await recordInkDeliveryCrop(row(nameTwo, second!.variant));
  if (two.outcome === "minted") written.push(nameTwo);
  const secondFrame = two.outcome === "minted";
  console.log(`  arm 4a    a SECOND frame's words-only crop is accepted  ${secondFrame ? "PASS" : "FAIL"}  (${two.outcome})`);

  /* ---- ...and a re-mint from the SAME frame is still refused. ---- */
  const three = await recordInkDeliveryCrop(row(randomUUID(), first!.variant));
  const mintedOnce = three.outcome === "already";
  console.log(`  arm 4b    a re-mint from the SAME frame is refused — MINTED ONCE  ${mintedOnce ? "PASS" : "FAIL"}  (${three.outcome})`);

  /*
    THE NEGATIVE CONTROL. Without it, arm 4b would pass on a writer that
    refused everything, and arms 1–2 would pass on a reader that returned every
    row it could see regardless of owner.
  */
  let refusedForeign = false;
  await recordInkDeliveryCrop({ ...row(randomUUID(), first!.variant), userId: first!.userId + 100000 })
    .catch(() => { refusedForeign = true; });
  console.log(`  negative  a crop filed against another account is REFUSED  ${refusedForeign ? "PASS" : "FAIL"}`);

  if (!wroteIt || !readBack || !secondFrame || !mintedOnce || !refusedForeign) {
    throw new Error("the arm did not prove what it claims — read the lines above");
  }
  console.log("PROVEN — a tattoo with no design is written, keyed and READ BACK");
} catch (cause) {
  failure = cause;
} finally {
  /* Every row this wrote, gone — they point at keys with no bytes. */
  for (const publicId of written) {
    await world.connection.query(`DELETE FROM \`${TABLE}\` WHERE publicId = ?`, [publicId]).catch(() => {});
  }
  const [left] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS n FROM \`${TABLE}\` WHERE publicId IN (${written.map(() => "?").join(",") || "''"})`,
    written,
  );
  console.log(`cleanup     ${written.length} written, ${Number(left[0].n)} left behind`);
}

process.exit(await closeCeremony(world, failure));
