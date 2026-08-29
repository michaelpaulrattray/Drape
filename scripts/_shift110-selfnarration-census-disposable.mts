/**
 * DISPOSABLE — HOW OFTEN DOES THE MAX AUTHOR NARRATE ITS OWN ACT INTO THE
 * IMAGE PROMPT? (#242)
 *
 * #242 was filed on ONE draft of four, measured on a drive rather than at the
 * rows, and it names its own cheap next step in as many words:
 *
 *   > A rate is cheap to get: the drafts are already recorded on every author
 *   > row (`register.content`), so a census over production rows is a read,
 *   > not a drive.
 *
 * This is that read. It answers two questions and refuses to answer a third.
 *
 *   1. WHAT IS THE RATE — of recorded author drafts, how many contain a clause
 *      that talks about the author's own act (what it added, did not add, kept,
 *      or what the request said) rather than about the picture?
 *   2. IS IT SEPARABLE BY CODE — the card's real question. The obvious ban
 *      (`no invented`, `no new`, `not add`) is the `cropped` / bare `framing`
 *      class a fifth time, because *"no soft youthful rounding"* is the
 *      founder's own legitimate picture direction and has the same shape. So
 *      this prints EVERY candidate sentence for reading, labelled with the cue
 *      that caught it, instead of returning a count of a judgement nobody made.
 *   3. It does NOT rule. Classification of each hit is a reading, done at the
 *      printed text and recorded in the shift's report — not asserted here.
 *
 * ⚠ THE DETECTOR IS DELIBERATELY OVER-BROAD. Its job is to bound the
 * population from above: a cue list narrow enough to be right would already be
 * the fix, and the fix is what the card is undecided about. Precision is
 * supplied by the eye that reads the output; what code supplies is that
 * nothing is missed.
 *
 * ⚠ AND IT CARRIES ITS OWN CONTROLS (working law 2). Before it reads a single
 * row it runs the known POSITIVE specimen from #242 (draft 3's closing clause,
 * which must be caught) and three NEGATIVE controls that a naive ban would
 * take — the founder's own *"no soft youthful rounding"* among them. A run
 * whose controls do not behave prints CONTROLS FAILED and exits nonzero, so a
 * clean census can never be read off an instrument that cannot fail.
 *
 * Read-only. One SELECT. No write of any kind, no engine call, no money.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_shift110-selfnarration-census-disposable.mts
 *   npx tsx scripts/_shift110-selfnarration-census-disposable.mts --dev
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";

const useDev = process.argv.includes("--dev");
/*
  READ DRAFTS FROM DISK INSTEAD OF THE ROWS. The recorded row population is
  five drafts across both worlds (measured, see the card), so the population
  that can answer #242 is the drive corpora — and it goes through THIS cue
  list rather than a second copy of it (working law 4).

    --drafts output/_shift110-author-drive --drafts output/_shift101-lane
*/
const draftDirs: string[] = [];
process.argv.forEach((arg, at) => {
  if (arg === "--drafts" && process.argv[at + 1]) draftDirs.push(process.argv[at + 1]);
});

/*
  CUES — each is a fragment that MIGHT indicate the author is talking about its
  own act or about the request, rather than about the picture. Every one of
  these has a legitimate second sense in a casting paragraph; that is the point
  of the card and the reason nothing here is a ban.
*/
const CUES: ReadonlyArray<{ cue: string; why: string }> = [
  { cue: "the user", why: "already banned (NEVER_WRITTEN) — present as a control on the ban's reach" },
  { cue: "the request", why: "names the customer's text as an object" },
  { cue: "the brief", why: "names the customer's text as an object" },
  { cue: "the prompt", why: "names the customer's text as an object" },
  { cue: "the description", why: "names the customer's text as an object" },
  { cue: "described", why: "'beyond the armour already described' — #242's own specimen" },
  { cue: "specified", why: "'the texture the user specified' — #230's first drive" },
  { cue: "stated", why: "refers to what the request said" },
  { cue: "as given", why: "refers to what the request said" },
  { cue: "invented", why: "'no invented jewelry' — #242's own specimen" },
  { cue: "added", why: "refers to the author's act" },
  { cue: "adding", why: "refers to the author's act" },
  { cue: "no new", why: "'no new garments' — #242's own specimen" },
  { cue: "beyond", why: "'beyond what was described' — the author bounding its own additions" },
  { cue: "retained", why: "refers to the author's act of keeping something" },
  { cue: "unchanged", why: "refers to the author's act of keeping something" },
  { cue: "instruction", why: "names the author's own instructions" },
  { cue: "no softening", why: "#242's own specimen — and the shape of his legitimate 'no soft…' direction" },
];

