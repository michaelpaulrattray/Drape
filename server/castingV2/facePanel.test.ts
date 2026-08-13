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

describe("a face with nothing said about it still has a panel", () => {
  it("lists every catalogued feature, grouped, on an untouched original", () => {
    const built = panel([]);

    expect(built.groups.map((group) => group.heading)).toEqual(["Face", "Hair", "Body", "Accessories"]);
    const names = built.groups.flatMap((group) => group.rows.map((row) => row.name));
    expect(names).toContain("Her lips");
    expect(names).toContain("Her hair");
    expect(names).toContain("Her skin");
    expect(names).toContain("Her earrings");
  });

  it("says nothing about where a row came from until something has happened to it", () => {
    const lips = named([], "Her lips")!;
    expect(lips.words).toEqual([]);
    expect(lips.from).toBeNull();
    expect(lips.thumb).toBeNull();
    expect(lips.box).toBeNull();
  });

  it("opens their own sentence, lowercased, when a row is tapped", () => {
    expect(named([], "Her lips")!.prefill).toBe("her lips — ");
    expect(named([], "Her earrings")!.prefill).toBe("her earrings — ");
  });

  it("uses THIS face's pronoun — v1 called a man's eyes hers in front of him", () => {
    const names = allRows([], HE).map((panelRow) => panelRow.name);
    expect(names).toContain("His lips");
    expect(names.some((name) => name.startsWith("Her "))).toBe(false);
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
    expect(built.thumb).toEqual({
      contentUrl: "https://bucket.example/library/hair.png",
      /* The stencil goes through the proxy: a CSS mask is a CORS fetch and the
         public bucket sends no allow-origin, so a bucket mask renders NOTHING. */
      maskUrl: "/api/image-proxy?url=https%3A%2F%2Fbucket.example%2Flibrary%2Fhair-mask.png",
      /* A minted crop IS the picture, so there is no window onto a frame — the
         scan-born rows are the ones that carry one. */
      crop: null,
    });
    expect(built.box).toEqual({ x: 12, y: 30, width: 200, height: 140, frame: { width: 1024, height: 1536 } });
  });

  it("REFUSES to invent a box for a row that has words but was never measured", () => {
    /* The words-only case is most of the panel — a jaw, a tan, anything the
       guard turned away. A rectangle by proportion here is a promise that
       clicking those pixels edits that thing. */
    const jaw = named([row({ slot: "jaw", words: ["a softer jawline"] })], "Her jaw")!;
    expect(jaw.words).toEqual(["a softer jawline"]);
    expect(jaw.box).toBeNull();
    expect(jaw.thumb).toBeNull();
  });

  it("tells a thing she arrived with from a thing she asked for", () => {
    expect(named([row({ slot: "glasses", tier: "item", variantId: null, words: ["round wire frames"] })], "Her glasses")!.from)
      .toBe("she came with it");
    expect(named([row({ slot: "hair", variantId: 11, words: ["copper"] })], "Her hair")!.from)
      .toBe("from an edit");
  });

  it("reads the branch through the library's own fold — a retired newest is gone", () => {
    /* Rule 2: if the fold merely skipped retired rows, the ancestor's older
       earring would come back and the row would still say "a gold hoop". */
    const rows = [
      row({ slot: "earring@left", tier: "item", words: ["a gold hoop"], version: 1 }),
      row({ slot: "earring@right", tier: "item", words: ["a gold hoop"], version: 1 }),
      row({ slot: "earring@left", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
      row({ slot: "earring@right", tier: "item", words: ["a gold hoop"], version: 2, retiredAt: new Date() }),
    ];
    expect(named(rows, "Her earrings")!.words).toEqual([]);
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
    const names = allRows([]).map((r) => r.name);
    expect(names).toContain("Her lashes");
    expect(names).not.toContain("Her lasheses");
    expect(names).toContain("Her eyes");
    expect(names).toContain("Her ears");
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
    expect(nose.thumb).toEqual({
      contentUrl: "https://bucket.example/casting/master.jpg",
      maskUrl: "data:image/png;base64,nose",
      crop: { x: 400, y: 600, width: 120, height: 160, frame },
    });
    expect(nose.box).toEqual({ x: 400, y: 600, width: 120, height: 160, frame });
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
    expect(hair.thumb!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.thumb!.crop).toBeNull();
    expect(hair.box).toEqual({ x: 12, y: 30, width: 200, height: 140, frame });
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

    expect(hair.thumb!.contentUrl).toBe("https://bucket.example/library/hair.png");
    expect(hair.box).toEqual({ x: 900, y: 900, width: 50, height: 50, frame });
  });

  it("still refuses to invent a box for a region the scan did not find", () => {
    /* An ear behind her hair files NOTHING (fable-352). The row is present and
       tappable, as every row is, and the picture stays honest about what was
       measured. */
    const rows = scanned([], { nose: { x: 400, y: 600, width: 120, height: 160 } });
    const ears = rows.find((panelRow) => panelRow.name === "Her ears")!;
    expect(ears.box).toBeNull();
    expect(ears.thumb).toBeNull();
    expect(rows.find((panelRow) => panelRow.name === "Her jaw")!.box).toBeNull();
  });

  it("shows a matched pair one side's shape, never a box spanning both", () => {
    const rows = scanned([], {
      "eye@left": { x: 300, y: 500, width: 60, height: 30 },
      "eye@right": { x: 640, y: 500, width: 60, height: 30 },
    });
    const eyes = rows.find((panelRow) => panelRow.name === "Her eyes")!;
    /* One row, two slots, and the geometry of ONE instance — a box drawn
       around both would be a rectangle across the bridge of her nose. */
    expect(eyes.slots).toEqual(["eye@left", "eye@right"]);
    expect(eyes.box).toEqual({ x: 300, y: 500, width: 60, height: 30, frame });
    expect(eyes.thumb!.crop).toEqual({ x: 300, y: 500, width: 60, height: 30, frame });
  });

  it("is exactly today's panel when there is no scan", () => {
    const withoutScan = allRows([]);
    expect(withoutScan.every((panelRow) => panelRow.box === null && panelRow.thumb === null)).toBe(true);
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
  const scanned = (slots: Record<string, { x: number; y: number; width: number; height: number }>) => facePanel({
    rows: [],
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
    expect(eyes.box).toEqual({ x: 640, y: 500, width: 60, height: 30, frame });
    /* And it does not claim to be the pair. */
    expect(eyes.boxName).toBe("Her right eye");
  });

  it("says nothing extra when the box covers what the row names", () => {
    const eyes = scanned({
      "eye@left": { x: 300, y: 500, width: 60, height: 30 },
      "eye@right": { x: 640, y: 500, width: 60, height: 30 },
    }).find((row) => row.name === "Her eyes")!;
    /* Null is not an omission: it means the row's own name is the label. */
    expect(eyes.boxName).toBeNull();
    expect(eyes.box!.x).toBe(300);
  });

  it("leaves a row with no geometry at all unlabelled and unclickable", () => {
    const eyes = scanned({ nose: { x: 400, y: 600, width: 120, height: 160 } })
      .find((row) => row.name === "Her eyes")!;
    expect(eyes.box).toBeNull();
    expect(eyes.boxName).toBeNull();
  });
});
