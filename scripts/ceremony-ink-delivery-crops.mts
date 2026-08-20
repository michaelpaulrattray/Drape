/**
 * Ceremony — **THE DELIVERED-TATTOO STORE** (`casting_ink_delivery_crops`,
 * migration 0049): the crop of the frame that first delivered a design onto a
 * Cast, which is what the carry lane sends instead of the customer's artwork
 * (design report opus-886 §3, countersigned fable-1193 §3 / fable-1194 §2).
 *
 *   npx tsx scripts/ceremony-ink-delivery-crops.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-delivery-crops.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHY IT IS A NAMED PREREQUISITE OF THE INK STACK'S DEPLOY
 *
 * The writer is a post-delivery mint that catches its own failure, so an absent
 * table costs a CROP and never a customer's picture — nothing here is a crash
 * risk. But the carry lane falls back to the artwork whenever no crop exists,
 * and that fallback is the exact frame the court measured onto a T-shirt three
 * times. **So a deploy without this ceremony is a deploy where (a) silently
 * does not happen**, which is indistinguishable at the frames from (a) not
 * working. That is the failure this command exists to prevent, and it is the
 * reason it is on the founder's card rather than left to a boot guard.
 *
 * # WHAT IT READS BACK, and why each one is worth a round trip
 *
 * **The unique index is the ruling.** fable-1193 §3b's *minted ONCE, never
 * re-cut from a later carry* is `uq_casting_ink_delivery_crops_design` and
 * nothing else — no application code enforces it, deliberately, because a rule
 * that lives in a writer is a rule the next writer does not inherit. A table
 * created from an older copy of this file, or by a hand that dropped the index,
 * would take a second mint quietly and start the chained-anchor drift the whole
 * rule exists to prevent. So the index is read back BY NAME and BY COLUMNS.
 *
 * **The counted columns are the anti-silence arm.** `maskPixels` and
 * `keptPixels` exist so the whole-frame cut failure — a raw greyscale alpha
 * through `composite({blend:"dest-in"})`, which returns the entire photograph
 * while every number beside it stays correct — is findable by a query. They are
 * asserted present because a column nobody checks is a column a later tidy
 * removes as unused, and their whole job is to be unused until the day they are
 * the only evidence.
 *
 * **And it asserts an ABSENCE.** A row here points at a picture of a real
 * person's neck, so its short column list is a boundary and not a convenience:
 * no prose about the picture, no reader's description, no instruction. An
 * absence nobody checks is an absence that quietly ends.
 */
import {
  applyOnce,
  closeCeremony,
  columnType,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";

const TABLE = "casting_ink_delivery_crops";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  await applyOnce({
    what: "the delivered-tattoo store is here",
    isApplied: () => tableExists(world.connection, TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0049_casting_ink_delivery_crops.sql"),
  });

  /*
    THE RULING, READ BACK OFF THE DATABASE — see the header. `SHOW INDEX` names
    the columns in their own order, which is the half of it a `COUNT(*)` would
    miss: an index over (candidateId, slot) alone would permit two designs on
    one slot and refuse the second, which is a different rule wearing the same
    name.
  */
  const [indexRows] = await world.connection.query<any[]>(
    `SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = 'uq_casting_ink_delivery_crops_design'`,
  );
  if (indexRows.length === 0) {
    throw new Error(
      "`uq_casting_ink_delivery_crops_design` is absent — MINTED ONCE has no enforcement, and a second mint would start the chained-anchor drift",
    );
  }
  if (indexRows.some((row) => row.Non_unique !== 0)) {
    throw new Error("`uq_casting_ink_delivery_crops_design` exists and is NOT UNIQUE — it enforces nothing");
  }
  const indexed = [...indexRows]
    .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
    .map((row) => row.Column_name as string);
  const wanted = ["candidateId", "designId", "slot"];
  const same = indexed.length === wanted.length && indexed.every((name, at) => name === wanted[at]);
  if (!same) {
    throw new Error(
      `\`uq_casting_ink_delivery_crops_design\` is over [${indexed.join(", ")}] and the rule is [${wanted.join(", ")}]`,
    );
  }
  console.log(`  minted once  UNIQUE(${indexed.join(", ")})`);

  /* The columns whose absence would be silent — see the header. */
  for (const column of ["storageKey", "digest", "variantId", "maskPixels", "keptPixels"]) {
    const ddl = await columnType(world.connection, TABLE, column);
    if (ddl === null) throw new Error(`\`${column}\` is missing — a table created from an older copy of the migration`);
    console.log(`  ${column.padEnd(11)} ${ddl}`);
  }

  /* THE ABSENCE, read back. This row points at a picture of a person. */
  const forbidden = ["sentence", "instruction", "description", "prompt", "caption"];
  const present: string[] = [];
  for (const column of forbidden) {
    if (await columnType(world.connection, TABLE, column) !== null) present.push(column);
  }
  if (present.length > 0) {
    throw new Error(
      `\`${TABLE}\` carries [${present.join(", ")}] — this row holds a cut and where it sat, and may not carry prose about the person in it`,
    );
  }
  console.log(`  absent       ${forbidden.join(" · ")}  (no prose about the picture)`);

  /*
    A WHOLE-FRAME CUT, IF ONE HAS EVER BEEN WRITTEN — the counted columns doing
    the job they exist for. Zero rows is the expected answer on the day this
    lands and stays a legitimate one; a row where the cut kept every pixel of
    its frame is the silent failure, and it is a finding rather than a warning.
  */
  const [rows] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS n, SUM(keptPixels >= frameWidth * frameHeight) AS whole FROM \`${TABLE}\``,
  );
  const total = Number(rows[0].n);
  const whole = Number(rows[0].whole ?? 0);
  console.log(`rows: ${total}${total === 0 ? " (the mint has not run here yet)" : ""}`);
  if (whole > 0) {
    throw new Error(`${whole} of ${total} rows kept the WHOLE FRAME — the cut did not cut, and those crops are photographs`);
  }
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