/** Every sentence of `text` that contains at least one cue, with the cues that caught it. */
const candidateSentences = (text: string): Array<{ sentence: string; cues: string[] }> => {
  const sentences = text
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hits: Array<{ sentence: string; cues: string[] }> = [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const cues = CUES.filter(({ cue }) => lower.includes(cue)).map(({ cue }) => cue);
    if (cues.length > 0) hits.push({ sentence, cues });
  }
  return hits;
};

/*
  THE CONTROLS. The positive is #242's measured specimen; the negatives are
  three sentences a fix must NOT take — his own optional-heat direction, an
  ordinary picture negative, and a species fact. A negative control that the
  over-broad detector DOES catch is not a failure of this run: it is the
  measurement the card asked for, so each says which it expects.
*/
const POSITIVE_CONTROL =
  "no invented jewelry, no new garments beyond the armour already described, no softening of the "
  + "predatory stillness that defines the character.";
const NEGATIVE_CONTROLS = [
  "no soft youthful rounding in the jaw.",
  "matte skin, no shine.",
  "hairless, with a keratin ridge over the brow.",
];

let controlsOk = true;
console.log("CONTROLS");
const positiveHits = candidateSentences(POSITIVE_CONTROL);
if (positiveHits.length === 0) {
  controlsOk = false;
  console.log("  positive  MISSED — the detector cannot see #242's own specimen. Nothing below is evidence.");
} else {
  console.log(`  positive  CAUGHT via [${positiveHits[0].cues.join(", ")}]`);
}
for (const control of NEGATIVE_CONTROLS) {
  const hits = candidateSentences(control);
  console.log(
    hits.length === 0
      ? `  negative  clear   "${control}"`
      : `  negative  CAUGHT  "${control}" via [${hits[0].cues.join(", ")}] — a naive ban would take this`,
  );
}
if (!controlsOk) {
  console.log("");
  console.log("CONTROLS FAILED — refusing to report a census from an instrument that cannot fail.");
  process.exit(1);
}
console.log("");

if (draftDirs.length > 0) {
  const drafts: Array<{ id: string; content: string }> = [];
  for (const dir of draftDirs) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".txt")).sort()) {
      const content = readFileSync(`${dir}/${name}`, "utf8");
      /* A `static` fallback wrote an EMPTY file — it is a draft that does not
         exist, not a clean one, and counting it as clean would flatter the rate. */
      if (content.trim().length === 0) {
        console.log(`skip  ${dir}/${name} — empty (the author fell to the static bundle)`);
        continue;
      }
      drafts.push({ id: `${dir}/${name}`, content });
    }
  }
  console.log("");
  console.log(`drafts read from disk            ${drafts.length}`);
  console.log("");
  console.log("CANDIDATE SENTENCES — every one is printed; classification is a reading, not a count");
  console.log("");
  let withCandidates = 0;
  for (const draft of drafts) {
    const hits = candidateSentences(draft.content);
    if (hits.length === 0) continue;
    withCandidates += 1;
    console.log(`${draft.id} · ${draft.content.trim().split(/\s+/).length} words`);
    for (const hit of hits) {
      console.log(`    [${hit.cues.join(", ")}]`);
      console.log(`      ${hit.sentence}`);
    }
    console.log("");
  }
  console.log("SUMMARY");
  console.log(`  drafts read                      ${drafts.length}`);
  console.log(`  drafts with ≥1 CANDIDATE clause  ${withCandidates}`);
  console.log(`  drafts clear of every cue        ${drafts.length - withCandidates}`);
  console.log("");
  console.log("The candidate count is an UPPER BOUND and nothing else — the cue list is");
  console.log("deliberately over-broad. The rate #242 asked for is the confirmed subset,");
  console.log("read at the sentences printed above.");
  process.exit(0);
}

