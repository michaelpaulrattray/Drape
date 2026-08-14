/**
 * THE DESCRIBED ROWS — the reader, the derivation that decides which rows it
 * speaks for, and the merge that puts its words on the panel.
 *
 * Every reading here is DICTATED through a fake transport (law 3). The live
 * reader mostly behaves, so a suite that reached it would be measuring a
 * model's good manners and calling it a control — and it would spend house
 * money on every run of `pnpm test`.
 *
 * The one thing that is NOT asserted here is quality: whether these
 * descriptions are about the person in the photograph was measured on real
 * faces with a pre-registered bar (`bench-face-describe-disposable.mts`,
 * 11/12 discrimination for the arm that ships). A unit test cannot answer that
 * and should not pretend to.
 */
import { describe, expect, it, vi } from "vitest";

import type { CastPronouns } from "./castPronouns";
import {
  assertEveryDescribedFeatureHasAnAsk,
  DESCRIBED_ASKS,
  describeFace,
  describeSeparately,
  describeTogether,
  describeWithTeeth,
  describedFeatures,
  NOT_DESCRIBED,
} from "./faceDescribe";
import { facePanel, type PanelRow } from "./facePanel";
import { scanFace } from "./faceScan";
import type { Mask } from "./maskedComposite";
import type { TextEngine } from "../providers/types";
import { catalogueSlots, isAskable } from "./referenceSlotCatalogue";
import type { StoredReference } from "./referenceLibrary";

const FRAME = { bytes: Buffer.from("frame"), contentType: "image/png" };

function engineSaying(...replies: string[]): TextEngine & { sent: { system: string; user: string }[] } {
  const sent: { system: string; user: string }[] = [];
  let index = 0;
  return {
    id: "fake",
    sent,
    complete: vi.fn(async (request: { system: string; user: string }) => {
      sent.push({ system: request.system, user: request.user });
      const text = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return { text, provenance: { provider: "fake", model: "fake" } as never, latencyMs: 1 };
    }),
  } as never;
}

describe("the reader", () => {
  it("says nothing at all when there is no transport", async () => {
    /* The scan's own rule: a courtesy read that cannot happen degrades to
       today's panel, never to an error and never to a guess. */
    expect(await describeTogether({ ...FRAME, engine: null })).toEqual({ build: null, skin: null });
  });

  it("treats a hedge as no description", async () => {
    const read = await describeTogether({
      ...FRAME,
      engine: engineSaying('{"build": "unclear", "skin": "  "}'),
    });
    expect(read).toEqual({ build: null, skin: null });
  });

  it("refuses an essay, because the row holds one line", async () => {
    const essay = `broad through the shoulders ${"and quite remarkably so ".repeat(8)}`;
    const read = await describeTogether({ ...FRAME, engine: engineSaying(`{"build": ${JSON.stringify(essay)}}`) });
    expect(read.build).toBeNull();
  });

  it("survives a reply that is not JSON at all", async () => {
    const read = await describeTogether({ ...FRAME, engine: engineSaying("I'm happy to help! Here goes:") });
    expect(read).toEqual({ build: null, skin: null });
  });

  it("takes a fenced reply, which is what a model actually sends", async () => {
    const read = await describeTogether({
      ...FRAME,
      engine: engineSaying('```json\n{"build": "slight, straight shoulder line", "skin": "fair, even"}\n```'),
    });
    expect(read).toEqual({ build: "slight, straight shoulder line", skin: "fair, even" });
  });

  it("tells the reader, ON THE WIRE, that the frame stops at the ribs", async () => {
    /*
      ASSERTED ON THE OUTGOING REQUEST, not on the constant beside it (law 5).
      The crop rule is the one instruction that keeps a description honest about
      a photograph nobody took — `castingFrame`'s law, said to the describer.
    */
    const engine = engineSaying('{"build": "slim", "skin": "fair"}');
    await describeTogether({ ...FRAME, engine });
    const system = engine.sent[0].system;
    for (const word of ["waist", "hips", "legs", "height"]) expect(system).toContain(word);
    expect(system).toContain("lower ribs");
  });

  it("passes the frame itself, since a description of no picture is a guess", async () => {
    const engine = engineSaying('{"build": "slim", "skin": "fair"}');
    await describeTogether({ ...FRAME, engine });
    const request = (engine.complete as unknown as { mock: { calls: [{ images?: unknown[] }][] } }).mock.calls[0][0];
    expect(request.images).toHaveLength(1);
  });
});

