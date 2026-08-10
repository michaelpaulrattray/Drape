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
