/**
 * #246 — THE PRODUCTION CALL-SITE CENSUS for the region reader's `absentIsAnswer`.
 *
 * The card's own first proposed item, untaken for two shifts: *"Enumerate the
 * production call sites that ask with `absentIsAnswer: true` and ask, per site,
 * whether a lookalike could be in frame."* Two sittings have now measured the
 * substitution in a lab (`tusks`, `hair`, `eyebrows`); nobody has asked which
 * of the product's LIVE doors it reaches. A repair chosen without that is a
 * repair aimed at a fixture.
 *
 * DERIVED, NEVER MIRRORED (working law 4): the population is scanned out of
 * `server/**` and re-derived on every run, so a site that moves cannot leave a
 * stale hand-typed row behind.
 *
 * ⚠ IT IS ANCHORED ON THE CALL, NOT ON THE FLAG, AND THAT IS THE WHOLE POINT.
 * The first shape of this census matched `absentIsAnswer:\s*true` and looked
 * back six lines for a `.region(`. It reported 24 sites in 8 modules and put
 * TWO MODULES THAT GENUINELY CALL THE READER into its "prose only" bucket:
 *   - `carriedGeometry.ts` builds the argument as an OBJECT and calls
 *     `.region(ask)` ten lines below the flag;
 *   - `maskedRefine.ts` takes `absentIsAnswer` as a PARAMETER and forwards it
 *     shorthand, so the literal `true` never appears at the call at all.
 * That is this repo's named collector failure — a regex standing in for
 * something the code already states — arriving in the instrument built to
 * survey it. So the scan now walks every `.region(`/`.regionSides(` call and
 * classifies what it is HANDED, and every textual `absentIsAnswer` in
 * production must be accounted for by the end or the run refuses.
 *
 * Declared limit: it does not resolve a `name:` that is a variable to the word
 * it holds — that is a per-site read, and the read is the deliverable here.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* NOT a quoted pathspec: execSync's shell on Windows is cmd.exe, which passes
   the quotes through to git and yields an EMPTY list — which the first shape of
   this census would have reported as "no production call sites" had it not been
   built to refuse. Ask git for the directory and filter here. */
const files = execSync("git ls-files server", { encoding: "utf8" })
  .split("\n").map((s) => s.trim()).filter((f) => f.endsWith(".ts"));

const production = files.filter((f) => !f.endsWith(".test.ts"));
const excludedTests = files.length - production.length;

type Disposition = "absent-is-answer" | "absent-throws" | "forwarded";
type Site = { file: string; line: number; word: string; disposition: Disposition };

const sites: Site[] = [];
let textualMentions = 0;
let accountedMentions = 0;
const unaccounted: string[] = [];

/* Prose is REMOVED rather than pattern-guessed. This repo's docblocks carry
   unprefixed continuation lines, so "starts with a star" misfiled seven of them
   as unaccounted code on the first run. Blanking comment interiors in place
   keeps every line number true. */
