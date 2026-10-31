/**
 * EVERY READER THAT ASKS FAL WHERE A FACE IS SAYS WHERE THE HEAD IS (#2888).
 *
 * The behaviour arms are `faceSpanOnTheHead.test.ts`'s — that the box refuses a
 * face read landing on a tattooed arm, asks the head alone, and reads on
 * without a face only when the head answers nothing either. This suite asks the
 * other half of the question, which no behaviour arm can: **is every reader
 * actually told?**
 *
 * #2887 built the box and wired it into the SCAN only. The four left behind
 * were named in that PR rather than shipped silently, and they are the ones a
 * customer PAYS on — the refine's region reads, the take's, the ink mint's
 * sided read and the ink upload's cut. On the founder's round-10 and round-11
 * casts the segmenter's `face` answered a face tattooed on the cast's arm, and
 * a paid edit of an eye, a brow or an ear cuts its territory from that span.
 *
 * ⚠ **The population is DERIVED, never a list here**, which is the whole point:
 * the four were left behind by one PR naming three files, so a fifth factory
 * added next month must not be able to ship unnoticed. The walk reads the real
 * `server/` tree through the sanctioned reader, strips comments, and finds every
 * call of the factory by balancing its own parentheses — so a call written
 * across six lines is read exactly like a one-liner.
 *
 * Its own blindness is the thing to guard, so the reader is driven over
 * fixtures in both directions (a call with the option and one without) and the
 * tree arm carries a floor: the five production factories are named, and a walk
 * that found fewer than five calls reddens rather than passing vacuously.
 */
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { repoPath, sourcesUnder } from "../testing/sourceTree";
import { codeOnly } from "../testing/withoutComments";

/* This suite reads the whole `server/` tree, so it declares the class's clock
   rather than running inside vitest's 5s default — `contendedTestTimeouts`
   derives its population from the walk and reddens without this line. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const FACTORY = "createFalRegionReader(";

/**
 * Every CALL of the factory in `source`, as its own text — the declaration
 * excluded, because its option object naturally mentions `headBox` and would
 * pass this guard while saying nothing about any caller.
 *
 * Parentheses are balanced rather than matched to the end of a line: three of
 * the five production calls are now multi-line, and a line-based reader would
 * have read each as a call with no options at all.
 */
