/**
 * WHICH QUESTION CAN A HALF-FRAME ANSWER? — a wording bake-off, on two frames
 * whose answers are known.
 *
 * The first cut of the per-ear reader asked the sentence she typed — "gold hoop
 * earrings" — of a picture containing ONE ear, and the reader reported a miss on
 * both sides of a perfectly matching pair: *"gold hoop visible on the visible
 * ear; other side out of frame"*. It was answering about the PAIR, honestly,
 * because the noun is plural and the product's own prompt tells it a pair is the
 * subject. The crop changed what could be seen and not what was being asked.
 *
 * So the wording is measured rather than guessed, on the two specimens the walk
 * already paid for:
 *
 *   POSITIVE  shift61 step 2 — a dangly cross on one ear, a plain hoop on the
 *             other. Exactly one side must come back missing.
 *   NEGATIVE  shift61 step 1 — a matching pair of gold hoops. Neither side may.
 *
 * A wording that cannot separate those two is not a reading, however sensible it
 * looks. No credits: vision calls over frames on disk.
 *
 *   npx tsx scripts/bake-per-ear-wording-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import sharp from "sharp";

import { verifyRender } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";

const facet = facetOfSubject("statedAccessories");

/** The wordings, each a function of what she typed. */
const WORDINGS: Array<{ id: string; of: (asked: string) => string }> = [
  { id: "as-typed", of: (asked) => asked },
  {
    id: "one-ear-clause",
    of: (asked) => `${asked} — this photograph shows ONE ear; answer only about the earring in it`,
  },
  {
    id: "single-object",
    of: (asked) => `a single earring of this description, on the one ear in this photograph: ${asked}`,
  },
];

const SPECIMENS = [
  {
    id: "POSITIVE  crosses asked, one ear wearing a plain hoop",
    frame: "output/shift61-fiveask/02-delivered.png",
    asked: "dangly cross earrings",
    wants: "exactly one side missing",
    ok: (sides: Array<{ verified: boolean }>) => sides.filter((s) => !s.verified).length === 1,
  },
  {
    id: "NEGATIVE  hoops asked, a matching pair delivered",
    frame: "output/shift61-fiveask/01-delivered.png",
    asked: "gold hoop earrings",
    wants: "neither side missing",
    ok: (sides: Array<{ verified: boolean }>) => sides.every((s) => s.verified),
  },
] as const;

for (const wording of WORDINGS) {
  console.log(`\n${"=".repeat(90)}\nWORDING  ${wording.id}`);
  let verdicts: boolean[] = [];
  for (const specimen of SPECIMENS) {
    const bytes = readFileSync(specimen.frame);
    const width = (await sharp(bytes).metadata()).width ?? 1024;
    const midline = Math.round(width / 2);
    const height = (await sharp(bytes).metadata()).height ?? 1536;
    const sides = await Promise.all(([
      { side: "left", left: 0, width: midline },
      { side: "right", left: midline, width: width - midline },
    ] as const).map(async (half) => {
      const halfBytes = await sharp(bytes)
        .extract({ left: half.left, top: 0, width: half.width, height })
        .png().toBuffer();
      const verdict = await verifyRender({
        bytes: halfBytes,
        contentType: "image/png",
        facts: [{ facet, asked: wording.of(specimen.asked), binding: true }],
      });
      const check = verdict.checks[0];
      return {
        side: half.side,
        verified: check?.verified === true,
        absent: typeof check?.absent === "boolean" ? check.absent : null,
        read: check?.read === true,
        saw: check?.saw ?? "(nothing named)",
      };
    }));
    const passed = specimen.ok(sides);
    verdicts.push(passed);
    console.log(`  ${passed ? "OK  " : "FAIL"}  ${specimen.id} — wants ${specimen.wants}`);
    for (const side of sides) {
      console.log(`         ${side.side}: ${side.verified ? "PRESENT" : "missing"}`
        + `${side.absent === true ? "+absent" : side.absent === false ? "+degree" : ""}`
        + `${side.read ? "" : " (NO READ)"} — "${side.saw}"`);
    }
  }
  console.log(`  → ${verdicts.every(Boolean) ? "SEPARATES the two specimens" : "cannot be used"}`);
}

process.exit(0);
