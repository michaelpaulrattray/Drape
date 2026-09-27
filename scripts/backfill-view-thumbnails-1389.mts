/**
 * MINT THE MISSING SMALL COPIES OF ALREADY-SIGNED CASTS (#1389).
 *
 * # Why this exists rather than "it heals itself"
 *
 * From #1389 onward every signed view and every anchor gets a small copy the
 * moment its bytes are stored. **Casts signed BEFORE that get nothing**, and
 * they are the ones already on the founder's account — so without this script
 * the card's whole customer-visible win ("the page opens quickly") arrives only
 * for casts nobody has made yet. The strip falls back to the full picture for
 * them, correctly and invisibly, but it still costs the 20 MB the card is about
 * and it asks for a `.thumb.jpg` that 404s on every load.
 *
 * # What it does, and what it deliberately does not
 *
 * For every `model_assets` row whose storage key carries a small copy (a signed
 * cast's `views/` or `anchor/` object — `isViewThumbnailBearingKey` decides, so
 * this cannot drift from the mint or the sweep), it reads the object, shrinks
 * it through the SAME module the product uses, and writes the derivative.
 *
 * - **It writes NOTHING to the database.** The derivative is a derived key; no
 *   row names it, which is the whole shape of #1389.
 * - **It spends no customer credits and calls no model.** The cost is house R2
 *   egress: one read of each already-paid-for object.
 *
 * # ⚠ IT RE-MINTS A COPY THAT IS NARROWER THAN THE CONSTANT (#1456)
 *
 * This bullet used to read *"it never re-mints — an object whose small copy
 * already exists is skipped on a HEAD, so a second run over the same world is
 * nearly free"*, and that was right while there was only ever one width. #1456
 * widened `VIEW_THUMBNAIL_WIDTH` from 288 to 576, which left the copies minted
 * before it **narrower than every consumer now asks for** — and a HEAD cannot
 * see that, because it answers with a byte count and no width.
 *
 * So the question asked of each object is now *"is the copy beside it at least
 * as wide as the constant"*, read off the stored bytes themselves through the
 * BUCKET rather than the public URL — an authoritative read, because a CDN
 * serving a cached copy of the old width would make the ceremony re-mint
 * something it had already fixed.
 *
 * ⚠ **A copy can be narrow because its SOURCE is narrow, and that one must be
 * left alone.** `withoutEnlargement` means a 200px view yields a 200px copy
 * forever, so re-writing it on every run would be churn that reads as work.
 * The mint decides this, not the ceremony (`onlyWiderThan`), so the comparison
 * is made against the bytes the product actually produces rather than against a
 * second copy of its resize settings.
 *
 * **What the second run costs, stated rather than promised:** it writes nothing,
 * and it still READS the source of every source-limited object to learn that
 * again. At the 32-object population this ceremony was built for that is a
 * bounded cost; it is not the "nearly free" the old bullet claimed, and the
 * `source-limited` count in the output is how you see how much of it there is.
 *
 * # ⚠ IT IS A DRY RUN UNLESS YOU SAY `--apply`
 *
 *     npx tsx scripts/backfill-view-thumbnails-1389.mts            # report only
 *     npx tsx scripts/backfill-view-thumbnails-1389.mts --apply    # write
 *
 * `--limit <n>` bounds a first pass. The world it opened is printed by
 * `scripts/lib/dbConnection.mts` on stderr before anything happens, because a
 * ceremony that does not say which database it is on is how the wrong one gets
 * written to (memory: two databases, compare the port).
 *
 * # ⚠ WHICH WRAPPER, FOR PRODUCTION — AND NEITHER ONE ALONE IS ENOUGH (#1448)
 *
 * This is a TWO-SERVICE ceremony: it needs the production BUCKET and the
 * production DATABASE, and no single `railway run` supplies both. Measured at
 * the artifact on 2026-09-27 by asking each wrapper what it injects, rather
 * than reasoned from the dashboard:
 *
 *     railway run --service Drape   ->  DATABASE_URL = mysql.railway.internal:3306
 *                                       (PRIVATE, unreachable from a laptop)
 *                                       R2_* present
 *     railway run --service MySQL   ->  MYSQL_PUBLIC_URL = hayabusa.proxy.rlwy.net:23768
 *                                       MYSQL_URL (private), and NO DATABASE_URL
 *                                       no R2_* at all
 *
 * ⚠ **So `--service Drape` on its own still cannot work, whatever this script
 * does** — its only database address is the private one. What makes the
 * ceremony go is handing the resolver a PUBLIC url in the shell, which
 * `railway run` passes through (driven, same sitting):
 *
 *     # bash
 *     export MYSQL_PUBLIC_URL="$(railway variables --service MySQL --kv  *       | grep '^MYSQL_PUBLIC_URL=' | cut -d= -f2-)"
 *     railway run --service Drape -- npx tsx scripts/backfill-view-thumbnails-1389.mts --apply
 *
 *     # PowerShell
 *     $env:MYSQL_PUBLIC_URL = (railway variables --service MySQL --kv `
 *       | Select-String '^MYSQL_PUBLIC_URL=').ToString().Split('=',2)[1]
 *     railway run --service Drape -- npx tsx scripts/backfill-view-thumbnails-1389.mts --apply
 *
 * `resolveDatabaseUrl()` prefers that public url, so the run reads the world it
 * was wrapped for and `assertSameWorld` is satisfied rather than refusing.
 * **Against dev, no wrapper and no export** — `.env` is the dev world already.
 */
