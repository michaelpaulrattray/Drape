/**
 * THE EARRING FLOOR, RE-DERIVED AT THE BOUNDARY IT WILL BE APPLIED AT.
 *
 * fable-435 condition 1. `EARRING_COVERAGE_FLOOR` was measured on the
 * WHOLE-FRAME union (8 worn faces, 0.0404–0.0621%) and its provenance says the
 * floor sits *"2x under the smallest worn reading"*. Both live consumers
 * (`refineService:1083`, `:1268`) call `reader.region(...)`, which IS that
 * union, so the number is honest about the boundary it is used at today.
 *
 * Arming detection changes the boundary. A born-worn detector filing
 * `earring@left` / `earring@right` judges ONE SIDE, and a side is roughly half
 * the union — so the same 0.0002 would sit about 1.1x under the smallest worn
 * SIDE rather than 2x, and the provenance sentence would quietly become false
 * about the boundary it was being used at. That is the wrong-boundary class,
 * which this program has paid for five times. It dies unpublished here.
 *
 * # What this produces
 *
 * The whole court, per side, in one table: every face the original court
 * classified by eye, both halves, through the product's own `regionSides` call.
 * Then the arithmetic fable-435 asked for, each cell quoting its own n:
 *
 *   worn sides            the band, and the SMALLEST, which is what a floor
 *                         has to sit under
 *   bare, visible sides   the false-positive arm
 *   covered sides         the second false-positive arm — an earring is not
 *                         hallucinated behind hair, which is why presence-only
 *                         arming is safe on a covered face
 *
 * Costs fal calls: one axis read plus two half reads per face, ~45 calls. No
 * credits, no rows, no writes.
 *
 *   npx tsx scripts/read-earring-side-floor-disposable.mts
 */
import "dotenv/config";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { coverage } from "../server/castingV2/maskGeometry";

type Class = "wearing" | "bare, ears visible" | "ears not visible";
type Specimen = { label: string; id: string; key: string; seen: Class; prod?: boolean };

const DEV_BASE = "https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev/casting-v2/candidates";
const PROD_BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/candidates";

/* The court's whole population, verbatim from
   `read-earring-court-coverage-disposable.mts` — every face classified by eye
   off a contact sheet, never by its brief.

   ONE CORRECTION, and it is a reading rather than a re-classification: the
   sides sheet (opus-339) showed n0's two sides are not alike — her right is a
   wall of hair with no ear in it, her left is a visible temple and lobe. The
   face is left in its original column because this table judges SIDES and the
   earring answer is zero on both of them either way; the note is here so the
   next reader does not re-derive it. */
const SPECIMENS: Specimen[] = [
  { label: "p0", id: "a8303571", key: "0f3b609e-08a8-4d0c-8fed-722c26a07af3", seen: "wearing" },
  { label: "p1", id: "71ad3c7b", key: "a90deb69-7fc9-451d-adbc-b2e723827b1c", seen: "wearing" },
  { label: "p2", id: "27dbd3a4", key: "3224fda0-a7a8-46f4-ac3f-a7441c8fe62d", seen: "wearing" },
  { label: "p3", id: "40279ed9", key: "f53064bd-d913-47f7-b418-ec111d90dabe", seen: "wearing" },
  { label: "p4", id: "18767549", key: "1b22f213-643a-401f-b96d-52504880ecba", seen: "wearing" },
  { label: "p5", id: "83e10422", key: "e9451600-7821-40d5-9b45-10d677f17fe2", seen: "wearing" },
  { label: "p6", id: "8540d86f", key: "fce4b507-83a2-495f-80cd-9de7acc5641a", seen: "wearing" },
  { label: "p7", id: "86e896f1", key: "4b957e20-78da-4e33-b515-b86edc4ab7dd", seen: "wearing" },
  { label: "n3", id: "3d30406d", key: "1c535fb0-ca6b-4752-99cc-caf93b101120", seen: "bare, ears visible" },
  { label: "q1", id: "6683309a", key: "43f1130e-9348-4eeb-b6f0-24417b9153ae", seen: "bare, ears visible", prod: true },
  { label: "q3", id: "f9e9cb81", key: "5b9a6e1b-667c-4f03-abf9-c3eea4f249c5", seen: "bare, ears visible", prod: true },
  { label: "q9", id: "828c2102", key: "c66f10ab-8b60-4c27-bc51-d66f159d4239", seen: "bare, ears visible", prod: true },
  { label: "n0", id: "43ac4560", key: "ace45d10-e467-485b-be83-37384d820e78", seen: "ears not visible" },
  { label: "n2", id: "4eb7f921", key: "19b5eae9-1529-4c6d-9510-00ead34f95e0", seen: "ears not visible" },
  { label: "n7", id: "7cf4f801", key: "b80308d5-4d6b-45f0-996d-ba158690643f", seen: "ears not visible" },
];