export function regionReaderCalls(source: string): string[] {
  const code = codeOnly(source);
  const calls: string[] = [];
  for (let at = code.indexOf(FACTORY); at !== -1; at = code.indexOf(FACTORY, at + 1)) {
    if (/\bfunction\s+$/.test(code.slice(Math.max(0, at - 20), at))) continue;
    let depth = 0;
    let end = at + FACTORY.length - 1;
    for (; end < code.length; end += 1) {
      if (code[end] === "(") depth += 1;
      else if (code[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(code.slice(at, end + 1));
  }
  return calls;
}

/** The modules that build a real reader today. A FLOOR for the walk, not the
 *  subject: the assertion below is about every call it finds, named or not. */
const KNOWN_FACTORIES = [
  "castingV2/faceScanService.ts",
  "castingV2/inkDeliveryMint.ts",
  "castingV2/inkUploadService.ts",
  "castingV2/referenceSpotlight.ts",
  "castingV2/refineService.ts",
] as const;

/**
 * THE ONE EXEMPTION, AND IT IS NOT A PROMISE — the spotlight's reader
 * (`referenceSpotlight.ts`, #14 slice 3a-2).
 *
 * It is here because this guard FOUND it rather than because anybody
 * remembered it: it landed the same morning this card was taken, three commits
 * after the tree the card was written against, and no grep of a stale checkout
 * could have named it.
 *
 * It is exempt for two reasons that both have to hold:
 *
 * 1. **The box would be INERT.** The spotlight asks its reader for `pointer`
 *    and nothing else — the detector's rectangles round a noun — and that road
 *    never reads the segmenter's face span (`boxesFor`, which `judgedFace` is
 *    not on). Passing the option would read as coverage while changing nothing,
 *    which is worse than not passing it.
 * 2. **And the top half would be the WRONG box for it anyway.** Every other
 *    reader reads a picture this product RENDERED of a cast, where the head is
 *    measurably in the top half on all 86 readings production has kept. The
 *    spotlight reads a photograph the CUSTOMER attached — a hanger shot, a
 *    product shot, somebody seated — where a face can be anywhere. So a face
 *    read on this road wants its own answer, measured, not this one borrowed.
 *
 * ⚠ **Reason 1 is CHECKED below rather than stated**: the arm reddens if that
 * module ever names any reader member but `pointer`, at which point the
 * exemption has to be decided again instead of inherited.
 */
const EXEMPT = {
  file: "castingV2/referenceSpotlight.ts",
  /* Every member of `RegionReader` (`maskedRefine.ts`). A SUBSTRING test on
     purpose, so `regionSides` and `regionInBox` are caught by `region` too and
     a member added to the type cannot slip past a word boundary. */
  members: [
    "region", "regionSides", "subject", "pointer", "regionInBox",
    "sideByDetector", "sideByCrop", "landmark",
  ],
  allowed: "pointer",
} as const;

describe("the reader of the call sites", () => {
  it("finds a call written on one line and a call written over several", () => {
    const calls = regionReaderCalls(
      'const a = createFalRegionReader({ apiKey, headBox: "topHalfOfEachPicture" });\n'
      + "const b = createFalRegionReader({\n  apiKey,\n  boxer,\n  headBox: HEAD,\n});\n",
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("headBox");
    expect(calls[1]).toContain("headBox");
    expect(calls[1]).toContain("boxer");
  });

  it("POSITIVE CONTROL: it reports a call that passes no head box", () => {
    const calls = regionReaderCalls("return apiKey ? createFalRegionReader({ apiKey }) : refusing;");
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("headBox");
  });

  it("NEGATIVE CONTROLS: the declaration, the import and a mention in prose are not calls", () => {
    expect(regionReaderCalls("export function createFalRegionReader(input: { headBox?: string }) {}")).toEqual([]);
    expect(regionReaderCalls('import { createFalRegionReader } from "./falRegionReader";')).toEqual([]);
    expect(regionReaderCalls("/* createFalRegionReader({ apiKey }) in a comment */")).toEqual([]);
  });
});

describe("every production reader is told where the head is", () => {
  it("no call of `createFalRegionReader` under `server/` omits `headBox`", () => {
    const sources = sourcesUnder(repoPath("server"), { tests: "exclude" });
    const found: Array<{ file: string; call: string }> = [];
    for (const source of sources) {
      for (const call of regionReaderCalls(source.source)) {
        found.push({ file: source.relative, call: call.replace(/\s+/g, " ") });
      }
    }

    /* The floor: a walk that read nothing looks exactly like a repository
       where every call is correct. */
    expect(found.length, "the walk found the factory's call sites at all").toBeGreaterThanOrEqual(5);
    for (const name of KNOWN_FACTORIES) {
      expect(found.map((one) => one.file), `${name} builds a reader`).toContain(name);
    }

    const bare = found
      .filter((one) => !one.call.includes("headBox"))
      .filter((one) => one.file !== EXEMPT.file);
    expect(
      bare,
      "a reader with no head box believes the segmenter's face read even when it lands on a tattoo (#2888)"
      + " — say `headBox: \"topHalfOfEachPicture\"` unless the caller measured its own frame",
    ).toEqual([]);

    /* The exemption is still an exemption: the file is in the population, and
       it is the only one the filter above lets through. */
    expect(found.map((one) => one.file)).toContain(EXEMPT.file);
  });

  it("the exempt reader still asks for nothing the head box would govern", () => {
    const [source] = sourcesUnder(repoPath("server", "castingV2"), { tests: "exclude" })
      .filter((one) => `castingV2/${one.relative}` === EXEMPT.file);
    expect(source, `${EXEMPT.file} is still in the tree`).toBeDefined();
    const code = codeOnly(source!.source);
    const named = EXEMPT.members.filter((member) => code.includes(member));
    expect(
      named,
      `${EXEMPT.file} is exempt from the head box only while \`${EXEMPT.allowed}\` is all it asks of a reader`
      + " — any other member reads the segmenter's face span, so the exemption has to be decided again",
    ).toEqual([EXEMPT.allowed]);
  });
});
