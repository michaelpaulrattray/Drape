/**
 * WHAT IS ACTUALLY IN THE DIAGNOSTICS KEY SPACE — the refused-frames
 * population, counted where it really lives (POST_SIGN_ROADMAP §4).
 *
 * # Why this exists at all, and it is a correction to my own first reading
 *
 * The obvious index is wrong twice over.
 *
 * **The candidate row is wrong by construction.** `failCandidate`/`failVariant`
 * transition only out of `queued`/`dispatched` and `imageKey` is written when a
 * render SUCCEEDS, so a refused row can never carry a frame. Zero there is a
 * fact about the writers, not about history.
 *
 * **The cleanup register is wrong in the nastier way — it looks like an index
 * and answers zero.** `storage_cleanup_items` rows are DELETED on successful
 * purge and on reservation-consumption, so an empty table means "nothing
 * pending" and says NOTHING about what was ever captured. A census taken there
 * would have reported a clean, confident, entirely fictional zero. (This is the
 * null-result law: a clean null is evidence only if the fixture could have
 * produced a non-null.)
 *
 * The keys are owner-scoped precisely so a listing answers this question —
 * `diagnosticKey`'s own docblock says so. So the bucket is the index, and this
 * lists it.
 *
 * # Secrets
 *
 * Reads `R2_EVIDENCE_*` from the environment and NEVER prints them. Run it
 * under the app service's own variables so the credential is injected rather
 * than copied:
 *
 *   railway.cmd run --service Drape -- npx tsx scripts/list-diagnostic-frames-disposable.mts
 *
 * It refuses rather than falling back if the private bucket is unconfigured: a
 * lister that quietly reads the PUBLIC bucket instead would answer zero and
 * look identical to an empty private one.
 *
 * Read-only: `ListObjectsV2` and nothing else. No writes, no deletes, no
 * credits, no vision, no database.
 */
import "dotenv/config";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT;
const bucket = process.env.R2_EVIDENCE_BUCKET;
const accessKeyId = process.env.R2_EVIDENCE_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_EVIDENCE_SECRET_ACCESS_KEY;

/* Named, never valued. The point of the line is which one is missing. */
const missing = [
  ["R2_ENDPOINT", endpoint],
  ["R2_EVIDENCE_BUCKET", bucket],
  ["R2_EVIDENCE_ACCESS_KEY_ID", accessKeyId],
  ["R2_EVIDENCE_SECRET_ACCESS_KEY", secretAccessKey],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
  console.log(`REFUSED — the private evidence bucket is unconfigured here: ${missing.join(", ")}`);
  console.log("Run this under the app service's own variables; it will not read the public bucket instead.");
  process.exit(1);
}

const PREFIX = "casting-v2/diagnostics/";

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
});

type Entry = { key: string; size: number; modified: Date | undefined };
const entries: Entry[] = [];
let token: string | undefined;
let pages = 0;
do {
  const page = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: PREFIX,
    ContinuationToken: token,
  }));
  pages += 1;
  for (const object of page.Contents ?? []) {
    if (object.Key) entries.push({ key: object.Key, size: object.Size ?? 0, modified: object.LastModified });
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

/* THE CONTROL. An empty prefix and a credential that can see nothing look the
   same. One unprefixed page proves the listing works before its zero is
   believed — and it is a COUNT of that page, never its keys, because those
   belong to the evidence road and not to this reading. */
const probe = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
console.log(`CONTROL — the bucket answers: ${(probe.Contents ?? []).length} object(s) on an unprefixed page`);
console.log("");

console.log(`DIAGNOSTIC FRAMES under ${PREFIX} — ${entries.length} object(s) across ${pages} page(s)`);
if (entries.length === 0) {
  console.log("  (none — and the control above says that is the prefix being empty,");
  console.log("   not the credential being blind)");
  process.exit(0);
}

/* One row per REFUSAL, because that is the unit a human reads: the key is
   <prefix>/<userId>/<operationId>/<name>.png. */
const byOperation = new Map<string, Entry[]>();
for (const entry of entries) {
  const rest = entry.key.slice(PREFIX.length).split("/");
  const operation = `${rest[0]}/${rest[1]}`;
  byOperation.set(operation, [...(byOperation.get(operation) ?? []), entry]);
}
console.log(`  ${byOperation.size} refusal(s) captured`);
console.log("");
console.log("  user/operation                                    frames  bytes      captured");
for (const [operation, frames] of [...byOperation].sort()) {
  const bytes = frames.reduce((sum, frame) => sum + frame.size, 0);
  const when = frames.map((frame) => frame.modified?.toISOString() ?? "—").sort()[0];
  console.log(`  ${operation.padEnd(48)} ${String(frames.length).padStart(6)}  ${String(bytes).padStart(9)}  ${when}`);
  for (const frame of frames.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`      ${frame.key.split("/").pop()}  ${frame.size} B`);
  }
}

process.exit(0);
