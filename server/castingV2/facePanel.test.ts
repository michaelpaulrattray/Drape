/**
 * The face panel — the rows, and the four things the panel must not do.
 *
 * It must not hide a feature because nothing has happened to it yet (the
 * founder's v2 ruling: everything is editable by default). It must not draw a
 * box it never measured. It must not keep a "these match" flag beside a pair.
 * And it must not call a man's face hers, which is the defect v1 shipped and a
 * unit test caught only because the projection is pure.
 */
import { describe, expect, it } from "vitest";

import type { CastPronouns } from "./castPronouns";
import type { FeatureKind } from "./faceDiscovery";
import {
  PANEL_GROUPS,
  facePanel,
  maskFetchUrl,
  type FacePanel,
  type PanelBox,
  type PanelInkWorn,
  type PanelRow,
} from "./facePanel";
import type { NamedNotCut } from "./pointerCut";
import { catalogueSlots, slotDefinition } from "./referenceSlotCatalogue";
import type { StoredReference } from "./referenceLibrary";
import type { FeatureSlot } from "./recipeAssembler";

let nextId = 1;

function row(overrides: Partial<StoredReference> & { slot: string }): StoredReference {
  const id = nextId++;
  return {
    id,
    publicId: `pub-${id}`,
    candidateId: 7,
    variantId: 11,
    role: "carry",
    tier: "anatomy",
    noun: overrides.slot,
    words: [],
    storageKey: null,
    maskKey: null,
    digest: null,
    /*
      A BOX BY DEFAULT, because the founder's rule made one the price of
      admission (fable-414: *"everything in the right panel should have a
      bounding box"*), and an ordinary library row has one — the mint stores its
      crop's geometry beside it, and a row the library has nothing for is filled
      by the scan.

      The cases whose subject IS that rule pass `geometry: null` explicitly, so
      the membership question is asked where it is being tested and nowhere
      else.
    */
    geometry: { bbox: { x: 10, y: 20, width: 30, height: 40 }, frame: { width: 1000, height: 1500 } },
    guard: null,
    refusal: null,
    version: 1,
    retiredAt: null,
    createdAt: new Date(2026, 7, 10, 12, 0, id),
    ...overrides,
  };
}

const SHE: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };
const HE: CastPronouns = { subject: "he", object: "him", possessive: "his", plural: false };

function panel(rows: StoredReference[], pronouns: CastPronouns = SHE) {
  return facePanel({
    rows,
    pronouns,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
  });
}

function allRows(rows: StoredReference[], pronouns: CastPronouns = SHE): PanelRow[] {
  return panel(rows, pronouns).groups.flatMap((group) => group.rows);
}

/** One delivered tattoo, as the delivery-crop store hands it over. */
function worn(overrides: Partial<PanelInkWorn> = {}): PanelInkWorn {
  return {
    slot: "ink:neck",
    storageKey: "casting-v2/ink-delivery/abc.png",
    bboxX: 120,
    bboxY: 60,
    bboxW: 200,
    bboxH: 90,
    frameWidth: 1024,
    frameHeight: 1536,
    ...overrides,
  };
}

function panelWithInk(ink: PanelInkWorn[], rows: StoredReference[] = [], pronouns: CastPronouns = HE) {
  return facePanel({
    rows,
    pronouns,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    ink,
  });
}

function named(rows: StoredReference[], name: string): PanelRow | undefined {
  return allRows(rows).find((row) => row.name === name);
}

/**
 * THE FOUNDER'S OWN CORRECTION (fable-382 §1), against his own earlier ruling.
 *
 * v2 shipped the catalogue as the rows, so a face nobody had edited was sixteen
 * labelled squares with nothing in them. His words looking at it: *"i dont think
 * eyelashes really needs to be there · cheekbones or jaw or chin"*, and before
 * that *"only show the 8 rows that real pictures have"*. So a row is drawn when
 * it has a picture or something said, and never as an offer.
 */
describe("a face with nothing said about it shows nothing", () => {
  it("draws no rows at all rather than a column of empty squares", () => {
    expect(panel([]).groups).toEqual([]);
  });

  it("appears when it has a PLACE on the photograph, and not for words alone", () => {
    /*
      THE FOUNDER'S RULE (fable-414): *"nothing should ride words alone in the
      right panel — everything in the right panel should have a bounding box."*
      Words are welcome ON a row and may not BE the row: a name with nowhere to
      point is a list about her face rather than a picture of it.
    */
    const lips = named([row({ slot: "lips", words: ["a fuller lip"] })], "Lips")!;
    expect(lips.words).toEqual(["a fuller lip"]);
    expect(lips.regions).toHaveLength(1);

    /* The same sentence with nothing to point at draws no row at all. */
    expect(named([row({ slot: "lips", words: ["a fuller lip"], geometry: null })], "Lips"))
      .toBeUndefined();
  });

  it("keeps the group order it is read in, and drops a group with nothing in it", () => {
    const built = panel([
      row({ slot: "lips", words: ["a fuller lip"] }),
      row({ slot: "hair", words: ["a copper shag"] }),
    ]);
    expect(built.groups.map((group) => group.heading)).toEqual(["Face", "Hair"]);
  });

  it("opens their own sentence, lowercased, when a row is tapped", () => {
    expect(named([row({ slot: "lips", words: ["a fuller lip"] })], "Lips")!.prefill).toBe("her lips — ");
    expect(named(
      [
        row({ slot: "earring@left", tier: "item", words: ["a gold hoop"] }),
        row({ slot: "earring@right", tier: "item", words: ["a gold hoop"] }),
      ],
      "Earrings",
    )!.prefill).toBe("her earrings — ");
  });

  it("uses THIS face's pronoun WHERE IT SPEAKS — v1 called a man's eyes hers in front of him", () => {
    /*
      The labels went bare on 2026-08-14 (founder, fable-450/451), so a label
      that carries no pronoun cannot get one wrong — and a test asserting that
      would be an assertion that cannot fail. The claim moved with the pronoun:
      it is the SENTENCES the product speaks that must be his, and those are
      `spoken` and the ask box's opening words.
    */
    const rows = allRows([row({ slot: "lips", words: ["a fuller lip"] })], HE);
    expect(rows.map((panelRow) => panelRow.name)).toContain("Lips");
    expect(rows.map((panelRow) => panelRow.spoken)).toContain("his lips");
    expect(rows.map((panelRow) => panelRow.prefill)).toContain("his lips — ");
    expect(rows.some((panelRow) => `${panelRow.spoken}${panelRow.prefill}`.includes("her "))).toBe(false);
    /* And no label anywhere carries a possessive, whichever pronoun it is. */
    expect(rows.some((panelRow) => /^(Her|His|Their) /.test(panelRow.name))).toBe(false);
  });
});

/**
 * A MAINTAINED ABSENCE IS NOT DISPLAYED — the founder, in as many words
 * (fable-401: *"do not display it"*).
 *
 * When she takes her glasses off, the library files a vacancy row whose words
 * are the sentence every later RECIPE has to say — the master wears them
 * forever, so silence paints them back on. Read onto the panel, that sentence
 * became a row telling her about something that is not on her face.
 *
 * The fact keeps working and stops speaking. Both halves are asserted here,
 * because dropping the row is easy and dropping the FACT would be the
 * one-frame removal all over again — this file cannot see the recipe, so the
 * half it can hold is that the vacancy still beats what is under it.
 */
describe("a slot she has emptied says nothing on the panel", () => {
  const removed = () => [
    row({ slot: "glasses", tier: "item", noun: "glasses", version: 1,
      words: ["thin gold wire frames"], storageKey: "library/glasses.png", maskKey: "library/glasses-mask.png" }),
    row({ slot: "glasses", tier: "item", noun: "glasses", role: "vacancy", version: 2,
      words: ["no glasses — her face uncovered, no frames, no lenses and no rim shadow on her cheeks or brows"] }),
  ];

  it("draws no row for it — not a row reciting the absence", () => {
    const rows = allRows(removed());
    expect(rows.map((panelRow) => panelRow.name)).not.toContain("Glasses");
    /* And not merely renamed: nothing anywhere in the panel says it. */
    expect(JSON.stringify(rows)).not.toContain("no glasses");
  });

  it("and the vacancy still BEATS the crop underneath it", () => {
    /*
      The row is dropped by having nothing to say, never by being filtered out
      of the library — a vacancy that stopped being the newest state would let
      the retired carry beneath it surface, and the panel would show her a
      picture of the glasses she just took off. Same rows, one extra thing said
      about the slot, and the crop must still not appear.
    */
    const rows = allRows(removed());
    expect(JSON.stringify(rows)).not.toContain("library/glasses.png");
  });

  it("CONTROL — the same slot with an ordinary newest row is a row as usual", () => {
    /* The rule keys on the vacancy ROLE and on nothing wider. Without this the
       test above passes just as well against a panel that lost its glasses row
       for some other reason entirely. */
    const rows = allRows([
      row({ slot: "glasses", tier: "item", noun: "glasses", version: 1, words: ["thin gold wire frames"] }),
    ]);
    expect(rows.map((panelRow) => panelRow.name)).toContain("Glasses");
  });

  it("CONTROL — a re-add after the removal speaks again", () => {
    /* The founder's own sequence, one step further on: the newest row is an
       ordinary one again, so the row comes back with its new words. */
    const rows = allRows([
      ...removed(),
      row({ slot: "glasses", tier: "item", noun: "glasses", version: 3, words: ["round tortoiseshell frames"] }),
    ]);
    const glasses = rows.find((panelRow) => panelRow.name === "Glasses");
    expect(glasses?.words).toEqual(["round tortoiseshell frames"]);
  });
});

/**
 * WHICH SLOTS ARE ROWS AT ALL — the catalogue's answer, not this file's.
 *
 * Two different rules, and keeping them apart is the point: the catalogue says
 * whether a slot has a row (a decision about the product), and the panel says
 * whether this face has anything to put in one (a fact about a face).
 */
describe("the slots that have no row of their own", () => {
  it("keeps facial structure askable and unpictured — it is words, by his ruling", () => {
    /* The stack still fills: the ask lands, the words are carried, and the
       recipe reads them. What it does not get is a square on the panel. */
    const rows = [row({ slot: "jaw", words: ["a softer jawline"] }), row({ slot: "lips", words: ["a fuller lip"] })];
    const names = allRows(rows).map((panelRow) => panelRow.name);
    expect(names).toContain("Lips");
    expect(names).not.toContain("Jaw");
    expect(names).not.toContain("Chin");
    expect(names).not.toContain("Cheekbones");
  });

  it("reads a lash sentence on the eyes row, because the only region holding lashes is the eye", () => {
    /* The eyes row needs its own place on the photograph to be drawn at all —
       a folded sentence lands ON a row and cannot BE one. */
    const held = [
      row({ slot: "eye@left", words: [] }),
      row({ slot: "eye@right", words: [] }),
      row({ slot: "lashes@left", words: ["longer lashes"] }),
    ];
    const eyes = named(held, "Eyes")!;
    expect(eyes.words).toEqual(["longer lashes"]);
    /* The row is still about the eyes — an edit to it means the eye slots, and
       the lash ask files where it always did. */
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(allRows(held).map((r) => r.name)).not.toContain("Lashes");
  });

  it("says a folded sentence once when it was filed on both sides", () => {
    const eyes = named(
      [
        row({ slot: "eye@left", words: ["green"] }),
        row({ slot: "eye@right", words: ["green"] }),
        row({ slot: "lashes@left", words: ["longer lashes"] }),
        row({ slot: "lashes@right", words: ["longer lashes"] }),
      ],
      "Eyes",
    )!;
    expect(eyes.words).toEqual(["green", "longer lashes"]);
  });
});

