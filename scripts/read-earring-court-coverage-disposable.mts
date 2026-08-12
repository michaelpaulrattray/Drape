/**
 * THE EARRING COURT — both populations through the production segmenter.
 *
 * fable-335 ratified the method and left the number unwritten: the floor for
 * `earring` is written only after a court with BOTH populations. The glasses
 * precedent is the shape (`bornWornDetector.ts:85`) — 23 bare faces at 0.000%
 * against 8 bespectacled at 1.349–2.093%, and the floor placed in the empty
 * space between.
 *
 * Every face here was CLASSIFIED BY EYE off
 * `output/shift65-earring-court/{asked,unasked}-heads.png`, never by its brief.
 * Three columns, because two would lie:
 *
 *   WEARING            hoops visible on a lobe
 *   BARE, EARS VISIBLE the lobe is in the picture and there is nothing on it
 *   EARS NOT VISIBLE   hair covers the ear — NOT a bare face, and the reason
 *                      this column exists rather than being folded into bare
 *
 * That third column is the court's own control on its confound: if a covered
 * ear reads the same as a bare one, then a "bare" population drawn from
 * ordinary rolls is measuring hair, not the absence of jewellery.
 *
 * Costs fal segmentation calls. No credits, no rows, no writes.
 *
 *   npx tsx scripts/read-earring-court-coverage-disposable.mts
 */
import "dotenv/config";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { coverage, COVERAGE_BANDS } from "../server/castingV2/maskGeometry";

type Specimen = { label: string; id: string; key: string; seen: Class; prod?: boolean };
type Class = "wearing" | "bare, ears visible" | "ears not visible";

/* Two worlds, two buckets. `assertOneWorld` guards the DATABASE url and says
   nothing about object storage, so the base is chosen per specimen here. */
const DEV_BASE = "https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev/casting-v2/candidates";
const PROD_BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/candidates";

/*
  The verdicts below are the LOOKING, transcribed. Where the sheet did not let
  me be sure, the face is marked "ears not visible" rather than guessed into a
  population — an uncertain face in the bare column is exactly how a floor gets
  written too low.
*/
const SPECIMENS: Specimen[] = [
  // The roll whose brief asked for hoops. Hoops legible on a lobe in all eight.
  { label: "p0", id: "a8303571", key: "0f3b609e-08a8-4d0c-8fed-722c26a07af3", seen: "wearing" },
  { label: "p1", id: "71ad3c7b", key: "a90deb69-7fc9-451d-adbc-b2e723827b1c", seen: "wearing" },
  { label: "p2", id: "27dbd3a4", key: "3224fda0-a7a8-46f4-ac3f-a7441c8fe62d", seen: "wearing" },
  { label: "p3", id: "40279ed9", key: "f53064bd-d913-47f7-b418-ec111d90dabe", seen: "wearing" },
  { label: "p4", id: "18767549", key: "1b22f213-643a-401f-b96d-52504880ecba", seen: "wearing" },
  { label: "p5", id: "83e10422", key: "e9451600-7821-40d5-9b45-10d677f17fe2", seen: "wearing" },
  { label: "p6", id: "8540d86f", key: "fce4b507-83a2-495f-80cd-9de7acc5641a", seen: "wearing" },
  { label: "p7", id: "86e896f1", key: "4b957e20-78da-4e33-b515-b86edc4ab7dd", seen: "wearing" },

  // The glasses roll. ONE face wears its hair back far enough to judge a lobe.
  { label: "n3", id: "3d30406d", key: "1c535fb0-ca6b-4752-99cc-caf93b101120", seen: "bare, ears visible" },

  // The rest of that roll: hair over the ear. The control column.
  { label: "n0", id: "43ac4560", key: "ace45d10-e467-485b-be83-37384d820e78", seen: "ears not visible" },
  { label: "n2", id: "4eb7f921", key: "19b5eae9-1529-4c6d-9510-00ead34f95e0", seen: "ears not visible" },
  { label: "n7", id: "7cf4f801", key: "b80308d5-4d6b-45f0-996d-ba158690643f", seen: "ears not visible" },

  /*
    PRODUCTION faces, classified off `prod-heads.png` — three of the ten wear
    their hair clear of both lobes. **These live in a different bucket**, which
    is not a detail: the first cut of the sheet fetched production keys from the
    dev base and reported ten candidates as deleted.

    Seven of the ten were excluded as "ears not visible" and are deliberately
    NOT listed — a marginal ear counted as bare is how a floor gets written too
    low, and the conservative direction is to drop the face.
  */
  { label: "q1", id: "6683309a", key: "43f1130e-9348-4eeb-b6f0-24417b9153ae", seen: "bare, ears visible", prod: true },
  { label: "q3", id: "f9e9cb81", key: "5b9a6e1b-667c-4f03-abf9-c3eea4f249c5", seen: "bare, ears visible", prod: true },
  { label: "q9", id: "828c2102", key: "c66f10ab-8b60-4c27-bc51-d66f159d4239", seen: "bare, ears visible", prod: true },
];

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });
/* The catalogue's own word, not a user's inflection — the fix in 6a7f6251. */
const REGION = "earring";

