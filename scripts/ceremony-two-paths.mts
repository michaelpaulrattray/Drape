/**
 * Ceremony — **THE TWO PATHS** (`casting_rolls.path` and
 * `casting_rolls.wardrobeLine`, migration 0051): which path a sheet was cast on
 * — Wardrobe or Basics — and the outfit line that was resolved for it (founder
 * ruling 2026-08-21, *"this is the way foward 100%"*, relayed fable-1311 with
 * fable-1312's addendum; design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md`,
 * countersigned fable-1334).
 *
 *   npx tsx scripts/ceremony-two-paths.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-two-paths.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHY THIS ONE IS A BLOCKING PREREQUISITE OF THE CODE RATHER THAN OF THE FLIP
 *
 * Every other ceremony in this folder creates a table, and a table nobody reads
 * costs nothing until its feature is switched on. **This one adds columns to a
 * table the whole studio already SELECTs.** Drizzle names its columns in the
 * statement, so the moment `drizzle/schema.ts` gains these two, every read of
 * `casting_rolls` in the product asks for them — flag or no flag, dark or not.
 * Against a production database that has not taken this migration, that is not
 * a dark landing; it is roll history failing to load for everybody.
 *
 * So the order is **this command → the code lands dark → the court → his eyes
 * → the flip**, and until this command has run in a world, the schema half must
 * not reach it. At the commit that carries migration 0051, `drizzle/schema.ts`
 * deliberately does not name either column, and
 * `server/castingV2/twoPathsMigration.test.ts` pins that.
 *
 * # WHAT IT READS BACK, and why each one is worth a round trip
 *
 * **The DEFAULT, which is the one that would be a permanent, silent loss.**
 * `NULL` here means *cast before the paths existed*, and that meaning survives
 * only if the ALTER left the historical rows alone. MySQL fills every existing
 * row with a column's DEFAULT when one is given — so a copy of this migration
 * carrying `DEFAULT 'wardrobe'` would stamp all 44 dev rolls and every
 * production roll with a claim that they were cast on a path that did not exist
 * when they were cast. There is no repair afterwards, because the distinction it
 * destroys is the only evidence of which rolls predate the feature, and a table
 * created from such a copy looks entirely healthy. So the default is read back
 * BY VALUE, and on the sitting that applies it the non-null count is asserted
 * to be zero.
 *
 * **The enum's own two words.** `path` is code-owned and closed by his ruling —
 * not 0046's open, customer-supplied vocabulary — so the fence is the feature:
 * under `STRICT_TRANS_TABLES` a third path arriving without a migration must
 * ERROR at the insert rather than be written and read back as a word no reader
 * handles. An enum silently created over the wrong two words would refuse the
 * product's own value on the day the code lands, which is a long way from here.
 *
 * **The width, because the line is complete or it is a contradiction.** The
 * stored line carries top, bottoms and footwear so the waist-up sheet and the
 * three full-length signed views cannot disagree about what she is wearing
 * below the crop. A narrower column truncates the footwear — and under strict
 * mode that errors at the write, days after this command, in front of a
 * customer.
 *
 * **And it asserts an ABSENCE.** Nothing on the CANDIDATE may hold a wardrobe.
 * One outfit per sheet is the comparability law (design §B2: a sheet compares
 * people, not clothes), and the day someone adds a per-candidate garment column
 * is the day eight people wear eight outfits and the sheet stops answering the
 * question it exists for.
 */
import {
  applyOnce,
  closeCeremony,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";

const TABLE = "casting_rolls";

type Connection = Awaited<ReturnType<typeof openCeremonyWorld>>["connection"];

/**
 * A column's live DDL, its nullability AND its default.
 *
 * `columnType` in the shared skeleton answers the Type alone, which is the
 * right shape for every ceremony written so far — none of them had a default
 * that could destroy data. This one does, so the reading is here rather than in
 * the shared module: the skeleton's own docblock says what stays per-ceremony
 * is *what evidence to print afterwards*, and a helper nobody else needs in the
 * shared file is one more thing to keep true.
 */
async function columnFacts(
  connection: Connection,
  column: string,
): Promise<{ type: string; nullable: boolean; dflt: string | null } | null> {
  const [rows] = await connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [column],
  );
  if (rows.length !== 1) return null;
  return {
    type: String(rows[0].Type),
    nullable: String(rows[0].Null).toUpperCase() === "YES",
    dflt: rows[0].Default === null ? null : String(rows[0].Default),
  };
}