describe("what the library adds to a row", () => {
  it("hangs the minted cutout and its box on the slot that minted them", () => {
    const built = named([row({
      slot: "hair",
      words: ["a blunt shoulder-length bob"],
      storageKey: "library/hair.png",
      maskKey: "library/hair-mask.png",
      geometry: { bbox: { x: 12, y: 30, width: 200, height: 140 }, frame: { width: 1024, height: 1536 } },
    })], "Hair")!;

    expect(built.words).toEqual(["a blunt shoulder-length bob"]);
    expect(built.cutouts).toEqual([{
      contentUrl: "https://bucket.example/library/hair.png",
      /* The stencil goes through the proxy: a CSS mask is a CORS fetch and the
         public bucket sends no allow-origin, so a bucket mask renders NOTHING. */
      maskUrl: "/api/image-proxy?url=https%3A%2F%2Fbucket.example%2Flibrary%2Fhair-mask.png",
      /* A minted crop IS the picture, so there is no window onto a frame — the
         scan-born rows are the ones that carry one. */
      crop: null,
    }]);
    expect(built.regions).toEqual([
      {
        box: { x: 12, y: 30, width: 200, height: 140, frame: { width: 1024, height: 1536 } },
        name: null, spoken: null, prefill: null, slot: "hair", scopable: false, whole: false,
      },
    ]);
  });

  it("REFUSES to invent a box for a row that was never measured — so the row goes", () => {
    /*
      A rectangle by proportion would be a promise that clicking those pixels
      edits that thing. The panel has always refused to invent one; what the
      founder's rule changed is the CONSEQUENCE — the row leaves rather than
      standing there unclickable.

      Her skin is the row this was written about, and it is no longer in this
      state: it is drawn from `face skin` through the catalogue's `display`
      field now. The rule is what is under test, so the case keeps a row with
      nothing to point at rather than a slot that has since acquired one.
    */
    expect(named([row({ slot: "skin", words: ["a warm tan"], geometry: null })], "Skin"))
      .toBeUndefined();
  });

  it("does not count provenance as content — 'from an edit' about nothing is not a row", () => {
    /* A library row that says only that something happened here, with no words,
       no crop and nowhere to point, tells the person nothing about their own
       face. A row with a PLACE is a different thing: the picture is the
       content, which is why the box arm below still draws. */
    expect(named([row({ slot: "lips", words: [], geometry: null })], "Lips")).toBeUndefined();
    expect(named([row({ slot: "lips", words: [] })], "Lips")).toBeDefined();
  });

  it("tells a thing she arrived with from a thing she asked for", () => {
    expect(named([row({ slot: "glasses", tier: "item", variantId: null, words: ["round wire frames"] })], "Glasses")!.from)
      .toBe("she came with it");
    expect(named([row({ slot: "hair", variantId: 11, words: ["copper"] })], "Hair")!.from)
      .toBe("from an edit");
  });

  it("reads the branch through the library's own fold — a retired newest is gone", () => {
    /* Rule 2: if the fold merely skipped retired rows, the ancestor's older
       earring would come back and the row would still say "a gold hoop". Both
       arms, because under the content rule the row VANISHES when the fold
       empties it — and a row that is absent for the wrong reason looks exactly
       like one that is absent for the right one. */
    const worn = [
      row({ slot: "earring@left", tier: "item", words: ["a gold hoop"], version: 1 }),
      row({ slot: "earring@right", tier: "item", words: ["a gold hoop"], version: 1 }),
    ];
    expect(named(worn, "Earrings")!.words).toEqual(["a gold hoop"]);

    const removed = [
      ...worn,
      row({ slot: "earring@left", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
      row({ slot: "earring@right", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
    ];
    expect(named(removed, "Earrings")).toBeUndefined();
  });
});

/**
 * HER BUILD — one row over five facets (fable-382 §3, on his own correction:
 * *"their body should just be a single thing like body type or body shape it
 * doesnt need individal pieces like hips chest etc"*).
 */
describe("the body is one row and never pieces", () => {
  it("speaks every body facet as one row, in the Body section", () => {
    const built = panel([
      row({ slot: "build", words: ["broader shoulders", "a more athletic build"] }),
    ]);
    const body = built.groups.find((group) => group.heading === "Body");
    expect(body!.rows.map((r) => r.name)).toEqual(["Build"]);
    expect(body!.rows[0]!.prefill).toBe("her build — ");
  });

  it("shows no piece row for any of the five facets", () => {
    const names = allRows([row({ slot: "build", words: ["a larger bust"] })]).map((r) => r.name);
    for (const piece of ["Bust", "Waist", "Shoulders", "Arms", "Chest", "Hips"]) {
      expect(names, piece).not.toContain(piece);
    }
  });
});

describe("a pair is one row until it isn't, and the split is derived", () => {
  const hoops = (left: string[], right: string[]) => [
    row({ slot: "earring@left", tier: "item", words: left }),
    row({ slot: "earring@right", tier: "item", words: right }),
  ];

  it("speaks a matched pair as one thing, and edits both sides", () => {
    const built = named(hoops(["a gold hoop"], ["a gold hoop"]), "Earrings")!;
    expect(built.slots).toEqual(["earring@left", "earring@right"]);
    expect(allRows(hoops(["a gold hoop"], ["a gold hoop"])).some((r) => r.name === "Left earring")).toBe(false);
  });

  /*
    RE-ANCHORED BY FOUNDER RULING (fable-452): divergence stopped changing the
    panel's SHAPE.

    It used to split into two top-level rows, so the list re-arranged itself to
    report a fact about her face. The rule underneath is unchanged and is still
    derived from the words every time — what moved is where it is SAID: one row,
    two children, and the parent's words attributed side by side.
  */
  it("says which side is which the moment one is edited, with no flag to set", () => {
    const rows = allRows(hoops(["a gold hoop", "noticeably bigger"], ["a gold hoop"]));
    const earrings = rows.find((r) => r.name === "Earrings")!;

    /* Still ONE row, and tapping it still means both. */
    expect(rows.map((r) => r.name)).not.toContain("Left earring");
    expect(earrings.slots).toEqual(["earring@left", "earring@right"]);
    /*
      And it claims nothing of either side: each side's own words, attributed —
      COMPOSED into one sentence, and each side compressed to what tells it
      apart (fable-475 §2). The left earring's full stack ("a gold hoop",
      "noticeably bigger") lives on the child row that opens beneath.
    */
    expect(earrings.words).toEqual(["left a gold hoop · right a gold hoop"]);
    /* The children are the per-instance records that already existed. */
    expect(earrings.instances.map((instance) => [instance.name, instance.words])).toEqual([
      ["Left earring", ["a gold hoop", "noticeably bigger"]],
      ["Right earring", ["a gold hoop"]],
    ]);
    /* Each carries the scope its tap sends — the same wire the rectangle over
       that earring sends (fable-444 ruling C). */
    expect(earrings.instances.map((instance) => instance.slot)).toEqual(["earring@left", "earring@right"]);
  });

  it("opens a MATCHED pair too — the children are the row's sides, not its disagreement", () => {
    /* The children exist whether or not the sides agree: a pair is a pair, and
       she can ask about one eye of two identical ones. Make the instances
       conditional on divergence and this goes red. */
    const built = named(hoops(["a gold hoop"], ["a gold hoop"]), "Earrings")!;

    expect(built.instances.map((instance) => instance.name)).toEqual(["Left earring", "Right earring"]);
    /* And the parent still speaks in her own words, not attributed ones. */
    expect(built.words).toEqual(["a gold hoop"]);
  });

  it("CONTROL — a row there is only one of has nothing to open", () => {
    const nose = named([row({ slot: "nose", words: ["a little straighter"] })], "Nose")!;
    expect(nose.instances).toEqual([]);
  });

  it("merges again when they match again, because there was never a flag to clear", () => {
    const rows = allRows(hoops(["a gold hoop", "noticeably bigger"], ["a gold hoop", "noticeably bigger"]));
    expect(rows.map((r) => r.name)).toContain("Earrings");
    expect(rows.some((r) => r.name.includes("left"))).toBe(false);
  });

  it("says the plural the way the catalogue writes it, never by adding an s", () => {
    const names = allRows([
      row({ slot: "eye@left", words: ["green"] }),
      row({ slot: "eye@right", words: ["green"] }),
      row({ slot: "ear@left", words: ["a little more tucked"] }),
      row({ slot: "ear@right", words: ["a little more tucked"] }),
    ]).map((r) => r.name);
    expect(names).toContain("Eyes");
    expect(names).toContain("Ears");
    expect(names).not.toContain("Eyess");
  });
});

/**
 * WHAT A SCAN ADDS, AND WHAT IT MUST NOT TAKE OVER.
 *
 * A scan is what the picture already contains; the library is what an edit
 * made. The founder's own two provenances ("she came with it" / "from an edit")
 * are the whole of the distinction, and the failure to avoid is a scan of
 * today's frame quietly replacing the crop a paid render minted.
 */
describe("what a scan adds to a row", () => {
  const frame = { width: 1000, height: 1500 };
  const scanOf = (slots: Record<string, { x: number; y: number; width: number; height: number }>) => ({
    frameUrl: "https://bucket.example/casting/master.jpg",
    slots: new Map(
      Object.entries(slots).map(([slot, box]) => [slot, {
        box: { ...box, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }]),
    ),
  });

  const scanned = (rows: StoredReference[], slots: Parameters<typeof scanOf>[0]) => facePanel({
    rows,
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: scanOf(slots),
  }).groups.flatMap((group) => group.rows);

  it("fills a row the library has never held with a window on the frame", () => {
    const nose = scanned([], { nose: { x: 400, y: 600, width: 120, height: 160 } })
      .find((row) => row.name === "Nose")!;

    /* The picture is the frame the viewer already has — no object was written
       to show this, which is the whole of ruling 4a. */
    expect(nose.cutouts).toEqual([{
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,nose",
      crop: { x: 400, y: 600, width: 120, height: 160, frame },
    }]);
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null, spoken: null, prefill: null, slot: "nose", scopable: false, whole: false }]);
  });

  it("leaves the MINTED cutout in place where an edit made one", () => {
    const rows = [row({
      slot: "hair",
      words: ["a copper shag"],
      storageKey: "library/hair.png",
      maskKey: "library/hair-mask.png",
      geometry: { bbox: { x: 12, y: 30, width: 200, height: 140 }, frame },
    })];
    const hair = scanned(rows, { hair: { x: 900, y: 900, width: 50, height: 50 } })
      .find((panelRow) => panelRow.name === "Hair")!;

    /*
      The library wins where it has minted. A scan of today's frame replacing
      the crop a paid render cut would make "from an edit" a lie on a row that
      is showing a picture of something else.
    */
    expect(hair.cutouts[0]!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.cutouts[0]!.crop).toBeNull();
    expect(hair.regions).toEqual([{ box: { x: 12, y: 30, width: 200, height: 140, frame }, name: null, spoken: null, prefill: null, slot: "hair", scopable: false, whole: false }]);
  });

  it("gives a measured row its click target even when the crop came from an edit", () => {
    /* A crop minted on an ancestor version, with no geometry recorded — the row
       keeps its cutout AND gains a box, rather than the panel choosing one. */
    const rows = [row({
      slot: "hair",
      words: ["a copper shag"],
      storageKey: "library/hair.png",
      maskKey: "library/hair-mask.png",
      geometry: null,
    })];
    const hair = scanned(rows, { hair: { x: 900, y: 900, width: 50, height: 50 } })
      .find((panelRow) => panelRow.name === "Hair")!;

    expect(hair.cutouts[0]!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.regions).toEqual([{ box: { x: 900, y: 900, width: 50, height: 50, frame }, name: null, spoken: null, prefill: null, slot: "hair", scopable: false, whole: false }]);
  });

  it("still refuses to invent a box for a region the scan did not find", () => {
    /* An ear behind her hair files NOTHING (fable-352). The row survives only
       because something was SAID about her ears; the picture stays honest about
       what was measured, so there is no box and no cutout on it. */
    const rows = scanned(
      [
        row({ slot: "ear@left", words: ["a little more tucked"], geometry: null }),
        row({ slot: "ear@right", words: ["a little more tucked"], geometry: null }),
      ],
      { nose: { x: 400, y: 600, width: 120, height: 160 } },
    );
    /* No box was invented for them — and under the founder's rule that now
       means the row leaves rather than standing there with nothing to click. */
    expect(rows.map((panelRow) => panelRow.name)).not.toContain("Ears");
  });

  it("drops the row entirely when the scan found nothing and nothing was said", () => {
    const rows = scanned([], { nose: { x: 400, y: 600, width: 120, height: 160 } });
    expect(rows.map((panelRow) => panelRow.name)).toEqual(["Nose"]);
  });

  it("shows a matched pair BOTH of them, in the order the photograph reads", () => {
    /* The founder's own complaint: *"its only showing one eye"* on a face whose
       eyes were both read. `eye@left` is HER left, which sits at the image's
       RIGHT — so a tile ordered by the side word would mirror every pair on the
       panel, and this one is ordered by where the boxes are. */
    const rows = scanned([], {
      "eye@left": { x: 640, y: 500, width: 60, height: 30 },
      "eye@right": { x: 300, y: 500, width: 60, height: 30 },
    });
    const eyes = rows.find((panelRow) => panelRow.name === "Eyes")!;
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(eyes.cutouts.map((cutout) => cutout.crop!.x)).toEqual([300, 640]);
    /* Two rectangles, each naming the eye it covers — never one box spanning
       both, which would be a rectangle across the bridge of her nose. */
    expect(eyes.regions).toEqual([
      {
        box: { x: 300, y: 500, width: 60, height: 30, frame },
        name: "Right eye", spoken: "her right eye", prefill: "her right eye — ", slot: "eye@right", scopable: true, whole: false,
      },
      {
        box: { x: 640, y: 500, width: 60, height: 30, frame },
        name: "Left eye", spoken: "her left eye", prefill: "her left eye — ", slot: "eye@left", scopable: true, whole: false,
      },
    ]);
  });

  it("is the LIBRARY's own answer when there is no scan", () => {
    /* Without a scan the panel is rows from the catalogue and content from the
       library, exactly as before — and a row the library cannot place on the
       frame is not drawn, which is the founder's rule applied to the same
       inputs rather than a second rule for the unscanned case. */
    const withoutScan = allRows([
      row({ slot: "lips", words: ["a fuller lip"] }),
      row({ slot: "skin", words: ["a warm tan"], geometry: null }),
    ]);
    expect(withoutScan.map((panelRow) => panelRow.name)).toEqual(["Lips"]);
    expect(withoutScan[0]!.regions).toHaveLength(1);
  });
});

/**
 * THE RECTANGLE NAMES WHAT IT COVERS (fable-378 ruling (c)).
 *
 * A matched pair is one row about two slots, and until now its box came from
 * the left instance alone — so a pair read on one side only showed a cutout
 * with no click target at all: a feature you can see in the list and cannot
 * touch on the picture. The fix is not to relabel the row. It is to let the row
 * keep the person's own ontology while the rectangle keeps the pixels' one.
 */
describe("a pair whose geometry is one instance", () => {
  const frame = { width: 1000, height: 1500 };
  const scanned = (
    slots: Record<string, { x: number; y: number; width: number; height: number }>,
    rows: StoredReference[] = [],
  ) => facePanel({
    rows,
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => key,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map(Object.entries(slots).map(([slot, box]) => [slot, {
        box: { ...box, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }])),
    },
  }).groups.flatMap((group) => group.rows);

  it("draws the box it has, and says which eye it is", () => {
    const eyes = scanned({ "eye@right": { x: 640, y: 500, width: 60, height: 30 } })
      .find((row) => row.name === "Eyes")!;

    /* The row is unchanged: both slots, one ask, the pair's own name. */
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(eyes.name).toBe("Eyes");
    /* The rectangle exists — the defect was that it did not. */
    /* And it does not claim to be the pair. */
    expect(eyes.regions).toEqual([
      {
        box: { x: 640, y: 500, width: 60, height: 30, frame },
        name: "Right eye", spoken: "her right eye", prefill: "her right eye — ", slot: "eye@right", scopable: true, whole: false,
      },
    ]);
    expect(eyes.cutouts).toHaveLength(1);
  });

  it("draws BOTH rectangles when both were read, each naming its own instance", () => {
    const eyes = scanned({
      "eye@left": { x: 640, y: 500, width: 60, height: 30 },
      "eye@right": { x: 300, y: 500, width: 60, height: 30 },
    }).find((row) => row.name === "Eyes")!;
    /* One row, one ask, two promises about two sets of pixels. */
    expect(eyes.regions.map((region) => region.name)).toEqual(["Right eye", "Left eye"]);
    expect(eyes.regions.map((region) => region.box.x)).toEqual([300, 640]);
  });

  it("names a singular row's rectangle with nothing extra at all", () => {
    /* Null is not an omission: it means the row's own name is the label. */
    const nose = scanned({ nose: { x: 400, y: 600, width: 120, height: 160 } })
      .find((row) => row.name === "Nose")!;
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null, spoken: null, prefill: null, slot: "nose", scopable: false, whole: false }]);
  });

  it("draws no row at all when nothing can place it — not an unclickable one", () => {
    /* The scan found neither eye, so there is nothing to point at. Words used
       to keep such a row on screen; the founder's rule takes it off. */
    const drawn = scanned(
      { nose: { x: 400, y: 600, width: 120, height: 160 } },
      [
        row({ slot: "eye@left", words: ["green"], geometry: null }),
        row({ slot: "eye@right", words: ["green"], geometry: null }),
      ],
    );
    expect(drawn.map((panelRow) => panelRow.name)).not.toContain("Eyes");
    /* And the row that CAN be placed is still drawn, so the case is not passing
       by the panel having emptied itself. */
    expect(drawn.map((panelRow) => panelRow.name)).toContain("Nose");
  });
});

/**
 * A PER-EYE EDIT ON THE PANEL — fable-444 condition 1, decided rather than
 * deferred: **the panel may never claim what the rows do not agree on.**
 *
 * Ruling C put the per-side memory in the library, which means the panel is
 * where the founder finds out that only one of them is green. The split itself
 * is the pair rule this file already owns (`pairHasDiverged`); what these cases
 * pin is that a per-eye edit REACHES it — a state sentence claiming both eyes
 * over one green eye is the confession-never-displayed class inverted, and the
 * ruling forbade it from the start rather than after somebody read it.
 */
describe("one green eye is never spoken of as two", () => {
  const scoped = [
    row({ slot: "eye@left", noun: "left eye", words: ["green"], version: 2 }),
    row({ slot: "eye@right", noun: "right eye", words: ["dark brown"], version: 1 }),
  ];

  /*
    RE-ANCHORED BY FOUNDER RULING (fable-452), and the rule is the SAME rule.

    These used to assert two top-level rows. The ruling made a pair one
    expandable row with its two sides as children, so what condition 1 forbids
    is now forbidden in one row's words: the parent may say only what both sides
    carry, and where they disagree it says each side's own, attributed.
  */
  it("says each side's own words, attributed, and claims neither for the pair", () => {
    const eyes = named(scoped, "Eyes")!;

    /* ONE composed sentence, not two stacks (fable-475 §2): the row has room
       for about eight words, and both sides' full descriptions do not fit. */
    expect(eyes.words).toEqual(["left green · right dark brown"]);
    expect(eyes.instances.map((instance) => [instance.name, instance.words])).toEqual([
      ["Left eye", ["green"]],
      ["Right eye", ["dark brown"]],
    ]);
    /* The thing the ruling forbids, asserted directly: no sentence on this row
       says "green" as though it were true of her eyes. */
    expect(eyes.words.join(" ")).not.toBe("green");
  });

  /*
    HIS OWN ROW, WITH THE WORDS THAT DID NOT FIT (fable-475 §2).

    Scan-born descriptions are prose, not labels — the founder's read *"left A
    pale grey-blue iris with a dark, dilated pupil, and a small bright…"*,
    truncated mid-thought with a mid-sentence capital, because the row has space
    for about eight words and it was being handed thirty.
  */
  it("compresses each side to what tells it apart, and keeps the rest on the child", () => {
    const described = [
      row({
        slot: "eye@left",
        noun: "left eye",
        words: ["A pale grey-blue iris with a dark, dilated pupil, and a small bright highlight"],
        version: 2,
      }),
      row({
        slot: "eye@right",
        noun: "right eye",
        words: ["A warm brown iris with a soft limbal ring"],
        version: 1,
      }),
    ];
    const eyes = named(described, "Eyes")!;

    expect(eyes.words).toEqual(["left a pale grey-blue iris · right a warm brown iris"]);
    /* Lower case, because her sentence continues the row's own — the
       mid-sentence capital is the thing he was looking at. */
    expect(eyes.words[0]!).not.toMatch(/left A |right A /);
    /* And nothing is lost: the whole description is on the child that opens. */
    expect(eyes.instances[0]!.words).toEqual([
      "A pale grey-blue iris with a dark, dilated pupil, and a small bright highlight",
    ]);
  });

  it("draws a rectangle per instance, so tapping one is a promise about those pixels", () => {
    const eyes = named(scoped, "Eyes")!;

    expect(eyes.regions.map((region) => region.name)).toEqual(["Left eye", "Right eye"]);
    expect(eyes.instances.map((instance) => instance.box !== null)).toEqual([true, true]);
  });

  it("CONTROL — a whole-face edit is still ONE row about both of them", () => {
    /* The discriminator: split on the pair rather than on divergence and this
       goes red. She has one pair of eyes until an edit makes it two. */
    const matched = [
      row({ slot: "eye@left", noun: "left eye", words: ["green"], version: 2 }),
      row({ slot: "eye@right", noun: "right eye", words: ["green"], version: 2 }),
    ];

    expect(named(matched, "Eyes")?.words).toEqual(["green"]);
    /* One row, and its words are hers rather than attributed — the children are
       there either way, which is the ruling's shape and not its symptom. */
    expect(named(matched, "Left eye")).toBeUndefined();
    expect(named(matched, "Eyes")?.instances).toHaveLength(2);
  });

  it("re-merges when a later whole-face edit makes them match again", () => {
    /* Nothing to clear, because there was never a flag: the row is derived from
       the words every time (fable-167). */
    const remerged = [
      ...scoped,
      row({ slot: "eye@left", noun: "left eye", words: ["hazel"], version: 3 }),
      row({ slot: "eye@right", noun: "right eye", words: ["hazel"], version: 3 }),
    ];

    expect(named(remerged, "Eyes")?.words).toEqual(["hazel"]);
    expect(named(remerged, "Left eye")).toBeUndefined();
    /* And the attribution is gone with the divergence, not left behind. */
    expect(named(remerged, "Eyes")?.words.join(" ")).not.toContain("left ");
  });
});

/**
 * THE ROW STATES A FINDING OF NOTHING — founder ruling, fable-889.
 *
 * Asked whether hair should appear on his bald cyborg cast or only once asked
 * for: **"yes show bald"**. A finding of nothing is a look, not a gap (working
 * law 8 — a stylist names bald, clean-shaven, no makeup), and a row that
 * vanishes says nothing at all where the product should be saying something
 * true about his photograph.
 *
 * The whole risk of the ruling is in its scope note, verbatim: *"do not invent
 * none-states for features the scan cannot honestly assert none about"* — so
 * half of what is driven here is the panel REFUSING to speak. The design and
 * the controls behind the two admitted features are
 * `PANEL_ABSENT_STATE_DESIGN.md`.
 */
describe("a row states a finding of nothing", () => {
  const nothingFound = (absent: string[], rows: StoredReference[] = [], scanning?: boolean) => facePanel({
    rows,
    pronouns: HE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map(),
      absent: new Set(absent as any),
    },
    scanning,
  }).groups.flatMap((group) => group.rows);

  it("says BALD on a face whose hair read came back empty", () => {
    const hair = nothingFound(["hair"]).find((row) => row.name === "Hair");
    expect(hair).toBeDefined();
    expect(hair!.absent).toBe("bald");
    /* And it is FULL STRENGTH: this is the version's own confirmed reading, not
       a place kept for one. */
    expect(hair!.state).toBe("settled");
  });

  it("keeps the row on the panel although there is nothing to point at", () => {
    /* The deliberate exception to fable-414. A bald head has no hair to draw a
       rectangle around, and the row is not offering a picture of his hair — it
       is telling him there is none. Everything else still leaves the panel. */
    const hair = nothingFound(["hair"]).find((row) => row.name === "Hair")!;
    expect(hair.regions).toEqual([]);
    expect(hair.cutouts).toEqual([]);
  });

  it("is TAPPABLE, so the state is an invitation (fable-893 ruling 3a)", () => {
    /* His own grounds for the ruling were that the row is the click target. A
       stated "bald" that invites "give him a mohawk" is the row doing its job,
       and the prefill is the same sentence-opening every other row carries. */
    const hair = nothingFound(["hair"]).find((row) => row.name === "Hair")!;
    expect(hair.slots).toEqual(["hair"]);
    expect(hair.prefill).toBe("his hair — ");
  });

  it("says CLEAN-SHAVEN for facial hair, the same argument one jaw down", () => {
    const beard = nothingFound(["facial-hair"]).find((row) => row.name === "Facial hair")!;
    expect(beard.absent).toBe("clean-shaven");
  });

  it("REFUSES on a feature an empty read cannot honestly mean nothing about", () => {
    /*
      The negative control, and it is the ruling's own scope note. An empty ear
      read means "he has no ear" or "I could not see it", and which one depends
      on the pose and the hair — neither of which the scan knows. The same is
      true of eyes behind glasses, brows, lashes.

      Driven on the SAME projection that says "bald" one row above, so this is
      the catalogue's admission doing the work rather than a coincidence of
      fixtures.
    */
    const absent = ["ear@left", "ear@right", "eye@left", "eye@right", "nose", "lips"];

    /* First on a bare face: not one of them draws a row, so nothing was
       invented — the panel is unchanged for every unadmitted feature. */
    expect(nothingFound(absent).map((row) => row.name)).toEqual([]);

    /*
      And then on rows that DO exist, because the arm above cannot fail on its
      own: those rows draw nothing today for a different reason (no box), so an
      admission slipped into the catalogue would hide behind the old rule. Give
      each one a library row with geometry and the row is on the panel — and it
      must still say nothing about being absent.
    */
    const drawn = nothingFound(absent, [
      row({ slot: "ear@left", noun: "left ear", words: ["a small lobe"] }),
      row({ slot: "ear@right", noun: "right ear", words: ["a small lobe"] }),
      row({ slot: "nose", words: ["a straight nose"] }),
      row({ slot: "lips", words: ["a fuller lip"] }),
    ]);
    expect(drawn.map((one) => one.name).sort()).toEqual(["Ears", "Lips", "Nose"]);
    expect(drawn.every((one) => one.absent === null)).toBe(true);
  });

  it("says nothing at all when nobody looked", () => {
    /* No scan is not an empty scan. A panel built without one has never asked,
       and never-asked may not be drawn as found-nothing — which is the fact
       `panelScanOf` is careful to keep separate upstream. */
    expect(allRows([]).filter((row) => row.absent !== null)).toEqual([]);
  });

  it("does not say BALD over words the library already holds", () => {
    /*
      Whatever she has bought wins whole, exactly as words and pictures already
      merge. A described or minted hair row is the answer; a thin read of
      today's frame does not overturn it and tell her she is bald.
    */
    const held = nothingFound(["hair"], [row({ slot: "hair", words: ["a copper shag"] })]);
    const hair = held.find((one) => one.name === "Hair")!;
    expect(hair.absent).toBeNull();
    expect(hair.words).toEqual(["a copper shag"]);
  });

  it("does not say BALD while the read is still running", () => {
    /*
      A row with nothing yet is a PLACE for something while the scan is in
      flight (fable-521), and that is exactly the state a bald row must not be
      confused with. Belt and braces at this layer: the projection upstream
      already claims no absence from a partial reading, because a question still
      in the air has answered neither way.
    */
    const pending = nothingFound([], [], true).find((one) => one.name === "Hair")!;
    expect(pending.state).toBe("pending");
    expect(pending.absent).toBeNull();
  });
});

