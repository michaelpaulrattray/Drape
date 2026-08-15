/**
 * WHAT PEOPLE ACTUALLY ASK FOR — the demand reading the promotion kit needs and
 * the demand TABLE cannot yet give.
 *
 * The kit's last refusal clause is *"it does not decide which kinds get run —
 * that is the demand table's job"*, and `casting_open_lane_demand` (migration
 * 0031) has no writer: the table landed ahead of its code, correctly, and the
 * writer belongs to V5. So the instrument that is supposed to choose the next
 * promoted kind chooses nothing, and the choice falls to taste — which is the
 * one thing the kit says it must never be.
 *
 * The corpus is the proxy the program already owns. Every brief and every
 * refine instruction ever typed is a record of somebody asking for something,
 * and counting them against the vocabulary's OWN word lists says which kinds
 * are alive, which are dead, and — the interesting column — how much of the
 * corpus names nothing the vocabulary knows.
 *
 *   npx tsx scripts/read-vocabulary-demand-disposable.mts             (dev)
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-vocabulary-demand-disposable.mts
 *
 * # What this is NOT
 *
 * It is not the demand table, and it must not be quoted as one. It reads the
 * words people typed, matched against the words the vocabulary declares — so a
 * kind asked for in words nobody registered is INVISIBLE to it, and that is the
 * exact population V5's writer exists to capture. It is a floor on demand, not
 * a measurement of it, and the unmatched-corpus figure below is the honest size
 * of what it cannot see.
 *
 * Read-only. Selects only. No transport, no credits.
 */
import { LANDMARK_OF_ACCESSORY } from "../server/castingV2/accessoryKinds";
import { SUBJECT_CARD_ENTRIES } from "../server/castingV2/subjectCards";
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.env.MYSQL_PUBLIC_URL !== undefined;
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: no database URL. For production run under `railway.cmd run --service MySQL`.");
  process.exit(1);
}
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port || "3306"}`);

const connection = await openDatabase(url);
const query = async (sql: string): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql);
  return rows;
};

/* ── the corpus ───────────────────────────────────────────────────────────── */

const briefs = (await query(
  "SELECT briefText AS text FROM casting_rolls WHERE briefText IS NOT NULL AND briefText <> ''",
)).map((row) => String(row.text));
const edits = (await query(
  "SELECT instructions AS text FROM casting_candidate_variants WHERE instructions IS NOT NULL",
)).map((row) => (typeof row.text === "string" ? row.text : JSON.stringify(row.text)));

const corpus = [...briefs.map((t) => ({ from: "brief", text: t })), ...edits.map((t) => ({ from: "edit", text: t }))];
console.log(`corpus: ${briefs.length} briefs + ${edits.length} refine instructions = ${corpus.length} asks`);
console.log("");

/* ── the vocabulary's own words ───────────────────────────────────────────── */

type Term = { id: string; family: string; words: readonly string[] };
const terms: Term[] = [
  ...LANDMARK_OF_ACCESSORY.map((entry) => ({
    id: entry.region, family: "accessory", words: entry.words,
  })),
  ...SUBJECT_CARD_ENTRIES.map(([id, card]) => ({
    id: String(id), family: "subject", words: card.nouns ?? [],
  })),
];

/*
  WORD BOUNDARIES, NOT SUBSTRINGS — and the first run of this script is why.

  `ears` came back the loudest kind in production at 84 asks, ahead of every
  hair subject, which is not what anybody would have guessed about this
  product. It is *"25 years old"*. A substring match on a four-letter noun eats
  every brief that states an age, and the count that looked like a finding was
  a spelling accident. Matched on whole words now, with the same reader driven
  both ways at the bottom.
*/
const boundary = (word: string): RegExp =>
  new RegExp(`(^|[^a-z])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
const patterns = new Map<string, RegExp>();
const hits = (words: readonly string[], text: string): boolean =>
  words.some((word) => {
    if (word.length <= 2) return false;
    let pattern = patterns.get(word);
    if (!pattern) { pattern = boundary(word); patterns.set(word, pattern); }
    return pattern.test(text);
  });