const withoutComments = (text: string): string => {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\r\n]/g, " "));
  out = out.replace(/(^|[^:])\/\/[^\r\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  return out;
};

/* The reader's own module DECLARES `absentIsAnswer`; it is the thing being
   surveyed, never a caller of itself. Named, not silently skipped. */
const READER_MODULE = "server/castingV2/falRegionReader.ts";

for (const file of production) {
  if (file === READER_MODULE) continue;
  const text = withoutComments(readFileSync(file, "utf8"));
  if (!text.includes("absentIsAnswer")) continue;
  const lines = text.split(/\r?\n/);
  const mentionLines = new Set<number>();
  lines.forEach((l, i) => { if (l.includes("absentIsAnswer")) mentionLines.add(i); });
  textualMentions += mentionLines.size;

  for (let i = 0; i < lines.length; i++) {
    if (!/\.region(Sides)?\s*(\?\.)?\s*\(/.test(lines[i]!)) continue;

    /* The argument may be an inline literal ON this line and the next few, or
       an object built ABOVE and passed by name. Both windows are read, and the
       object-above window is bounded by the nearest `const <id> = {`. */
    const forward = lines.slice(i, Math.min(lines.length, i + 12));
    const inlineArg = forward.join("\n");
    const byName = /\.region(?:Sides)?\s*(?:\?\.)?\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(lines[i]!);
    let scope = inlineArg;
    let scopeStart = i;
    if (byName) {
      const decl = new RegExp(`(?:const|let)\\s+${byName[1]}\\s*[:=]`);
      for (let j = i; j >= Math.max(0, i - 40); j--) {
        if (decl.test(lines[j]!)) { scope = lines.slice(j, i + 1).join("\n"); scopeStart = j; break; }
      }
    }

    if (!/absentIsAnswer/.test(scope)) continue;

    const disposition: Disposition =
      /absentIsAnswer:\s*true/.test(scope) ? "absent-is-answer"
      : /absentIsAnswer:\s*false/.test(scope) ? "absent-throws"
      : "forwarded";

    const nameMatch = /name:\s*([^,}\n]+)/.exec(scope);
    /* Shorthand `{ image, name, absentIsAnswer }` names a binding, not a literal. */
    const shorthand = !nameMatch && /\bname\b\s*[,}]/.test(scope);

    sites.push({
      file,
      line: i + 1,
      word: nameMatch ? nameMatch[1]!.trim() : shorthand ? "<caller's `name`>" : "<unresolved>",
      disposition,
    });

    for (let j = scopeStart; j < Math.min(lines.length, i + 12); j++) {
      if (mentionLines.has(j)) { mentionLines.delete(j); accountedMentions++; }
    }
  }

  /* Whatever is left is a type declaration, a docblock, or a call this scan
     cannot see. Prose and types are expected; anything else is reported. */
  /* Comments are already blanked, so what is left is code. A type or parameter
     DECLARATION is expected (it defines the door rather than walking through
     it); anything else is a call this scan cannot see, and it refuses. */
  for (const j of mentionLines) {
    const line = lines[j]!.trim();
    const isDeclaration =
      /absentIsAnswer\??\s*:\s*boolean/.test(line)
      || /absentIsAnswer\s*=\s*(true|false)/.test(line)
      || /\$\{absentIsAnswer\}/.test(line);
    if (isDeclaration) accountedMentions++;
    else unaccounted.push(`${file}:${j + 1}  ${line}`);
  }
}

if (sites.length === 0) throw new Error("census found no production call sites — the scan is broken, not the product");
if (unaccounted.length > 0) {
  console.error("UNACCOUNTED `absentIsAnswer` mentions — the scan cannot see these:");
  for (const u of unaccounted) console.error(`  ${u}`);
  throw new Error(`${unaccounted.length} mention(s) neither parsed as a call nor recognised as prose/type`);
}

const asking = sites.filter((s) => s.disposition !== "absent-throws");
const byFile = new Map<string, Site[]>();
for (const s of asking) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s]);

/**
 * THE JUDGEMENT, BOUND TO THE DERIVED POPULATION.
 *
 * Keyed by MODULE with an asserted site COUNT rather than by `file:line`: a
 * line number drifts on the next edit and a stale row would read as a current
 * verdict, which is the failure this census exists to avoid. A module gaining a
 * site, losing one, or arriving new refuses the run — so a new `absentIsAnswer`
 * caller cannot land without somebody answering the card's question about it.
 *
 * `exposure` is the answer to #246's actual question — *could a lookalike be in
 * frame, and what does the product DO with the answer* — read at each site on
 * 2026-08-30. `floor` is the vulnerability condition: the substitution was
 * measured OUTSCORING the real feature (absent `eyebrows` 6,714 px against real
 * brows 3,878), so a floor derived from PRESENT readings cannot exclude it, and
 * a floor of zero does not try.
 */