/**
 * THE TATTOOS SHE IS WEARING (his 1246 — *"i dont see his neck tatto on the
 * feature panel?"* — shaped 1248, source ruled fable-1259 §2).
 *
 * The row is DERIVED PER CAST from the delivery crops rather than enumerated by
 * the catalogue, which is the one asymmetry in this projection. These arms hold
 * both halves of it: that a worn tattoo draws a row, and that nothing about ink
 * reaches the enumeration the face scan walks.
 */
describe("the tattoos she is wearing", () => {
  it("draws a row for a delivered tattoo, named for its placement and boxed where it sits", () => {
    const rows = panelWithInk([worn()]).groups.flatMap((group) => group.rows);
    const ink = rows.find((row) => row.name.toLowerCase().includes("tattoo"));
    expect(ink, "a worn tattoo has a row").toBeDefined();
    expect(ink!.name).toBe("Neck tattoo");
    /* The possessive is the CAST's — this panel was built with HE. */
    expect(ink!.spoken).toBe("his neck tattoo");
    expect(ink!.prefill).toBe("his neck tattoo — ");
    expect(ink!.state).toBe("settled");
  });

  it("puts the box where the crop says, in the frame the crop was measured on", () => {
    const rows = panelWithInk([worn()]).groups.flatMap((group) => group.rows);
    const ink = rows.find((row) => row.name === "Neck tattoo")!;
    expect(ink.regions).toHaveLength(1);
    expect(ink.regions[0]!.box).toEqual({
      x: 120, y: 60, width: 200, height: 90, frame: { width: 1024, height: 1536 },
    });
    /* One thing, one rectangle — so the row's own label names it, exactly as
       every other unpaired row does. */
    expect(ink.regions[0]!.name).toBeNull();
    expect(ink.regions[0]!.slot).toBe("ink:neck");
  });

  it("shows OUR copy of the tattoo as it sits on her, not the artwork she uploaded", () => {
    const rows = panelWithInk([worn({ storageKey: "casting-v2/ink-delivery/xyz.png" })])
      .groups.flatMap((group) => group.rows);
    const ink = rows.find((row) => row.name === "Neck tattoo")!;
    expect(ink.cutouts).toHaveLength(1);
    expect(ink.cutouts[0]!.contentUrl).toBe("https://bucket.example/casting-v2/ink-delivery/xyz.png");
    /*
      AND IT IS ITS OWN STENCIL — never an empty mask URL.

      `cutoutStyle` applies `mask-image: url(...)` unconditionally, so `""` is
      `url("")`, a mask that matches nothing and renders the thumbnail
      invisible. That is what the first build shipped and what the frame caught:
      the row drew with no picture while every assertion here passed.
    */
    /*
      AND IT IS DRAWN WITH NO STENCIL AT ALL.

      NULL, never `""`. The tile masks by LUMINANCE, so a black tattoo on
      transparency handed its own picture as a mask masks itself out, and
      `url("")` masks everything out — both render an empty tile, and both
      shipped past every other assertion in this block before the frame caught
      them. A picture that is already a cutout is drawn unmasked.
    */
    expect(ink.cutouts[0]!.maskUrl).toBeNull();
    /* A minted crop is its own picture: no window to cut out of a bigger one. */
    expect(ink.cutouts[0]!.crop).toBeNull();
  });

  it("says nothing about a tattoo it cannot describe", () => {
    /*
      Every other row's words are a description something wrote. Nothing
      describes a tattoo — what we hold is the picture of it on her. Putting the
      placement in `words` would be the row's own name pretending to be a
      reading of the frame.
    */
    const rows = panelWithInk([worn()]).groups.flatMap((group) => group.rows);
    const ink = rows.find((row) => row.name === "Neck tattoo")!;
    expect(ink.words).toEqual([]);
    expect(ink.absent, "an absence is a stated nothing, and this is not one").toBeNull();
  });

  it("carries a side when the placement has one, and files under the body group", () => {
    const built = panelWithInk([worn({ slot: "ink:upperArm@left" })]);
    const body = built.groups.find((group) => group.heading === "Body");
    expect(body, "a tattoo is on the body").toBeDefined();
    expect(body!.rows.map((row) => row.name)).toEqual(["Left upper arm tattoo"]);
  });

  it("draws a row per placement, so two tattoos are two rows", () => {
    const rows = panelWithInk([worn(), worn({ slot: "ink:upperChest" })])
      .groups.flatMap((group) => group.rows);
    const names = rows.filter((row) => row.name.includes("tattoo")).map((row) => row.name).sort();
    expect(names).toEqual(["Neck tattoo", "Upper chest tattoo"]);
  });

  it("has no ink row when she wears none, and none when the caller passes nothing", () => {
    expect(panelWithInk([]).groups.flatMap((g) => g.rows).map((r) => r.name)).not.toContain("Neck tattoo");
    const untouched = facePanel({
      rows: [],
      pronouns: HE,
      contentUrl: (key) => key,
      maskUrl: (key) => key,
    });
    expect(untouched.groups).toEqual([]);
  });

  it("SKIPS a slot it cannot read rather than drawing a row under a made-up name", () => {
    /*
      The slot string crossed a JSON boundary to get here. A row is a promise
      that tapping it edits that thing, so an unreadable one is dropped — the
      `inkApplied` reader's own fence, one surface along.
    */
    const rows = panelWithInk([worn({ slot: "ink:" }), worn({ slot: "not-an-ink-slot" })])
      .groups.flatMap((group) => group.rows);
    expect(rows).toEqual([]);
  });
});

/*
  THE KINDS NOBODY HAS CATALOGUED — his own words on his own cast (1394): *"the
  orb isnt showing up in the features panel"*.

  The mechanism was one line: the row loop walks `catalogueSlots()`, an open
  kind has no catalogue definition, and the enumeration walked past a library
  row that was sitting right there in the same function. These arms are the
  design countersigned in fable-1397 §1, and the two that matter most are the
  ones about what the panel REFUSES to compose — her word is her word, and a
  rectangle over an uncatalogued thing scopes nothing.
*/
describe("an open kind — a thing the catalogue has no word for", () => {
  const orb = () => row({
    slot: "open:orb",
    noun: "orb",
    words: ["a glowing red vertical slit orb embedded in the centre of her forehead"],
  });

  it("draws a row for it, in her own word, in a section that claims no anatomy", () => {
    const built = panel([orb()]);
    const section = built.groups.find((group) => group.heading === "Also on this character");
    expect(section, "an uncatalogued kind has a section of its own").toBeDefined();
    expect(section!.rows.map((one) => one.name)).toEqual(["Orb"]);
    expect(section!.rows[0]!.spoken).toBe("her orb");
    expect(section!.rows[0]!.prefill).toBe("her orb — ");
    expect(section!.rows[0]!.words)
      .toEqual(["a glowing red vertical slit orb embedded in the centre of her forehead"]);
  });

  it("puts that section LAST, and never under the region the kind's store believes", () => {
    /*
      The obvious grouping is wrong, measured on the only two specimens there
      are: the property store says the orb's `anchorRegion` is `wholeBody`,
      while her own sentence says it is on her forehead. Grouped by the store, a
      forehead feature files under Body — law 8's ontology failure produced by
      trusting a reader on a question the customer already answered.
    */
    const built = panel([orb(), row({ slot: "hair", noun: "hair", words: ["a copper shag"] })]);
    expect(built.groups.map((group) => group.heading))
      .toEqual(["Hair", "Also on this character"]);
    expect(built.groups.find((group) => group.heading === "Body")).toBeUndefined();
  });

  it("takes her noun from the LIBRARY ROW, never from the key", () => {
    /*
      `cat ears` and `cat-ears` both key as `open:cat-ears`, so the key cannot
      say which she typed — `openLaneKind`'s binding condition is that nothing a
      customer reads is derived from it. The CONTROL is the key itself: read
      from there the row would be named "Cat-ears", which is a word she did not
      use.
    */
    const built = panel([row({ slot: "open:cat-ears", noun: "cat ears", words: ["soft grey fur"] })]);
    const section = built.groups.find((group) => group.heading === "Also on this character")!;
    expect(section.rows[0]!.name).toBe("Cat ears");
    expect(section.rows[0]!.name, "the key's own spelling never reaches her").not.toBe("Cat-ears");
    expect(section.rows[0]!.spoken).toBe("her cat ears");
  });

  it("invents no plural — the row is her word and nothing composed from it", () => {
    const built = panel([row({ slot: "open:halo", noun: "halo", words: ["a thin gold ring"] })]);
    const section = built.groups.find((group) => group.heading === "Also on this character")!;
    expect(section.rows[0]!.name).toBe("Halo");
    expect(section.rows[0]!.spoken).toBe("her halo");
  });

  it("says where it came from, the way every other row does", () => {
    const fromEdit = allRows([orb()]).find((one) => one.name === "Orb")!;
    expect(fromEdit.from).toBe("from an edit");
    const bornWith = allRows([row({
      slot: "open:orb", noun: "orb", words: ["a glowing red orb"], variantId: null,
    })]).find((one) => one.name === "Orb")!;
    expect(bornWith.from).toBe("she came with it");
  });

  it("DRAWS NO ROW while nothing has measured where it is (fable-414)", () => {
    /*
      This is the state of every open kind in production the day the panel
      learned to draw them: two library rows, both words-only, neither with a
      crop — because the segmenter was asked the bare noun and answered nothing.
      The rule is the founder's own overrule of fable-382 and it is not bent
      here: a name with nowhere to point is not a row.
    */
    const built = panel([row({
      slot: "open:orb", noun: "orb", words: ["a glowing red orb"], geometry: null,
    })]);
    expect(built.groups.find((group) => group.heading === "Also on this character")).toBeUndefined();
  });

  it("is NOT kept open as a placeholder while a scan runs", () => {
    /*
      A pending row is a place kept for an answer that is coming. The scan walks
      the catalogue and can never answer an open kind, so a placeholder here
      would be a working state outliving its work — fable-521's own warning.
    */
    const built = facePanel({
      rows: [row({ slot: "open:orb", noun: "orb", words: ["a glowing red orb"], geometry: null })],
      pronouns: SHE,
      contentUrl: (key) => key,
      maskUrl: (key) => key,
      scanning: true,
    });
    expect(built.groups.find((group) => group.heading === "Also on this character")).toBeUndefined();
  });

  it("draws its rectangle, and that rectangle SCOPES NOTHING", () => {
    /*
      `refineService` refuses an `open:` scope with `scope_unknown`, deliberately
      and with three rulings holding it there. A rectangle that sent one would
      be a tap dead-ending 1,860 lines before the road it appears to promise.
    */
    const one = allRows([orb()]).find((entry) => entry.name === "Orb")!;
    expect(one.regions).toHaveLength(1);
    expect(one.regions[0]!.slot).toBe("open:orb");
    expect(one.regions[0]!.scopable).toBe(false);
    expect(one.instances, "one of it, so there is nothing to open").toEqual([]);
  });

  it("LEAVES THE PANEL when the kind is pruned (fable-1397 §1)", () => {
    /*
      By the same mechanism that puts it there rather than by a second rule: a
      pruned kind's library rows retire, and a retired row is not live. Driven
      because the behaviour has no code of its own, which is the kind that
      breaks silently.
    */
    const built = panel([row({
      slot: "open:orb", noun: "orb", words: ["a glowing red orb"], retiredAt: new Date(),
    })]);
    expect(built.groups.find((group) => group.heading === "Also on this character")).toBeUndefined();
  });

  it("has no section at all on a cast that has none", () => {
    const built = panel([row({ slot: "hair", noun: "hair", words: ["a copper shag"] })]);
    expect(built.groups.map((group) => group.heading)).toEqual(["Hair"]);
  });

  /*
    A DISTRIBUTED KIND — wings, not fangs. The library files one row per side
    because one rectangle cannot honestly hold two things on opposite sides; the
    PANEL is still one row, because that is how the product speaks about them
    and because naming one of her wings needs a singular of her word.
  */
  describe("a kind filed one side each", () => {
    const wings = (words: { left: string[]; right: string[] }) => [
      row({
        slot: "open:wings@left", noun: "wings", words: words.left,
        geometry: { bbox: { x: 700, y: 300, width: 200, height: 400 }, frame: { width: 1000, height: 1500 } },
      }),
      row({
        slot: "open:wings@right", noun: "wings", words: words.right,
        geometry: { bbox: { x: 100, y: 300, width: 200, height: 400 }, frame: { width: 1000, height: 1500 } },
      }),
    ];

    it("folds into ONE row that speaks her plural, with both rectangles", () => {
      const built = panel(wings({ left: ["black feathered"], right: ["black feathered"] }));
      const section = built.groups.find((group) => group.heading === "Also on this character")!;
      expect(section.rows).toHaveLength(1);
      expect(section.rows[0]!.name).toBe("Wings");
      expect(section.rows[0]!.spoken).toBe("her wings");
      expect(section.rows[0]!.slots).toEqual(["open:wings@left", "open:wings@right"]);
      expect(section.rows[0]!.words).toEqual(["black feathered"]);
      expect(section.rows[0]!.regions).toHaveLength(2);
    });

    it("orders the rectangles as the PHOTOGRAPH reads them, not by the side word", () => {
      /* `left` is HER left, which is the image's right — ordering by the word
         would mirror every tile on the panel. */
      const built = allRows(wings({ left: ["black"], right: ["black"] }));
      const one = built.find((entry) => entry.name === "Wings")!;
      expect(one.regions.map((region) => region.box.x)).toEqual([100, 700]);
    });

    it("OPENS NO CHILDREN — the product has no word for one of her wings", () => {
      const one = allRows(wings({ left: ["black"], right: ["black"] }))
        .find((entry) => entry.name === "Wings")!;
      expect(one.instances).toEqual([]);
      expect(one.regions.every((region) => region.scopable === false)).toBe(true);
      expect(one.regions.every((region) => region.name === null)).toBe(true);
    });

    it("says each side's own words when they diverge, and claims neither for the pair", () => {
      const one = allRows(wings({ left: ["black feathered"], right: ["white feathered"] }))
        .find((entry) => entry.name === "Wings")!;
      expect(one.words).toEqual(["left black feathered · right white feathered"]);
    });

    it("stays ONE row when only one side has ever been filed", () => {
      const built = panel([row({
        slot: "open:wings@left", noun: "wings", words: ["black feathered"],
      })]);
      const section = built.groups.find((group) => group.heading === "Also on this character")!;
      expect(section.rows).toHaveLength(1);
      expect(section.rows[0]!.name).toBe("Wings");
      expect(section.rows[0]!.regions).toHaveLength(1);
    });
  });
});

/**
 * §6.1 IS RETIRED WITH THE PATHS — no row says which world its picture came
 * from, because no cast can be born in one (#203 slice 2 step (b), 2026-09-24).
 *
 * The label was *"as dressed"*, drawn on `build` and `skin` on a cast born on
 * the Wardrobe path. **Nobody ever saw it**: it was refused on Basics, where
 * the row is still unmeasured, and refused on every unpathed cast — which is
 * every cast in production — because drawing it would have changed a live
 * surface for accounts that had never met the feature. Slice 1 closed the
 * entrance, so its one state became unreachable and the field, the catalogue's
 * `pathProvenance`, the span and its class are gone.
 *
 * ⚠ **THE ARM BELOW IS WRITTEN AGAINST THE EMPTY-LIST TRAP** — the class the
 * panel's own retirement suite met one step earlier. *"No row carries a
 * label"* is satisfied by a typo, by a reader that returns nothing for
 * everything, and by a panel with no rows at all. So it proves the SUBJECT
 * survives first: the two rows that carried it are still drawn, still named,
 * and still say their words.
 */
describe("no row says which world its picture came from", () => {
  /* ⚠ BOTH `source: "born"` AND `path` ARE RETIRED SHAPES SINCE #1577 SLICE 2,
     and that makes this fixture MORE of what it already was rather than stale:
     it exists to smuggle a field the panel no longer admits and prove nothing
     reads it. Kept verbatim on purpose — the arm must run the fixture that once
     produced two labels, not a tidier one. */
  const dressed = { kind: "line", line: "a plain grey crew-neck t-shirt, dark straight jeans", source: "born", path: "wardrobe" } as const;

  /* The fixture that USED to produce two labels, resolution and all — the arm
     must run the SAME fixture, not a smaller one. `facePanel` no longer admits
     a `wardrobe` at all, which `pnpm check` is what proves; the cast below is
     deliberate and buys the second half of the statement: even if a caller
     smuggled the retired field back in, nothing reads it and no row grows a
     label. */
  const rows = facePanel({
    rows: [
      row({ slot: "build", noun: "build", words: ["narrower shoulders"] }),
      row({ slot: "skin", noun: "skin", words: ["freckled"] }),
      row({ slot: "hair", noun: "hair", words: ["auburn"] }),
    ],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    ...({ wardrobe: dressed } as unknown as Record<string, never>),
  }).groups.flatMap((group) => group.rows);

  it("still draws the two rows that carried it, saying what she said", () => {
    /* THE POSITIVE CONTROL, and it comes first on purpose: without it the case
       below passes on an empty panel, which is the one way it must not pass. */
    expect(rows.filter((entry) => ["Build", "Skin"].includes(entry.name)).map((entry) => [entry.name, entry.words]))
      .toEqual([["Build", ["narrower shoulders"]], ["Skin", ["freckled"]]]);
  });

  it("carries no label field on any row, whatever the branch is wearing", () => {
    /* Keys rather than values: `provenance === null` would pass with the field
       still on the row and the helper one edit from returning again. */
    expect(rows.length).toBeGreaterThan(0);
    for (const entry of rows) {
      expect(Object.keys(entry).filter((key) => /provenance/i.test(key)), entry.name).toEqual([]);
    }
  });

  it("says where a row came from, which is the channel that did NOT retire", () => {
    /* The label was kept apart from `from` because an edited wardrobe-path
       `build` had to say both at once. One of the two survived; this is the
       arm that notices if a sweep took the wrong one. */
    const built = facePanel({
      rows: [row({ slot: "build", noun: "build", words: ["narrower shoulders"], variantId: 11 })],
      pronouns: SHE,
      contentUrl: (key) => `https://bucket.example/${key}`,
      maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    }).groups.flatMap((group) => group.rows);
    expect(built.find((entry) => entry.name === "Build")!.from).toBe("from an edit");
  });
});

