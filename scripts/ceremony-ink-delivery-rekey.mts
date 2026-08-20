/**
 * Ceremony — **THE DELIVERY IS THE KEY** (`casting_ink_delivery_crops`,
 * migration 0050): re-keying the delivered-tattoo store off the DESIGN and onto
 * the FRAME THAT DELIVERED IT, and making `designId` nullable provenance
 * (recommended opus-890 §3 as shape (c), ruled fable-1197 §1).
 *
 *   npx tsx scripts/ceremony-ink-delivery-rekey.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-delivery-rekey.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # IT RUNS AFTER `ceremony-ink-delivery-crops`, ALWAYS
 *
 * 0050 alters the table 0049 creates. Production has taken neither, so both
 * commands land in one sitting and in that order — this one refuses outright if
 * the table is not there, rather than creating anything itself, because a
 * ceremony that quietly does its predecessor's job is a ceremony that hides a
 * skipped step.
 *
 * # WHAT IT IS FOR, in one paragraph
 *
 * A tattoo painted from the customer's own WORDS — D-137's face-and-neck road —
 * has no design row anywhere. Keyed on the design, its delivery could not be
 * recorded, so it could not be carried, so it vanished on her next unrelated
 * edit. The row was never really about the design: it has always meant *this
 * frame delivered this ink onto this placement*, and the new key says so.
 *
 * # WHAT IT READS BACK, and why each one is worth a round trip
 *
 * **The new key is the ruling.** MINTED ONCE is `uq_casting_ink_delivery_crops_
 * delivery` and nothing else — no application code enforces it, deliberately,
 * because a rule that lives in a writer is a rule the next writer does not
 * inherit. So the index is read back BY NAME and BY COLUMNS IN ORDER: an index
 * over (candidateId, slot) would permit one crop per placement for all time and
 * wear the same name, which is a different rule entirely.
 *
 * **AND THE OLD KEY IS READ BACK ABSENT.** This is the half a `CREATE` ceremony
 * never has to check and the half that can silently half-happen: leave
 * `uq_casting_ink_delivery_crops_design` in place and every words-only delivery
 * still refuses on a NULL-repeating index nobody is looking at — the feature
 * would appear to land and would keep failing for the exact lane it was built
 * for. An absence nobody checks is an absence that quietly ends.
 *
 * **And `designId` is read back NULLABLE.** The column keeps its type and loses
 * its NOT NULL; if the MODIFY did not take, the first words-only mint fails at
 * the insert with a constraint error and the crop is silently never kept.
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
const NEW_KEY = "uq_casting_ink_delivery_crops_delivery";
const OLD_KEY = "uq_casting_ink_delivery_crops_design";

/** Every column of one named index, in the order the index holds them. */
async function indexColumns(
  connection: Awaited<ReturnType<typeof openCeremonyWorld>>["connection"],
  name: string,
): Promise<{ present: boolean; unique: boolean; columns: string[] }> {
  const [rows] = await connection.query<any[]>(
    `SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = ?`,
    [name],
  );
  return {
    present: rows.length > 0,
    unique: rows.length > 0 && rows.every((row) => row.Non_unique === 0),
    columns: [...rows]
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map((row) => row.Column_name as string),
  };
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  /*
    ITS PREDECESSOR, PROVEN RATHER THAN ASSUMED. `replayMigration` would fail on
    a missing table anyway, with the driver's own sentence about an unknown
    table — which reads as a broken migration rather than as a skipped step.
  */
  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(
      `\`${TABLE}\` is not here — run scripts/ceremony-ink-delivery-crops.mts (migration 0049) FIRST; this ceremony alters that table and will not create it`,
    );
  }

  await applyOnce({
    what: "the delivered-tattoo store is keyed on the DELIVERY",
    isApplied: async () => (await indexColumns(world.connection, NEW_KEY)).present,
    apply: () => replayMigration(world.connection, "drizzle/0050_ink_delivery_keyed_on_delivery.sql"),
  });

  /* THE NEW RULING, read back off the database — name, uniqueness and the
     column ORDER, which a COUNT would miss. */
  const now = await indexColumns(world.connection, NEW_KEY);
  if (!now.unique) throw new Error(`\`${NEW_KEY}\` exists and is NOT UNIQUE — it enforces nothing`);
  const wanted = ["candidateId", "variantId", "slot"];
  const same = now.columns.length === wanted.length && now.columns.every((name, at) => name === wanted[at]);
  if (!same) {
    throw new Error(
      `\`${NEW_KEY}\` is over [${now.columns.join(", ")}] and the rule is [${wanted.join(", ")}]`,
    );
  }
  console.log(`  minted once  UNIQUE(${now.columns.join(", ")})`);

  /* AND THE OLD RULING, read back GONE — see the header. */
  const before = await indexColumns(world.connection, OLD_KEY);
  if (before.present) {
    throw new Error(
      `\`${OLD_KEY}\` is still here over [${before.columns.join(", ")}] — every words-only delivery would still refuse on a key it cannot satisfy, and the feature would look landed`,
    );
  }
  console.log(`  old key      ${OLD_KEY} is GONE`);

  /* AND THE COLUMN THAT HAD TO GIVE. `SHOW COLUMNS` reports the type; the
     nullability is its own field, so it is read directly. */
  const ddl = await columnType(world.connection, TABLE, "designId");
  if (ddl === null) throw new Error("`designId` is missing — this is not the table 0049 created");
  const [designColumn] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE 'designId'`,
  );
  const nullable = String(designColumn[0]?.Null ?? "").toUpperCase() === "YES";
  if (!nullable) {
    throw new Error(
      "`designId` is still NOT NULL — a tattoo painted from her words has no design, and its first mint would fail at the insert",
    );
  }
  console.log(`  designId     ${ddl} NULL  (provenance, never key)`);

  /*
    AND WHAT THE RE-KEY MADE POSSIBLE, counted. Zero rows and zero words-only
    rows are both the expected answer on the day this lands; the line is here so
    that a later run of the same command is a reading rather than a repeat.
  */
  const [rows] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS n, SUM(designId IS NULL) AS words FROM \`${TABLE}\``,
  );
  const total = Number(rows[0].n);
  const words = Number(rows[0].words ?? 0);
  console.log(`rows: ${total} (${words} painted from words, ${total - words} from a design)`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