const DISPOSITIONS: Record<string, {
  sites: number; live: string; floor: string; exposure: string; verdict: "REACHED" | "FAILS-SAFE" | "NARROW";
}> = {
  "server/castingV2/faceScan.ts": {
    sites: 4,
    live: "CASTING_FACE_SCAN_SCOPE = all — EVERY ACCOUNT",
    floor: "ZERO for every anatomical word. `detectionFloorFor` returns 0 for any question the born-worn catalogue does not name, and says so: \"any pixels at all are the region answering, which is what the scan has always done\"",
    exposure: "The face panel's boxes. Two of the three words measured substituting (`hair`, `eyebrows`) ARE panel words. A box is drawn over the substrate, and `FaceRegions`' own `onAsk(instruction, scope?)` makes it a tap target for a PAID edit — 'same pipeline, same price'. So a customer can be shown, and charged for, an edit to a feature their cast does not have",
    verdict: "REACHED",
  },
  "server/castingV2/refineService.ts": {
    sites: 6,
    live: "CASTING_V2_SCOPE = all; CASTING_REPAINT_SCOPE = all",
    floor: "`departureFloorFor` — measured for glasses and earrings, ZERO for everything else",
    exposure: "The departure gate (`:8611`) decides the REFUND: a substituted mask means `covered > floor`, so a render that correctly removed the thing is called a failure and the customer loses the edit they paid for and received. The library mint (`:9287`/`:9301`) files a crop of the lookalike, which is then CARRIED into every later edit. `:3119` decides `presentInBase`; `:4810` (glasses, measured floor) fails toward a FREE re-ask; `:8342` crops for a caption",
    verdict: "REACHED",
  },
  "server/castingV2/carriedGeometry.ts": {
    sites: 2,
    live: "ungated — the render re-reads every carried feature on the frame it delivers",
    floor: "NONE. `boundsOf(mask) === null` is the only 'empty'; any non-empty mask becomes a box",
    exposure: "This module IS the repair for the founder's own floating-rectangle complaint (a 'Right horn' box over background). A carried feature genuinely absent from the delivered frame reads as its lookalike, and the box is filed over the wrong pixels — reproducing the reported defect with fresh geometry that looks trustworthy",
    verdict: "REACHED",
  },
  "server/castingV2/invisibleRemoval.ts": {
    sites: 2,
    live: "reached from the refine road",
    floor: "`binaryCoverage(anatomy) > 0` — a zero floor on a presence question",
    exposure: "Asks whether the anatomy is visible in the delivered frame. A substitution returns `visible: true`, and the hair-occlusion explanation the module exists to give is skipped — the customer is told her removal is visible when it is not",
    verdict: "REACHED",
  },
  "server/castingV2/inkDeliveryMint.ts": {
    sites: 2,
    live: "CASTING_INK_WORDS_SCOPE = all (neck and upper arm)",
    floor: "no coverage floor; the mask is checked for the frame's SPACE, not for plausibility",
    exposure: "Mints the delivered tattoo crop that documents the design for every later edit. A substituted mask mints the wrong pixels as her tattoo, durably",
    verdict: "REACHED",
  },
  "server/castingV2/bornWornDetector.ts": {
    sites: 1,
    live: "reached by the panel scan; only ARMED classes are asked (glasses, earrings)",
    floor: "measured per class, three orders of magnitude below the smallest worn reading",
    exposure: "UNMEASURED against substitution. Its floors are derived from WORN readings, which is the direction the substitution defeats — but whether `glasses` on a bare face answers with the eye region has never been asked. A named gap, not a clean site",
    verdict: "NARROW",
  },
  "server/castingV2/framingTrimStep.ts": {
    sites: 2,
    live: "CASTING_FRAMING_TRIM_SCOPE = users:1 (his account)",
    floor: "no floor; the boxes are handed to the trim planner",
    exposure: "`face`/`head` on a portrait, where the feature is genuinely present — the substitution's population is ABSENCE, so an ordinary cast is not exposed. A subject with no face (a creature, a helmet) would be, and the mission is casting creatures",
    verdict: "NARROW",
  },
  "server/castingV2/inkReferenceCutter.ts": {
    sites: 5,
    live: "CASTING_INK_CUT_SCOPE / CASTING_INK_REGION_CROP_SCOPE = users:1 (his account)",
    floor: "the licence is `pixels > 0` by design and may never carry a percentage floor",
    exposure: "Both safety reads fail the SAFE way: a substituted `human skin` says a person IS present, which routes to CUTTING rather than to riding her photograph whole; a substituted `face` over-excludes. The dangerous direction here is the false NEGATIVE, which is already the documented padded-licence finding",
    verdict: "FAILS-SAFE",
  },
  "server/castingV2/hairReferenceCutter.ts": {
    sites: 2,
    live: "CASTING_HAIR_REFERENCE_SCOPE = users:1 (his account)",
    floor: "a scale floor below, applied to the answer",
    exposure: "Asked of a picture the customer ATTACHED because it has hair in it, so the absence population is thin. A hairless reference would cut the lookalike instead of refusing",
    verdict: "NARROW",
  },
  "server/castingV2/maskedRefine.ts": {
    sites: 2,
    live: "the paste road's shared reader",
    floor: "the caller's",
    exposure: "`absentIsAnswer` is a PARAMETER here (default false), so this module neither creates nor closes the exposure — it forwards its callers'. Listed because it is a call site and a census that hides a forwarder is a census with a hole",
    verdict: "NARROW",
  },
};