/**
 * THE STENCIL URL, ported here with its function by #1160 slice 2.
 *
 * `maskFetchUrl` lived in `segmentsOnFace.ts` and these are that module's own
 * two arms, re-pointed rather than rewritten — the retirement removed the
 * segment panel, not the CORS fact the face panel's stencils still live under.
 *
 * ⚠ **The arms in this file above RESTATE the proxy shape as a test double**
 * (`maskUrl: (key) => "/api/image-proxy?url=…"`), so not one of them would have
 * noticed the real function going back to a bucket URL. These call it.
 */
describe("the stencil url is same-origin, because a CSS mask is a CORS fetch", () => {
  it("wraps a bucket url in the proxy", () => {
    /*
      A CSS `mask-image` is a CORS-mode fetch and the bucket sends no
      `Access-Control-Allow-Origin`, so a bucket URL here loads NOTHING and the
      row renders an empty box with every stylesheet assertion still true. Found
      by looking at the running app; asserted here so the wire cannot quietly go
      back to the direct URL.
    */
    expect(maskFetchUrl("https://cdn.example/a-mask.png")).toBe(
      `/api/image-proxy?url=${encodeURIComponent("https://cdn.example/a-mask.png")}`,
    );
  });

  it("CONTROL — what it returns is never the bucket's own url", () => {
    /* The whole class in one line: if a stencil is cross-origin, it is
       invisible in the product and green everywhere else. */
    const url = maskFetchUrl("https://pub-test.r2.dev/casting-v2/library/a-mask.png");
    expect(url.startsWith("http")).toBe(false);
    expect(url.startsWith("/")).toBe(true);
    expect(url).toContain("/api/image-proxy?url=");
  });
});

/**
 * WHAT THE READING FOUND THAT NOBODY CATALOGUED — the pointer road's rows
 * (#2566 slice 2, the design approved on #2532).
 *
 * The panel has had two sources of rows since it was written — the CATALOGUE
 * and the LIBRARY — and this is the first that is a READING. Everything worth
 * asserting is about what the row carries from the reading and what it refuses
 * to compose: the noun is the customer's own, there is no label derived from the
 * key, and a found rectangle offers no narrow edit the server would refuse.
 */
describe("a found row — what the reading saw and the catalogue cannot name", () => {
  const frame = { width: 1000, height: 1500 };
  const found = (
    discovered: Array<{ slot: string; noun: string; instance: number; x: number; y: number; kind?: FeatureKind; on?: string }>,
  ) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map(),
      discovered: discovered.map((one) => ({
        slot: one.slot,
        noun: one.noun,
        instance: one.instance,
        /* A hostless `anatomy` by default, which is what the grouping reads as
           *its own row in the open section* — so every arm below that predates
           #2566 slice 2's grouping still describes the panel it described. An
           arm about the grouping passes its own. */
        kind: one.kind ?? "anatomy",
        on: one.on ?? "",
        box: { x: one.x, y: one.y, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.slot}`,
      })),
    },
  });

  it("draws the thing under the reading's own noun — a body part, so under Face (#2801)", () => {
    const panelOut = found([{ slot: "discovered:jaw-hardware#1", noun: "jaw hardware", instance: 1, x: 300, y: 500 }]);
    const section = panelOut.groups.find((group) => group.group === "face")!;

    /* A hostless `anatomy` by default: a body part, which lists under Face
       since #2801 (his eye on the first creature) rather than beside the marks. */
    expect(section.heading).toBe("Face");
    expect(section.rows).toHaveLength(1);
    const row = section.rows[0]!;
    expect(row.name).toBe("Jaw hardware");
    expect(row.spoken).toBe("her jaw hardware");
    expect(row.slots).toEqual(["discovered:jaw-hardware#1"]);
    /* A window on the frame the viewer already has — no object was written. */
    expect(row.cutouts).toEqual([{
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,discovered:jaw-hardware#1",
      crop: { x: 300, y: 500, width: 80, height: 60, frame },
    }]);
    expect(row.regions).toHaveLength(1);
    expect(row.regions[0]!.box).toEqual({ x: 300, y: 500, width: 80, height: 60, frame });
  });

  it("offers no narrow edit on a found rectangle — the scope door admits catalogued instances only", () => {
    const row = found([{ slot: "discovered:sash#1", noun: "sash", instance: 1, x: 10, y: 20 }])
      .groups.flatMap((group) => group.rows)[0]!;
    expect(row.regions[0]!.scopable).toBe(false);
    /* And no name of its own on the rectangle: naming one of a thing needs a
       singular of somebody's word, and composing one is the invention the
       distributed-kind row refuses by name. */
    expect(row.regions[0]!.name).toBeNull();
  });

  it("keeps two instances of one noun as two rows", () => {
    const rows = found([
      { slot: "discovered:strap#1", noun: "strap", instance: 1, x: 100, y: 100 },
      { slot: "discovered:strap#2", noun: "strap", instance: 2, x: 500, y: 100 },
    ]).groups.flatMap((group) => group.rows);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.slots)).toEqual([["discovered:strap#1"], ["discovered:strap#2"]]);
  });

  it("says nothing about it in words, and claims no provenance", () => {
    const row = found([{ slot: "discovered:coat#1", noun: "coat", instance: 1, x: 0, y: 0 }])
      .groups.flatMap((group) => group.rows)[0]!;
    /* What the reading SAID about a coat is prose for the current description,
       not a line under its own picture. */
    expect(row.words).toEqual([]);
    expect(row.from).toBeNull();
    expect(row.absent).toBeNull();
    expect(row.instances).toEqual([]);
  });

  it("draws nothing for a noun that is blank", () => {
    const rows = found([{ slot: "discovered:feature#1", noun: "   ", instance: 1, x: 0, y: 0 }])
      .groups.flatMap((group) => group.rows);
    expect(rows).toEqual([]);
  });

  it("draws nothing at all when the reading found nothing off the list", () => {
    expect(found([]).groups.flatMap((group) => group.rows)).toEqual([]);
  });

  /*
    AND THE SCAN'S PENDING GRACE DOES NOT REACH A FOUND ROW, which is the same
    clause that keeps it off an open kind: the grace holds a place for an answer
    the CATALOGUE walk is going to give, and there is no catalogue walk behind a
    jacket. A placeholder for a read that is not running is a working state that
    can outlive its work.
  */
  it("keeps no empty place for a found row while a reading is in flight", () => {
    const panelOut = facePanel({
      rows: [],
      pronouns: SHE,
      scanning: true,
      contentUrl: (key) => `https://bucket.example/${key}`,
      maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
      scan: { frameUrl: "https://bucket.example/casting/master.jpg", slots: new Map(), discovered: [] },
    });
    expect(panelOut.groups.find((group) => group.group === "open")).toBeUndefined();
  });
});

/**
 * THE LOADER NAMES NOTHING NOBODY HAS SEEN — #2566 slice 3.
 *
 * His word on the first look at the discovery panel, verbatim: *"loader is
 * still showing the default list"*. While a reading ran, the panel drew one
 * placeholder row per catalogue entry — Eyes, Brows, Horns, Nose stud — over a
 * cast that had several of those and not others. On the discovery road the
 * named grace is not drawn; the panel says `pendingUnnamed` and the browser
 * keeps the places without names.
 *
 * ⚠ The positive control comes first and every arm after it is the same input
 * with one field changed, so an arm that passes cannot be passing because the
 * fixture drew no placeholders to begin with.
 */
describe("the loader names nothing nobody has seen", () => {
  const frame = { width: 1000, height: 1500 };
  const reading = (over: { scanning?: boolean; discovering?: boolean; rows?: StoredReference[] } = {}) => facePanel({
    rows: over.rows ?? [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    /* A part-answered reading: the nose has landed with its picture, one found
       thing has landed, and nothing else has answered yet. */
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map([["nose", {
        box: { x: 400, y: 600, width: 120, height: 160, frame },
        maskUrl: "data:image/png;base64,nose",
      }]]),
      discovered: [{
        slot: "discovered:neck-tattoo#1",
        noun: "neck tattoo",
        instance: 1,
        kind: "marking",
        on: "",
        box: { x: 420, y: 900, width: 90, height: 70, frame },
        maskUrl: "data:image/png;base64,neck",
      }],
    },
    ...(over.scanning === undefined ? {} : { scanning: over.scanning }),
    ...(over.discovering === undefined ? {} : { discovering: over.discovering }),
  });
  const rowsOf = (built: ReturnType<typeof facePanel>) => built.groups.flatMap((group) => group.rows);

  it("⚠ POSITIVE CONTROL — off the discovery road the reading keeps NAMED places", () => {
    /* Without this arm every one below passes against a fixture that could
       never draw a placeholder at all. */
    const built = reading({ scanning: true });
    const pending = rowsOf(built).filter((row) => row.state === "pending");
    expect(pending.length, "the catalogue road drew no placeholder rows to take away").toBeGreaterThan(3);
    expect(pending.map((row) => row.name)).toContain("Eyes");
    expect(built.pendingUnnamed).toBe(false);
  });

  it("on the discovery road, while it reads, no row is a placeholder — and none is named in advance", () => {
    const built = reading({ scanning: true, discovering: true });
    const rows = rowsOf(built);
    expect(rows.filter((row) => row.state === "pending"), "a named placeholder survived on the discovery road").toEqual([]);
    /* And it says so, so the browser can keep the places without names. */
    expect(built.pendingUnnamed).toBe(true);
    /* What is on the panel is exactly what has LANDED, by name. */
    expect(rows.map((row) => row.name).sort()).toEqual(["Neck tattoo", "Nose"]);
  });

  it("rows land whole: every row drawn mid-reading is settled and has its picture", () => {
    const rows = rowsOf(reading({ scanning: true, discovering: true }));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.state, `${row.name} landed as a placeholder`).toBe("settled");
      expect(row.cutouts.length, `${row.name} landed without its picture`).toBeGreaterThan(0);
      expect(row.regions.length, `${row.name} landed with nowhere to point`).toBeGreaterThan(0);
    }
  });

  it("a row the library already holds stays on screen while the reading runs", () => {
    /* The panel is INCOMPLETE while it reads, never emptied: what an edit
       already made is still hers and still tappable. */
    const rows = rowsOf(reading({
      scanning: true,
      discovering: true,
      rows: [row({ slot: "hair", noun: "hair", words: ["a copper shag"] })],
    }));
    const hair = rows.find((one) => one.name === "Hair");
    expect(hair?.state).toBe("settled");
    expect(hair?.words).toEqual(["a copper shag"]);
  });

  it("the unnamed places end when the reading does", () => {
    /* `pendingUnnamed` is the reading's own state, never the road's: a settled
       reading on the discovery road keeps no place of either kind. */
    const built = reading({ scanning: false, discovering: true });
    expect(built.pendingUnnamed).toBe(false);
    expect(rowsOf(built).filter((row) => row.state === "pending")).toEqual([]);
  });

  it("once settled, the discovery road's panel is the catalogue road's — the loader and the words-only rows differ", () => {
    /* `discovering` changes what is kept for a reading in flight and, since
       #2752, ONE thing about an answer: the slots that author
       `noRowOnDiscovery` (build and skin) draw no row. This reading has
       neither, so the two panels are identical; the arms that hold the
       difference are under "build and skin are words alone". */
    expect(reading({ scanning: false, discovering: true })).toEqual(reading({ scanning: false }));
  });

  it("off the road, `discovering: false` is the panel with no such field — today's panel exactly", () => {
    expect(reading({ scanning: true, discovering: false })).toEqual(reading({ scanning: true }));
  });
});

/**
 * THE GROUPING — where each found thing actually goes (#2566 slice 2, the
 * grouping design of 2026-10-28, answering his five findings of that day).
 *
 * Until slice 2 every found thing was a top-level sibling, and his eye found
 * five separate defects in that one fact: a lip ring sibling to Lips, "eye
 * makeup" a row at all, six garment nouns six rows, freckles cut like an
 * object. The panel now reads the two facts the reading declares — `kind` and
 * `on` — and these arms are the three destinations and the words.
 *
 * ⚠ **The fixtures are real readings.** Every name, kind and host below came
 * back from the discovery read on his three production casts, merged across
 * both crops (`output/2566/grouping-discovery.json`), which is the bench the
 * design was written from.
 */
