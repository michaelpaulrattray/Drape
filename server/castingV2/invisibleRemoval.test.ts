import { describe, expect, it } from "vitest";

import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { pronounsForSex } from "./castPronouns";
import { OCCLUDER, invisibleRemovalNote, readSiteVisibility } from "./invisibleRemoval";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

const WIDTH = 512;
const HEIGHT = 768;

/** Her lobes, roughly where a portrait puts them — normalised, as the model answers. */
const LOBES = [{ x: 0.32, y: 0.42 }, { x: 0.68, y: 0.42 }];

const blank = (): Mask => ({ data: Buffer.alloc(WIDTH * HEIGHT, 0), width: WIDTH, height: HEIGHT });
const solid = (): Mask => ({ data: Buffer.alloc(WIDTH * HEIGHT, 255), width: WIDTH, height: HEIGHT });

/** Hair over the left half of the picture only — one lobe covered, one bare. */
const leftHalf = (): Mask => {
  const mask = blank();
  for (let y = 0; y < HEIGHT; y += 1) mask.data.fill(255, y * WIDTH, y * WIDTH + Math.floor(WIDTH / 2));
  return mask;
};

/**
 * A READER THAT ANSWERS IN PIXELS, which is the only kind that discriminates
 * anything here.
 *
 * The arithmetic under test is real — `additionDestination` builds the corridor
 * and `occludedShare` scores it — so the double supplies mattes and landmark
 * points and never a verdict. A double that answered "hidden: true" would be
 * measuring itself.
 *
 * It answers the two questions DIFFERENTLY, which is the whole shape of the
 * reading: the site's anatomy and the hair are separate facts about one frame,
 * and a double that returned the same mask for both would prove whichever one
 * it happened to suit.
 */
const readerWith = (input: {
  anatomy: Mask;
  occluder?: Mask;
  landmarks?: { x: number; y: number }[];
  asked?: string[];
}): RegionReader => ({
  async region({ name }) {
    input.asked?.push(name);
    if (name === OCCLUDER) {
      if (!input.occluder) throw new Error("the occluder was asked for and this arm did not expect it");
      return input.occluder;
    }
    return input.anatomy;
  },
  async subject() {
    throw new Error("not asked");
  },
  async landmark() {
    return input.landmarks ?? LOBES;
  },
});

const readSite = (
  reader: RegionReader,
  kind = "earring",
) => readSiteVisibility({ reader, frame: Buffer.from("frame"), kind });

describe("whether she can see where the thing came off", () => {
  /*
    THE COMMON REMOVAL, AND THE CHEAP ANSWER. Her ear is in the picture, so she
    can see the bare lobe — nothing to say, and the expensive half is never
    reached. Asserted on what was ASKED, because "did not run" is the claim.
  */
  it("stops at one read when the site is plainly in the picture", async () => {
    const asked: string[] = [];
    const site = await readSite(readerWith({ anatomy: solid(), asked }));

    expect(site.visible).toBe(true);
    expect(site.cause).toBeNull();
    /* Not zero — never measured. The two are different answers. */
    expect(site.hiddenShare).toBeNull();
    expect(asked).toEqual(["ear"]);
  });

  it("names her hair when the site is gone and her hair is over it", async () => {
    const asked: string[] = [];
    const site = await readSite(readerWith({ anatomy: blank(), occluder: solid(), asked }));

    expect(site.visible).toBe(false);
    expect(site.hiddenShare).toBe(1);
    expect(site.cause).toBe("hair");
    expect(asked).toEqual(["ear", OCCLUDER]);
  });

  /*
    PARTLY HIDDEN IS NOT HAIR'S DOING. One lobe behind her hair and one bare
    scores about a half — nowhere near the bar — so the site is invisible for
    some other reason and the reading refuses to name one.
  */
  it("claims no cause it cannot prove", async () => {
    const site = await readSite(readerWith({ anatomy: blank(), occluder: leftHalf() }));

    expect(site.hiddenShare).toBeGreaterThan(0.4);
    expect(site.hiddenShare).toBeLessThan(0.6);
    expect(site.cause).toBe("unattributed");
  });

  it("attributes nothing when there is no hair in the frame at all", async () => {
    const site = await readSite(readerWith({ anatomy: blank(), occluder: blank() }));

    expect(site.hiddenShare).toBe(0);
    expect(site.cause).toBe("unattributed");
  });

  it("asks each kind for its own anatomy, never a borrowed one", async () => {
    const asked: string[] = [];
    await readSite(readerWith({ anatomy: solid(), asked }), "nose stud");
    expect(asked).toEqual(["nose"]);
  });

  it("refuses a kind the placement table cannot site", async () => {
    await expect(readSite(readerWith({ anatomy: solid() }), "tiara")).rejects.toThrow(/placement table/);
  });

  it("refuses when the landmark model cannot place the site at all", async () => {
    await expect(readSite(readerWith({ anatomy: blank(), occluder: solid(), landmarks: [] })))
      .rejects.toThrow();
  });
});