const REGION = "earring";
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });

type Row = { specimen: Specimen; left: number | null; right: number | null; note: string };
const rows: Row[] = [];

for (const specimen of SPECIMENS) {
  const response = await fetch(`${specimen.prod ? PROD_BASE : DEV_BASE}/${specimen.key}.png`);
  if (!response.ok) {
    rows.push({ specimen, left: null, right: null, note: `image HTTP ${response.status}` });
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  try {
    const sides = await reader.regionSides!({ image: bytes, name: REGION, absentIsAnswer: true });
    if (sides === null) {
      rows.push({ specimen, left: null, right: null, note: "reader gave no sides for this name" });
      continue;
    }
    rows.push({ specimen, left: coverage(sides.left) * 100, right: coverage(sides.right) * 100, note: "" });
  } catch (error) {
    /* A read that FAILED is not a reading of zero — the court's own third-column
       discipline, kept. It is excluded from every band below. */
    rows.push({ specimen, left: null, right: null, note: error instanceof Error ? error.message : String(error) });
  }
}

console.log(`asked "${REGION}" PER SIDE   n = ${SPECIMENS.length} faces\n`);
console.log("face".padEnd(12) + "looked like".padEnd(22) + "her left".padEnd(12) + "her right");
console.log("-".repeat(62));
for (const row of rows) {
  const cell = (value: number | null) => (value === null ? "—" : `${value.toFixed(4)}%`);
  console.log(
    `${row.specimen.label} ${row.specimen.id}`.padEnd(12)
    + row.specimen.seen.padEnd(22)
    + cell(row.left).padEnd(12)
    + cell(row.right)
    + (row.note ? `   ${row.note}` : ""),
  );
}

const sidesOf = (seen: Class) => rows
  .filter((row) => row.specimen.seen === seen && row.left !== null)
  .flatMap((row) => [row.left!, row.right!]);

const worn = sidesOf("wearing");
const bare = sidesOf("bare, ears visible");
const covered = sidesOf("ears not visible");

console.log("\nEVERY CELL WITH ITS OWN n (fable-435 condition 2)");
console.log(`worn sides            n=${worn.length}   ${worn.length ? `${Math.min(...worn).toFixed(4)}% – ${Math.max(...worn).toFixed(4)}%` : "none"}`);
console.log(`bare, visible sides   n=${bare.length}   ${bare.length ? `${Math.min(...bare).toFixed(4)}% – ${Math.max(...bare).toFixed(4)}%` : "none"}`);
console.log(`covered sides         n=${covered.length}   ${covered.length ? `${Math.min(...covered).toFixed(4)}% – ${Math.max(...covered).toFixed(4)}%` : "none"}`);

const zeroes = [...bare, ...covered].filter((value) => value === 0).length;
console.log(
  `\nTHE FALSE-POSITIVE ARM (condition 3): ${zeroes} of ${bare.length + covered.length} non-wearing sides read`
  + ` EXACTLY zero — ${bare.length} visibly bare and ${covered.length} behind hair. An earring is not`
  + " hallucinated on a bare lobe and not hallucinated behind hair either, which is why arming PRESENCE"
  + " is safe on a covered face.",
);

if (worn.length > 0) {
  const smallest = Math.min(...worn);
  /* HALF THE SMALLEST WORN SIDE — the same 2x margin the whole-frame floor was
     written with, re-derived at this boundary rather than inherited across it. */
  const floor = smallest / 2 / 100;
  console.log(
    `\nTHE PER-SIDE FLOOR: smallest worn side ${smallest.toFixed(4)}% → floor ${floor.toFixed(6)}`
    + ` (${(floor * 100).toFixed(4)}% of frame), 2x under it.`,
  );
  const shipped = 0.02;
  const missed = worn.filter((value) => value <= shipped);
  console.log(
    `\nAND THE SHIPPED FLOOR AT THIS BOUNDARY: 0.0002 (${shipped.toFixed(4)}% of frame) sits at`
    + ` ${(smallest / shipped).toFixed(3)}x the smallest worn side — ${smallest < shipped ? "ABOVE it, not under it" : "under it"}.`,
  );
  console.log(
    missed.length === 0
      ? "  Every worn side still clears it, but the 2x margin its provenance claims belongs to the"
      + " whole-frame union and is not the margin at this boundary."
      : `  ${missed.length} of ${worn.length} worn sides read AT OR UNDER it`
        + ` (${missed.map((value) => `${value.toFixed(4)}%`).join(", ")}), so arming detection at the`
        + " per-side boundary with the shipped number would file a worn earring as absent. The floor"
        + " has to come down, not merely be re-labelled.",
  );
}

process.exit(0);
