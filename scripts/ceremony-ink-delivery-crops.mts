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
 * re-cut from a later carry* is enforced by an index and by nothing else — no
 * application code enforces it, deliberately, because a rule that lives in a
 * writer is a rule the next writer does not inherit. A table created from an
 * older copy of this file, or by a hand that dropped the index, would take a
 * second mint quietly and start the chained-anchor drift the whole rule exists
 * to prevent. So the index is read back BY NAME and BY COLUMNS.
 *
 * **And there are TWO names it may legitimately wear**, because 0050 re-keys
 * this table off the DESIGN and onto the FRAME THAT DELIVERED IT — see the
 * read-back's own comment. *(This paragraph said `uq_casting_ink_delivery_crops_
 * design` "and nothing else" until 2026-08-21, one migration after that stopped
 * being true, and a real confirmation pass printed FAILED over a correct
 * database because of it.)*
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
  indexColumns,
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

    ⚠ AND THERE ARE TWO CORRECT WORLDS NOW, WHICH IS WHY THIS READS BOTH
    (ordered fable-1232 §3, from a real re-run that printed FAILED over a
    correct database).

    0050 re-keys this table off the DESIGN and onto the FRAME THAT DELIVERED IT.
    Production has taken both, in one sitting, in that order. Written against
    the original key alone, this ceremony's re-check then asserted the very
    index its own sibling had legitimately removed — so re-running the pair to
    confirm the world printed FAILED at 0049 and OK at 0050, about the same
    correct table. **A confirmation pass that cries wolf is worse than none: the
    next reader either stops trusting it or starts fixing a world that is not
    broken.**

    So MINTED ONCE is read as a PROPERTY rather than as one index's name — it is
    enforced by exactly one of two, and which one says only how far the pair has
    got. What this must still refuse, and does, is the world where NEITHER is
    there: that is the enforcement genuinely absent, which is the whole reason
    this block exists.
  */
  const KEYS = [
    { name: "uq_casting_ink_delivery_crops_design", columns: ["candidateId", "designId", "slot"], world: "0049 alone" },
    { name: "uq_casting_ink_delivery_crops_delivery", columns: ["candidateId", "variantId", "slot"], world: "0050 applied" },
  ] as const;

  const seen = await Promise.all(
    KEYS.map(async (key) => ({ key, read: await indexColumns(world.connection, TABLE, key.name) })),
  );
  const live = seen.filter((one) => one.read.present);
  if (live.length === 0) {
    throw new Error(
      `neither \`${KEYS[0].name}\` nor \`${KEYS[1].name}\` is here — MINTED ONCE has no enforcement at all, and a second mint would start the chained-anchor drift`,
    );
  }
  /*
    BOTH is not a third correct world — it is 0050 half-applied, and it is the
    exact state its own read-back refuses: the old key left in place makes every
    words-only delivery refuse on a NULL-repeating index nobody is looking at.
    Named here so a reader of THIS command is sent to the right one.
  */
  if (live.length === 2) {
    throw new Error(
      `both \`${KEYS[0].name}\` and \`${KEYS[1].name}\` are here — 0050 is HALF-APPLIED; run scripts/ceremony-ink-delivery-rekey.mts, whose read-back owns this`,
    );
  }
  const { key, read } = live[0];
  if (!read.unique) throw new Error(`\`${key.name}\` exists and is NOT UNIQUE — it enforces nothing`);
  const wanted = [...key.columns];
  const same = read.columns.length === wanted.length && read.columns.every((name, at) => name === wanted[at]);
  if (!same) {
    throw new Error(
      `\`${key.name}\` is over [${read.columns.join(", ")}] and the rule is [${wanted.join(", ")}]`,
    );
  }
  console.log(`  minted once  UNIQUE(${read.columns.join(", ")})   [${key.world}]`);

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
