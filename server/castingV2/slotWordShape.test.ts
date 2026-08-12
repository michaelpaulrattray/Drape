/**
 * THE WORDS DOOR, DRIVEN BOTH WAYS.
 *
 * The negative specimens are the SIX sentences the live mint actually wrote
 * into production earring rows, read off `hayabusa.proxy.rlwy.net:23768` on
 * 2026-08-12 (world declared, per standing law). The positive controls are the
 * four CLEAN sentences from the same table — because a guard whose positive
 * control cannot pass is a guard that refuses everything, and a guard whose
 * negative control cannot fail is not a guard at all (working law 2).
 *
 * "Each hoop" is deliberately in the positive set. A blanket pair-claim ban
 * would refuse the four rows this whole change exists to produce.
 */
import { describe, expect, it } from "vitest";

import {
  accessoryKindsNamedIn,
  accessoryKindOfSlot,
  pairClaimIn,
  slotWordsRefusal,
  tidyStackWord,
  wordCarriesTerminator,
} from "./slotWordShape";

/** Verbatim production rows #1–#4, #11/#12 and #3/#4 — every one names glasses. */
const NAMES_GLASSES = [
  "Small gold hoop earrings and dark tortoiseshell rectangular glasses.",
  "Small gold hoop earrings with a tiny dangling cross charm beneath each hoop, plus dark tortoiseshell cat-eye glasses.",
  "Small gold hoop earrings and tortoiseshell rectangular-frame glasses.",
  "Small gold hoop earrings with a dangling gold cross-shaped charm at each ear; brown tortoiseshell rectangular-framed glasses.",
  "Black rectangular-framed glasses; small thin gold wire hoop earrings visible at both earlobes.",
  "Small gold hoop earrings visible at each ear, plus black rectangular-framed glasses.",
];

/** Verbatim production rows #7/#8 and #15/#16 — the wording the fix produces. */
const CLEAN = [
  "Small gold hoop earrings with a dangling gold cross charm hanging from each hoop",
  "Small gold hoop earrings with a dangling cross charm hanging from each hoop",
  "a slim gold hoop",
  "a small thin gold wire hoop",
];

describe("accessoryKindsNamedIn", () => {
  it("names every kind in the sentence, not just the best one", () => {
    expect(accessoryKindsNamedIn("gold hoop earrings and tortoiseshell glasses").sort())
      .toEqual(["earring", "glasses"]);
  });

  it("keeps the LONGEST match, so a nose stud does not name earrings", () => {
    /* "stud" is an earring word and sits inside "nose stud". First-match over
       the word list once put a nose stud on her earlobe; the same defect here
       would refuse a nose stud's own row for naming another kind. */
    expect(accessoryKindsNamedIn("a small silver nose stud")).toEqual(["nose stud"]);
  });

  it("names nothing when the sentence is about anatomy", () => {
    expect(accessoryKindsNamedIn("Long auburn-brown hair worn down, center-parted")).toEqual([]);
  });
});

describe("accessoryKindOfSlot", () => {
  it("answers for an accessory slot, on either side", () => {
    expect(accessoryKindOfSlot("earring@left")).toBe("earring");
    expect(accessoryKindOfSlot("earring@right")).toBe("earring");
    expect(accessoryKindOfSlot("glasses")).toBe("glasses");
  });

  it("answers null for anatomy and for a key that is not a slot", () => {
    expect(accessoryKindOfSlot("hair")).toBeNull();
    expect(accessoryKindOfSlot("eye@left")).toBeNull();
    expect(accessoryKindOfSlot("hair.colour@face skin")).toBeNull();
  });
});

describe("pairClaimIn", () => {
  it("catches the phrases that cannot describe a single site", () => {
    expect(pairClaimIn("visible at both earlobes")).toBe("both earlobes");
    expect(pairClaimIn("a charm at each ear")).toBe("each ear");
    /* Whichever rule fires first, the sentence is refused — the caller only
       ever asks "is there a claim", and the phrase is for the message. */
    expect(pairClaimIn("one on each ear, a matching pair")).not.toBeNull();
    expect(pairClaimIn("one on each side")).toBe("one on each");
    expect(pairClaimIn("a matching pair of studs")).toBe("matching pair");
  });

  it("leaves 'each hoop' alone — it is about one hoop's own charms", () => {
    for (const clean of CLEAN) expect(pairClaimIn(clean)).toBeNull();
  });

  it("does not read 'each earring' as 'each ear'", () => {
    /* Anchored on a word boundary. Without it the ban would fire on a perfectly
       good sentence about one earring's own decoration. */
    expect(pairClaimIn("a charm on each earring's hoop")).toBeNull();
  });
});