const WANTED = [
  { column: "path", type: "enum('wardrobe','basics')" },
  { column: "wardrobeLine", type: "varchar(240)" },
] as const;

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  /* The table itself is not this ceremony's to create, and its absence means a
     world far stranger than a missing migration. */
  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(`\`${TABLE}\` is not here — this ceremony adds columns to a table the studio already reads`);
  }

  /*
    HALF-APPLIED IS NAMED RATHER THAN RETRIED. Two ALTERs, so a run interrupted
    between them leaves one column standing. Replaying the file in that state
    fails on the first statement with MySQL's own duplicate-column message,
    which says nothing about what happened — so it is caught here and named,
    with the repair stated.
  */
  const before = await Promise.all(WANTED.map((one) => columnFacts(world.connection, one.column)));
  const standing = before.filter((facts) => facts !== null).length;
  if (standing === 1) {
    const alone = WANTED[before.findIndex((facts) => facts !== null)].column;
    throw new Error(
      `\`${alone}\` is here and its sibling is not — 0051 is HALF-APPLIED; drop \`${alone}\` and re-run, so the pair lands together`,
    );
  }

  const outcome = await applyOnce({
    what: "the two paths are on the roll",
    isApplied: async () =>
      (await Promise.all(WANTED.map((one) => columnFacts(world.connection, one.column))))
        .every((facts) => facts !== null),
    apply: () => replayMigration(world.connection, "drizzle/0051_casting_rolls_two_paths.sql"),
  });

  /* THE SHAPE, off the database rather than off the file that asked for it. */
  for (const wanted of WANTED) {
    const facts = await columnFacts(world.connection, wanted.column);
    if (facts === null) throw new Error(`\`${wanted.column}\` is missing after a successful apply — stop and investigate`);
    if (facts.type !== wanted.type) {
      throw new Error(`\`${wanted.column}\` is \`${facts.type}\` and the migration asks for \`${wanted.type}\``);
    }
    if (!facts.nullable) {
      throw new Error(`\`${wanted.column}\` is NOT NULL — a roll cast before the paths existed has no honest value to hold`);
    }
    if (facts.dflt !== null) {
      throw new Error(
        `\`${wanted.column}\` carries DEFAULT '${facts.dflt}' — every historical roll has been stamped with a path it was not cast on, and that cannot be undone`,
      );
    }
    console.log(`  ${wanted.column.padEnd(12)} ${facts.type}  NULL  no default`);
  }

  /*
    THE ABSENCE — one outfit per SHEET. A per-candidate garment column would be
    added by someone solving a real problem, which is exactly why it is checked
    here rather than trusted to review.
  */
  const [candidateColumns] = await world.connection.query<any[]>("SHOW COLUMNS FROM `casting_candidates`");
  const strays = candidateColumns
    .map((row: any) => String(row.Field))
    .filter((name: string) => /wardrobe|outfit|garment/i.test(name));
  if (strays.length > 0) {
    throw new Error(
      `\`casting_candidates\` carries [${strays.join(", ")}] — the outfit belongs to the sheet, and eight candidates in eight outfits is the comparability law broken`,
    );
  }
  console.log("  absent       a per-candidate wardrobe column  (one outfit per sheet)");

  /*
    WHAT THE HISTORICAL ROWS SAY. On the sitting that applies it, every row must
    read NULL on both — a non-zero count is the DEFAULT failure above having
    already happened, and it is a finding rather than a warning. On a
    confirmation re-run the counts are printed and nothing is asserted, because
    by then the product may legitimately have cast on a path.
  */
  const [counts] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS n,
            SUM(\`path\` IS NOT NULL) AS pathSet,
            SUM(\`wardrobeLine\` IS NOT NULL) AS lineSet
       FROM \`${TABLE}\``,
  );
  const total = Number(counts[0].n);
  const pathSet = Number(counts[0].pathSet ?? 0);
  const lineSet = Number(counts[0].lineSet ?? 0);
  console.log(`rows: ${total} · path set on ${pathSet} · line set on ${lineSet}`);
  if (outcome === "applied" && (pathSet > 0 || lineSet > 0)) {
    throw new Error(
      `the ALTER backfilled ${Math.max(pathSet, lineSet)} of ${total} historical rolls — the migration carried a DEFAULT and the pre-paths distinction is gone`,
    );
  }
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
