/**
 * MAKE THE PAID SHEET REAL — move roll `641c71d0`'s eight pictures to the
 * bucket its production rows already name. (fable-063 approves; opus-053 §4.)
 *
 * # What went wrong, in one paragraph
 *
 * `bespectacled-roll-production.mts` ran `createRoll` in process under
 * `railway run --service MySQL`. The database was pointed at production by
 * hand; the five R2 variables were not pointed anywhere, so dotenv filled them
 * from the developer's `.env`. The rows landed in production and the eight
 * objects landed in `drape-dev`. The founder paid 160 credits for a tray of
 * broken tiles, and — the part that decided this repair — her faces currently
 * live ONLY in a bucket the cleanup worker never sweeps, so deleting those
 * candidates would delete nothing.
 *
 * # Three phases, and they are separate on purpose
 *
 *   (default)   LOOK   — what is where, and what would happen. Writes nothing.
 *   --apply     COPY   — copy each object, then re-read the DESTINATION and
 *                        compare SHA-256 against the source. A copy that cannot
 *                        be proven identical is a failure, not a copy.
 *   --purge-source      delete the dev originals — refuses unless every object
 *                        is already verified present, identical, and SERVED as
 *                        an image from the production public base.
 *
 * The purge is a separate invocation from the copy because the only safe order
 * is prove-then-delete, and an order that lives in a flag is an order that
 * cannot be got wrong by a rerun.
 *
 * # It will not overwrite
 *
 * Every destination is checked for existence first and an occupied key aborts
 * the whole run. These keys are random UUIDs and 404 today; if one is occupied,
 * something is true that this script's entire premise says is false, and the
 * right response is to stop rather than to clobber a customer's object.
 *
 *   railway.cmd run --service Drape -- railway.cmd run --service MySQL -- npx tsx \
 *     scripts/repair-misdelivered-sheet-disposable.mts \
 *     --roll 641c71d0-df30-4db3-ad65-1a94936a983c \
 *     --source-bucket drape-dev --source-base https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev
 */
import "dotenv/config";
import { createHash } from "node:crypto";

import {
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { openDatabase } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertDefinedByService, assertOneWorld, WORLD_DISCRIMINATING_KEYS } from "./lib/worldGuard.mts";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const APPLY = process.argv.includes("--apply");
const PURGE = process.argv.includes("--purge-source");

const roll = arg("roll");
const sourceBucket = arg("source-bucket");
const sourceBase = arg("source-base")?.replace(/\/$/, "");
if (!roll) throw new Error("--roll <publicId> is required");
if (!sourceBucket) throw new Error("--source-bucket is required, explicitly");
if (!sourceBase) throw new Error("--source-base is required, explicitly — for the served-medium check");

/* The database is dialled by its public name; the swap happens before the
   guards so they judge the URL that will actually be used. */
if (process.env.MYSQL_PUBLIC_URL && /\.railway\.internal/.test(process.env.DATABASE_URL ?? "")) {
  process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL;
}
assertDefinedByService([
  "DATABASE_URL", "R2_ENDPOINT", "R2_BUCKET", "R2_PUBLIC_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
]);
assertOneWorld(WORLD_DISCRIMINATING_KEYS);

const destinationBucket = process.env.R2_BUCKET!;
const destinationBase = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
if (destinationBucket === sourceBucket) {
  throw new Error(`source and destination are the same bucket (${sourceBucket}) — nothing to repair`);
}

/* One client for both buckets, because dev and production are the same R2
   account with the same credential. That fact is the founder-queue security
   item; here it is simply what makes a one-process copy possible. */
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function readObject(bucket: string, key: string): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return { bytes: Buffer.concat(chunks), contentType: response.ContentType ?? "application/octet-stream" };
}

async function exists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const connection = await openDatabase(process.env.DATABASE_URL);
const [rows] = await connection.query<any[]>(
  `SELECT c.publicId, c.position, c.status, c.imageKey
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.publicId = ? AND c.imageKey IS NOT NULL
    ORDER BY c.position`,
  [roll],
);
await connection.end();

console.log(`roll ${roll} — ${rows.length} candidates naming an object`);
console.log(`source:      ${sourceBucket}  (${sourceBase})`);
console.log(`destination: ${destinationBucket}  (${destinationBase})`);
console.log(`mode:        ${PURGE ? "PURGE SOURCE" : APPLY ? "COPY + VERIFY" : "LOOK ONLY — writes nothing"}\n`);

type Row = { publicId: string; position: number; imageKey: string };
const candidates = rows as Row[];

/* ------------------------------------------------------------------ survey */