const missing = [...byFile.keys()].filter((f) => !(f in DISPOSITIONS));
const stale = Object.keys(DISPOSITIONS).filter((f) => !byFile.has(f));
const miscounted = [...byFile.entries()]
  .filter(([f, ss]) => DISPOSITIONS[f] && DISPOSITIONS[f]!.sites !== ss.length)
  .map(([f, ss]) => `${f}: judged ${DISPOSITIONS[f]!.sites} sites, scan found ${ss.length}`);
if (missing.length || stale.length || miscounted.length) {
  for (const m of missing) console.error(`UNJUDGED MODULE: ${m} — a new absentIsAnswer caller with no answer to #246's question`);
  for (const s of stale) console.error(`STALE JUDGEMENT: ${s} — no longer calls the reader`);
  for (const m of miscounted) console.error(`SITE COUNT MOVED: ${m}`);
  throw new Error("the judgement no longer matches the derived population");
}

console.log(`# \`absentIsAnswer\` — production call-site census (#246)\n`);
console.log(`${files.length} tracked server files · ${excludedTests} test files excluded · ${production.length} production files`);
console.log(`${textualMentions} textual mentions, ${accountedMentions} accounted for, 0 unaccounted`);
console.log(`\n**${asking.length} production call sites in ${byFile.size} modules** ask in a way that can return an absent answer.\n`);
const rank = { REACHED: 0, NARROW: 1, "FAILS-SAFE": 2 } as const;
const ordered = [...byFile.entries()].sort(
  (a, b) => rank[DISPOSITIONS[a[0]]!.verdict] - rank[DISPOSITIONS[b[0]]!.verdict] || a[0].localeCompare(b[0]),
);
const reached = ordered.filter(([f]) => DISPOSITIONS[f]!.verdict === "REACHED");
console.log(`**${reached.reduce((n, [, ss]) => n + ss.length, 0)} of them, in ${reached.length} modules, are REACHED** — live on production, with a floor the measured substitution defeats.\n`);

for (const [file, ss] of ordered) {
  const d = DISPOSITIONS[file]!;
  console.log(`### ${d.verdict} — \`${file}\` (${ss.length} site${ss.length === 1 ? "" : "s"})`);
  for (const s of ss) console.log(`- \`${file}:${s.line}\` · asked: \`${s.word}\` · ${s.disposition}`);
  console.log(`- **live:** ${d.live}`);
  console.log(`- **floor:** ${d.floor}`);
  console.log(`- **exposure:** ${d.exposure}`);
  console.log("");
}

/* Exit discipline (#249): a script ends by exiting, so a stray handle can never
   leave it resident. */
process.exit(0);
