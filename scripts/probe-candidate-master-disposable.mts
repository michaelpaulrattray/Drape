/**
 * IS HER MASTER ACTUALLY GONE? — the 404 that stopped the counter's control.
 *
 * The speck counter could not use run-12's own face as its negative baseline
 * because "the candidate's original image 404s on the public bucket", and that
 * sentence has two very different readings:
 *
 *   PRODUCT DEFECT   a live candidate's original object is genuinely missing
 *                    from storage — a broken tile in the tray, and either a
 *                    cleanup-worker bite or a key-scheme drift.
 *   SCRIPT MISTAKE   the probe built the wrong URL and the object is fine.
 *
 * Only one artifact separates them: the object itself, asked for twice — once
 * over the PUBLIC URL exactly as the product builds it, and once by HEAD on the
 * bucket with credentials. Public 404 + bucket HEAD 200 means the URL was wrong
 * (or the object is not public). Both missing means the bytes are gone.
 *
 * Read-only. No writes, no deletes, no renders.
 *
 * TWO RUNS, because the two services hold different halves and a credential
 * should not be carried between them by hand:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/probe-candidate-master-disposable.mts
 *   railway.cmd run --service Drape -- npx tsx scripts/probe-candidate-master-disposable.mts --bucket <key> [<key>…]
 *
 * The first reads the rows and asks the PUBLIC URL. The second asks the bucket
 * with credentials, for the keys the first printed.
 */
import "dotenv/config";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

/** The faces the walks were run on. Two, so one specimen cannot pass for a class. */
const CANDIDATES = [
  "8154ac6d-64ee-45ad-834b-fcbabca0f3ef", // run-12, olive-skinned brunette
];

/**
 * THE BASE THE PRODUCT ACTUALLY SERVED — passed in, never inherited.
 *
 * The first version of this script read `R2_PUBLIC_URL` from the environment
 * with a fallback, ran under the MySQL service (which defines no R2 variables),
 * and got the developer's **dev** bucket out of `.env`. Every key then 404'd
 * and the answer came out "her master is gone" when her master was fine.
 *
 * So the row half takes the base as an argument and refuses without it. It
 * matches `output/walk/run-12/walk.json`'s recorded `imageUrl` prefix, which is
 * the base production genuinely served these objects on.
 */
function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}
const PUBLIC_BASE = (argument("public-base") ?? process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

async function publicStatus(key: string): Promise<string> {
  if (!PUBLIC_BASE) return "NOT ASKED — pass --public-base <https://…> so the answer names a bucket";
  const href = `${PUBLIC_BASE}/${key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const response = await fetch(href);
    const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0;
    return `${response.status}${response.ok ? ` (${bytes} bytes)` : ""}`;
  } catch (error) {
    return `fetch failed: ${String(error).slice(0, 60)}`;
  }
}

/* ---------------------------------------------------------------- bucket half */

const bucketFlag = process.argv.indexOf("--bucket");
if (bucketFlag > -1) {
  /* This half genuinely reads the bucket, so a dev bucket base or a dev
     credential inside a production run must stop it. */
  assertOneWorld(["R2_PUBLIC_URL", "R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
  const keys = process.argv.slice(bucketFlag + 1).filter((value) => !value.startsWith("--"));
  if (keys.length === 0) throw new Error("--bucket needs at least one key");
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET!;
  console.log(`bucket ${bucket}  publicBase ${PUBLIC_BASE}`);
  for (const key of keys) {
    let verdict: string;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      verdict = `PRESENT (${head.ContentLength} bytes, ${head.ContentType})`;
    } catch (error: any) {
      verdict = `ABSENT (${error?.name ?? error?.Code ?? "unknown"} / http ${error?.$metadata?.httpStatusCode ?? "?"})`;
    }
    console.log(`  ${key}\n    bucket ${verdict}\n    public ${await publicStatus(key)}`);
  }
  process.exit(0);
}

/* ------------------------------------------------------------------- row half */

/* Assert on the key actually chosen, not on both: under the MySQL service
   `DATABASE_URL` is unavoidably the local one, and refusing over a variable
   this script never reads is how a guard gets routed around. */
const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");
const connection = await openDatabase(databaseUrl);

const [rows] = await connection.query<any[]>(
  `SELECT c.id, c.publicId, c.status, c.position, c.imageKey, c.thumbKey,
          c.selectedVariantId, c.keptAt, c.discardedAt, c.expiresAt, c.signedCastId,
          c.createdAt, r.publicId AS roll, r.createdAt AS rollCreatedAt
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE c.publicId IN (${CANDIDATES.map(() => "?").join(",")})`,
  CANDIDATES,
);

for (const row of rows) {
  console.log(`\n=== candidate ${row.publicId} (row ${row.id}, roll ${row.roll}) ===`);
  console.log(`status ${row.status}  position ${row.position}  signedCastId ${row.signedCastId ?? "—"}`);
  console.log(`created ${row.createdAt}  kept ${row.keptAt ?? "—"}  discarded ${row.discardedAt ?? "—"}  expires ${row.expiresAt ?? "—"}`);
  console.log(`imageKey  ${row.imageKey ?? "NULL"}`);
  console.log(`thumbKey  ${row.thumbKey ?? "NULL"}`);
  console.log(`selectedVariantId ${row.selectedVariantId ?? "NULL (the original IS the face)"}`);

  for (const [label, key] of [["imageKey", row.imageKey], ["thumbKey", row.thumbKey]] as const) {
    if (!key) continue;
    console.log(`  ${label} public ${await publicStatus(key)}`);
  }

  const [variants] = await connection.query<any[]>(
    `SELECT id, publicId, status, imageKey, createdAt
       FROM casting_candidate_variants
      WHERE candidateId = ?
      ORDER BY id ASC`,
    [row.id],
  );
  console.log(`  ${variants.length} variant row(s)`);
  for (const variant of variants) {
    const selected = variant.id === row.selectedVariantId ? "  <- SELECTED" : "";
    console.log(`   v${variant.id} ${variant.status} ${variant.imageKey ?? "NULL"}${selected}`);
    if (variant.imageKey) console.log(`      public ${await publicStatus(variant.imageKey)}`);
  }

  /* Did anything ever RESERVE these keys for deletion? A cleanup bite leaves a
     row; a key-scheme drift leaves nothing. */
  const keys = [row.imageKey, row.thumbKey].filter(Boolean) as string[];
  if (keys.length > 0) {
    const [items] = await connection.query<any[]>(
      `SELECT i.id, i.storageKey, i.status, i.createdAt, b.kind, b.status AS batchStatus
         FROM storage_cleanup_items i
         JOIN storage_cleanup_batches b ON b.id = i.batchId
        WHERE i.storageKey IN (${keys.map(() => "?").join(",")})`,
      keys,
    );
    console.log(`  cleanup items naming these keys: ${items.length}`);
    for (const item of items) {
      console.log(`   #${item.id} ${item.kind} item=${item.status} batch=${item.batchStatus} ${item.createdAt}`);
    }
  }
}

await connection.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