type Row = { specimen: Specimen; pct: number | null; note: string };
const rows: Row[] = [];

for (const specimen of SPECIMENS) {
  const response = await fetch(`${specimen.prod ? PROD_BASE : DEV_BASE}/${specimen.key}.png`);
  if (!response.ok) {
    rows.push({ specimen, pct: null, note: `image HTTP ${response.status}` });
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  try {
    /*
      `absentIsAnswer` is what makes this a court rather than a tally of
      refusals. Without it the reader THROWS on an empty answer, and the first
      run of this script duly put every bare face in a "NO READ" column — which
      reads exactly like a broken instrument and is actually the negative
      population reporting itself correctly.

      With it, a genuine absence comes back as an empty mask (coverage 0.0000%)
      and only a TRANSPORT failure still throws. That is the discrimination the
      floor depends on: a zero is a reading, and an unreachable segmenter is
      not.
    */
    const seen = await reader.region({ image: bytes, name: REGION, absentIsAnswer: true });
    rows.push({ specimen, pct: coverage(seen) * 100, note: "" });
  } catch (error) {
    /*
      A read that FAILED is not a reading of zero. It gets its own note and is
      excluded from both distributions — the third-column discipline the
      born-worn detector already keeps (`scan.failed`).
    */
    rows.push({ specimen, pct: null, note: error instanceof Error ? error.message : String(error) });
  }
}

console.log(`region asked: "${REGION}"   n = ${SPECIMENS.length}\n`);
console.log("face".padEnd(16) + "looked like".padEnd(22) + "segmenter reads");
console.log("-".repeat(62));
for (const row of rows) {
  console.log(
    `${row.specimen.label} ${row.specimen.id}${row.specimen.prod ? "*" : ""}`.padEnd(16) +
      row.specimen.seen.padEnd(22) +
      (row.pct === null ? `NO READ — ${row.note}` : `${row.pct.toFixed(4)}%`),
  );
}

const of = (klass: Class) =>
  rows.filter((r) => r.specimen.seen === klass && r.pct !== null).map((r) => r.pct as number);

const wearing = of("wearing");
const bare = of("bare, ears visible");
const hidden = of("ears not visible");

const span = (values: number[]) =>
  values.length === 0
    ? "no readings"
    : `${Math.min(...values).toFixed(4)}% – ${Math.max(...values).toFixed(4)}%  (n=${values.length})`;

console.log("-".repeat(62));
console.log(`WEARING            ${span(wearing)}`);
console.log(`BARE, EARS VISIBLE ${span(bare)}`);
console.log(`EARS NOT VISIBLE   ${span(hidden)}`);
console.log(`\nthe gate's current floor (measured on GLASSES): `
  + `${(COVERAGE_BANDS.eyewearFrames.min * 100).toFixed(4)}%`);

/*
  The verdict is about SEPARATION, not about a number. A floor may only be
  written into an empty gap; if the two populations touch, the honest finding is
  that this instrument cannot judge this kind by coverage alone.
*/
if (wearing.length > 0 && bare.length > 0) {
  const gap = Math.min(...wearing) - Math.max(...bare);
  console.log(
    gap > 0
      ? `\nGAP: ${Math.max(...bare).toFixed(4)}% … ${Math.min(...wearing).toFixed(4)}% `
        + `— ${gap.toFixed(4)} points of empty space, and a floor may sit in it.`
      : `\nNO GAP: the populations OVERLAP by ${(-gap).toFixed(4)} points. `
        + `No floor is honest here; coverage alone cannot judge this kind.`,
  );
} else {
  console.log("\nONE POPULATION IS EMPTY — this is not a court yet, and no floor may be written.");
}

process.exit(0);