describe("the grouping — the outfit, the folds, and the words with no picture", () => {
  const frame = { width: 1000, height: 1500 };
  type Found = {
    noun: string;
    kind: FeatureKind;
    on?: string;
    instance?: number;
    x?: number;
    y?: number;
    /** His check 1 (#2856): measured at the pixels by the scan service and
     *  carried, so here it is simply given. */
    coversFace?: boolean;
  };
  type Said = {
    noun: string;
    on: string;
    about: string;
    kind: FeatureKind;
    why: "scattered" | "makeup" | "uncut" | "dropped";
  };

  /**
   * A panel from a reading: `found` is what the pointer road cut, `catalogued`
   * is which catalogue slots the scan located (so a fold has a parent to land
   * under), and `said` is the words with no picture.
   */
  const panelOf = (input: {
    found?: readonly Found[];
    catalogued?: readonly string[];
    said?: readonly Said[];
  }) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map((input.catalogued ?? []).map((slot, at) => [slot as FeatureSlot, {
        box: { x: 10 + at * 10, y: 20 + at * 10, width: 50, height: 40, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }])),
      discovered: (input.found ?? []).map((one, at) => ({
        slot: `discovered:${one.noun.replace(/[^a-z0-9]+/g, "-")}#${one.instance ?? 1}` as FeatureSlot,
        noun: one.noun,
        instance: one.instance ?? 1,
        kind: one.kind,
        on: one.on ?? "",
        box: { x: one.x ?? 100 + at * 100, y: one.y ?? 200 + at * 50, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
        ...(one.coversFace === undefined ? {} : { coversFace: one.coversFace }),
      })),
      namedNotCut: input.said ?? [],
    },
  });
  const sectionOf = (panel: FacePanel, group: string) =>
    panel.groups.find((one) => one.group === group) ?? null;
  const rowNames = (panel: FacePanel, group: string) =>
    (sectionOf(panel, group)?.rows ?? []).map((row) => row.name);

  /* ---- rule 5: the outfit is ONE row ---- */

  it("draws ONE Outfit row for a whole look, however many garments the reading named", () => {
    /* Cast 2556's merged reading: four garments the old panel drew as four
       sibling rows, which is the complaint. */
    const panel = panelOf({
      found: [
        { noun: "hood", kind: "clothing" },
        { noun: "face mask", kind: "clothing" },
        { noun: "scarf", kind: "clothing" },
        { noun: "coat", kind: "clothing" },
      ],
    });
    const outfit = sectionOf(panel, "outfit")!;
    expect(outfit.heading).toBe("Outfit");
    expect(outfit.rows).toHaveLength(1);
    const row = outfit.rows[0]!;
    expect(row.name).toBe("Outfit");
    expect(row.spoken).toBe("her outfit");
    expect(row.prefill).toBe("her outfit — ");
    /* The pieces are real underneath — one child each, with its own cut. */
    expect(row.instances.map((one) => one.name)).toEqual(["Hood", "Face mask", "Scarf", "Coat"]);
    /* And nothing is left in the open section: the whole reading was clothing. */
    expect(sectionOf(panel, "open")).toBeNull();
  });

  it("sits between Body and Accessories, and vanishes when the cast wears nothing the reading saw", () => {
    const dressed = panelOf({ found: [{ noun: "coat", kind: "clothing" }] });
    expect(dressed.groups.map((one) => one.group)).toEqual(["outfit"]);
    /* Order is the authored one, and it is asserted on the declaration rather
       than on a panel that happens to have every section. */
    expect(PANEL_GROUPS.map((one) => one.group)).toEqual([
      "face", "hair", "body", "outfit", "accessories", "open",
    ]);
    const bare = panelOf({ found: [{ noun: "neck tattoo", kind: "marking" }] });
    expect(sectionOf(bare, "outfit")).toBeNull();
  });

  it("draws the dressed figure in a window, with no stencil over it", () => {
    const panel = panelOf({
      found: [
        { noun: "coat", kind: "clothing", x: 100, y: 300 },
        { noun: "scarf", kind: "clothing", x: 400, y: 200 },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    expect(row.cutouts).toHaveLength(1);
    /* ⚠ NULL, not a union of masks: a union of several stencils is several
       disconnected islands with the body showing between them, which is not
       what anybody means by an outfit. */
    expect(row.cutouts[0]!.maskUrl).toBeNull();
    expect(row.cutouts[0]!.contentUrl).toBe("https://bucket.example/casting/master.jpg");
    /* The union of the pieces' boxes — x 100..480, y 200..360. */
    expect(row.cutouts[0]!.crop).toEqual({ x: 100, y: 200, width: 380, height: 160, frame });
  });

  it("takes anything whose chain ends at clothing, however many hops away", () => {
    /* Cast 2556 again: `buckle on=strap`, `strap on=coat`, `coat` clothing.
       ⚠ A ONE-HOP READER PUTS THE BUCKLE IN *Also on this character* BESIDE AN
       OUTFIT ROW HOLDING THE STRAP IT IS BUCKLED TO, which is why the walk is
       a walk. */
    const panel = panelOf({
      found: [
        { noun: "coat", kind: "clothing" },
        { noun: "strap", kind: "accessory", on: "coat" },
        { noun: "buckle", kind: "accessory", on: "strap" },
        { noun: "rope", kind: "accessory", on: "coat" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    /*
      ⚠ UPDATED WITH HIS WORD RATHER THAN DELETED (#2862, 2026-10-31). This read
      ~~`toEqual(["Coat", "Strap", "Buckle", "Rope"])`~~ on the instances: every
      worn thing on the coat was a piece row. His answer on drawstrings —
      *"on your question about drawstrings yes"*, garments only — makes the
      coat the one piece, and the walk this arm is about is now proven where
      the outfit still carries them: the row's own `slots`.
    */
    expect(row.instances.map((one) => one.name)).toEqual(["Coat"]);
    expect(row.slots).toEqual([
      "discovered:outfit", "discovered:coat#1", "discovered:strap#1", "discovered:buckle#1", "discovered:rope#1",
    ]);
    expect(sectionOf(panel, "open")).toBeNull();
    expect(sectionOf(panel, "accessories")).toBeNull();
  });

  it("draws the WHOLE outfit first, then every piece inside it", () => {
    /* The harness is CLOTHING here, a garment he names as one (#2862: *"a
       hoodie, top, harness, jacket"*). It read `kind: "accessory"` until his
       word on trims, and a worn thing on a garment is no longer a piece row —
       so the arm's subject, the whole-then-pieces order, needs two garments. */
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "clothing" },
        { noun: "harness", kind: "clothing", on: "jacket" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    /* UNCHANGED, and it is the half his complaint was NOT about: the edit has
       meant the whole outfit since #2566 slice 2. */
    expect(row.slots).toEqual(["discovered:outfit", "discovered:jacket#1", "discovered:harness#1"]);
    /*
      ⚠ THIS ARM PINNED THE OPPOSITE AND IS UPDATED WITH HIS WORD RATHER THAN
      DELETED (#2845, 2026-10-30). It read:

        ~~"One rectangle per PIECE and not the union: a union rectangle over a
          dressed figure is the whole figure, which points at nothing."~~
        ~~expect(row.regions.map((one) => one.name)).toEqual(["Jacket", "Harness"]);~~

      His words: *"why cant i select his outfit box as a whole its selecting
      individual pieces?"* and *"also outfit should be selectablke as a whole"*.
      The struck reasoning is true of a union drawn ALONE; what he was shown was
      two lit rectangles and no outfit, and he read it as the panel editing
      pieces one at a time. The pieces are still here, inside it.
    */
    expect(row.regions.map((one) => one.name)).toEqual([null, "Jacket", "Harness"]);
    expect(row.regions.map((one) => one.whole)).toEqual([true, false, false]);
    /* The whole rectangle is the ROW's, so it carries the row's own key and
       narrows to nothing — a scope here would mean a piece. */
    expect(row.regions[0]!.slot).toBe("discovered:outfit");
    expect(row.regions[0]!.scopable).toBe(false);
  });

  it("gives the whole rectangle the SAME extent the row's own thumbnail is cropped to", () => {
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "clothing" },
        { noun: "harness", kind: "accessory", on: "jacket" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    /*
      ONE VALUE USED TWICE, NEVER TWO MEASUREMENTS OF ONE THING (working law 4).
      The thumbnail was already cropped to the union before this card; if the
      rectangle were computed a second time the picture and the tile beside it
      could drift, and the customer would see a box that does not match the
      thing it is a picture of.
    */
    expect(row.regions[0]!.box).toEqual(row.cutouts[0]!.crop);
  });

  it("CONTROL — the whole rectangle encloses every piece it was built from", () => {
    /* Three GARMENTS (#2862): a piece row is a garment's now, so a worn thing
       here would no longer be one of the three pieces this arm counts. */
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "clothing" },
        { noun: "harness", kind: "clothing", on: "jacket" },
        { noun: "belt", kind: "clothing" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    const whole = row.regions.find((one) => one.whole)!.box;
    const pieces = row.regions.filter((one) => !one.whole).map((one) => one.box);
    /* Three pieces, so this is not satisfied by a single box being its own
       union — the shape that would pass while the arithmetic was wrong. */
    expect(pieces.length).toBe(3);
    for (const piece of pieces) {
      expect(piece.x, piece.toString()).toBeGreaterThanOrEqual(whole.x);
      expect(piece.y).toBeGreaterThanOrEqual(whole.y);
      expect(piece.x + piece.width).toBeLessThanOrEqual(whole.x + whole.width);
      expect(piece.y + piece.height).toBeLessThanOrEqual(whole.y + whole.height);
    }
    /* And it is the SMALLEST such rectangle — a union that simply returned the
       frame would pass every bound above. */
    expect(whole.x).toBe(Math.min(...pieces.map((one) => one.x)));
    expect(whole.y).toBe(Math.min(...pieces.map((one) => one.y)));
    expect(whole.x + whole.width).toBe(Math.max(...pieces.map((one) => one.x + one.width)));
    expect(whole.y + whole.height).toBe(Math.max(...pieces.map((one) => one.y + one.height)));
  });

  it("leaves a piece whose SHAPE lies over the face out of the whole outline, and keeps its row", () => {
    /*
      HIS RULING, 2026-10-30 (#2856, point 4): *"The whole-Outfit outline must
      never be built from a failed piece."* The relay's finding on PR #2850 is
      the case — a union inherits the worst piece, so one garment reading from
      the mouth to the waist would drag the outfit's own rectangle over the
      face.

      ⚠ **Judged at the SHAPE and never at the rectangle, which is his own
      amendment the same hour**: *"im not worried about the box covering the
      neck that sort of normal if its the outfit or whatever"*. The boolean
      arrives measured at the pixels (`maskCoverage`, driven on its own).
    */
    const panel = panelOf({
      found: [
        { noun: "cloak", kind: "clothing", x: 200, y: 900 },
        { noun: "face wrap", kind: "clothing", x: 100, y: 100, coversFace: true },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    const whole = row.regions.find((one) => one.whole)!;
    const wrap = row.regions.find((one) => one.name === "Face wrap")!;
    /* The outline is the cloak's extent alone — it does not reach up to the
       wrap at y 100. */
    expect(whole.box).toEqual({ x: 200, y: 900, width: 80, height: 60, frame });
    expect(whole.box.y).toBeGreaterThan(wrap.box.y);
    /* ⚠ AND THE FAILING PIECE IS STILL A ROW AND STILL A RECTANGLE. Point 3 of
       his ruling — a failed piece gets no row at all — is #2845's defect 2 and
       waits for the other three checks; taking one of four would hide pieces
       for one reason while three others still drew theirs. */
    expect(row.instances.map((one) => one.name)).toEqual(["Cloak", "Face wrap"]);
    expect(wrap.whole).toBe(false);
    /* And the thumbnail is the same window as the outline, still one value. */
    expect(row.cutouts[0]!.crop).toEqual(whole.box);
  });

  it("draws NO whole rectangle at all when every piece lies over the face", () => {
    /*
      A row with nothing it may outline must not outline the wrong thing. The
      picture falls back to one rectangle per piece — the panel exactly as it
      was before this card — and the thumbnail keeps the window it always had.
    */
    const panel = panelOf({
      found: [
        { noun: "face wrap", kind: "clothing", x: 100, y: 100, coversFace: true },
        { noun: "mask", kind: "clothing", x: 300, y: 150, coversFace: true },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    expect(row.regions.some((one) => one.whole)).toBe(false);
    expect(row.regions.map((one) => one.name)).toEqual(["Face wrap", "Mask"]);
    /* The row is still the whole outfit to tap — only the picture changed. */
    expect(row.slots).toEqual(["discovered:outfit", "discovered:face-wrap#1", "discovered:mask#1"]);
    /* The window is the union of all of them, which is what it was before. */
    expect(row.cutouts[0]!.crop).toEqual({ x: 100, y: 100, width: 280, height: 110, frame });
  });

  it("CONTROL — a piece the scan did not measure is treated as clear, so today's panel is unchanged", () => {
    /*
      ⚠ THE ARM THAT MAKES THE FIELD FREE. A reading kept before the check
      existed restores without it, and the live preview a scan serves while it
      is still running never carries it. Both must draw what they drew
      yesterday: inside the outline.
    */
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "clothing", x: 100, y: 100 },
        { noun: "belt", kind: "clothing", x: 400, y: 800, coversFace: false },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    const whole = row.regions.find((one) => one.whole)!;
    expect(whole.box).toEqual({ x: 100, y: 100, width: 380, height: 760, frame });
  });

  it("CONTROL — no other row on the panel grows a whole rectangle", () => {
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "clothing" },
        { noun: "scar", kind: "marking", on: "cheek" },
      ],
    });
    /*
      The field is `false` everywhere but the one collection row, which is what
      lets the browser's rule be *"a row that HAS one"* rather than a list of
      which rows do. A second `true` anywhere here would silently start
      suppressing some other row's rectangles.
    */
    const all = panel.groups
      .flatMap((group) => group.rows.flatMap((row) => row.regions.map((one) => ({ group: group.group, one }))));
    /* ⚠ THE ARM BELOW IS VACUOUS WITHOUT THIS ONE, so it is pinned rather than
       assumed: the scar must actually draw a rectangle somewhere else on the
       panel, or "the outfit is the only whole" is true of a panel that has no
       other rectangle to be wrong about. Measured: outfit 2 regions, open/Scar
       1. */
    expect(all.filter((each) => each.group !== "outfit").length).toBeGreaterThan(0);
    expect(all.filter((each) => each.one.whole).map((each) => each.group)).toEqual(["outfit"]);
  });

  /*
    ⚠ **HIS OWN ⚠ ON THE FINDING, AND IT IS THE ARM THIS WHOLE RULE HANGS ON.**
    The body implants on his cast were labelled *Collar*, so a rule keyed on the
    WORD sweeps hardware into the outfit. `kind` is the only key, judged from
    the picture: the measured reader put body hardware in `anatomy` 4 of 4 times
    and its one miss landed in `accessory` — and this arm drives BOTH of those,
    plus the word that would have caught it.
  */
  it("CONTROL — body hardware never enters the outfit, whatever the reading called it", () => {
    for (const kind of ["anatomy", "accessory"] as const) {
      const panel = panelOf({
        found: [
          { noun: "jacket", kind: "clothing" },
          { noun: "collar", kind, on: "neck" },
        ],
      });
      const outfit = sectionOf(panel, "outfit")!.rows[0]!;
      expect(outfit.instances.map((one) => one.name), kind).toEqual(["Jacket"]);
      /* Never the Outfit, and never a fold: read as anatomy it is this
         character, read as worn it is an accessory (his ruling, #2789). */
      expect(rowNames(panel, kind === "accessory" ? "accessories" : "face"), kind).toEqual(["Collar"]);
    }
  });

  /* ---- his ruling of 2026-10-29 (#2789): a worn thing is an accessory ---- */

  /*
    ⚠ **THIS ARM USED TO SAY THE OPPOSITE, AND IT WAS HIS SENTENCE.** It read
    ~~*"folds a found thing under the catalogued row it sits on — his own
    sentence: a lip ring goes under Lips"*~~. On 2026-10-29 the founder took the relay's
    recommendation instead (*"go with your reccomendation"*): every worn thing
    is a row under Accessories and the body rows hold the body alone.
  */
  it("lists a worn thing under Accessories, and the body row it sits on holds the body alone", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [{ noun: "lip ring", kind: "accessory", on: "lips", x: 420, y: 700 }],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances).toEqual([]);
    expect(lips.regions.map((one) => one.name)).toEqual([null]);
    expect(sectionOf(panel, "open")).toBeNull();
    const ring = sectionOf(panel, "accessories")!.rows.find((row) => row.name === "Lip ring")!;
    expect(ring.slots).toEqual(["discovered:lip-ring#1"]);
    /* Its own cut, kept, and its own rectangle on the photograph. */
    expect(ring.cutouts).toEqual([{
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,lip ring",
      crop: { x: 420, y: 700, width: 80, height: 60, frame },
    }]);
    expect(ring.regions.map((one) => one.slot)).toEqual(["discovered:lip-ring#1"]);
  });

  it("lists every worn thing his ruling names there — piercings on any body row, and a choker on the neck", () => {
    const panel = panelOf({
      catalogued: ["nose", "lips", "brow@left", "brow@right", "ear@left", "ear@right"],
      found: [
        { noun: "septum ring", kind: "accessory", on: "nose" },
        { noun: "lip piercing", kind: "accessory", on: "lips" },
        { noun: "eyebrow bar", kind: "accessory", on: "eyebrows" },
        { noun: "ear cuff", kind: "accessory", on: "ear" },
        { noun: "choker", kind: "accessory", on: "neck" },
      ],
    });
    expect(rowNames(panel, "accessories")).toEqual([
      "Septum ring", "Lip piercing", "Eyebrow bar", "Ear cuff", "Choker",
    ]);
    /* Every body row holds the body alone. */
    for (const row of sectionOf(panel, "face")!.rows) {
      expect(row.instances.some((one) => one.slot.startsWith("discovered:")), row.name).toBe(false);
    }
    expect(sectionOf(panel, "open")).toBeNull();
  });

  it("keeps a mark on the skin in Also on this character, never under the body row it sits on", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [{ noun: "lip tattoo", kind: "marking", on: "lips" }],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances).toEqual([]);
    expect(rowNames(panel, "open")).toEqual(["Lip tattoo"]);
    expect(sectionOf(panel, "accessories")).toBeNull();
  });

  it("CONTROL — a worn thing on a worn row stays that row's child: a charm on the catalogue's Earrings", () => {
    /* Not a body part, so the ruling does not move it — and the arm proves the
       fold grammar still reaches an Accessories row. */
    const panel = panelOf({
      catalogued: ["earring@left", "earring@right"],
      found: [{ noun: "charm", kind: "accessory", on: "earring" }],
    });
    const earrings = sectionOf(panel, "accessories")!.rows.find((row) => row.name === "Earrings")!;
    expect(earrings.instances.map((one) => one.name)).toEqual(["Left earring", "Right earring", "Charm"]);
    expect(rowNames(panel, "accessories")).toEqual(["Earrings"]);
  });

  /* ---- rule 3: what still folds under the row it sits on ---- */

  it("folds a body feature under the catalogued row it sits on, never beside it", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [{ noun: "cupid's bow", kind: "anatomy", on: "lips", x: 420, y: 700 }],
    });
    expect(sectionOf(panel, "open")).toBeNull();
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances.map((one) => one.name)).toEqual(["Cupid's bow"]);
    expect(lips.instances[0]!.spoken).toBe("her cupid's bow");
    expect(lips.instances[0]!.prefill).toBe("her cupid's bow — ");
    /* Its own cut, kept — the design's *"the child keeps its own cut"*. */
    expect(lips.instances[0]!.cutout).toEqual({
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,cupid's bow",
      crop: { x: 420, y: 700, width: 80, height: 60, frame },
    });
    /* And its rectangle on the photograph, NAMED, the way a pair's sides are. */
    const bow = lips.regions.find((one) => one.name === "Cupid's bow")!;
    expect(bow.slot).toBe("discovered:cupid-s-bow#1");
    expect(bow.spoken).toBe("her cupid's bow");
  });

  it("reaches a pair row through the words the catalogue uses for it", () => {
    /* `on: "ear"` has to reach a row that draws as *Ears* — the label alone
       would not, which is why the catalogue's five words are recorded. */
    const panel = panelOf({
      catalogued: ["ear@left", "ear@right"],
      found: [{ noun: "pointed tip", kind: "anatomy", on: "ear" }],
    });
    expect(sectionOf(panel, "open")).toBeNull();
    const ears = sectionOf(panel, "face")!.rows.find((row) => row.name === "Ears")!;
    expect(ears.instances.map((one) => one.name)).toEqual(["Left ear", "Right ear", "Pointed tip"]);
  });

  /*
    ⚠ **THESE TWO ARMS EXIST BECAUSE THE SABOTAGE ROUND SURVIVED WITHOUT THEM.**
    Deleting `catalogueHostWords` from either catalogue push left all 154 arms
    green, because the rows the earlier arms fold onto (*Skin*, *Lips*, *Ears*)
    happen to normalise from their own displayed label. The catalogue's other
    four words only earn their keep where the label and the reading's word are
    genuinely different — and the real readings have both cases.
  */
  it("reaches a row by a word the catalogue uses and the label does not", () => {
    /* `display: "face skin"` against a row that draws as *Skin*. The design's
       worked example is freckles on skin, and a reading that says *face skin*
       — which is the catalogue's own display string — must land in the same
       place. */
    const panel = panelOf({
      catalogued: ["skin"],
      said: [{ noun: "freckles", on: "face skin", about: "a dusting of freckles", kind: "marking", why: "scattered" }],
    });
    const skin = sectionOf(panel, "body")!.rows.find((row) => row.name === "Skin")!;
    expect(skin.words).toEqual(["a dusting of freckles"]);
  });

  it("reaches a PAIR row by the question the scan asks, not by the row's label", () => {
    /* The brows row draws as *Brows* and the scan's question is *eyebrows* —
       and `eyebrows` is exactly what the reading answered on two of the three
       production fixtures. `normalisedName` folds *Brows* to `brow` and
       *eyebrows* to `eyebrow`, so the label alone cannot reach it. */
    const panel = panelOf({
      catalogued: ["brow@left", "brow@right"],
      found: [{ noun: "brow ridge", kind: "anatomy", on: "eyebrows" }],
    });
    expect(sectionOf(panel, "open")).toBeNull();
    const brows = sectionOf(panel, "face")!.rows.find((row) => row.name === "Brows")!;
    expect(brows.instances.map((one) => one.name)).toEqual([
      "Left brow", "Right brow", "Brow ridge",
    ]);
  });

  /*
    ⚠ **AND THIS ONE EXISTS FOR THE SAME REASON: NOTHING WROTE TO ONE ROW
    TWICE.** `replaceRow` builds a NEW row object and has to carry that row's
    host words across with it, because `hostNounsOfRow` is keyed on the object.
    Deleting that one migration left every arm green — a row that took a child
    and then a words line silently lost the words, which is the second write
    landing nowhere.
  */
  it("takes a child AND a words line on one row, in either order", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [{ noun: "cupid's bow", kind: "anatomy", on: "lips" }],
      said: [{ noun: "chapping", on: "lips", about: "dry and chapped", kind: "marking", why: "scattered" }],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances.map((one) => one.name)).toEqual(["Cupid's bow"]);
    expect(lips.words).toEqual(["dry and chapped"]);
  });

  it("keeps a parent's own ask about the parent — the fold does not widen it", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [{ noun: "cupid's bow", kind: "anatomy", on: "lips" }],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    /* The arm is not vacuous: the fold happened. */
    expect(lips.instances.map((one) => one.name)).toEqual(["Cupid's bow"]);
    /* ⚠ Tapping Lips is an ask about the lips, not about a ring on them. A row
       whose `slots` quietly included its lodgers would send an edit meaning
       both — which is the opposite of the Outfit row, where the noun IS the
       collection. */
    expect(lips.slots).toEqual(["lips"]);
  });

  it("keeps two of one noun as two rows, never a union — two piercings are two rows (#2565 §6)", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [
        { noun: "piercing", kind: "accessory", on: "lips", instance: 1, x: 400, y: 700 },
        { noun: "piercing", kind: "accessory", on: "lips", instance: 2, x: 500, y: 700 },
      ],
    });
    const rows = sectionOf(panel, "accessories")!.rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.slots)).toEqual([["discovered:piercing#1"], ["discovered:piercing#2"]]);
    expect(rows.map((row) => row.cutouts[0]?.crop?.x)).toEqual([400, 500]);
  });

  it("keeps two body features of one noun as two children, never a union", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      found: [
        { noun: "dimple", kind: "anatomy", on: "lips", instance: 1, x: 400, y: 700 },
        { noun: "dimple", kind: "anatomy", on: "lips", instance: 2, x: 500, y: 700 },
      ],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances.map((one) => one.slot)).toEqual(["discovered:dimple#1", "discovered:dimple#2"]);
    expect(lips.instances.map((one) => one.cutout?.crop?.x)).toEqual([400, 500]);
  });

  it("folds under a FOUND row too, not only a catalogued one", () => {
    /* ⚠ The lodger read ~~`iris`~~ until #2840's second half: an iris is the
       ordinary body (`isPlainAnatomy`) and draws no row anywhere now, so it
       could no longer stand for "a thing folded under a found row". The arm's
       subject is the fold, so the lodger is a word that is not plain. */
    const panel = panelOf({
      found: [
        { noun: "third eye", kind: "anatomy", on: "forehead" },
        { noun: "veins", kind: "anatomy", on: "third eye" },
        { noun: "choker", kind: "accessory", on: "neck" },
        { noun: "chain", kind: "accessory", on: "choker" },
      ],
    });
    /* A body part lists under Face since #2801. */
    const open = sectionOf(panel, "face")!;
    expect(open.rows.map((row) => row.name)).toEqual(["Third eye"]);
    expect(open.rows[0]!.instances.map((one) => one.name)).toEqual(["Veins"]);
    /* A worn thing on a worn thing stays its child, in Accessories. */
    const accessories = sectionOf(panel, "accessories")!;
    expect(accessories.rows.map((row) => row.name)).toEqual(["Choker"]);
    expect(accessories.rows[0]!.instances.map((one) => one.name)).toEqual(["Chain"]);
  });

  it("never folds a worn thing under a FOUND body part either — a stud on a third eye is an accessory", () => {
    const panel = panelOf({
      found: [
        { noun: "third eye", kind: "anatomy", on: "forehead" },
        { noun: "stud", kind: "accessory", on: "third eye" },
      ],
    });
    const open = sectionOf(panel, "face")!;
    expect(open.rows.map((row) => row.name)).toEqual(["Third eye"]);
    expect(open.rows[0]!.instances).toEqual([]);
    expect(rowNames(panel, "accessories")).toEqual(["Stud"]);
  });

  /*
    ⚠ **NEVER SCOPABLE, AND THIS IS THE ARM THAT KEEPS A TAP FROM DEAD-ENDING.**
    `refineService`'s scope door answers `scope_unknown` on a `discovered:` key
    — driven at the code, `slotDefinition("discovered:lip-ring#1")` is null — so
    a child offering a narrow edit is a BAD_REQUEST on an affordance we drew.
    The catalogued sides in the same row are the positive control.
  */
  it("offers no narrow edit on a found child, and still offers one on a pair's sides", () => {
    const panel = panelOf({
      catalogued: ["ear@left", "ear@right"],
      found: [{ noun: "pointed tip", kind: "anatomy", on: "ear" }],
    });
    const ears = sectionOf(panel, "face")!.rows.find((row) => row.name === "Ears")!;
    expect(ears.instances.map((one) => ({ name: one.name, scopable: one.scopable }))).toEqual([
      { name: "Left ear", scopable: true },
      { name: "Right ear", scopable: true },
      { name: "Pointed tip", scopable: false },
    ]);
    expect(ears.regions.find((one) => one.name === "Pointed tip")!.scopable).toBe(false);
  });

  it("refuses a narrow edit on every piece of the outfit", () => {
    const panel = panelOf({
      found: [
        { noun: "coat", kind: "clothing" },
        { noun: "strap", kind: "accessory", on: "coat" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    expect(row.instances.every((one) => one.scopable === false)).toBe(true);
    expect(row.regions.every((one) => one.scopable === false)).toBe(true);
  });

  /*
    ⚠ **A CYCLE IS AN ANSWER AND NOT A HANG, and it is driven directly because
    a model that usually behaves is no test of a guard (working law 3).** A
    reading that answers `strap on=buckle` and `buckle on=strap` has said
    nothing about where either sits.
  */
  it("reads a cycle in the reading's own hosts as hostless", () => {
    const panel = panelOf({
      found: [
        { noun: "strap", kind: "accessory", on: "buckle" },
        { noun: "buckle", kind: "accessory", on: "strap" },
      ],
    });
    expect(rowNames(panel, "accessories")).toEqual(["Strap", "Buckle"]);
  });

  it("reads a thing that sits on itself as hostless", () => {
    const panel = panelOf({ found: [{ noun: "scales", kind: "marking", on: "scales" }] });
    expect(rowNames(panel, "open")).toEqual(["Scales"]);
  });

  it("invents no parent out of a host nothing drew — but hardware on an uncut garment is still the Outfit (#2801)", () => {
    /* `charm on=strap` where the strap itself could not be cut. The chain
       never FOLDS under it: a child of a thing with no picture would hang a
       visible row under an invisible one. ⚠ **Until #2801 the charm kept its
       own row here**, and that is the road that listed his creature's buckle
       and ring as accessories: the strap they sit on is on the robe by the
       reading's own word, so they are part of the outfit (his words: *"buckle
       and ring and just the strap across his chest apart of the outfit"*). */
    const panel = panelOf({
      found: [
        { noun: "robe", kind: "clothing" },
        { noun: "charm", kind: "accessory", on: "strap" },
      ],
      said: [{ noun: "strap", on: "robe", about: "frayed webbing", kind: "accessory", why: "uncut" }],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    /* Part of the one Outfit row — never a child of the strap nobody could
       draw. ⚠ It read ~~`["Robe", "Charm"]`~~, a piece with its own picture,
       until his word on trims (#2862): it is IN the outfit, by its slot, and
       draws no row of its own. */
    expect(row.instances.map((one) => one.name)).toEqual(["Robe"]);
    expect(row.slots).toContain("discovered:charm#1");
    expect(sectionOf(panel, "accessories")).toBeNull();
  });

  /* ---- rules 2 and 4: the words with no picture ---- */

  it("never writes a scattered worn thing's words onto the body row his ruling emptied of worn things", () => {
    const panel = panelOf({
      catalogued: ["ear@left", "ear@right"],
      said: [
        { noun: "ear piercings", on: "ear", about: "a row of small studs", kind: "accessory", why: "scattered" },
        { noun: "freckles", on: "ear", about: "a few freckles", kind: "marking", why: "scattered" },
      ],
    });
    const ears = sectionOf(panel, "face")!.rows.find((row) => row.name === "Ears")!;
    /* The positive control beside it: a mark's words still describe the skin
       of the part, which is the body. */
    expect(ears.words).toEqual(["a few freckles"]);
  });

  it("puts a scattered thing's words on the row it sits on", () => {
    /* The design's own worked example. */
    const panel = panelOf({
      catalogued: ["skin"],
      said: [{
        noun: "freckles",
        on: "skin",
        about: "a dusting of freckles across the nose and cheeks",
        kind: "marking",
        why: "scattered",
      }],
    });
    const skin = sectionOf(panel, "body")!.rows.find((row) => row.name === "Skin")!;
    expect(skin.words).toEqual(["a dusting of freckles across the nose and cheeks"]);
    /* No row of its own and no cut — the class his eye found is gone at source. */
    expect(sectionOf(panel, "open")).toBeNull();
  });

  it("writes no words for a thing whose detector call DROPPED either — identically (#2805)", () => {
    /*
      THE WHOLE OF WHAT THAT CARD CHANGES ON THIS SURFACE, WHICH IS NOTHING.

      `dropped` and `uncut` are told apart in the KEPT reading, because `uncut`
      asserts an ask that a dropped call never made. The panel's question is a
      different one — can any row carry these words — and the answer is no
      either way.

      ⚠ **THE SHAPE HERE IS THE SCATTERED-GARMENT ARM BELOW WITH ONE WORD
      CHANGED, AND THAT IS WHY IT IS THIS SHAPE.** The first draft of this arm
      used an accessory on a catalogued body row and asserted no words on it —
      and it passed with the branch DELETED, because `placedHomeOf` sends a worn
      thing off a body row to a row of its own anyway (his #2789 ruling). A
      scattered piece of clothing on a found garment is the one shape whose
      words demonstrably DO land somewhere, so it is the only shape on which
      skipping can be proven to be the thing that stopped them.
    */
    const panel = panelOf({
      found: [{ noun: "coat", kind: "clothing" }],
      said: [
        { noun: "leather patch", on: "coat", about: "leather patches at the elbows", kind: "clothing", why: "dropped" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    expect(row.words, "the words of a thing no call ever reached say nothing about the coat").toEqual([]);
    expect(row.instances.map((one) => one.name)).toEqual(["Coat"]);
  });

  it("puts a scattered piece of an outfit's words on the Outfit row", () => {
    /* Cast 2556: `leather patch` and `stitching`, both scattered, both on the
       coat. Neither is a child; both are words. */
    const panel = panelOf({
      found: [{ noun: "coat", kind: "clothing" }],
      said: [
        { noun: "leather patch", on: "coat", about: "leather patches at the elbows", kind: "clothing", why: "scattered" },
        { noun: "stitching", on: "coat", about: "rough visible stitching", kind: "marking", why: "scattered" },
      ],
    });
    const row = sectionOf(panel, "outfit")!.rows[0]!;
    expect(row.words).toEqual(["leather patches at the elbows", "rough visible stitching"]);
    expect(row.instances.map((one) => one.name)).toEqual(["Coat"]);
  });

  it("says the same thing once, however many crops reported it", () => {
    const panel = panelOf({
      catalogued: ["skin"],
      said: [
        { noun: "freckles", on: "skin", about: "a dusting across the nose", kind: "marking", why: "scattered" },
        { noun: "freckles", on: "face skin", about: "a dusting across the nose", kind: "marking", why: "scattered" },
      ],
    });
    const skin = sectionOf(panel, "body")!.rows.find((row) => row.name === "Skin")!;
    expect(skin.words).toEqual(["a dusting across the nose"]);
  });

  /*
    ⚠ **HIS RULING, AND IT IS THE ONE ENTRY THAT IS SKIPPED RATHER THAN
    ROUTED.** Makeup is something you change with words, not a thing in the
    list — so eyeliner on eyes must write no row AND no line onto the Eyes row,
    because a row's words line is a description of the feature the row IS.
  */
  it("writes no row and no words for makeup, wherever it sits", () => {
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right"],
      said: [{
        noun: "eye makeup",
        on: "eyes",
        about: "smoked black liner",
        kind: "makeup",
        why: "makeup",
      }],
    });
    expect(sectionOf(panel, "open")).toBeNull();
    const eyes = sectionOf(panel, "face")!.rows.find((row) => row.name === "Eyes")!;
    expect(eyes.words).toEqual([]);
  });

  it("writes no words for a thing it was asked about and could not draw", () => {
    /* What is missing is its OWN row, not a line on its host — and writing its
       words onto the host would describe the host with a sentence about
       something that is not drawn. The next edit to that area asks again. */
    const panel = panelOf({
      catalogued: ["lips"],
      said: [{ noun: "lip ring", on: "lips", about: "a thin steel hoop", kind: "accessory", why: "uncut" }],
    });
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.words).toEqual([]);
    expect(lips.instances).toEqual([]);
  });

  it("says nothing on the panel about a scattered thing nothing can carry", () => {
    const panel = panelOf({
      catalogued: ["lips"],
      said: [{ noun: "wrinkles", on: "face", about: "deep lines across the brow", kind: "marking", why: "scattered" }],
    });
    /* `face` is no row's noun, so there is nowhere honest to put it: it stays
       on the channel for the current description and the panel is silent. */
    const everyWord = panel.groups.flatMap((group) => group.rows.flatMap((row) => row.words));
    expect(everyWord).toEqual([]);
    expect(sectionOf(panel, "open")).toBeNull();
  });

  /* ---- the whole thing, on two real casts ---- */

  it("groups cast 2472's whole reading the way a person would describe it", () => {
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "skin", "teeth", "lips"],
      found: [
        /* ON THE FACE, and said in the geometry rather than only in the noun
           (#2840). The helper otherwise lays found boxes out on a diagonal far
           below the drawn face rows, which since #2840 is a real answer — a
           body part down there is a Body row. This cast's third eye is on its
           forehead and its jaw hardware is on its jaw, so the fixture places
           them there and the assertion below is the positive control. */
        { noun: "third eye", kind: "anatomy", on: "forehead", x: 15, y: 0 },
        { noun: "jaw hardware", kind: "anatomy", on: "jaw", x: 15, y: 40 },
        { noun: "neck hardware", kind: "accessory", on: "neck" },
        { noun: "scarf", kind: "clothing", on: "" },
        { noun: "shoulder armor", kind: "accessory", on: "shoulder" },
        { noun: "pendant", kind: "accessory", on: "robe" },
        { noun: "strap", kind: "accessory", on: "robe", instance: 1 },
        { noun: "charm", kind: "accessory", on: "strap", instance: 1 },
        { noun: "robe", kind: "clothing", on: "" },
      ],
      said: [{ noun: "wrinkles", on: "face", about: "deep lines", kind: "marking", why: "scattered" }],
    });
    /* ONE outfit row holding the scarf, the robe and everything hanging off
       it; two worn things that are not on the robe, as accessories (his ruling,
       #2789); and two things that are this character's own body. */
    const outfit = sectionOf(panel, "outfit")!.rows[0]!;
    /* ⚠ It read ~~`["Scarf", "Pendant", "Strap", "Charm", "Robe"]`~~ until his
       word on trims (#2862): the two garments are the pieces, and the three
       worn things hanging off the robe are still IN the outfit, by its slots. */
    expect(outfit.instances.map((one) => one.name)).toEqual(["Scarf", "Robe"]);
    for (const lodger of ["discovered:pendant#1", "discovered:strap#1", "discovered:charm#1"]) {
      expect(outfit.slots, lodger).toContain(lodger);
    }
    expect(rowNames(panel, "accessories")).toEqual(["Neck hardware", "Shoulder armor"]);
    /* Body parts list under Face since #2801 — and since #2840 that holds
       because they are ON the face, not because every body part lands there.
       Neither FOUND body part fell through to Body: the only row there is the
       catalogue's own Skin, which has always sat in that section. */
    expect(rowNames(panel, "face").slice(-2)).toEqual(["Third eye", "Jaw hardware"]);
    expect(rowNames(panel, "body")).toEqual(["Skin"]);
    expect(sectionOf(panel, "open")).toBeNull();
  });
  /* ---- #2840 / #2807 part 1: a body part lists where it actually IS ---- */

  /*
    His eye, rounds 9 and 10. Round 9's panel drew TWO rows both called
    Shoulders under FACE; round 10 drew a Collarbone there — *"no idea why
    collarbone is showing up?"*. #2807 part 1 named the day this would be
    built: *"a reading holding a body part the scan's face cuts do not touch
    is the day this becomes one branch plus one frame for his eye"*.

    The face these arms measure against is the one the HELPER draws:
    catalogued slots land at x 10+10n, y 20+10n, 50×40, so four face rows span
    x10–90, y20–90 — midline 50, middle row 55. A found box is 80×60 at
    x 100+100n, y 200+50n unless the arm places it. Nothing here is tuned; the
    allowances fall out of that span.
  */
  /*
    ⚠ **THE FOUR ARMS BELOW WERE WRITTEN ON A COLLARBONE AND A PAIR OF
    SHOULDERS, AND SINCE #2840's SECOND HALF THOSE ARE NO ROWS AT ALL** — his
    word of 2026-10-30: *no* to collarbone and shoulders being rows, *yes* to a
    Body section for real features. Each arm keeps its subject (WHERE a found
    body part lists) and now carries a real feature off the face: his lizard's
    tail, a cyborg's neck implant, a pair of wings. The old fixture is struck in
    each, and the plain-anatomy rule has its own block further down.
  */
  it("lists a found body part that is not on the face under Body, not Face", () => {
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "teeth", "lips"],
      /* ~~`collarbone`~~ — plain anatomy since #2840's second half. */
      found: [{ noun: "tail", kind: "anatomy", on: "" }],
    });
    /* The face section holds the face and nothing else. */
    expect(rowNames(panel, "face")).toEqual(["Eyes", "Lips", "Teeth"]);
    expect(rowNames(panel, "body")).toEqual(["Tail"]);
  });
  it("sends a body part DIRECTLY below the face to Body, where only the down axis can decide", () => {
    /* The arm the first one cannot be: a ~~collarbone~~ neck implant sits under
       the chin, so it is well within the face's span ACROSS (centre x 50, the
       face's own midline) and outside it only DOWN. Without this, a rule that
       had quietly lost its vertical half would still pass every arm above,
       because a box on the helper's default diagonal is outside the face on
       both axes at once. */
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "teeth", "lips"],
      found: [{ noun: "neck implant", kind: "anatomy", on: "", x: 10, y: 170 }],
    });
    expect(rowNames(panel, "face")).toEqual(["Eyes", "Lips", "Teeth"]);
    expect(rowNames(panel, "body")).toEqual(["Neck implant"]);
  });

  it("draws a pair of found body parts under Body rather than twice under Face", () => {
    /* ~~his round-9 pair of Shoulders~~ — plain anatomy since #2840's second
       half, and drawn nowhere now (the block further down holds that). The
       subject here is a PAIR's placement, so the pair is a real one. */
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "teeth", "lips"],
      found: [
        { noun: "wings", kind: "anatomy", on: "", instance: 1 },
        { noun: "wings", kind: "anatomy", on: "", instance: 2 },
      ],
    });
    expect(rowNames(panel, "face")).toEqual(["Eyes", "Lips", "Teeth"]);
    /* Still two rows — two of one found noun are two items (#2565 §6), and
       whether a real pair draws as one row is not decided here. */
    expect(rowNames(panel, "body")).toEqual(["Wings", "Wings"]);
  });

  it("keeps a body part that IS on the face under Face", () => {
    /* The positive control, and the reason the rule reads place rather than
       the noun: a third eye is as much a body part as a collarbone. Centre
       (50, 55) is the middle of the drawn face. */
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "teeth", "lips"],
      found: [{ noun: "third eye", kind: "anatomy", on: "forehead", x: 10, y: 25 }],
    });
    expect(rowNames(panel, "face")).toEqual(["Eyes", "Lips", "Teeth", "Third eye"]);
    expect(sectionOf(panel, "body")).toBeNull();
  });

  it("leaves every body part under Face when the scan drew no face row to measure against", () => {
    /* The fail-safe: a missing measurement never moves a row, so a scan with
       nothing of the face cut behaves exactly as the panel did before #2840.
       The catalogue puts `skin` in its BODY group, so this cast has no face
       span at all. */
    const panel = panelOf({
      catalogued: ["skin"],
      /* ~~`collarbone`~~ — plain anatomy since #2840's second half. */
      found: [{ noun: "tail", kind: "anatomy", on: "" }],
    });
    expect(rowNames(panel, "face")).toEqual(["Tail"]);
    expect(rowNames(panel, "body")).toEqual(["Skin"]);
  });

  it("routes by place only for the body — a worn thing and a mark are unmoved", () => {
    /* His #2789 placement ruling is untouched: the branch added here is inside
       the anatomy arm, so an accessory and a marking in the very same place
       still land where that ruling put them. */
    const panel = panelOf({
      catalogued: ["eye@left", "eye@right", "teeth", "lips"],
      found: [
        { noun: "shoulder armor", kind: "accessory", on: "" },
        { noun: "tattoo", kind: "marking", on: "" },
      ],
    });
    expect(rowNames(panel, "accessories")).toEqual(["Shoulder armor"]);
    expect(rowNames(panel, "open")).toEqual(["Tattoo"]);
    expect(sectionOf(panel, "body")).toBeNull();
  });

  /*
    ⚠ **THE CONTROL THAT PROVES THE OLD PANEL IS STILL REACHABLE, and it is the
    kept-row case rather than a hypothetical**: a reading written between slice
    2's two landings has `discovered` and neither fact, and `keptFaceScan`
    restores it as a hostless `anatomy`. Every found thing is then a top-level
    sibling — under Face since #2801, where a body part lists (until then *Also
    on this character*, byte for byte where it was drawn before the grouping).
  */
  it("CONTROL — a reading with no grouping facts draws exactly the old panel", () => {
    const panel = panelOf({
      found: [
        { noun: "jacket", kind: "anatomy" },
        { noun: "sash", kind: "anatomy" },
        { noun: "neck tattoo", kind: "anatomy" },
      ],
    });
    expect(sectionOf(panel, "outfit")).toBeNull();
    expect(rowNames(panel, "face")).toEqual(["Jacket", "Sash", "Neck tattoo"]);
    for (const row of sectionOf(panel, "face")!.rows) {
      expect(row.instances).toEqual([]);
      expect(row.regions).toHaveLength(1);
    }
  });
});