describe("the two arms, which differ in ONE thing", () => {
  it("arm A asks both questions in one call", async () => {
    const engine = engineSaying('{"build": "slim shoulders", "skin": "warm olive"}');
    const read = await describeTogether({ ...FRAME, engine });
    expect(engine.sent).toHaveLength(1);
    expect(engine.sent[0].user).toContain("HER BUILD");
    expect(engine.sent[0].user).toContain("HER SKIN");
    expect(read).toEqual({ build: "slim shoulders", skin: "warm olive" });
  });

  it("arm B asks each on its own, so neither hears the other", async () => {
    const engine = engineSaying('{"build": "slim shoulders"}', '{"skin": "warm olive"}');
    await describeSeparately({ ...FRAME, engine });
    expect(engine.sent).toHaveLength(2);
    expect(engine.sent.filter((call) => call.user.includes("HER BUILD"))).toHaveLength(1);
    expect(engine.sent.filter((call) => call.user.includes("HER SKIN"))).toHaveLength(1);
  });

  it("ships the arm the bench chose", async () => {
    /* The pointer is a measurement's result, so it is pinned. Arm A won the
       first bench (11/12 against arm B's 9/12, bar 10); the three-question arm
       then matched it 12/12 on the same faces on the same evening and cleared
       two bars of its own, so the shipped reader is that one. Changing this
       should mean a new run, and this fails if it changes without one. */
    expect(describeFace).toBe(describeWithTeeth);
  });

  it("arm 3Q asks the third question in the SAME call, on the same rules", async () => {
    const engine = engineSaying('{"build": "slim shoulders", "skin": "warm olive", "teeth": "even and bright"}');
    const read = await describeWithTeeth({ ...FRAME, engine });
    expect(engine.sent).toHaveLength(1);
    expect(read).toEqual({ build: "slim shoulders", skin: "warm olive", teeth: "even and bright" });
  });

  it("tells the teeth reader, ON THE WIRE, not to describe a mouth or guess at a closed one", async () => {
    /*
      ASSERTED ON THE OUTGOING REQUEST (law 5). The catalogue refuses teeth a
      PICTURE because "a crop of the mouth filed as her teeth is the lips' crop
      under a second name"; the same mistake in words is a line about her lips
      filed as a line about her teeth. Both halves of the instruction are
      load-bearing and neither is checkable from the constant beside it.
    */
    const engine = engineSaying('{"build": "a", "skin": "b", "teeth": null}');
    await describeWithTeeth({ ...FRAME, engine });
    const asked = engine.sent[0].user;
    expect(asked).toContain("HER TEETH");
    for (const word of ["lips", "mouth", "smile"]) expect(asked).toContain(word);
    expect(asked).toContain("never guess at what a closed mouth is hiding");
  });

  it("treats a hedge about teeth as no description, like every other row", async () => {
    const read = await describeWithTeeth({
      ...FRAME,
      engine: engineSaying('{"build": "slim", "skin": "fair", "teeth": "unclear"}'),
    });
    expect(read.teeth).toBeNull();
  });

  it("says nothing about any of the three when there is no transport", async () => {
    expect(await describeWithTeeth({ ...FRAME, engine: null }))
      .toEqual({ build: null, skin: null, teeth: null });
  });

  it("keeps both arms on the SAME rules, or the bench compared two things", async () => {
    const together = engineSaying('{"build": "a", "skin": "b"}');
    const separate = engineSaying('{"build": "a"}', '{"skin": "b"}');
    await describeTogether({ ...FRAME, engine: together });
    await describeSeparately({ ...FRAME, engine: separate });
    expect(separate.sent[0].system).toBe(together.sent[0].system);
    expect(separate.sent[1].system).toBe(together.sent[0].system);
  });
});

