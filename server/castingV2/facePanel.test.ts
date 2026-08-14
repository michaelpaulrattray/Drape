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
        name: null, spoken: null, prefill: null, slot: "hair",
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
    /* And it claims nothing of either side: each side's own words, attributed. */
    expect(earrings.words).toEqual(["left a gold hoop, noticeably bigger", "right a gold hoop"]);
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
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null, spoken: null, prefill: null, slot: "nose" }]);
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
    expect(hair.regions).toEqual([{ box: { x: 12, y: 30, width: 200, height: 140, frame }, name: null, spoken: null, prefill: null, slot: "hair" }]);
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
    expect(hair.regions).toEqual([{ box: { x: 900, y: 900, width: 50, height: 50, frame }, name: null, spoken: null, prefill: null, slot: "hair" }]);
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
        name: "Right eye", spoken: "her right eye", prefill: "her right eye — ", slot: "eye@right",
      },
      {
        box: { x: 640, y: 500, width: 60, height: 30, frame },
        name: "Left eye", spoken: "her left eye", prefill: "her left eye — ", slot: "eye@left",
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
        name: "Right eye", spoken: "her right eye", prefill: "her right eye — ", slot: "eye@right",
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
    expect(nose.regions).toEqual([{ box: { x: 400, y: 600, width: 120, height: 160, frame }, name: null, spoken: null, prefill: null, slot: "nose" }]);
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

    expect(eyes.words).toEqual(["left green", "right dark brown"]);
    expect(eyes.instances.map((instance) => [instance.name, instance.words])).toEqual([
      ["Left eye", ["green"]],
      ["Right eye", ["dark brown"]],
    ]);
    /* The thing the ruling forbids, asserted directly: no sentence on this row
       says "green" as though it were true of her eyes. */
    expect(eyes.words.join(" ")).not.toBe("green");
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