/**
 * HIS EYE ON THE LIVE GROUPING, ROUND 2 (#2752, 2026-10-29), verbatim: *"its
 * still picking up build, build runs in words alone remember and same with skin
 * not neccesary to pick up"*.
 *
 * The fixture is shaped like his panel: the scan located a build region and a
 * face-skin region and described both — exactly what drew *Build: narrow-
 * shouldered, slender frame under heavy layered jacket* and *Skin: fair and
 * even* on his screen.
 */
describe("build and skin are words alone on the discovery road", () => {
  const frame = { width: 1000, height: 1500 };
  const reading = (over: {
    discovering?: boolean;
    scanning?: boolean;
    ink?: PanelInkWorn[];
    said?: NamedNotCut[];
    found?: { noun: string; kind: FeatureKind; on: string }[];
  } = {}) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map<FeatureSlot, { box: PanelBox; maskUrl: string }>([
        ["build", { box: { x: 100, y: 700, width: 800, height: 800, frame }, maskUrl: "data:image/png;base64,build" }],
        ["skin", { box: { x: 300, y: 300, width: 400, height: 500, frame }, maskUrl: "data:image/png;base64,skin" }],
        ["nose", { box: { x: 450, y: 500, width: 100, height: 120, frame }, maskUrl: "data:image/png;base64,nose" }],
      ]),
      words: new Map<FeatureSlot, readonly string[]>([
        ["build", ["narrow-shouldered, slender frame under heavy layered jacket"]],
        ["skin", ["fair and even, a slight sheen at the collarbone"]],
      ]),
      discovered: (over.found ?? []).map((one, at) => ({
        slot: `discovered:${one.noun.replace(/[^a-z0-9]+/g, "-")}#1` as FeatureSlot,
        noun: one.noun,
        instance: 1,
        kind: one.kind,
        on: one.on,
        box: { x: 100 + at * 120, y: 900, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
      })),
      namedNotCut: over.said ?? [],
    },
    ...(over.ink === undefined ? {} : { ink: over.ink }),
    ...(over.scanning === undefined ? {} : { scanning: over.scanning }),
    ...(over.discovering === undefined ? {} : { discovering: over.discovering }),
  });
  const names = (built: ReturnType<typeof facePanel>) =>
    built.groups.flatMap((group) => group.rows.map((row) => row.name));

  it("⚠ POSITIVE CONTROL — off the discovery road, the same reading draws both rows with their words", () => {
    /* Without this arm the next one passes against a fixture that could never
       draw a Build or Skin row at all. */
    const body = reading().groups.find((group) => group.group === "body");
    expect(body?.rows.map((row) => [row.name, row.words])).toEqual([
      ["Build", ["narrow-shouldered, slender frame under heavy layered jacket"]],
      ["Skin", ["fair and even, a slight sheen at the collarbone"]],
    ]);
  });

  it("on the discovery road, the panel draws no Build row and no Skin row — and the Body heading goes with them", () => {
    const built = reading({ discovering: true });
    expect(names(built)).not.toContain("Build");
    expect(names(built)).not.toContain("Skin");
    expect(built.groups.find((group) => group.group === "body")).toBeUndefined();
    /* Everything else the reading found is exactly where it was. */
    expect(names(built)).toContain("Nose");
  });

  it("holds while the reading runs, too — never a Build or Skin row, settled or in flight", () => {
    expect(names(reading({ discovering: true, scanning: true }))).not.toContain("Build");
    expect(names(reading({ discovering: true, scanning: true }))).not.toContain("Skin");
  });

  it("⚠ keeps a delivered TATTOO in the Body section — the rule is per slot, never the group", () => {
    /* `ink:neck` lives in the body group, and he asked for it by name (*"i dont
       see his neck tatto on the feature panel?"*). A rule that hid the Body
       SECTION on this road would have taken it with build and skin — measured:
       that sabotage reddens this arm. (Keying the catalogue loop's skip on the
       group instead cannot reach it at all — ink rows are built beside that
       loop, not in it — so that form is inert and proves nothing.) */
    const body = reading({ discovering: true, ink: [worn()] }).groups.find((group) => group.group === "body");
    expect(body?.rows.map((row) => row.name)).toEqual(["Neck tattoo"]);
  });

  it("only build and skin carry the ruling — derived from the catalogue, never a list here", () => {
    expect(catalogueSlots().filter((one) => one.noRowOnDiscovery !== undefined).map((one) => one.slot))
      .toEqual(["build", "skin"]);
  });

  it("the ask still has somewhere to land: the build slot and its five facets are untouched", () => {
    /* *"a build ask still works in words, exactly as it does now"* — the ask
       files to the SLOT, and nothing about an ask reads the panel. */
    expect(slotDefinition("build" as FeatureSlot)?.noun).toBe("build");
    expect(catalogueSlots().find((one) => one.slot === "build")).toBeDefined();
    expect(catalogueSlots().find((one) => one.slot === "skin")).toBeDefined();
  });

  /* ---- the knock-on he was told about: freckles have no Skin row to sit on ---- */

  it("CONTROL — off the road, freckles on skin say their words on the Skin row", () => {
    const skin = reading({
      said: [{ noun: "freckles", on: "skin", about: "a dusting across the nose", kind: "marking", why: "scattered" }],
    }).groups.flatMap((group) => group.rows).find((row) => row.name === "Skin");
    expect(skin?.words).toContain("a dusting across the nose");
  });

  it("on the road, freckles on skin are on NO row — and are not dropped: the reading still carries them", () => {
    const said: NamedNotCut[] = [
      { noun: "freckles", on: "skin", about: "a dusting across the nose", kind: "marking", why: "scattered" },
    ];
    const built = reading({ discovering: true, said });
    const everyWord = built.groups.flatMap((group) => group.rows.flatMap((row) => [
      ...row.words,
      ...row.instances.flatMap((one) => one.words),
    ]));
    expect(everyWord).not.toContain("a dusting across the nose");
    /* The panel is a projection: it reads the channel and never empties it, so
       what the scan KEEPS (`keptFaceScan`'s `namedNotCut`) still has them. */
    expect(said).toHaveLength(1);
    expect(said[0]!.about).toBe("a dusting across the nose");
  });

  it("a found thing sitting on skin keeps its own row rather than folding under a row that is not there", () => {
    const built = reading({ discovering: true, found: [{ noun: "mole", kind: "marking", on: "skin" }] });
    const open = built.groups.find((group) => group.group === "open");
    expect(open?.rows.map((row) => row.name)).toEqual(["Mole"]);
  });
});

