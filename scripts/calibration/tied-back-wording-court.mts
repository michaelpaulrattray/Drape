/**
 * WHY DID `tied back` READ FALSE ON HAIR THAT NEVER MOVED?
 *
 * Run-14 pinned cand-1543 `tied back` — the value this build RULED for her, and
 * the reader itself chose it 3/3 on her master in the arrangement court. Then
 * two of three renders came back:
 *
 *   03  "hair worn down, loose strands framing the face, not fastened back"
 *   04  "hair loose around face, not gathered or fastened back"
 *   05  "hair pulled back from face, gathered behind, length hanging down"  ✓
 *
 * Master, 03, 04 and 05 are the SAME ARRANGEMENT — swept back off the forehead,
 * gathered behind, thin face-framing wisps to the jaw, nothing over the
 * shoulders in any of them. So 03 and 04 are FALSE MISSES, and the run-13
 * signature has repeated one layer down: not an ambiguous VALUE this time, but
 * an unstable threshold for what a few loose strands mean.
 *
 * # The hypothesis, and it is about my own wording
 *
 * `tied back` ends **"the length still hanging"**. `down` reads **"worn down —
 * hanging, not gathered…"**. The two share their most salient verb, so a reader
 * asked "is the length still hanging?" is one association away from answering
 * the OTHER question. The `saw`s read exactly like that.
 *
 * # So it is measured, not tweaked
 *
 * The last time a wording was sharpened on reasoning alone it measured worse and
 * was reverted. Three candidate wordings, the same five frames, five readings
 * each — plus NEGATIVE CONTROLS: two masters whose hair really is down, where
 * every candidate must read FALSE. A wording that passes everything is not a
 * better wording, it is a broken one.
 *
 * No credits: text calls on frames already paid for.
 *
 *   npx tsx scripts/calibration/tied-back-wording-court.mts --repeat 5
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import { verifyRender } from "../../server/castingV2/renderVerification";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

const OUT = "output/tied-back-court";
mkdirSync(OUT, { recursive: true });
const WALK = "output/walk/2026-08-08T15-45-12-636Z";
const HAIR_WORN = facetOfSubject("hairWorn");
const repeat = Number(process.argv[process.argv.indexOf("--repeat") + 1]) || 5;

const WORDINGS = {
  /* What shipped, and what produced the two false misses. */
  shipped: "tied back — drawn away from the face and fastened behind, the length still hanging",
  /* The hypothesis: drop the verb `down` also owns. */
  noHanging: "tied back — drawn away from the face and gathered behind the head",
  /* The other hypothesis: the wisps are what flips it, so name them as allowed. */
  forgivesWisps: "tied back — the bulk of the hair drawn away from the face and gathered behind the head,"
    + " apart from any loose strands left at the temples",
  /*
    AND THE SAME SENTENCE WITHOUT THE FORBIDDEN WORD.

    `forgivesWisps` measured best and then failed this build's OWN test: no
    wording may contain "loose", because that adjective is the whole reason
    run-13 scored 25%. The test is right and the measurement is right, so the
    third option is a wording that keeps the meaning and drops the word — and it
    is put to the same six frames rather than assumed equivalent.
  */
  strayStrands: "tied back — the bulk of the hair drawn away from the face and gathered behind the head,"
    + " apart from a few stray strands at the temples",
} as const;

const CASES: ReadonlyArray<{ file: string; name: string; truth: boolean }> = [
  /* POSITIVE — every one of these is her, tied back, byte-for-byte the same
     arrangement, looked at at 900px before this file was written. */
  { file: "output/hair-court/cand-1543.png", name: "1543 master", truth: true },
  { file: `${WALK}/03-delivered.png`, name: "run-14 03", truth: true },
  { file: `${WALK}/04-delivered.png`, name: "run-14 04", truth: true },
  { file: `${WALK}/05-delivered.png`, name: "run-14 05", truth: true },
  /* NEGATIVE — hair genuinely down. A wording that says yes here is not better,
     it is broken, and without these a permissive wording wins by default. */
  { file: "output/hair-court/cand-1546.png", name: "1546 (down)", truth: false },
  { file: "output/hair-court/cand-1584.png", name: "1584 (down)", truth: false },
];

type Row = { wording: string; name: string; truth: boolean; verdicts: boolean[]; saws: string[] };
const rows: Row[] = [];

for (const [key, asked] of Object.entries(WORDINGS)) {
  for (const testCase of CASES) {
    const bytes = readFileSync(testCase.file);
    const verdicts: boolean[] = [];
    const saws: string[] = [];
    for (let attempt = 0; attempt < repeat; attempt += 1) {
      const verdict = await verifyRender({
        bytes,
        contentType: "image/png",
        facts: [{ facet: HAIR_WORN, asked, binding: false }],
      });
      const check = verdict.checks[0];
      verdicts.push(Boolean(check?.verified));
      if (check?.saw) saws.push(check.saw);
    }
    const right = verdicts.filter((v) => v === testCase.truth).length;
    const unanimous = new Set(verdicts).size === 1;
    rows.push({ wording: key, name: testCase.name, truth: testCase.truth, verdicts, saws });
    console.log(
      `${key.padEnd(14)} ${testCase.name.padEnd(13)} truth=${String(testCase.truth).padEnd(5)} `
      + `${right}/${repeat} right ${unanimous ? "        " : "  SPLIT "} `
      + `saw: ${saws[0]?.slice(0, 58) ?? "—"}`,
    );
  }
  console.log("");
}

writeFileSync(`${OUT}/court.json`, JSON.stringify({ repeat, WORDINGS, rows }, null, 2));

console.log("summary — a wording must be right on the POSITIVES and still refuse the NEGATIVES\n");
for (const key of Object.keys(WORDINGS)) {
  const mine = rows.filter((row) => row.wording === key);
  const score = (subset: Row[]) =>
    subset.reduce((sum, row) => sum + row.verdicts.filter((v) => v === row.truth).length, 0);
  const positives = mine.filter((row) => row.truth);
  const negatives = mine.filter((row) => !row.truth);
  console.log(
    `  ${key.padEnd(14)} positives ${score(positives)}/${positives.length * repeat}   `
    + `negatives ${score(negatives)}/${negatives.length * repeat}   `
    + `splits ${mine.filter((row) => new Set(row.verdicts).size > 1).length}`,
  );
}
