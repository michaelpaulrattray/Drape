/**
 * UPLOAD ONE EYE FRAME — step 1 of putting a judgement in front of the
 * founder's eyes on /admin/crew (issue #75).
 *
 * Usage:  npx tsx scripts/crew-upload-eye-frame.mts <path-to-image>
 *
 * Uploads the file to the bucket under `crew-eye/<uuid>.<ext>` and prints the
 * KEY. The frame is NOT visible to anyone until a briefing edition names that
 * key inside an `eyeItems` entry and deploys — the deployed briefing is the
 * serving route's allowlist, so this script alone publishes nothing.
 *
 * Which bucket: whatever `.env`'s R2_* names — the dev bucket locally. For a
 * frame the founder must see on PRODUCTION, run it with the production R2
 * variables (the deploy-rite's own env discipline), or upload from a shift
 * whose .env carries them. The briefing caption you write next is where the
 * plain-English explanation lives; this script only moves bytes.
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

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/crew-upload-eye-frame.mts <path-to-image>");
  process.exit(1);
}

const ext = extname(filePath).toLowerCase();
const contentType = CONTENT_TYPES[ext];
if (!contentType) {
  console.error(`Unsupported extension ${ext} — the eye-frame schema takes png/jpg/jpeg/webp`);
  process.exit(1);
}

const bytes = readFileSync(filePath);
const key = `crew-eye/${crypto.randomUUID()}${ext}`;
const result = await storagePut(key, bytes, contentType);

console.log(`uploaded ${bytes.length} bytes`);
console.log(`key: ${result.key}`);
console.log("Next: name this key in a briefing eyeItems entry (with its caption and arm), and deploy.");
process.exit(0);