describe("tidyStackWord", () => {
  it("strips the terminator the join would double", () => {
    /* `words.join(", ")` over a stack ending in a full stop produced
       "…piled into a high bun., in a bun — …" in a paid prompt AND on the
       founder's own face panel. */
    expect(tidyStackWord("tight curls piled into a high bun.")).toBe("tight curls piled into a high bun");
    expect(tidyStackWord("auburn, ")).toBe("auburn");
    expect(tidyStackWord("a slim gold hoop;")).toBe("a slim gold hoop");
  });

  it("leaves a clean clause exactly as it is", () => {
    expect(tidyStackWord("a slim gold hoop")).toBe("a slim gold hoop");
  });

  it("does not eat punctuation that is not terminal", () => {
    expect(tidyStackWord("blue-black, cool-toned, deeper at the roots"))
      .toBe("blue-black, cool-toned, deeper at the roots");
  });

  it("agrees with wordCarriesTerminator, both ways", () => {
    expect(wordCarriesTerminator("a high bun.")).toBe(true);
    expect(wordCarriesTerminator("a high bun")).toBe(false);
  });
});

describe("slotWordsRefusal — the negative specimens are production rows", () => {
  it.each(NAMES_GLASSES)("refuses an earring slot whose words name her glasses: %s", (words) => {
    const refusal = slotWordsRefusal("earring@left", [tidyStackWord(words)]);
    expect(refusal?.reason).toBe("wordsNameAnotherKind");
    expect(refusal?.detail).toContain("glasses");
  });

  it("refuses the same sentence on the RIGHT slot too", () => {
    /* Every one of these was filed identically under both instances, which is
       the instance half of the same class. */
    expect(slotWordsRefusal("earring@right", [tidyStackWord(NAMES_GLASSES[0])])?.reason)
      .toBe("wordsNameAnotherKind");
  });

  it("refuses a pair claim even when no other kind is named", () => {
    const refusal = slotWordsRefusal("earring@left", ["a slim gold hoop at each ear"]);
    expect(refusal?.reason).toBe("wordsClaimThePair");
  });

  it("refuses a stack entry that still carries its terminator", () => {
    expect(slotWordsRefusal("hair", ["tight curls piled into a high bun."])?.reason)
      .toBe("wordCarriesTerminator");
  });
});

describe("slotWordsRefusal — the positive controls are production rows too", () => {
  it.each(CLEAN)("admits the clean wording: %s", (words) => {
    expect(slotWordsRefusal("earring@left", [words])).toBeNull();
    expect(slotWordsRefusal("earring@right", [words])).toBeNull();
  });

  it("admits a glasses slot describing glasses", () => {
    /* The rule is CROSS-kind, not a ban on the word. A glasses row saying
       "glasses" is the whole point of a glasses row. */
    expect(slotWordsRefusal("glasses", ["dark tortoiseshell rectangular frames"])).toBeNull();
  });

  it("admits an anatomy stack that happens to mention an accessory", () => {
    /* Only accessory slots are scoped by kind. Her hair is allowed to be
       described as tucked behind a glasses arm; the defect was an EARRING slot
       claiming to be about her eyewear. */
    expect(slotWordsRefusal("hair", ["swept back behind her glasses arms"])).toBeNull();
  });

  it("admits an empty stack", () => {
    /* A crop with no readable words is honest — the crop is the carrier, and
       the assembler says "the same left earring, unchanged" for one. */
    expect(slotWordsRefusal("earring@left", [])).toBeNull();
  });
});

/**
 * WORDS ABOUT THE PICTURE, NOT THE PERSON.
 *
 * These specimens are verbatim from the DEV supersession dry run of 2026-08-12
 * — the fix's own first run on real frames, which produced them. They are the
 * class arriving through the fix's own front door, caught by reading the
 * receipt rather than by trusting the run.
 */
describe("slotWordsRefusal — a caption about the cutout is not a caption about her", () => {
  const ABOUT_THE_PICTURE = [
    "Cutout too dark to distinguish any earring details; no visible jewelry shape or texture discernible",
    "Cutout too dark/indistinct to discern any earring shape or detail; appears as a solid black silhouette with no visible features",
  ];

  it.each(ABOUT_THE_PICTURE)("refuses it on an accessory slot: %s", (words) => {
    expect(slotWordsRefusal("earring@left", [tidyStackWord(words)])?.reason)
      .toBe("wordsDescribeTheArtifact");
  });

  it.each(ABOUT_THE_PICTURE)("refuses it on an ANATOMY slot too: %s", (words) => {
    /* The same read produces both, so the same refusal has to cover both — a
       note about the cutout is no more true filed as her jaw. */
    expect(slotWordsRefusal("jaw", [tidyStackWord(words)])?.reason)
      .toBe("wordsDescribeTheArtifact");
  });

  it("leaves a real description that happens to mention a silhouette", () => {
    /* Narrow on purpose: a jaw IS legitimately described by its silhouette, and
       refusing that would cost a true sentence to catch a false one. */
    expect(slotWordsRefusal("jaw", ["a soft rounded silhouette, tapering to a narrow chin"]))
      .toBeNull();
  });

  it("leaves a dark-coloured thing alone — 'dark' is not 'too dark to'", () => {
    expect(slotWordsRefusal("earring@left", ["a dark oxidised silver hoop, matte"])).toBeNull();
  });
});
