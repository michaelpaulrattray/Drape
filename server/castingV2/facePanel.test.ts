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
import { facePanel, type PanelRow } from "./facePanel";
import type { StoredReference } from "./referenceLibrary";

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
    geometry: null,
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

  it("appears the moment something is said about it, box or no box", () => {
    const lips = named([row({ slot: "lips", words: ["a fuller lip"] })], "Her lips")!;
    expect(lips.words).toEqual(["a fuller lip"]);
    expect(lips.cutouts).toEqual([]);
    expect(lips.regions).toEqual([]);
  });

  it("keeps the group order it is read in, and drops a group with nothing in it", () => {
    const built = panel([
      row({ slot: "lips", words: ["a fuller lip"] }),
      row({ slot: "hair", words: ["a copper shag"] }),
    ]);
    expect(built.groups.map((group) => group.heading)).toEqual(["Face", "Hair"]);
  });

  it("opens their own sentence, lowercased, when a row is tapped", () => {
    expect(named([row({ slot: "lips", words: ["a fuller lip"] })], "Her lips")!.prefill).toBe("her lips — ");
    expect(named(
      [
        row({ slot: "earring@left", tier: "item", words: ["a gold hoop"] }),
        row({ slot: "earring@right", tier: "item", words: ["a gold hoop"] }),
      ],
      "Her earrings",
    )!.prefill).toBe("her earrings — ");
  });

  it("uses THIS face's pronoun — v1 called a man's eyes hers in front of him", () => {
    const names = allRows([row({ slot: "lips", words: ["a fuller lip"] })], HE).map((panelRow) => panelRow.name);
    expect(names).toContain("His lips");
    expect(names.some((name) => name.startsWith("Her "))).toBe(false);
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
    expect(names).toContain("Her lips");
    expect(names).not.toContain("Her jaw");
    expect(names).not.toContain("Her chin");
    expect(names).not.toContain("Her cheekbones");
  });

  it("reads a lash sentence on the eyes row, because the only region holding lashes is the eye", () => {
    const eyes = named([row({ slot: "lashes@left", words: ["longer lashes"] })], "Her eyes")!;
    expect(eyes.words).toEqual(["longer lashes"]);
    /* The row is still about the eyes — an edit to it means the eye slots, and
       the lash ask files where it always did. */
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(allRows([row({ slot: "lashes@left", words: ["longer lashes"] })]).map((r) => r.name))
      .not.toContain("Her lashes");
  });

  it("says a folded sentence once when it was filed on both sides", () => {
    const eyes = named(
      [
        row({ slot: "eye@left", words: ["green"] }),
        row({ slot: "eye@right", words: ["green"] }),
        row({ slot: "lashes@left", words: ["longer lashes"] }),
        row({ slot: "lashes@right", words: ["longer lashes"] }),
      ],
      "Her eyes",
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
    })], "Her hair")!;

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
      { box: { x: 12, y: 30, width: 200, height: 140, frame: { width: 1024, height: 1536 } }, name: null },
    ]);
  });

  it("REFUSES to invent a box for a row that has words but was never measured", () => {
    /* The words-only case is most of the panel — her skin, anything the guard
       turned away. A rectangle by proportion here is a promise that clicking
       those pixels edits that thing. */
    const skin = named([row({ slot: "skin", words: ["a warm tan"] })], "Her skin")!;
    expect(skin.words).toEqual(["a warm tan"]);
    expect(skin.regions).toEqual([]);
    expect(skin.cutouts).toEqual([]);
  });

  it("does not count provenance as content — 'from an edit' about nothing is not a row", () => {
    /* A library row that says only that something happened here, with no words
       and no crop, tells the person nothing about their own face. */
    expect(named([row({ slot: "lips", words: [] })], "Her lips")).toBeUndefined();
  });

  it("tells a thing she arrived with from a thing she asked for", () => {
    expect(named([row({ slot: "glasses", tier: "item", variantId: null, words: ["round wire frames"] })], "Her glasses")!.from)
      .toBe("she came with it");
    expect(named([row({ slot: "hair", variantId: 11, words: ["copper"] })], "Her hair")!.from)
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
    expect(named(worn, "Her earrings")!.words).toEqual(["a gold hoop"]);

    const removed = [
      ...worn,
      row({ slot: "earring@left", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
      row({ slot: "earring@right", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
    ];
    expect(named(removed, "Her earrings")).toBeUndefined();
  });
});

describe("a pair is one row until it isn't, and the split is derived", () => {
  const hoops = (left: string[], right: string[]) => [
    row({ slot: "earring@left", tier: "item", words: left }),
    row({ slot: "earring@right", tier: "item", words: right }),
  ];

  it("speaks a matched pair as one thing, and edits both sides", () => {
    const built = named(hoops(["a gold hoop"], ["a gold hoop"]), "Her earrings")!;
    expect(built.slots).toEqual(["earring@left", "earring@right"]);
    expect(allRows(hoops(["a gold hoop"], ["a gold hoop"])).some((r) => r.name === "Her left earring")).toBe(false);
  });

  it("splits the row the moment one side is edited, with no flag to set", () => {
    const rows = allRows(hoops(["a gold hoop", "noticeably bigger"], ["a gold hoop"]));
    expect(rows.map((r) => r.name)).toContain("Her left earring");
    expect(rows.map((r) => r.name)).toContain("Her right earring");
    expect(rows.find((r) => r.name === "Her left earring")!.slots).toEqual(["earring@left"]);
  });

  it("merges again when they match again, because there was never a flag to clear", () => {
    const rows = allRows(hoops(["a gold hoop", "noticeably bigger"], ["a gold hoop", "noticeably bigger"]));
    expect(rows.map((r) => r.name)).toContain("Her earrings");
    expect(rows.some((r) => r.name.includes("left"))).toBe(false);
  });

  it("says the plural the way the catalogue writes it, never by adding an s", () => {
    const names = allRows([
      row({ slot: "eye@left", words: ["green"] }),
      row({ slot: "eye@right", words: ["green"] }),
      row({ slot: "ear@left", words: ["a little more tucked"] }),
      row({ slot: "ear@right", words: ["a little more tucked"] }),
    ]).map((r) => r.name);
    expect(names).toContain("Her eyes");
    expect(names).toContain("Her ears");
    expect(names).not.toContain("Her eyess");
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
      .find((row) => row.name === "Her nose")!;

    /* The picture is the frame the viewer already has — no object was written
       to show this, which is the whole of ruling 4a. */
    expect(nose.cutouts).toEqual([{
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,nose",
      crop: { x: 400, y: 600, width: 120, height: 160, frame },
    }]);
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null }]);
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
      .find((panelRow) => panelRow.name === "Her hair")!;

    /*
      The library wins where it has minted. A scan of today's frame replacing
      the crop a paid render cut would make "from an edit" a lie on a row that
      is showing a picture of something else.
    */
    expect(hair.cutouts[0]!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.cutouts[0]!.crop).toBeNull();
    expect(hair.regions).toEqual([{ box: { x: 12, y: 30, width: 200, height: 140, frame }, name: null }]);
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
      .find((panelRow) => panelRow.name === "Her hair")!;

    expect(hair.cutouts[0]!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.regions).toEqual([{ box: { x: 900, y: 900, width: 50, height: 50, frame }, name: null }]);
  });

  it("still refuses to invent a box for a region the scan did not find", () => {
    /* An ear behind her hair files NOTHING (fable-352). The row survives only
       because something was SAID about her ears; the picture stays honest about
       what was measured, so there is no box and no cutout on it. */
    const rows = scanned(
      [row({ slot: "ear@left", words: ["a little more tucked"] }), row({ slot: "ear@right", words: ["a little more tucked"] })],
      { nose: { x: 400, y: 600, width: 120, height: 160 } },
    );
    const ears = rows.find((panelRow) => panelRow.name === "Her ears")!;
    expect(ears.regions).toEqual([]);
    expect(ears.cutouts).toEqual([]);
  });

  it("drops the row entirely when the scan found nothing and nothing was said", () => {
    const rows = scanned([], { nose: { x: 400, y: 600, width: 120, height: 160 } });
    expect(rows.map((panelRow) => panelRow.name)).toEqual(["Her nose"]);
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
    const eyes = rows.find((panelRow) => panelRow.name === "Her eyes")!;
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(eyes.cutouts.map((cutout) => cutout.crop!.x)).toEqual([300, 640]);
    /* Two rectangles, each naming the eye it covers — never one box spanning
       both, which would be a rectangle across the bridge of her nose. */
    expect(eyes.regions).toEqual([
      { box: { x: 300, y: 500, width: 60, height: 30, frame }, name: "Her right eye" },
      { box: { x: 640, y: 500, width: 60, height: 30, frame }, name: "Her left eye" },
    ]);
  });

  it("is exactly today's panel when there is no scan", () => {
    const said = [row({ slot: "lips", words: ["a fuller lip"] }), row({ slot: "skin", words: ["a warm tan"] })];
    const withoutScan = allRows(said);
    expect(withoutScan.map((panelRow) => panelRow.name)).toEqual(["Her lips", "Her skin"]);
    expect(withoutScan.every((panelRow) => panelRow.regions.length === 0 && panelRow.cutouts.length === 0)).toBe(true);
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
      .find((row) => row.name === "Her eyes")!;

    /* The row is unchanged: both slots, one ask, the pair's own name. */
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(eyes.name).toBe("Her eyes");
    /* The rectangle exists — the defect was that it did not. */
    /* And it does not claim to be the pair. */
    expect(eyes.regions).toEqual([
      { box: { x: 640, y: 500, width: 60, height: 30, frame }, name: "Her right eye" },
    ]);
    expect(eyes.cutouts).toHaveLength(1);
  });

  it("draws BOTH rectangles when both were read, each naming its own instance", () => {
    const eyes = scanned({
      "eye@left": { x: 640, y: 500, width: 60, height: 30 },
      "eye@right": { x: 300, y: 500, width: 60, height: 30 },
    }).find((row) => row.name === "Her eyes")!;
    /* One row, one ask, two promises about two sets of pixels. */
    expect(eyes.regions.map((region) => region.name)).toEqual(["Her right eye", "Her left eye"]);
    expect(eyes.regions.map((region) => region.box.x)).toEqual([300, 640]);
  });

  it("names a singular row's rectangle with nothing extra at all", () => {
    /* Null is not an omission: it means the row's own name is the label. */
    const nose = scanned({ nose: { x: 400, y: 600, width: 120, height: 160 } })
      .find((row) => row.name === "Her nose")!;
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null }]);
  });

  it("leaves a row with no geometry at all unlabelled and unclickable", () => {
    /* Words keep the row on screen — the scan found neither eye, so there is
       nothing to point at and nothing to name. */
    const eyes = scanned(
      { nose: { x: 400, y: 600, width: 120, height: 160 } },
      [row({ slot: "eye@left", words: ["green"] }), row({ slot: "eye@right", words: ["green"] })],
    ).find((row) => row.name === "Her eyes")!;
    expect(eyes.regions).toEqual([]);
  });
});
