/**
 * UPLOAD ONE EYE FRAME — step 1 of putting a judgement in front of the
 * founder's eyes on /admin/crew (issue #75).
 *
 *   npx tsx scripts/crew-upload-eye-frame.mts <path-to-image> --bucket <name>
 *
 * Uploads the file under `crew-eye/<uuid>.<ext>` and prints the KEY — on its
 * LAST line, so `| tail -1` keeps it (#265). The frame
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
 *
 * # ⚠ AND IT READS THE FRAME BACK BEFORE IT HANDS YOU THE KEY (#1509)
 *
 * The sentence above — *the rite is the backstop* — was true of the road it
 * describes and silently false of the road a builder seat walks. A seat proving
 * working law 6 on a pull request uploads a frame, pastes the link in a comment
 * and never runs the rite, so nothing ever asked whether the object was there.
 * **PR #1508's law-6 comment carried six links and all six answered Not Found**,
 * over frames that existed only in that machine's `%TEMP%`, under a body saying
 * they had been looked at.
 *
 * So this script now HEADs the URL it is about to hand back and REFUSES if the
 * bucket does not serve it. `storagePut` returning a key proves the request did
 * not throw; it does not prove an object. Working law 1, at the one moment the
 * repair is free.
 *
 * **On success the output names the on-disk path and the public URL as well as
 * the key** — a comment that carries both says where the frame came from as
 * well as where it lives. **The key stays the LAST line** (#265).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { extname, resolve as resolvePath } from "node:path";

import { storagePut } from "../server/storage";
import { judgeUploadedFrame } from "./lib/eyeFramePresence.mts";
import { fetchWithClearedTimeout, settleSockets } from "./lib/exitSafeFetch.mts";

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

/* ⚠ THE PUT'S RETURN VALUE IS A CLAIM; THE OBJECT IS THE FACT (#1509).
   The rite asks this question before a briefing pushes, and a builder seat
   proving working law 6 on a pull request never meets the rite — so PR #1508
   posted six links that all answered Not Found, over frames that existed only
   in that machine's %TEMP%. Asking HERE covers every road that uploads a
   frame, including the ones nobody has written yet. */
const landed = await judgeUploadedFrame(
  result.key,
  result.url,
  process.env.R2_PUBLIC_URL,
  /* The rite's own fetch policy, and the timeout for its reason (#1177): a
     host that accepts the connection and never answers takes 306.6s to reject
     on node 24, which would hang a seat mid-batch.

     ⚠ A CLEARED TIMER RATHER THAN `AbortSignal.timeout`, AND IT WAS A REAL
     CRASH RATHER THAN A PREFERENCE. This script calls `process.exit(1)` on the
     very next statement, and exiting while a timer handle is still closing
     aborts node itself — `Assertion failed: !(handle->flags &
     UV_HANDLE_CLOSING)`, exit code 3221226505 instead of 1, measured on the
     unresolvable-host arm. A refusal that reports a crash code is a refusal a
     caller cannot tell from a bug.

     ⚠ THE CONTROLLER USED TO BE WRITTEN OUT HERE, AND THE SENTENCE BESIDE IT
     WAS WRONG (#1517). It read *"The rite can use the terser form because it
     keeps running afterwards"* — but the rite calls `die()`, which is
     `process.exit(1)`, on the statement after its own judge and again after its
     health probe. So the rite had this exact hazard on the strength of a premise
     about the rite that was not true. Both are on the shared owner now, which is
     also the only place the duration is written down. */
  async (url) =>
    await fetchWithClearedTimeout(url, { method: "HEAD" }, 10_000)
      .then((response) => response.status)
      .catch(() => null),
);
if (!landed.ok) {
  /* ⚠ NOTHING KEY-SHAPED IS PRINTED ON THE WAY OUT, and that is the #265 trap
     read the other way: callers pipe this through `| tail -1`, and a shell
     pipeline reports the LAST command's status, so a refusal whose final line
     looked like a key would be harvested with the failure masked. */
  console.error(
    `REFUSED: the frame was written but the bucket does not serve it back.\n`
    + `  ${landed.why}\n`
    + `  on disk: ${resolvePath(filePath)}\n`
    /* ⚠ THE OBJECT IS NAMED, AND IT IS NOT DELETED. The bytes were written
       before this check ran, so saying nothing would leave litter with no name
       — but an `unread` verdict means the object may be perfectly fine and
       merely unreachable from here, and deleting on that reading would destroy
       a good frame to tidy up after a flaky HEAD. So it is named for a person
       to judge. It is on STDERR and it is not `key:`-shaped, so no pipe can
       harvest it as a publishable key. */
    + `  wrote, unpublished: ${result.key}\n`
    + "  Nothing is published. A link posted from here would answer Not Found to everyone\n"
    + "  but this machine — which is what PR #1508 did (#1509). Re-run under the environment\n"
    + "  whose R2_PUBLIC_URL names the bucket you just wrote to.",
  );
  /*
    ⚠ THE REFUSAL DRAINS BEFORE IT EXITS, AND THE NUMBER IS MEASURED RATHER
    THAN A SUPERSTITION — `scripts/lib/exitSafeFetch.mts` carries the whole
    measurement table and is the ONE owner of the duration.

    `process.exit` while the sockets the HEAD opened are still closing aborts
    node itself on Windows — `Assertion failed: !(handle->flags &
    UV_HANDLE_CLOSING)`, and the process reports **3221226505** instead of 1.
    Deterministic: 3 of 3 runs of this script against a host that answers
    anything but 200, and 4 of 4 with `connection: close` asked for.

    ⚠ **THE RITE HAD THE SAME HAZARD AND THIS COMMENT USED TO SAY SO AND LEAVE
    IT** — `die()` calls `process.exit(1)` immediately after this same judge, so
    an `unread` verdict crashed it instead of printing its refusal. **Fixed under
    #1517**, and the 250 that was written out here moved into the shared owner in
    the same act: two copies of a measured constant on two error paths nobody
    exercises is working law 4, and the copy that drifts is the one nobody runs.
  */
  await settleSockets("the read-back HEAD");
  process.exit(1);
}

console.log(`READ BACK FROM THE BUCKET: ${landed.why}`);
/* THE ON-DISK PATH RIDES ALONG (#1509). A comment naming both says where the
   frame came from as well as where it lives, so a link that rots later is
   still traceable to the driver run that made it. */
console.log(`on disk: ${resolvePath(filePath)}`);
console.log(`url: ${result.url}`);
console.log("Next: name the key below in a briefing eyeItems entry (with its caption and arm), and deploy.");
/* THE KEY IS THE LAST LINE, ON PURPOSE (#265). Two shifts ran this in a loop
   piped through `| tail -1`, got the "Next:" sentence instead of the key, and
   ran the loop AGAIN with a grep — so every frame was uploaded twice and the
   first set became orphans nobody can name. The one line a caller needs is the
   one the obvious pipe keeps; prose goes above it. */
console.log(`key: ${result.key}`);
process.exit(0);