/**
 * ⚠ ANATOMY NEVER ENTERS THE OUTFIT, BY ANY ROAD (#2752's sweep of his round-1
 * ⚠). The kind rule kept body hardware out of the Outfit and the `on` chain let
 * it back in: `jaw hardware on=collar`, the collar read as clothing.
 */
describe("body hardware never reaches the Outfit through what it sits on", () => {
  const frame = { width: 1000, height: 1500 };
  const panelWith = (found: { noun: string; kind: FeatureKind; on: string }[]) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map(),
      discovered: found.map((one, at) => ({
        slot: `discovered:${one.noun.replace(/[^a-z0-9]+/g, "-")}#1` as FeatureSlot,
        noun: one.noun,
        instance: 1,
        kind: one.kind,
        on: one.on,
        box: { x: 100 + at * 120, y: 900, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
      })),
    },
  });
  const section = (built: FacePanel, group: string) => built.groups.find((one) => one.group === group) ?? null;

  it("CONTROL — an accessory on the collar follows the collar into the Outfit", () => {
    const built = panelWith([
      { noun: "collar", kind: "clothing", on: "" },
      { noun: "pin", kind: "accessory", on: "collar" },
    ]);
    /* ⚠ It read ~~`["Collar", "Pin"]`~~ until #2862: the pin is in the outfit
       by its slot and draws no piece row (his word on trims). */
    const outfit = section(built, "outfit")!.rows[0]!;
    expect(outfit.instances.map((one) => one.name)).toEqual(["Collar"]);
    expect(outfit.slots).toContain("discovered:pin#1");
    expect(section(built, "accessories")).toBeNull();
  });

  it("⚠ jaw hardware sitting on the collar keeps its own row", () => {
    const built = panelWith([
      { noun: "collar", kind: "clothing", on: "" },
      { noun: "jaw hardware", kind: "anatomy", on: "collar" },
    ]);
    expect(section(built, "outfit")!.rows[0]!.instances.map((one) => one.name)).toEqual(["Collar"]);
    expect(section(built, "face")!.rows.map((row) => row.name)).toEqual(["Jaw hardware"]);
  });

  it("⚠ and two hops away too — hardware on a strap on a jacket", () => {
    const built = panelWith([
      { noun: "jacket", kind: "clothing", on: "" },
      { noun: "strap", kind: "accessory", on: "jacket" },
      { noun: "neck implant", kind: "anatomy", on: "strap" },
    ]);
    /* ⚠ It read ~~`["Jacket", "Strap"]`~~ until #2862 (garments only). The
       arm's subject is now read where the outfit carries its members: the strap
       is in the row's slots and the implant is not. */
    const outfit = section(built, "outfit")!.rows[0]!;
    expect(outfit.instances.map((one) => one.name)).toEqual(["Jacket"]);
    expect(outfit.slots).toContain("discovered:strap#1");
    expect(outfit.slots).not.toContain("discovered:neck-implant#1");
    expect(section(built, "face")!.rows.map((row) => row.name)).toEqual(["Neck implant"]);
  });

  it("and what sits on the hardware does not follow the collar into the outfit either", () => {
    const built = panelWith([
      { noun: "collar", kind: "clothing", on: "" },
      { noun: "jaw hardware", kind: "anatomy", on: "collar" },
      { noun: "stud", kind: "accessory", on: "jaw hardware" },
      { noun: "ridge", kind: "anatomy", on: "jaw hardware" },
    ]);
    expect(section(built, "outfit")!.rows[0]!.instances.map((one) => one.name)).toEqual(["Collar"]);
    /* Body on the hardware stays with the hardware; a worn stud on it is an
       accessory, never folded under a body part (his ruling, #2789). */
    const hardware = section(built, "face")!.rows.find((row) => row.name === "Jaw hardware")!;
    expect(hardware.instances.map((one) => one.name)).toEqual(["Ridge"]);
    expect(section(built, "accessories")!.rows.map((row) => row.name)).toEqual(["Stud"]);
  });
});

