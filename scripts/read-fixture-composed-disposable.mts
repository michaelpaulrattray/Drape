/**
 * THE COMPOSITE IS THE PRODUCT'S OUTPUT — read that, ten times, per round.
 *
 * The first table read the PAINTED frame as "did the painter draw freckles",
 * and one row could not be true: written15-r2 read painted 0/5 and composed
 * 4/5. Re-read at ten it is stable and larger — painted 0/10, composed 10/10 —
 * and the arithmetic says 79.2% of that frame differs between the two.
 *
 * That is the paint's own GLOBAL DRIFT. A re-render moves almost every pixel a
 * little, the reader looks at a whole face rendered slightly differently and
 * calls the skin clear, and the composite — which reverts everything outside
 * the applied mask to her master and keeps only the in-mask content — reads as
 * freckled. So the painted column was never the measure of anything; the
 * composite is what she is charged for and what she sees.
 *
 *   npx tsx scripts/read-fixture-composed-disposable.mts
 */
import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { verifyRender } from "../server/castingV2/renderVerification";

const REPEAT = 10;

/** The fact each arm is read for. Marks unless the arm says otherwise. */
const MARKS = { facet: "marks", asked: "freckles", binding: false } as const;
const HAIR = { facet: "hair.colour", asked: "copper", binding: false } as const;
const SKIN = { facet: "skinTone", asked: "a light golden tan", binding: false } as const;
const CHEEK = { facet: "cheekbones", asked: "higher, more defined cheekbones", binding: false } as const;

/** `--only hair` reads just the arms whose prefix contains it, so a new arm
    does not cost a re-read of every frame already in the record. */
const onlyFlag = process.argv.indexOf("--only");
const ONLY = onlyFlag > -1 ? String(process.argv[onlyFlag + 1]) : "";

type Fact = typeof MARKS | typeof HAIR | typeof SKIN | typeof CHEEK;
const ARMS: Array<{ name: string; prefix: string; fact?: Fact }> = [
  { name: "written (step-1 prompt, marks alone)", prefix: "freckles-written15" },
  { name: "carried-alone (step-3 clause, marks alone)", prefix: "freckles-alone" },
  { name: "carried (step-3 prompt, marks + makeup)", prefix: "freckles-carried" },
  { name: "carried-alone MINUS intensity words", prefix: "freckles-alone-nointensity" },
  { name: "carried-alone, IMPERATIVE framing", prefix: "freckles-alone-imperative" },
  { name: "carried-alone, NO caption at all", prefix: "freckles-alone-nocaption" },
  { name: "carried-alone, caption AFTER the clause", prefix: "freckles-alone-captionlast" },
  /* The sweep: is the caption's suppression a property of captions, or of
     low-amplitude surface facets? Same two arms, second facet. */
  { name: "SWEEP hair.colour, caption in the ask", prefix: "hair-caption", fact: HAIR },
  { name: "SWEEP hair.colour, NO caption", prefix: "hair-nocaption", fact: HAIR },
  { name: "SURFACE skinTone, caption in the ask", prefix: "skin-caption", fact: SKIN },
  { name: "SURFACE skinTone, NO caption", prefix: "skin-nocaption", fact: SKIN },
  { name: "SURFACE cheekbones, caption in the ask", prefix: "cheek-caption", fact: CHEEK },
  { name: "SURFACE cheekbones, NO caption", prefix: "cheek-nocaption", fact: CHEEK },
  /* The engine comparison, both transports at 848x1264 — the one size NBP
     will actually return. Same written ask, caption absent. */
  { name: "ENGINE gpt2 @848 — written ask", prefix: "freckles-w15-848" },
  { name: "ENGINE nbp  @848 — written ask", prefix: "freckles-w15-848-nbp" },
];

async function present(file: string, fact: Fact = MARKS): Promise<number> {
  const bytes = readFileSync(file);
  let yes = 0;
  for (let reading = 0; reading < REPEAT; reading += 1) {
    const verdict = await verifyRender({
      bytes, contentType: "image/png",
      facts: [{ ...fact }],
    });
    if (verdict.checks[0]?.verified) yes += 1;
  }
  return yes;
}

/*
  THE NEGATIVE CONTROL RUNS IN THE SITTING, not in somebody's memory of an
  earlier one (working law 2). Her bare master has no freckles; a reader that
  says it does has invalidated every row below it, and a sitting that cannot
  say so is not evidence. Previous sittings ran this separately and quoted the
  number — which is a claim about an instrument rather than a reading of it.
*/
const FULL = "output/marks-court/MASTER-run15.png";
const MATCHED = "output/marks-court/MASTER-run15-848.png";
for (const [label, fact, tag, master] of [
  ["freckles", MARKS, "freckles", FULL],
  ["copper hair", HAIR, "hair", FULL],
  ["a tan", SKIN, "skin", FULL],
  ["sculpted cheekbones", CHEEK, "cheek", FULL],
  /* The engine arms are painted from the 848 master, so THAT is the frame
     their control has to be — a control read off a different picture is not
     the control for this sitting. */
  ["freckles at 848x1264", MARKS, "848", MATCHED],
] as const) {
  if (ONLY && !tag.includes(ONLY) && !ONLY.includes(tag)) continue;
  const control = await present(master, fact);
  console.log(`negative control — her bare master, read for ${label}: ${control}/${REPEAT} `
    + `${control === 0 ? "(clean — the reader can say no)" : "*** THE READER IS BROKEN — DISCARD THIS SITTING ***"}`);
}
console.log();

const dirs = readdirSync("output/masked");
console.log(`COMPOSED frames, the asked fact present out of ${REPEAT} readings\n`);
for (const arm of ARMS.filter((candidate) => !ONLY || candidate.prefix.includes(ONLY))) {
  /*
    STARTSWITH, AND THE OMISSION WAS NOT COSMETIC.

    `dir.slice(prefix.length)` does not check that `dir` begins with `prefix`,
    so ANY directory whose name is the same length as this arm's and ends in
    `-rN` matched it. `freckles-alone-captionlast` and
    `freckles-alone-nointensity` are both twenty-six characters, and the whole
    captionlast arm was read into the nointensity row — four frames filed under
    an arm that never painted them. Both rows happened to be zeros, which is
    exactly how an instrument defect survives a sitting.
  */
  const rounds = dirs
    .filter((dir) => dir === arm.prefix
      || (dir.startsWith(arm.prefix) && /^-r\d+$/.test(dir.slice(arm.prefix.length))))
    .sort();
  let delivered = 0;
  const cells: string[] = [];
  for (const round of rounds) {
    const file = `output/masked/${round}/composed.png`;
    if (!existsSync(file)) continue;
    const yes = await present(file, arm.fact ?? MARKS);
    /* "Delivered" is unanimous, not a majority: the product takes one reading,
       and a frame the reader is split on is not one she can be charged for. */
    if (yes === REPEAT) delivered += 1;
    cells.push(`${round.replace(`${arm.prefix}`, "").replace("-", "") || "r1"}:${yes}`);
  }
  console.log(`${arm.name.padEnd(44)} delivered ${delivered}/${cells.length}   ${cells.join("  ")}`);
}