describe("which rows are described, derived rather than listed", () => {
  it("is exactly the rows that draw themselves and can never be pictured", async () => {
    const derived = describedFeatures();
    const expected = Array.from(new Set(
      catalogueSlots()
        .filter((definition) => !isAskable(definition) && definition.panel.row === "own")
        .map((definition) => definition.feature),
    )).sort();
    expect(derived).toEqual(expected);
    /* And the founder's two are in it — the complaint that started the chunk. */
    expect(derived).toContain("build");
    expect(derived).toContain("skin");
  });

  it("does NOT sweep in the rows that draw no row at all", async () => {
    /* cheekbones, jaw and chin have no question either, and are words-only by
       founder ruling with no row to fill. A derivation that caught them would
       be paying for descriptions nobody displays. */
    for (const feature of ["cheekbone", "jaw", "chin"]) {
      expect(describedFeatures()).not.toContain(feature);
    }
  });

  it("REFUSES a row that has neither an ask nor a written reason", () => {
    expect(() => assertEveryDescribedFeatureHasAnAsk(["build", "skin", "eyebrows-of-tomorrow"]))
      .toThrow(/eyebrows-of-tomorrow/);
  });

  it("accepts one that is declared, and the declaration says why", () => {
    expect(() => assertEveryDescribedFeatureHasAnAsk(describedFeatures())).not.toThrow();
    /* A reason of two words would satisfy the type and defeat the point, and a
       feature may not be declared in both places at once. The map is empty
       today; the assertions stand for the next row that lands in it. */
    for (const [feature, why] of Object.entries(NOT_DESCRIBED)) {
      expect(why.length, feature).toBeGreaterThan(60);
      expect(feature in DESCRIBED_ASKS, feature).toBe(false);
    }
  });

  it("asks about teeth now, because the bench it was waiting on was run", () => {
    /* `teeth` was the exception this guard found for itself and it is spent:
       fable-402 §2 ruled "if the bench passes, teeth joins". It passed six
       bars, so the row is asked and no longer excused. */
    expect(describedFeatures()).toContain("teeth");
    expect("teeth" in DESCRIBED_ASKS).toBe(true);
    expect("teeth" in NOT_DESCRIBED).toBe(false);
  });
});

describe("the scan carries the words", () => {
  const mask: Mask = { data: Buffer.from([255]), width: 1, height: 1 };
  const reader = {
    region: async () => mask,
    regionSides: async () => ({ left: mask, right: mask }),
    subject: async () => mask,
    landmark: async () => [],
  };
  const frame = { bytes: Buffer.from("f"), width: 10, height: 10 };

  it("files a description on every slot of its feature", async () => {
    const scan = await scanFace({
      frame,
      reader,
      describe: async () => ({
        build: "slim shoulders, long neck",
        skin: "warm olive, freckled",
        teeth: "even and bright, upper row shown in a smile",
      }),
    });
    expect(scan.descriptions.get("build")).toBe("slim shoulders, long neck");
    expect(scan.descriptions.get("skin")).toBe("warm olive, freckled");
    expect(scan.descriptions.get("teeth")).toBe("even and bright, upper row shown in a smile");
  });

  it("leaves the teeth row empty on the closed mouth every cast frame has", async () => {
    /*
      The common case, and the one the bench measured 17 times on real masters:
      the roll prompt says "Mouth closed" with override authority, so the honest
      answer is null and a row with no content does not draw. This pins that a
      null costs the panel nothing rather than filing an empty string.
    */
    const scan = await scanFace({
      frame,
      reader,
      describe: async () => ({ build: "slim shoulders", skin: "warm olive", teeth: null }),
    });
    expect(scan.descriptions.has("teeth")).toBe(false);
    expect(scan.descriptions.get("build")).toBe("slim shoulders");
  });

  /*
    HER TEETH GET A BOX WHEN THEY ARE IN THE PICTURE (fable-463).

    The founder: *"her teeth never gained a bounding box after the edit"* — the
    smile delivered, the teeth plainly there, and the row riding words alone
    because the catalogue refuses to CUT a teeth crop (it would be the mouth
    under a second name) and therefore gave the slot no region at all. The
    display door is the skin precedent, with the region chosen by measurement:
    "teeth" answers the teeth on a smiling frame and nothing on a closed mouth,
    so the region is its own discriminator.
  */
  it("gives the teeth row a box when the reader finds teeth", async () => {
    const scan = await scanFace({
      frame,
      reader: { ...reader, region: async ({ name }: { name: string }) => mask },
      describe: async () => ({ build: null, skin: null, teeth: "even and bright" }),
    });
    expect(scan.boxes.has("teeth")).toBe(true);
    expect(scan.masks.has("teeth")).toBe(true);
  });

  it("and NO box on the closed mouth every cast frame has — the control", async () => {
    /*
      The reading itself is the discriminator, so the control is a reader that
      answers this question with nothing — which is what the founder's own
      closed-mouth frame produced (0 px against 2,363 for the lips).
    */
    const bare: Mask = { data: Buffer.from([0]), width: 1, height: 1 };
    const scan = await scanFace({
      frame,
      reader: {
        ...reader,
        region: async ({ name }: { name: string }) => (name === "teeth" ? bare : mask),
      },
      describe: async () => ({ build: "slim shoulders", skin: "warm olive", teeth: null }),
    });
    expect(scan.boxes.has("teeth")).toBe(false);
    expect(scan.masks.has("teeth")).toBe(false);
    /* And the lips row, a different question, is untouched. */
    expect(scan.boxes.has("lips")).toBe(true);
  });

  it("asks nothing when it is handed no describer", async () => {
    /* `describe` is required and `null` is a real answer — the default that
       used to be here made every unit suite reach the paid transport. */
    const scan = await scanFace({ frame, reader, describe: null });
    expect(scan.descriptions.size).toBe(0);
  });

  it("records a failed description and keeps the rest of the scan", async () => {
    const scan = await scanFace({
      frame,
      reader,
      describe: async () => { throw new Error("transport down"); },
    });
    expect(scan.descriptions.size).toBe(0);
    expect(scan.boxes.size).toBeGreaterThan(0);
    expect(scan.failed.map((entry) => entry.question)).toContain("descriptions");
  });
});