describe("his first creature — tusks, a strap's hardware, and where a body part lists (#2801)", () => {
  const frame = { width: 1024, height: 1536 };
  const panelWith = (input: {
    catalogued?: string[];
    found: { noun: string; kind: "anatomy" | "clothing" | "accessory" | "marking"; on: string }[];
    said?: { noun: string; on: string; about: string; kind: "anatomy" | "clothing" | "accessory" | "marking"; why: "scattered" | "uncut" }[];
  }): FacePanel => facePanel({
    rows: [],
    pronouns: { subject: "they", object: "them", possessive: "their", plural: true },
    contentUrl: (key: string) => key,
    maskUrl: (key: string) => key,
    discovering: true,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map((input.catalogued ?? []).map((slot, at) => [slot as never, {
        box: { x: 100 + at * 90, y: 500, width: 60, height: 40, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }])) as never,
      words: new Map(),
      absent: new Set(),
      discovered: input.found.map((one, at) => ({
        slot: `discovered:${one.noun.replace(/ /g, "-")}#1` as never,
        noun: one.noun,
        instance: 1,
        kind: one.kind,
        on: one.on,
        box: { x: 600 + at * 50, y: 900, width: 40, height: 40, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
      })),
      namedNotCut: input.said ?? [],
    } as never,
  } as never);
  const names = (built: FacePanel, group: string) =>
    built.groups.find((one) => one.group === group)?.rows.map((row) => row.name) ?? [];

  it("the second tusk, sitting on the Teeth row, is inside that one row — never its own row", () => {
    const built = panelWith({ catalogued: ["teeth"], found: [{ noun: "tusks", kind: "anatomy", on: "teeth" }] });
    const teeth = built.groups.find((one) => one.group === "face")!.rows.find((row) => row.name === "Teeth")!;
    expect(teeth.instances.map((one) => one.name)).toEqual(["Tusks"]);
    /* Hovering the one row outlines both tusks. */
    expect(teeth.regions).toHaveLength(2);
    expect(names(built, "face").filter((name) => name === "Tusks")).toEqual([]);
    expect(names(built, "open")).toEqual([]);
  });

  it("a found body part with its own row lists under Face; a mark stays in Also on this character", () => {
    const built = panelWith({
      found: [
        { noun: "tusks", kind: "anatomy", on: "mouth" },
        { noun: "scar", kind: "marking", on: "chest" },
      ],
    });
    expect(names(built, "face")).toEqual(["Tusks"]);
    expect(names(built, "open")).toEqual(["Scar"]);
  });

  it("a buckle and a ring on a strap nothing could cut are part of the Outfit, not accessories", () => {
    const built = panelWith({
      found: [
        { noun: "scarf", kind: "clothing", on: "" },
        { noun: "buckle", kind: "accessory", on: "harness" },
        { noun: "ring", kind: "accessory", on: "harness" },
      ],
      said: [{ noun: "harness", on: "chest", about: "a leather strap", kind: "clothing", why: "uncut" }],
    });
    /* ⚠ It read ~~`["Scarf", "Buckle", "Ring"]`~~ until his word on trims
       (#2862): the buckle and the ring are in the outfit by its slots, and the
       scarf is the one piece row. */
    const outfit = built.groups.find((one) => one.group === "outfit")!.rows[0]!;
    expect(outfit.instances.map((one) => one.name)).toEqual(["Scarf"]);
    expect(outfit.slots).toEqual(["discovered:outfit", "discovered:scarf#1", "discovered:buckle#1", "discovered:ring#1"]);
    expect(names(built, "accessories")).toEqual([]);
  });

  it("CONTROL — a worn thing on an uncut host that is NOT a garment stays an accessory", () => {
    const built = panelWith({
      found: [{ noun: "charm", kind: "accessory", on: "cord" }],
      said: [{ noun: "cord", on: "neck", about: "a thin cord", kind: "accessory", why: "uncut" }],
    });
    expect(names(built, "accessories")).toEqual(["Charm"]);
    expect(built.groups.find((one) => one.group === "outfit")).toBeUndefined();
  });

  it("CONTROL — a body part on an uncut garment never enters the Outfit (his round-1 ⚠)", () => {
    const built = panelWith({
      found: [{ noun: "neck implant", kind: "anatomy", on: "harness" }],
      said: [{ noun: "harness", on: "", about: "a strap", kind: "clothing", why: "uncut" }],
    });
    expect(names(built, "face")).toEqual(["Neck implant"]);
    expect(built.groups.find((one) => one.group === "outfit")).toBeUndefined();
  });
});

/**
 * ONE THING, ONE ROW — his ruling on #2862, and the two facts his eye added on
 * round 11, the first round on the new box engine (2026-10-31).
 *
 * Hair, verbatim: *"why is the hair compartmantizilied? even if i make an edit
 * to her right bun by selecting it (i tested this) it edits her whole hair
 * anyway. Should hair just be one whole box?"* The chain: *"it thought the
 * chain which is apart of her outfit was a necklace"*. Trims, answering the
 * relay's recommendation of garments only: *"on your question about
 * drawstrings yes"*.
 *
 * ⚠ Every rule here has a CONTROL beside it that says what must NOT move,
 * because the hair rule reads in a diff exactly like a breach of the
 * two-instance rule (#2565 §6), and a rule that folds too much is the same
 * failure as one that folds too little, pointed the other way.
 */
describe("one thing, one row — hair holds no parts, and only a garment is a piece of the outfit (#2862)", () => {
  const frame = { width: 1000, height: 1500 };
  type Found = { noun: string; kind: FeatureKind; on?: string; instance?: number; x?: number; y?: number };
  const panelOf = (input: {
    found?: readonly Found[];
    catalogued?: readonly string[];
    said?: readonly NamedNotCut[];
    absent?: readonly string[];
  }) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    discovering: true,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map((input.catalogued ?? []).map((slot, at) => [slot as FeatureSlot, {
        box: { x: 10 + at * 10, y: 20 + at * 10, width: 50, height: 40, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }])),
      ...(input.absent === undefined ? {} : { absent: new Set(input.absent as FeatureSlot[]) }),
      discovered: (input.found ?? []).map((one, at) => ({
        slot: `discovered:${one.noun.replace(/[^a-z0-9]+/g, "-")}#${one.instance ?? 1}` as FeatureSlot,
        noun: one.noun,
        instance: one.instance ?? 1,
        kind: one.kind,
        on: one.on ?? "",
        box: { x: one.x ?? 100 + at * 100, y: one.y ?? 200 + at * 50, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
      })),
      namedNotCut: input.said ?? [],
    },
  });
  const sectionOf = (panel: FacePanel, group: string) =>
    panel.groups.find((one) => one.group === group) ?? null;
  const rowNames = (panel: FacePanel, group: string) =>
    (sectionOf(panel, group)?.rows ?? []).map((row) => row.name);
  const everyName = (panel: FacePanel) => panel.groups.flatMap((group) => group.rows.flatMap((row) => [
    row.name,
    ...row.instances.map((one) => one.name),
    ...row.regions.map((one) => one.name).filter((name): name is string => name !== null),
  ]));
  /* His round-10 reading of her hair, as the pointer road kept it
     (`relay-r10eye/reading-a1.json`): two buns, both `anatomy` `on: hair`. */
  const HER_BUNS: readonly Found[] = [
    { noun: "buns", kind: "anatomy", on: "hair", instance: 1, x: 605, y: 35 },
    { noun: "buns", kind: "anatomy", on: "hair", instance: 2, x: 203, y: 29 },
  ];

  /* ---- rule 1: hair is ONE row and ONE outline ---- */

  it("hair is ONE row and ONE outline — her buns and her fringe draw no child and no rectangle", () => {
    const panel = panelOf({
      catalogued: ["hair"],
      found: [...HER_BUNS, { noun: "fringe", kind: "anatomy", on: "hair", x: 380, y: 160 }],
    });
    expect(panel.groups.map((one) => one.group)).toEqual(["hair"]);
    const hair = sectionOf(panel, "hair")!.rows[0]!;
    expect(hair.name).toBe("Hair");
    expect(hair.instances).toEqual([]);
    /* The one outline is the scan's own cut of the hair — the catalogue slot's
       rectangle, unnamed, and nothing beside it. */
    expect(hair.regions.map((one) => [one.slot, one.name])).toEqual([["hair", null]]);
    /* Tapping it is still an ask about the hair and nothing narrower. */
    expect(hair.slots).toEqual(["hair"]);
    expect(everyName(panel).filter((name) => /bun|fringe/i.test(name))).toEqual([]);
  });

  it("the noun wandering between his scans changes nothing on the panel — fringe on one, bangs on the next", () => {
    const fringe = panelOf({ catalogued: ["hair"], found: [{ noun: "fringe", kind: "anatomy", on: "hair" }] });
    const bangs = panelOf({ catalogued: ["hair"], found: [{ noun: "bangs", kind: "anatomy", on: "hair" }] });
    expect(bangs.groups).toEqual(fringe.groups);
    /* Not vacuous: the reading DID find a part on each scan, and the row is there. */
    expect(rowNames(fringe, "hair")).toEqual(["Hair"]);
  });

  it("when the scan cut no hair but the reading cut its parts, the ONE row gets ONE outline — never deleted, never bald", () => {
    const panel = panelOf({ found: HER_BUNS, absent: ["hair"] });
    const hair = sectionOf(panel, "hair")!.rows[0]!;
    expect(hair.instances).toEqual([]);
    /* The union of the two buns' boxes: x 203..685, y 29..95. */
    expect(hair.regions.map((one) => one.box)).toEqual([{ x: 203, y: 29, width: 482, height: 66, frame }]);
    expect(hair.regions[0]!.slot).toBe("hair");
    /* A window on the frame, no stencil — the Outfit row's own shape. */
    expect(hair.cutouts).toEqual([{
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: null,
      crop: { x: 203, y: 29, width: 482, height: 66, frame },
    }]);
    /* The scan said it found no hair; a row outlining two buns may not say
       *bald* over them. */
    expect(hair.absent).toBeNull();
  });

  it("CONTROL — with no hair cut and no parts, a bald read still says bald", () => {
    /* The arm above is only evidence if `absent` would otherwise have been set
       on this very fixture. */
    const panel = panelOf({ absent: ["hair"] });
    expect(sectionOf(panel, "hair")!.rows[0]!.absent).toBe("bald");
  });

  it("facial hair holds no parts either — the one sibling the sweep took in", () => {
    const panel = panelOf({
      catalogued: ["facial-hair"],
      found: [{ noun: "goatee", kind: "anatomy", on: "facial hair" }],
    });
    const beard = sectionOf(panel, "hair")!.rows.find((row) => row.name === "Facial hair")!;
    expect(beard.instances).toEqual([]);
    expect(beard.regions.map((one) => one.slot)).toEqual(["facial-hair"]);
  });

  it("CONTROL — the horns share the Hair heading and still take a found child: a pair is the two-instance rule's own population", () => {
    const panel = panelOf({
      catalogued: ["horns@left", "horns@right"],
      found: [{ noun: "ridges", kind: "anatomy", on: "horns" }],
    });
    const horns = sectionOf(panel, "hair")!.rows.find((row) => row.name === "Horns")!;
    expect(horns.instances.map((one) => one.name)).toEqual(["Left horn", "Right horn", "Ridges"]);
    expect(horns.regions.map((one) => one.name)).toContain("Ridges");
  });

  it("CONTROL — the two-instance rule is untouched beside her buns: two earrings, two piercings, two dimples still list as two", () => {
    const panel = panelOf({
      catalogued: ["hair", "lips", "earring@left", "earring@right", "ear@left", "ear@right"],
      found: [
        ...HER_BUNS,
        { noun: "dimple", kind: "anatomy", on: "lips", instance: 1, x: 400, y: 700 },
        { noun: "dimple", kind: "anatomy", on: "lips", instance: 2, x: 500, y: 700 },
        { noun: "piercing", kind: "accessory", on: "lips", instance: 1, x: 420, y: 720 },
        { noun: "piercing", kind: "accessory", on: "lips", instance: 2, x: 520, y: 720 },
        { noun: "hoop earring", kind: "accessory", on: "ear", instance: 1, x: 250, y: 500 },
        { noun: "hoop earring", kind: "accessory", on: "ear", instance: 2, x: 700, y: 500 },
      ],
    });
    /* The hair rule held on this very panel — so the arms below are not passing
       because nothing folded at all. */
    expect(sectionOf(panel, "hair")!.rows[0]!.instances).toEqual([]);
    /* Two dimples on Lips: two children, two cuts, never a union. */
    const lips = sectionOf(panel, "face")!.rows.find((row) => row.name === "Lips")!;
    expect(lips.instances.map((one) => one.slot)).toEqual(["discovered:dimple#1", "discovered:dimple#2"]);
    /* The catalogue's pair: one row, its two sides as two children and two
       rectangles. */
    const earrings = sectionOf(panel, "accessories")!.rows.find((row) => row.name === "Earrings")!;
    expect(earrings.instances.map((one) => one.name)).toEqual(["Left earring", "Right earring"]);
    expect(earrings.regions).toHaveLength(2);
    /* And two of one found worn noun are two rows each, never one. */
    expect(rowNames(panel, "accessories")).toEqual(["Earrings", "Piercing", "Piercing", "Hoop earring", "Hoop earring"]);
  });

  /* ---- rules 2 and 3: a thing on a garment is in the Outfit; only garments are pieces ---- */

  it("his round-11 chain on her harness is inside the Outfit, and has no row anywhere", () => {
    const panel = panelOf({
      found: [
        { noun: "harness", kind: "clothing", on: "" },
        { noun: "chain", kind: "accessory", on: "harness" },
      ],
    });
    expect(panel.groups.map((one) => one.group)).toEqual(["outfit"]);
    const outfit = sectionOf(panel, "outfit")!.rows[0]!;
    expect(outfit.instances.map((one) => one.name)).toEqual(["Harness"]);
    expect(outfit.regions.map((one) => one.name)).toEqual([null, "Harness"]);
    /* IN the outfit: tapping Outfit is an ask about all of it, chain and all. */
    expect(outfit.slots).toEqual(["discovered:outfit", "discovered:harness#1", "discovered:chain#1"]);
    expect(everyName(panel)).not.toContain("Chain");
  });

  it("trims get no row — drawstrings, a zip, a buckle and studs ride inside the Outfit; the garments are the pieces", () => {
    const panel = panelOf({
      found: [
        { noun: "hoodie", kind: "clothing" },
        { noun: "drawstrings", kind: "accessory", on: "hoodie" },
        { noun: "zip", kind: "accessory", on: "hoodie" },
        { noun: "belt", kind: "clothing" },
        { noun: "buckle", kind: "accessory", on: "belt" },
        { noun: "studs", kind: "accessory", on: "belt" },
      ],
    });
    const outfit = sectionOf(panel, "outfit")!.rows[0]!;
    expect(outfit.instances.map((one) => one.name)).toEqual(["Hoodie", "Belt"]);
    expect(outfit.regions.filter((one) => !one.whole).map((one) => one.name)).toEqual(["Hoodie", "Belt"]);
    expect(outfit.slots).toHaveLength(7);
    expect(sectionOf(panel, "accessories")).toBeNull();
  });

  it("the outline and the thumbnail are the garments' — a chain hanging past the harness does not stretch them", () => {
    const panel = panelOf({
      found: [
        { noun: "harness", kind: "clothing", x: 100, y: 200 },
        { noun: "chain", kind: "accessory", on: "harness", x: 600, y: 900 },
      ],
    });
    const outfit = sectionOf(panel, "outfit")!.rows[0]!;
    const harness = { x: 100, y: 200, width: 80, height: 60, frame };
    expect(outfit.regions.find((one) => one.whole)!.box).toEqual(harness);
    expect(outfit.cutouts[0]!.crop).toEqual(harness);
  });

  it("no garment cut, no Outfit row — a buckle on a harness nothing could cut is never outlined as the outfit", () => {
    const panel = panelOf({
      found: [{ noun: "buckle", kind: "accessory", on: "harness" }],
      said: [{ noun: "harness", on: "", about: "black leather straps", kind: "clothing", why: "uncut" }],
    });
    expect(sectionOf(panel, "outfit")).toBeNull();
    /* And it is not thrown into Accessories instead: it is the outfit's, and it
       is changed by words. */
    expect(sectionOf(panel, "accessories")).toBeNull();
    expect(panel.groups).toEqual([]);
  });

  it("CONTROL — the line is the reading's kind, never the noun: a drawstring the reading calls clothing is still a piece (declared)", () => {
    const panel = panelOf({
      found: [
        { noun: "hoodie", kind: "clothing" },
        { noun: "drawstrings", kind: "clothing", on: "hoodie" },
      ],
    });
    expect(sectionOf(panel, "outfit")!.rows[0]!.instances.map((one) => one.name)).toEqual(["Hoodie", "Drawstrings"]);
  });

  it("CONTROL — a worn thing on a worn thing is untouched: a chain on her choker is still its child in Accessories", () => {
    const panel = panelOf({
      found: [
        { noun: "choker", kind: "accessory", on: "neck" },
        { noun: "chain", kind: "accessory", on: "choker" },
      ],
    });
    const choker = sectionOf(panel, "accessories")!.rows.find((row) => row.name === "Choker")!;
    expect(choker.instances.map((one) => one.name)).toEqual(["Chain"]);
    expect(sectionOf(panel, "outfit")).toBeNull();
  });
});

/**
 * THE ORDINARY BODY IS NOT A FEATURE — #2840's second half, his word of
 * 2026-10-30.
 *
 * His eye: *"no idea why collarbone is showing up?"* (round 10) and *"Her
 * shoulders were picked up randomly no idea why."* (round 11). The relay
 * recommended and he agreed: **yes** to a Body section for real non-face
 * features (a tail, wings, an implant off the face), **no** to collarbone and
 * shoulders being rows at all. Marks ON a shoulder still list.
 *
 * ⚠ Every arm that says *no row* has a control beside it on the SAME fixture
 * shape that says *a row* — an arm that passes because the helper draws
 * nothing would otherwise read exactly like the rule working.
 */
describe("the ordinary body is not a feature — a collarbone or a shoulder draws no row (#2840)", () => {
  const frame = { width: 1000, height: 1500 };
  type Found = { noun: string; kind: FeatureKind; on?: string; instance?: number; x?: number; y?: number };
  const panelOf = (input: { found?: readonly Found[]; catalogued?: readonly string[] }) => facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `/api/image-proxy?url=${encodeURIComponent(`https://bucket.example/${key}`)}`,
    discovering: true,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map((input.catalogued ?? []).map((slot, at) => [slot as FeatureSlot, {
        box: { x: 10 + at * 10, y: 20 + at * 10, width: 50, height: 40, frame },
        maskUrl: `data:image/png;base64,${slot}`,
      }])),
      discovered: (input.found ?? []).map((one, at) => ({
        slot: `discovered:${one.noun.replace(/[^a-z0-9]+/g, "-")}#${one.instance ?? 1}` as FeatureSlot,
        noun: one.noun,
        instance: one.instance ?? 1,
        kind: one.kind,
        on: one.on ?? "",
        box: { x: one.x ?? 100 + at * 100, y: one.y ?? 200 + at * 50, width: 80, height: 60, frame },
        maskUrl: `data:image/png;base64,${one.noun}`,
      })),
      namedNotCut: [],
    },
  });
  const sectionOf = (panel: FacePanel, group: string) =>
    panel.groups.find((one) => one.group === group) ?? null;
  const rowNames = (panel: FacePanel, group: string) =>
    (sectionOf(panel, group)?.rows ?? []).map((row) => row.name);
  /* Every name the panel carries anywhere — a row, a child, a rectangle — and
     every slot a tap could send, so "no row" cannot hide in a corner. */
  const everyName = (panel: FacePanel) => panel.groups.flatMap((group) => group.rows.flatMap((row) => [
    row.name,
    ...row.instances.map((one) => one.name),
    ...row.regions.map((one) => one.name).filter((name): name is string => name !== null),
  ]));
  const everySlot = (panel: FacePanel) => panel.groups.flatMap((group) => group.rows.flatMap((row) => [
    ...row.slots,
    ...row.regions.map((one) => one.slot),
  ]));
  /* A face to measure Body against, so a found body part off it would list
     under Body if it listed at all. */
  const FACE = ["eye@left", "eye@right", "teeth", "lips"];
  /* Does the panel draw a found row for this one noun, anywhere at all. */
  const drawsFound = (noun: string) =>
    panelOf({ catalogued: FACE, found: [{ noun, kind: "anatomy", on: "" }] }).groups
      .some((group) => group.rows.some((row) => row.slots.some((slot) => slot.startsWith("discovered:"))));

  it("his round-10 collarbone draws no row, no rectangle and no Body heading", () => {
    const panel = panelOf({ catalogued: FACE, found: [{ noun: "collarbone", kind: "anatomy", on: "" }] });
    expect(rowNames(panel, "face")).toEqual(["Eyes", "Lips", "Teeth"]);
    expect(sectionOf(panel, "body")).toBeNull();
    expect(everyName(panel).filter((name) => /collar/i.test(name))).toEqual([]);
    expect(everySlot(panel).filter((slot) => slot.includes("collarbone"))).toEqual([]);
  });

  it("CONTROL — the same panel with his lizard's tail in its place draws Body: Tail", () => {
    /* The arm above is only evidence if this very fixture CAN draw a Body row. */
    const panel = panelOf({ catalogued: FACE, found: [{ noun: "tail", kind: "anatomy", on: "" }] });
    expect(rowNames(panel, "body")).toEqual(["Tail"]);
    expect(sectionOf(panel, "body")!.rows[0]!.regions).toHaveLength(1);
  });

  it("his shoulders draw nothing — round 9's pair as `shoulders`, round 11's as `shoulder`", () => {
    for (const noun of ["shoulders", "shoulder"]) {
      const panel = panelOf({
        catalogued: FACE,
        found: [
          { noun, kind: "anatomy", on: "", instance: 1, x: 100, y: 300 },
          { noun, kind: "anatomy", on: "", instance: 2, x: 800, y: 300 },
        ],
      });
      expect(sectionOf(panel, "body"), noun).toBeNull();
      expect(everyName(panel).filter((name) => /shoulder/i.test(name)), noun).toEqual([]);
    }
  });

  it("drops every plain part the reading has named on his casts, as the reading spelled it", () => {
    /* LITERAL, never read back out of the list under test: an arm that walked
       the rule's own words would pass on an empty list. Every spelling here is
       one a kept reading or a #2846 reading actually wrote, plus the build's
       facets and his own "hips chest" (fable-382 §3). */
    const spelled = [
      "collarbone", "collarbones", "collar bone", "shoulders", "shoulder", "neck", "chest", "arms", "arm",
      "hands", "legs", "torso", "abdomen", "nipple", "nipples", "bust", "waist", "hips",
      "head", "face", "skull", "scalp", "forehead", "cheek", "cheeks", "eyelid", "eyelashes", "eyelash",
      "iris", "irises", "pupil", "nostril", "nostrils", "mouth", "tooth",
    ];
    expect(spelled.filter(drawsFound)).toEqual([]);
  });

  it("CONTROL — a real feature keeps its row, and the match is the WHOLE name, never a part of it", () => {
    /* `neck` is plain and `neck hardware` is his cyborg's headline find; the
       same for `eye`/`third eye`, `nose`/`nose horn`, `jaw`/`jaw spikes`, and
       `arm`/`arm spikes`. */
    const real = [
      "tail", "wings", "third eye", "jaw hardware", "neck hardware", "neck implant", "neck frill",
      "tusks", "snout", "brow ridge", "nose horn", "fangs", "horn nub", "jaw spikes", "arm spikes",
    ];
    expect(real.filter((noun) => !drawsFound(noun))).toEqual([]);
  });

  it("a mark ON a shoulder still lists — a tattoo, a scar, and a tattoo the reading named for the shoulder", () => {
    const panel = panelOf({
      catalogued: FACE,
      found: [
        { noun: "shoulder", kind: "anatomy", on: "" },
        { noun: "tattoo", kind: "marking", on: "shoulder" },
        { noun: "scar", kind: "marking", on: "shoulders" },
        { noun: "shoulder tattoo", kind: "marking", on: "" },
      ],
    });
    expect(rowNames(panel, "open")).toEqual(["Tattoo", "Scar", "Shoulder tattoo"]);
    /* And the shoulder itself is nowhere — not a row, not a parent. */
    expect(everyName(panel)).not.toContain("Shoulder");
    expect(sectionOf(panel, "body")).toBeNull();
  });

  it("a worn thing on a shoulder still lists under Accessories, and shoulder armour keeps its row", () => {
    const panel = panelOf({
      catalogued: FACE,
      found: [
        { noun: "shoulders", kind: "anatomy", on: "" },
        { noun: "strap", kind: "accessory", on: "shoulders" },
        { noun: "shoulder armor", kind: "accessory", on: "" },
      ],
    });
    expect(rowNames(panel, "accessories")).toEqual(["Strap", "Shoulder armor"]);
    expect(everyName(panel)).not.toContain("Shoulders");
  });

  it("a body feature the reading put ON a plain part keeps a row of its own, in Body", () => {
    /* Before #2840's second half a creature's spikes on its shoulder were the
       Shoulder row's child; with the shoulder gone they are placed as if they
       sat on nothing, and never hung under a row that is not drawn. */
    const panel = panelOf({
      catalogued: FACE,
      found: [
        { noun: "shoulder", kind: "anatomy", on: "" },
        { noun: "spikes", kind: "anatomy", on: "shoulder" },
      ],
    });
    expect(rowNames(panel, "body")).toEqual(["Spikes"]);
    expect(sectionOf(panel, "body")!.rows[0]!.instances).toEqual([]);
  });

  it("CONTROL — his round-10 panel as a whole: Hair is one row, two earrings are two, the collarbone is nothing", () => {
    /* His round-10 tattooed cast as the pointer road kept it
       (`relay-r10eye/reading-a1.json`): two buns on the hair and the
       collarbone — plus two hoop earrings and a tattoo on her shoulder, so the
       rules that must NOT move are on the same panel as the one that does. */
    const panel = panelOf({
      catalogued: [...FACE, "hair"],
      found: [
        { noun: "buns", kind: "anatomy", on: "hair", instance: 1, x: 605, y: 35 },
        { noun: "buns", kind: "anatomy", on: "hair", instance: 2, x: 203, y: 29 },
        { noun: "collarbone", kind: "anatomy", on: "", x: 400, y: 900 },
        { noun: "hoop earring", kind: "accessory", on: "ear", instance: 1, x: 250, y: 500 },
        { noun: "hoop earring", kind: "accessory", on: "ear", instance: 2, x: 700, y: 500 },
        { noun: "tattoo", kind: "marking", on: "shoulder", x: 150, y: 1000 },
      ],
    });
    /* Hair: ONE row, no parts (#2862, PR #2886). */
    expect(rowNames(panel, "hair")).toEqual(["Hair"]);
    expect(sectionOf(panel, "hair")!.rows[0]!.instances).toEqual([]);
    /* Two earrings: two rows (#2565 §6, untouched). */
    expect(rowNames(panel, "accessories")).toEqual(["Hoop earring", "Hoop earring"]);
    /* The tattoo lists; the collarbone does not, and so there is no Body. */
    expect(rowNames(panel, "open")).toEqual(["Tattoo"]);
    expect(sectionOf(panel, "body")).toBeNull();
    expect(everyName(panel).filter((name) => /collar/i.test(name))).toEqual([]);
  });
});