describe("the sentence a hidden site says", () => {
  const hair = (kind: string, sex: unknown) =>
    invisibleRemovalNote({ kind, pronouns: pronounsForSex(sex), cause: "hair" });
  const unattributed = (kind: string, sex: unknown) =>
    invisibleRemovalNote({ kind, pronouns: pronounsForSex(sex), cause: "unattributed" });

  /* His own draft, ruled in chat (fable-398 §3) — pinned verbatim, because the
     next edit to the template is the one that quietly rewrites his words. */
  it("is his sentence exactly, for a woman's earrings", () => {
    expect(hair("earring", "female")).toBe(
      "Her ears are behind her hair, so you won't see this until her hair moves — "
      + "but she's no longer wearing earrings.",
    );
  });

  /* Ruled in fable-407 §1, adapted off his: says the whole of what was measured
     and nothing about a cause. */
  it("is the ruled fallback when the cause is not proven", () => {
    expect(unattributed("earring", "female")).toBe(
      "Her earrings weren't visible in this shot, so the picture looks the same — "
      + "but she's no longer wearing them.",
    );
  });

  it("derives the possessive rather than shipping 'her' over a man's face", () => {
    expect(hair("earring", "male")).toBe(
      "His ears are behind his hair, so you won't see this until his hair moves — "
      + "but he's no longer wearing earrings.",
    );
    expect(unattributed("earring", "male")).toBe(
      "His earrings weren't visible in this shot, so the picture looks the same — "
      + "but he's no longer wearing them.",
    );
  });

  it("agrees the verb with a plural pronoun when the sex was never stated", () => {
    expect(hair("earring", null)).toBe(
      "Their ears are behind their hair, so you won't see this until their hair moves — "
      + "but they're no longer wearing earrings.",
    );
  });

  /* The site's and the thing's own verbs, which is why each carries a `plural`
     field instead of the code guessing from an "s". */
  it("says 'is' and 'wasn't' for a thing there is one of", () => {
    expect(hair("nose stud", "male")).toBe(
      "His nose is behind his hair, so you won't see this until his hair moves — "
      + "but he's no longer wearing a nose stud.",
    );
    expect(unattributed("nose stud", "male")).toBe(
      "His nose stud wasn't visible in this shot, so the picture looks the same — "
      + "but he's no longer wearing it.",
    );
  });

  it("says nothing at all for a site she can see", () => {
    expect(invisibleRemovalNote({ kind: "earring", pronouns: pronounsForSex("female"), cause: null }))
      .toBeNull();
  });

  it("says nothing for a kind the table does not hold", () => {
    expect(hair("tiara", "female")).toBeNull();
  });

  /*
    NO SENTENCE MENTIONS MONEY. Something was charged — this is a delivered take
    — and every refusal in the service reassures with "nothing was charged".
    Borrowing that clause here would be the reverse of the honesty it is for.
  */
  it("never says anything about the charge", () => {
    for (const entry of LANDMARK_OF_ACCESSORY) {
      expect(hair(entry.region, "female")).not.toMatch(/charge|credit|refund/i);
      expect(unattributed(entry.region, "female")).not.toMatch(/charge|credit|refund/i);
    }
  });

  /* Every kind can say both, and no kind says either with a pronoun baked in —
     the compiler asks for the fields, this asks whether they were filled
     honestly. */
  it("speaks for every kind the product can place, with no hard-coded pronoun", () => {
    for (const entry of LANDMARK_OF_ACCESSORY) {
      expect(entry.site.question.length).toBeGreaterThan(0);
      expect(`${entry.site.words} ${entry.worn.phrase} ${entry.worn.possessed}`)
        .not.toMatch(/\b(her|his|their|she|he|they)\b/i);
      for (const said of [hair(entry.region, "male"), unattributed(entry.region, "male")]) {
        expect(said).toContain("his");
        expect(said).not.toMatch(/\bher\b/);
      }
    }
  });
});
