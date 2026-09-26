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
 * - **It never re-mints.** An object whose small copy already exists is skipped
 *   on a HEAD, so a second run over the same world is nearly free and an
 *   interrupted run simply resumes.
 * - **It spends no customer credits and calls no model.** The cost is house R2
 *   egress: one read of each already-paid-for object.
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
 */
import "dotenv/config";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { openDatabase } from "./lib/dbConnection.mjs";
import {
  isViewThumbnailBearingKey,
  withViewThumbnailSuffix,
} from "../shared/viewThumbnails.js";
import { mintViewThumbnail } from "../server/castingV2/viewThumbnailMint.js";

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

  const db = await openDatabase();
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

  let present = 0;
  let minted = 0;
  let unreadable = 0;
  for (const key of population) {
    const derived = withViewThumbnailSuffix(key);
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: derived }));
      present += 1;
      continue;
    } catch {
      /* Absent, which is the whole population this script is for. */
    }
    if (!apply) {
      minted += 1;
      continue;
    }
    try {
      const response = await fetch(`${publicOrigin}/${key.split("/").map(encodeURIComponent).join("/")}`);
      if (!response.ok) { unreadable += 1; continue; }
      const bytes = Buffer.from(await response.arrayBuffer());
      /* The product's own mint, never a second copy of its settings. It
         swallows its own failures, so a refusal here is counted as unreadable
         rather than crashing a ceremony halfway through a bucket. */
      await mintViewThumbnail(key, bytes);
      minted += 1;
    } catch {
      unreadable += 1;
    }
  }

  console.log(
    `${apply ? "minted" : "would mint"} ${minted} · already present ${present} · unreadable ${unreadable}`,
  );
}

await main();
process.exit(0);
