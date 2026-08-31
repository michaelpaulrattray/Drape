/**
 * UPLOAD ONE EYE FRAME — step 1 of putting a judgement in front of the
 * founder's eyes on /admin/crew (issue #75).
 *
 *   npx tsx scripts/crew-upload-eye-frame.mts <path-to-image> --bucket <name>
 *
 * Uploads the file under `crew-eye/<uuid>.<ext>` and prints the KEY. The frame
 * is NOT visible to anyone until a briefing edition names that key inside an
 * `eyeItems` entry and deploys — the deployed briefing IS the serving route's
 * allowlist, so this script alone publishes nothing.
 *
 * # ⚠ `--bucket` IS REQUIRED, AND IT IS THE WHOLE POINT (#320)
 *
 * This script reads `.env`, which names the DEV bucket on a local machine. It
 * succeeds identically against either bucket and hands back a real key, so a
 * frame meant for production lands in dev and NOTHING between here and his
 * browser notices: the key is real, the caption is real, the schema is
 * satisfied, the deploy is SUCCESS — and his card draws broken images. That
 * happened twice (the concept frames, then `queue-titles-285-frames`, both
 * repaired by hand) with a third near-miss on this same script (#265).
 *
 * So the caller must NAME the bucket they mean, and a mismatch refuses before a
 * byte moves. An optional warning would not have caught either incident: both
 * were run by someone who believed they were pointed at production.
 *
 * To write to PRODUCTION, take the production R2 variables from the service:
 *
 *   railway.cmd run --service Drape -- npx tsx scripts/crew-upload-eye-frame.mts <path> --bucket <production-bucket>
 *
 * The bucket a run resolved is printed IN CAPITALS, before and after the write.
 *
 * The rite is the backstop, not the substitute: `scripts/lib/eyeFramePresence.mts`
 * refuses to push an edition naming a frame the production bucket does not
 * hold. Two independent catches, because this one can still be given the wrong
 * name on purpose.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { storagePut } from "../server/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const USAGE = "Usage: npx tsx scripts/crew-upload-eye-frame.mts <path-to-image> --bucket <name>";

/* The argument reader ENUMERATES what it was given rather than scanning for the
   flags it likes: `--dry-run`, the safest-sounding word an operator can type,
   was once read as "no arguments" by a sibling script and took the do-it-for-
   real path (#289). A word this script does not know stops it. */
const args = process.argv.slice(2);
let filePath: string | undefined;
let expectedBucket: string | undefined;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]!;
  if (arg === "--bucket") {
    expectedBucket = args[index + 1];
    if (!expectedBucket || expectedBucket.startsWith("--")) {
      console.error("--bucket takes the bucket name it should write to");
      process.exit(1);
    }
    index += 1;
  } else if (arg.startsWith("--")) {
    console.error(`unknown argument ${arg}\n${USAGE}`);
    process.exit(1);
  } else if (filePath === undefined) {
    filePath = arg;
  } else {
    console.error(`unexpected second path ${arg}\n${USAGE}`);
    process.exit(1);
  }
}

if (!filePath) {
  console.error(USAGE);
  process.exit(1);
}
if (!expectedBucket) {
  console.error(
    `--bucket is required — name the bucket this frame must land in.\n${USAGE}\n`
    + "  This script reads .env, which names the DEV bucket locally, and a wrong-bucket\n"
    + "  upload is invisible at the call site: it succeeds and hands back a real key (#320).",
  );
  process.exit(1);
}

const resolvedBucket = process.env.R2_BUCKET;
if (!resolvedBucket) {
  console.error("R2_BUCKET is not set in this environment — nothing was uploaded");
  process.exit(1);
}
if (resolvedBucket !== expectedBucket) {
  console.error(
    `REFUSING: this environment resolves R2_BUCKET to "${resolvedBucket}", and you asked for "${expectedBucket}".\n`
    + "  Nothing was uploaded. Run it under the environment that names the bucket you meant:\n"
    + "    railway.cmd run --service Drape -- npx tsx scripts/crew-upload-eye-frame.mts <path> --bucket <name>",
  );
  process.exit(1);
}

const ext = extname(filePath).toLowerCase();
const contentType = CONTENT_TYPES[ext];
if (!contentType) {
  console.error(`Unsupported extension ${ext} — the eye-frame schema takes png/jpg/jpeg/webp`);
  process.exit(1);
}

console.log(`WRITING TO BUCKET: ${resolvedBucket}`);

const bytes = readFileSync(filePath);
const key = `crew-eye/${crypto.randomUUID()}${ext}`;
const result = await storagePut(key, bytes, contentType);

console.log(`uploaded ${bytes.length} bytes TO BUCKET ${resolvedBucket}`);
console.log(`key: ${result.key}`);
console.log("Next: name this key in a briefing eyeItems entry (with its caption and arm), and deploy.");
process.exit(0);