import "dotenv/config";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mjs";
import {
  VIEW_THUMBNAIL_WIDTH,
  isViewThumbnailBearingKey,
  withViewThumbnailSuffix,
} from "../shared/viewThumbnails.js";
import { mintViewThumbnail } from "../server/castingV2/viewThumbnailMint.js";
import { storagePut } from "../server/storage.js";

type AssetRow = { id: number; storageKey: string | null; storageUrl: string };

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function value(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/**
 * The key, from the row.
 *
 * `storageKey` is nullable and older rows carry only a URL, so the key is
 * recovered from the public URL's path when the column is empty — the same
 * reconstruction `storagePublicUrl` performs in reverse, and the reason the
 * bucket's own public origin has to match before a URL is trusted.
 */
function keyOf(row: AssetRow, publicOrigin: string): string | null {
  if (row.storageKey) return row.storageKey.replace(/^\/+/, "");
  if (!row.storageUrl.startsWith(publicOrigin)) return null;
  return decodeURIComponent(row.storageUrl.slice(publicOrigin.length).replace(/^\/+/, ""));
}

async function main(): Promise<void> {
  const apply = flag("--apply");
  const limit = Number(value("--limit") ?? "0");
  const publicOrigin = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const bucket = process.env.R2_BUCKET ?? "";
  if (!publicOrigin || !bucket) throw new Error("R2_PUBLIC_URL and R2_BUCKET are required");

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });

  /*
    THE RESOLVER, NAMED RATHER THAN DEFAULTED (#1448). The door's default is
    `resolveDatabaseUrl()` now, so this is not load-bearing — it is the intent
    stated where the next operator of a production ceremony will read it: this
    script reads the world it was WRAPPED for, never whichever one `.env`
    happens to name.
  */
  const db = await openDatabase(resolveDatabaseUrl());
  const [rows] = await db.query<AssetRow[]>(
    "SELECT id, storageKey, storageUrl FROM model_assets ORDER BY id DESC",
  );
  await db.end();

  const keys = rows
    .map((row) => keyOf(row, publicOrigin))
    .filter((key): key is string => key !== null && isViewThumbnailBearingKey(key));
  const population = limit > 0 ? keys.slice(0, limit) : keys;

  console.log(
    `${rows.length} asset rows -> ${keys.length} carry a small copy`
    + `${limit > 0 ? ` (bounded to ${population.length})` : ""}`,
  );
  if (!apply) console.log("DRY RUN — pass --apply to write. Nothing below is minted.");

  /*
    HOW WIDE IS THE COPY THAT IS ALREADY THERE? (#1456)

    Read through the BUCKET rather than the public origin, on purpose: this
    answer decides whether to write, and a CDN handing back a cached copy of the
    width we just replaced would make the ceremony re-mint what it had already
    fixed. `null` means there is nothing beside the object yet.
  */
  async function storedWidth(derivedKey: string): Promise<number | null> {
    let body: Uint8Array;
    try {
      const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: derivedKey }));
      body = await stored.Body!.transformToByteArray();
    } catch {
      return null; /* Absent, which is the population #1389 wrote this for. */
    }
    /* A stored object that sharp cannot read is not a width we may reason from,
       so it is treated as absent and re-minted rather than silently kept. */
    return (await sharp(Buffer.from(body)).metadata()).width ?? null;
  }

  let alreadyWide = 0;
  let minted = 0;
  let widened = 0;
  let sourceLimited = 0;
  let refused = 0;
  let unreadable = 0;
  for (const key of population) {
    const derived = withViewThumbnailSuffix(key);
    const existing = await storedWidth(derived);
    if (existing !== null && existing >= VIEW_THUMBNAIL_WIDTH) {
      alreadyWide += 1;
      continue;
    }
    if (!apply) {
      if (existing === null) minted += 1;
      else widened += 1;
      continue;
    }
    try {
      const response = await fetch(`${publicOrigin}/${key.split("/").map(encodeURIComponent).join("/")}`);
      if (!response.ok) { unreadable += 1; continue; }
      const bytes = Buffer.from(await response.arrayBuffer());
      /*
        The product's own mint, never a second copy of its settings. It swallows
        its own failures, so a refusal here is counted as unreadable rather than
        crashing a ceremony halfway through a bucket.

        The writer is WRAPPED rather than replaced: the mint returns void by
        design (a caller able to branch on success would eventually treat a
        missing thumbnail as an error), so the only honest way to learn whether
        a narrow copy was actually improved is to watch the write happen.
      */
      let wrote = false;
      await mintViewThumbnail(key, bytes, {
        ...(existing === null ? {} : { onlyWiderThan: existing }),
        put: async (...args: Parameters<typeof storagePut>) => {
          wrote = true;
          return storagePut(...args);
        },
      });
      /*
        FIVE OUTCOMES, EACH COUNTED AS ITSELF. The version of this loop before
        #1456 incremented `minted` the moment the mint RETURNED — and the mint
        swallows its own failures by design, so a bucket refusing every write
        reported a clean run. `wrote` is the write actually happening.
      */
      if (existing === null) {
        if (wrote) minted += 1;
        else refused += 1; /* sharp refused the bytes, or the copy was no smaller. */
      } else if (wrote) {
        widened += 1;
      } else {
        sourceLimited += 1; /* The source is the limit, not the constant. */
      }
    } catch {
      unreadable += 1;
    }
  }

  console.log(
    `${apply ? "minted" : "would mint"} ${minted}`
    + ` · ${apply ? "widened" : "would widen"} ${widened}`
    + ` · already ${VIEW_THUMBNAIL_WIDTH}px or wider ${alreadyWide}`
    + `${apply ? ` · source-limited ${sourceLimited} · refused ${refused}` : ""}`
    + ` · unreadable ${unreadable}`,
  );
  /*
    ⚠ THE DRY RUN CANNOT TELL A NARROW COPY FROM A SOURCE-LIMITED ONE, and says
    so rather than letting its own figure read as a forecast. Knowing which it is
    means minting the thing and looking at what came out, which is the one act a
    dry run may not perform.
  */
  if (!apply && widened > 0) {
    console.log(
      `  of those ${widened}, some may be as wide as their source already allows —`
      + " only --apply can tell those apart, and it reports them as source-limited.",
    );
  }
}

await main();
process.exit(0);