const lowered = corpus.map((entry) => ({ ...entry, text: entry.text.toLowerCase() }));
const counted = terms
  .map((term) => ({
    ...term,
    briefs: lowered.filter((entry) => entry.from === "brief" && hits(term.words, entry.text)).length,
    edits: lowered.filter((entry) => entry.from === "edit" && hits(term.words, entry.text)).length,
  }))
  .map((term) => ({ ...term, total: term.briefs + term.edits }))
  .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));

console.log("DEMAND, by the vocabulary's own words (asks naming this kind at all)");
console.log("");
for (const term of counted) {
  const bar = "#".repeat(Math.min(40, term.total));
  console.log(`  ${term.total.toString().padStart(4)}  ${term.id.padEnd(20)} ${term.family.padEnd(10)}`
    + ` briefs ${String(term.briefs).padStart(4)} edits ${String(term.edits).padStart(4)}  ${bar}`);
}

const dead = counted.filter((term) => term.total === 0);
console.log("");
console.log(`NEVER ASKED FOR, in this world: ${dead.length === 0 ? "(none)" : dead.map((t) => t.id).join(", ")}`);

/* ── what the vocabulary cannot see ───────────────────────────────────────── */

const unmatched = lowered.filter((entry) => !terms.some((term) => hits(term.words, entry.text)));
/*
  SPLIT, BECAUSE THE TWO HALVES MEAN DIFFERENT THINGS — and the pooled figure
  is misleading in the loud direction.

  A ROLL BRIEF describes a whole person ("a young male mediterranean model
  inspired by versace editorial"), and naming no feature is what a brief is
  SUPPOSED to look like. A REFINE INSTRUCTION names a thing to change, so one
  that matches no registered word is a customer asking for something the
  vocabulary has no word for — which is the population that actually decides
  what gets promoted next.
*/
const unmatchedBriefs = unmatched.filter((entry) => entry.from === "brief");
const unmatchedEdits = unmatched.filter((entry) => entry.from === "edit");
const share = (part: number, whole: number) => `${((part / Math.max(1, whole)) * 100).toFixed(1)}%`;
console.log("");
console.log(`ASKS NAMING NOTHING THE VOCABULARY KNOWS: ${unmatched.length} of ${corpus.length}`);
console.log(`  briefs ${unmatchedBriefs.length} of ${briefs.length} (${share(unmatchedBriefs.length, briefs.length)}) `
  + "— expected: a brief describes a person, not a feature");
console.log(`  EDITS  ${unmatchedEdits.length} of ${edits.length} (${share(unmatchedEdits.length, edits.length)}) `
  + "— THE SIGNAL: someone asked to change a thing the vocabulary has no word for");
console.log("");
console.log("  every unmatched EDIT, in full — this is the list that chooses the next kind:");
for (const entry of unmatchedEdits) {
  console.log(`    ${entry.text.replace(/\s+/g, " ").slice(0, 150)}`);
}

/* ── the controls ─────────────────────────────────────────────────────────── */

console.log("");
const positive = lowered.filter((entry) => hits(["hair"], entry.text)).length;
const negative = lowered.filter((entry) => hits(["zzqxnotaword"], entry.text)).length;
/* AND THE BOUNDARY ITSELF, PROVED — the defect this reader shipped with for one
   run. `ears` must not match `years`, and must still match `her ears`. */
const boundaryHolds = !hits(["ears"], "she is 25 years old") && hits(["ears"], "pin her ears back");
console.log(`control POSITIVE  "hair" appears in ${positive} asks `
  + `— ${positive > 0 ? "the reader reads" : "THE READER IS BLANK, ignore every count above"}`);
console.log(`control NEGATIVE  a word that cannot occur appears in ${negative} asks `
  + `— ${negative === 0 ? "the reader can decline" : "THE READER MATCHES ANYTHING"}`);
console.log(`control BOUNDARY  "ears" vs "25 years old" and "pin her ears back" `
  + `— ${boundaryHolds ? "declines the first, finds the second" : "THE SUBSTRING DEFECT IS BACK"}`);

await connection.end();
process.exit(positive > 0 && negative === 0 && boundaryHolds ? 0 : 1);
