/**
 * THE REFUSAL PATROL'S READING — #129 slice 2, item (2).
 *
 * Lists the words slice 1 kept (`casting-v2/refusal-loop/…` on the PRIVATE
 * evidence bucket), reads them, and prints what the corpus supports: the
 * census, the coin, and the words that clear the left half of his bar. The
 * judging lives in `server/castingV2/refusalLoopCorpus.ts`, which is driven by
 * its own suite — this file is the door to the objects and nothing else, so a
 * finding can never rest on a one-off reader nobody tested.
 *
 * # How to run it, and why it is the only shape that works
 *
 *     railway.cmd run --service Drape -- npx tsx scripts/refusal-patrol-read.mts
 *
 * The objects are on `private_evidence_r2`, whose three variables exist ONLY on
 * the production `Drape` service — they are absent from a local `.env`, and
 * that is deliberate (a dev tree cannot reach a customer's kept words). This
 * script therefore does NOT import dotenv: under the wrong wrapper the keys are
 * simply absent and `assertDefinedByService` refuses by name, where a dotenv
 * import would have let a local value quietly fill the gap.
 *
 * It touches NO database. The key carries the owner, the operation, the
 * candidate and the outcome, so the whole census is a read of keys and bodies —
 * which also means it cannot mix worlds the way a rows-plus-objects script can.
 *
 * # What it will not print
 *
 * **No prompt text, ever** — not to the terminal, not to `output/`. A composed
 * prompt is the cast's recipe in sentences, the `masterPrompt` class, and the
 * capture half holds the same line in its own logging. What leaves here is
 * counts, truncated hashes, and single words that met a stated bar.
 *
 * # Options
 *
 *   --pair <word>=<replacement>   judge a proposed pair against the corpus
 *                                 (repeatable; this is the gate on his list)
 *   --min-refused-texts <n>       tighten the candidate bar (default 2)
 *   --out <path>                  where the reading is written
 *                                 (default output/refusal-patrol-129/reading.json)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import {
  PRIVATE_EVIDENCE_ACCESS_KEY_ENV,
  PRIVATE_EVIDENCE_BUCKET_ENV,
  PRIVATE_EVIDENCE_SECRET_KEY_ENV,
} from "../server/casting/evidence/privateEvidenceStorage";
import { REFUSAL_LOOP_KEY_PREFIX } from "../server/castingV2/refusalLoopCapture";
import {
  MIN_REFUSED_TEXTS,
  censusCorpus,
  identicalTextOutcomes,
  measuredPairVerdict,
  parseRefusalLoopKey,
  promptHash,
  triggerCandidates,
  vocabularyReach,
  type RefusalLoopEntry,
} from "../server/castingV2/refusalLoopCorpus";
import { assertDefinedByService } from "./lib/worldGuard.mts";

/* Named by its card, read before anything else so a bad flag costs nothing. */
const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}
const proposals = args.flatMap((arg, index) => {
  if (args[index - 1] !== "--pair") return [];
  const [word, replacement] = arg.split("=");
  if (!word || !replacement) {
    throw new Error(`--pair wants <word>=<replacement>, got "${arg}"`);
  }
  return [{ word, replacement }];
});
const minRefusedTexts = Number(flag("min-refused-texts") ?? MIN_REFUSED_TEXTS);
if (!Number.isSafeInteger(minRefusedTexts) || minRefusedTexts < 1) {
  throw new Error("--min-refused-texts wants a positive whole number");
}
const outPath = flag("out") ?? "output/refusal-patrol-129/reading.json";

/*
  THE KEYS THIS READING RESTS ON, DECLARED. Under `--service MySQL` — the
  wrapper every other crew script uses — all three evidence variables are
  absent, and this refusal is what stops the run reading an empty prefix off
  the wrong bucket and reporting "no corpus".
*/
assertDefinedByService([
  "R2_ENDPOINT",
  PRIVATE_EVIDENCE_BUCKET_ENV,
  PRIVATE_EVIDENCE_ACCESS_KEY_ENV,
  PRIVATE_EVIDENCE_SECRET_KEY_ENV,
]);

const bucket = process.env[PRIVATE_EVIDENCE_BUCKET_ENV]!;
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env[PRIVATE_EVIDENCE_ACCESS_KEY_ENV]!,
    secretAccessKey: process.env[PRIVATE_EVIDENCE_SECRET_KEY_ENV]!,
  },
});