const survey: { row: Row; inSource: boolean; inDestination: boolean }[] = [];
for (const row of candidates) {
  const [inSource, inDestination] = await Promise.all([
    exists(sourceBucket, row.imageKey),
    exists(destinationBucket, row.imageKey),
  ]);
  survey.push({ row, inSource, inDestination });
  console.log(`  pos ${row.position} ${row.publicId.slice(0, 8)}  source ${inSource ? "yes" : "NO "}`
    + `  destination ${inDestination ? "yes" : "NO "}  ${row.imageKey.slice(0, 46)}…`);
}

const missingAtSource = survey.filter((entry) => !entry.inSource);
if (missingAtSource.length > 0) {
  throw new Error(`${missingAtSource.length} object(s) are not in ${sourceBucket} either — stop and look before anything else`);
}

/* ------------------------------------------------------------------- purge */

if (PURGE) {
  /*
    PROVE, THEN DELETE — every object, every time, no sampling.

    The proof is not "we copied it earlier": it is read the destination now,
    hash it against the source now, and confirm the production base SERVES it
    as an image now. A purge that trusts a previous run's console output is a
    purge that deletes on the strength of a claim.
  */
  for (const { row } of survey) {
    const [source, destination] = await Promise.all([
      readObject(sourceBucket, row.imageKey),
      readObject(destinationBucket, row.imageKey).catch(() => null),
    ]);
    if (!destination) throw new Error(`pos ${row.position}: destination object missing — nothing is deleted`);
    if (sha(source.bytes) !== sha(destination.bytes)) {
      throw new Error(`pos ${row.position}: destination hash differs from source — nothing is deleted`);
    }
    const served = await fetchImageBytes(`${destinationBase}/${row.imageKey}`);
    if (sha(served.bytes) !== sha(source.bytes)) {
      throw new Error(`pos ${row.position}: the served bytes differ from the source — nothing is deleted`);
    }
    console.log(`  pos ${row.position} proven: identical in ${destinationBucket} and served as ${served.mime}`);
  }
  console.log("\nAll eight proven. Deleting the dev originals.");
  for (const { row } of survey) {
    await s3.send(new DeleteObjectCommand({ Bucket: sourceBucket, Key: row.imageKey }));
    const still = await exists(sourceBucket, row.imageKey);
    console.log(`  pos ${row.position} deleted from ${sourceBucket}${still ? " — STILL PRESENT, look" : ""}`);
  }
  console.log("\nHer faces now live in exactly one bucket, and it is the one her deletion reaches.");
  process.exit(0);
}

/* -------------------------------------------------------------------- copy */

const occupied = survey.filter((entry) => entry.inDestination);
if (occupied.length > 0 && !APPLY) {
  console.log(`\nNOTE: ${occupied.length} destination key(s) already occupied.`);
}

if (!APPLY) {
  console.log(`\nLOOK ONLY. Would copy ${survey.filter((e) => !e.inDestination).length} object(s) `
    + `from ${sourceBucket} to ${destinationBucket} under the same keys, then verify each by SHA-256.`);
  console.log("Pass --apply to do it. Nothing was written.");
  process.exit(0);
}

if (occupied.length > 0) {
  throw new Error(
    `${occupied.length} destination key(s) are already occupied. These keys are random UUIDs that 404ed `
    + `when this repair was designed, so an occupied one means something is true that the premise says is `
    + `false. Nothing is overwritten; look first.`,
  );
}

let copied = 0;
for (const { row } of survey) {
  const source = await readObject(sourceBucket, row.imageKey);
  await s3.send(new PutObjectCommand({
    Bucket: destinationBucket,
    Key: row.imageKey,
    Body: source.bytes,
    ContentType: source.contentType,
  }));
  /* Re-read the DESTINATION rather than trusting the write's own success — a
     PUT reporting 200 is a claim; the bytes that come back are the fact. */
  const written = await readObject(destinationBucket, row.imageKey);
  const same = sha(written.bytes) === sha(source.bytes);
  if (!same) throw new Error(`pos ${row.position}: written bytes do not match the source — stopping`);
  const served = await fetchImageBytes(`${destinationBase}/${row.imageKey}`);
  const servedSame = sha(served.bytes) === sha(source.bytes);
  copied += 1;
  console.log(`  pos ${row.position} ${row.publicId.slice(0, 8)}  copied ${(source.bytes.length / 1024).toFixed(0)}KB`
    + `  hash ${sha(source.bytes).slice(0, 12)}  re-read OK  served ${served.mime}${servedSame ? "" : " — SERVED BYTES DIFFER"}`);
  if (!servedSame) throw new Error(`pos ${row.position}: the public base serves different bytes — stopping`);
}

console.log(`\n${copied} of ${survey.length} copied, each verified twice: by re-reading the object and by `
  + `fetching the public URL her tray will use.`);
console.log(`NEXT: rerun with --purge-source to remove the dev originals, which re-proves all of the above first.`);
process.exit(0);