describe("and the panel puts them where the library is silent", () => {
  const SHE: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };
  const FRAME = { width: 1024, height: 1536 };

  function panelWith(rows: StoredReference[], words: Map<string, readonly string[]>): PanelRow[] {
    return facePanel({
      rows,
      pronouns: SHE,
      contentUrl: (key) => `https://bucket.example/${key}`,
      maskUrl: (key) => `/proxy/${key}`,
      /*
        BOTH described rows now have a place on the photograph, which is the
        price of admission to the panel (fable-414, built in fable-428): her
        build's region is COMPOSED (`belowHeadMask`) and her skin's is DRAWN
        from `face skin` — a region it may never be cut from. Without those
        boxes neither row renders, so a fixture without them would be testing
        the words channel against a row that cannot exist.
      */
      scan: {
        frameUrl: "https://bucket.example/frame.png",
        slots: new Map([
          ["build", { box: { x: 60, y: 700, width: 900, height: 800, frame: FRAME }, maskUrl: "/proxy/build-mask" }],
          ["skin", { box: { x: 330, y: 260, width: 340, height: 470, frame: FRAME }, maskUrl: "/proxy/skin-mask" }],
        ]),
        words,
      },
    }).groups.flatMap((group) => group.rows);
  }

  it("fills a row the library is silent about", () => {
    /*
      The founder's complaint — *"obviously missing her body"* — used to be
      answered by this channel ALONE: the row existed only because a sentence
      was read for it. Since the box rule (fable-414) her build has a place on
      the photograph of its own, so the row is drawn by its geometry and this
      channel is what it SAYS. Both halves are asserted, because a row that
      draws and says nothing is the empty square he complained about first.
    */
    const silent = panelWith([], new Map()).find((row) => row.slots.includes("build"));
    expect(silent?.words).toEqual([]);
    expect(silent?.regions).toHaveLength(1);

    const spoken = panelWith([], new Map([["build", ["slim shoulders, long neck"]]]))
      .find((row) => row.slots.includes("build"));
    expect(spoken?.words).toEqual(["slim shoulders, long neck"]);
  });

  it("never argues with what an edit filed — the library wins whole", () => {
    /* The fixture's `slot` is load-bearing: without it the row never reaches
       the library at all and the assertion passes for the wrong reason — which
       is exactly how it failed first. */
    const edited: StoredReference = {
      id: 1, publicId: "pub-1", candidateId: 7, variantId: 11, slot: "build", role: "carry", tier: "anatomy",
      noun: "build", words: ["broader shoulders"], storageKey: null, maskKey: null, digest: null,
      geometry: null, guard: null, refusal: null, version: 1, retiredAt: null,
      createdAt: new Date(2026, 7, 13, 12, 0, 0),
    };
    const rows = panelWith([edited], new Map([["build", ["slight, narrow shoulders"]]]));
    const body = rows.find((row) => row.slots.includes("build"));
    expect(body?.words).toEqual(["broader shoulders"]);
    expect(body?.words).not.toContain("slight, narrow shoulders");
  });

  it("claims no provenance for a described row", () => {
    /* "She came with it" and "from an edit" are facts about a library row. A
       description is neither, so the row says nothing about where it came
       from rather than saying something untrue. */
    const rows = panelWith([], new Map([["skin", ["warm olive, freckled across the nose"]]]));
    expect(rows.find((row) => row.slots.includes("skin"))?.from).toBeNull();
  });
});