async function listKeys(): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${REFUSAL_LOOP_KEY_PREFIX}/`,
      ContinuationToken: token,
    }));
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys.sort();
}

async function readBody(key: string): Promise<string> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body as AsyncIterable<Uint8Array> | undefined;
  if (!body) throw new Error("empty body");
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

type Rejected = { key: string; why: string };

const keys = await listKeys();
const entries: RefusalLoopEntry[] = [];
const rejected: Rejected[] = [];

for (const key of keys) {
  const parsed = parseRefusalLoopKey(key);
  if (!parsed) {
    rejected.push({ key, why: "the key is not one of slice 1's" });
    continue;
  }
  let body: unknown;
  try {
    body = JSON.parse(await readBody(key));
  } catch (error) {
    rejected.push({ key, why: `unreadable: ${(error as Error).message}` });
    continue;
  }
  if (typeof body !== "object" || body === null) {
    rejected.push({ key, why: "the body is not an object" });
    continue;
  }
  const record = body as Record<string, unknown>;
  const prompt = record.prompt;
  const promptSha256 = record.promptSha256;
  if (typeof prompt !== "string" || prompt.length === 0) {
    rejected.push({ key, why: "no prompt in the body" });
    continue;
  }
  if (typeof promptSha256 !== "string") {
    rejected.push({ key, why: "no hash in the body" });
    continue;
  }
  /*
    THE HASH IS RECOMPUTED, NOT TRUSTED. The body carries both the words and
    their hash, so a corrupt or truncated object can be caught rather than
    counted — and every bar in the reader keys on that hash as the identity of
    a TEXT, so a wrong one would split one piece of evidence into two.
  */
  const recomputed = promptHash(prompt);
  if (recomputed !== promptSha256) {
    rejected.push({ key, why: "the body's hash does not match its words" });
    continue;
  }
  /* The key's outcome is the one the census reads; disagreement is a finding. */
  if (record.outcome !== parsed.outcome) {
    rejected.push({ key, why: `the body says "${String(record.outcome)}" and the key says "${parsed.outcome}"` });
    continue;
  }
  entries.push({
    userId: parsed.userId,
    operationId: parsed.operationId,
    candidatePublicId: parsed.candidatePublicId,
    outcome: parsed.outcome,
    prompt,
    promptSha256,
  });
}

const census = censusCorpus(entries);
const reach = vocabularyReach(entries);
const coins = identicalTextOutcomes(entries);
const candidates = triggerCandidates(entries, { minRefusedTexts });
const verdicts = proposals.map((proposal) => measuredPairVerdict(entries, proposal, {
  minTexts: minRefusedTexts,
}));

const coinSlices = coins.reduce((total, row) => total + row.refusedSlices + row.passedSlices, 0);

console.log(`REFUSAL PATROL — the corpus under ${REFUSAL_LOOP_KEY_PREFIX}/`);
console.log(`bucket: ${bucket} (private evidence) · keys listed: ${keys.length} · read: ${entries.length}`);
if (rejected.length > 0) {
  console.log(`\n⚠ ${rejected.length} object(s) NOT counted:`);
  for (const row of rejected) console.log(`   ${row.key} — ${row.why}`);
}
console.log("\nCENSUS");
console.log(`  slices          ${census.slices}  (refused ${census.refusedSlices} · passed ${census.passedSlices})`);
console.log(`  operations      ${census.operations}`);
console.log(`  owners          ${census.users.join(", ") || "(none)"}`);
console.log(`  DISTINCT TEXTS  ${census.distinctTexts}  (refused ${census.refusedTexts} · passed ${census.passedTexts})`);
console.log(`     ^ this is the n. ${census.slices} objects amount to ${census.distinctTexts} piece(s) of evidence.`);
console.log(`  one-text rolls  ${census.singleTextOperations} of ${census.operations}`);
console.log(`  COIN rolls      ${census.coinOperations} — one text, both outcomes, inside one roll`);

console.log("\nWHAT THIS READING COULD HAVE FOUND — the run's own positive control");
console.log(`  distinct words   ${reach.distinctWords}`);
console.log(`  ever refused     ${reach.refusedWords}`);
console.log(
  `  ALSO delivered   ${reach.refusedWordsAlsoDelivered}`
  + (reach.refusedWords > 0 && reach.refusedWordsAlsoDelivered === reach.refusedWords
    ? "  <- EVERY refused word in the corpus was also allowed"
    : ""),
);
if (reach.distinctWords === 0) {
  console.log("  ⚠ ZERO WORDS READ — read everything below as unread, never as a finding.");
}

console.log(`\nTHE COIN — texts that were both refused and delivered: ${coins.length}`);
console.log(`  ${coinSlices} of ${census.slices} slices sit on such a text.`);
for (const row of coins.slice(0, 20)) {
  console.log(
    `  ${row.promptSha256.slice(0, 12)}…  refused ${row.refusedSlices} · passed ${row.passedSlices}`
    + `  across ${row.operationIds.length} roll(s)`,
  );
}
if (coins.length > 20) console.log(`  … and ${coins.length - 20} more`);

console.log(`\nTRIGGER CANDIDATES — refused in ≥ ${minRefusedTexts} distinct texts, delivered in none: ${candidates.length}`);
for (const row of candidates) {
  console.log(
    `  ${row.word}  refusedTexts ${row.refusedTexts} · refusedRolls ${row.refusedOperations}`
    + ` · (slices ${row.refusedSlices})`,
  );
}
if (candidates.length === 0) {
  console.log("  none. A candidate is not a pair; nothing enters his list from this.");
}

if (verdicts.length > 0) {
  console.log("\nPROPOSED PAIRS — judged against the corpus");
  for (const verdict of verdicts) {
    console.log(
      `  ${verdict.proposal.word} → ${verdict.proposal.replacement}: `
      + (verdict.admitted ? "ADMITTED" : `REFUSED — ${verdict.reason}`),
    );
  }
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({
  readAt: new Date().toISOString(),
  bucket,
  prefix: `${REFUSAL_LOOP_KEY_PREFIX}/`,
  keysListed: keys.length,
  entriesRead: entries.length,
  rejected,
  census,
  reach,
  minRefusedTexts,
  coins,
  candidates,
  verdicts,
}, null, 2)}\n`, "utf8");
console.log(`\nwritten: ${outPath}  (counts, hashes and words only — no prompt text)`);

process.exit(0);