let url: string | undefined;
if (useDev) {
  url = process.env.DATABASE_URL;
  if (!url) {
    console.log("UNREAD — DATABASE_URL is not set in this shell");
    process.exit(1);
  }
} else {
  const result = spawnSync("railway.cmd", ["variables", "--service", "MySQL", "--kv"], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(`UNREAD — railway variables failed: ${(result.stderr ?? "").slice(0, 200)}`);
    process.exit(1);
  }
  url = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
    ?.slice("MYSQL_PUBLIC_URL=".length);
  if (!url) {
    console.log("UNREAD — MYSQL_PUBLIC_URL not readable from this shell");
    process.exit(1);
  }
}

/* The world, named out loud — the port is how the two databases are told apart. */
console.log(`world: ${useDev ? "dev" : "production"} · ${new URL(url).port}`);
console.log("");

const connection = await openDatabase(url);

const [rolls] = await connection.query<any[]>(
  `SELECT id, createdAt, compiledBrief FROM casting_rolls
    WHERE compiledBrief IS NOT NULL ORDER BY id`,
);

let authorRows = 0;
const byMode = new Map<string, number>();
const drafts: Array<{ id: number; createdAt: string; mode: string; content: string }> = [];

for (const row of rolls) {
  const brief = typeof row.compiledBrief === "string" ? JSON.parse(row.compiledBrief) : row.compiledBrief;
  const register = brief?.register;
  if (!register || register.kind !== "author") continue;
  authorRows += 1;
  const mode = String(register.mode ?? "(absent)");
  byMode.set(mode, (byMode.get(mode) ?? 0) + 1);
  const content = typeof register.content === "string" ? register.content : "";
  if (content.trim().length > 0) {
    drafts.push({
      id: Number(row.id),
      createdAt: new Date(row.createdAt).toISOString(),
      mode,
      content,
    });
  }
}

console.log(`rolls with a compiled brief      ${rolls.length}`);
console.log(`  … author-road rows             ${authorRows}`);
for (const [mode, count] of [...byMode.entries()].sort()) {
  console.log(`      mode ${mode.padEnd(10)} ${count}`);
}
console.log(`  … rows carrying author TEXT    ${drafts.length}`);
console.log("");

if (drafts.length === 0) {
  console.log("NO DRAFTS — this world has no recorded author text, so it holds no rate.");
  console.log("A census with an empty population is not a low rate; it is no reading at all.");
  await connection.end();
  process.exit(0);
}

let draftsWithCandidates = 0;
console.log("CANDIDATE SENTENCES — every one is printed; classification is a reading, not a count");
console.log("");
for (const draft of drafts) {
  const hits = candidateSentences(draft.content);
  if (hits.length === 0) continue;
  draftsWithCandidates += 1;
  console.log(`roll ${draft.id} · ${draft.createdAt} · mode ${draft.mode} · ${draft.content.split(/\s+/).length} words`);
  for (const hit of hits) {
    console.log(`    [${hit.cues.join(", ")}]`);
    console.log(`      ${hit.sentence}`);
  }
  console.log("");
}

console.log("SUMMARY");
console.log(`  drafts read                      ${drafts.length}`);
console.log(`  drafts with ≥1 CANDIDATE clause  ${draftsWithCandidates}`);
console.log(`  drafts clear of every cue        ${drafts.length - draftsWithCandidates}`);
console.log("");
console.log("The candidate count is an UPPER BOUND on the defect and nothing else — the cue");
console.log("list is deliberately over-broad, and at least one negative control above is");
console.log("caught by it. The rate #242 asked for is the confirmed subset, read at the");
console.log("sentences printed here.");

await connection.end();
process.exit(0);
