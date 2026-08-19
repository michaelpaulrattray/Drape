import { describe, expect, it } from "vitest";

import {
  readWordsTake,
  refusalIsAnswerableByAReader,
  wordsTakeIntentFor,
} from "./referenceWordsLane";

/**
 * THE WORDS LANE, driven directly — the half of the reference road that can
 * never be a render (ruled fable-1103 §1).
 *
 * Every arm here is about the same asymmetry. The lane must fire on a sentence
 * that POINTS at a picture for a property a reader speaks for, and it must stay
 * out of the way of everything else — because the failure it can cause is
 * intercepting an ask that would have rendered, and the failure it prevents is
 * a paid render of words nobody read off anything.
 */
describe("which reader, if any", () => {
  it("takes a hair COLOUR ask", () => {
    expect(wordsTakeIntentFor("take the hair colour from this picture")).toBe("hair");
    expect(wordsTakeIntentFor("just the hair colour from this")).toBe("hair");
  });

  it("leaves a CROP take to the cutter", () => {
    /* Style and the whole look ride as a cropped carrier — his own split
       (§7.11 ruling 4). A words read here would answer a question she did not
       ask, and the crop road would never run. */
    expect(wordsTakeIntentFor("copy this hairstyle")).toBeNull();
    expect(wordsTakeIntentFor("copy this hair")).toBeNull();
    expect(wordsTakeIntentFor("give her the whole look from this photo")).toBeNull();
  });

  it("leaves a sentence naming TWO takes to the cutter", () => {
    /* "the colour and the cut" is a crop ask with a disclaimer, and the
       disclaimer is the words that ride WITH the crop (fable-1048). */
    expect(wordsTakeIntentFor("copy the colour and the cut from this")).toBeNull();
  });

  it("takes a makeup ask, in the three spellings", () => {
    for (const said of ["give her the makeup from this photo", "copy her make up", "the make-up in this"]) {
      expect(wordsTakeIntentFor(said)).toBe("makeup");
    }
  });

  it("does NOT take a cosmetic SURFACE ask", () => {
    /*
      "Make her eyes green like this" is an ask about a FEATURE. Routing it to a
      makeup reader would answer with a sentence about four surfaces — the
      product deciding what she meant, which is the whole defect the deleted
      per-feature link had in the other direction.
    */
    expect(wordsTakeIntentFor("make her eyes green like this")).toBeNull();
    expect(wordsTakeIntentFor("give her the lips from this photo")).toBeNull();
  });

  it("stays out of an ask that carries its own value", () => {
    /* The reference-happy cousin (fable-1104 §3): a complete ask of her own
       renders, and the picture is confessed unused. */
    expect(wordsTakeIntentFor("make her hair copper")).toBeNull();
    expect(wordsTakeIntentFor("give her a smoky eye")).toBeNull();
  });
});

describe("which refusals a reader may answer over", () => {
  it("answers the three a picture can actually fix", () => {
    for (const reason of ["unreadable", "wall_likeness", "wall_unfileable"]) {
      expect(refusalIsAnswerableByAReader(reason)).toBe(true);
    }
  });

  it("NEVER answers over the content wall", () => {
    /*
      A content wall is an answer about what was asked, not a gap a reader can
      fill. Reading a picture around it would be this lane serving the one ask
      the product refuses — and it would do it for free, quietly, on a road
      nobody is watching.
    */
    expect(refusalIsAnswerableByAReader("wall_content")).toBe(false);
  });

  it("never answers over the stage wall either", () => {
    /* A garment is not a property of a person, and no reader here speaks for
       one. */
    expect(refusalIsAnswerableByAReader("wall_stage")).toBe(false);
    expect(refusalIsAnswerableByAReader("absorbed")).toBe(false);
  });
});

describe("the read itself", () => {
  const bytes = Buffer.from("not really a picture");

  it("hands back a hair sentence with its blocks IN ENGLISH", async () => {
    const reading = await readWordsTake({
      intent: "hair",
      bytes,
      contentType: "image/png",
      readHair: async () => ({
        ok: true,
        sentence: "copper through the lengths",
        used: [{ tone: "copper", where: "through the lengths", side: null }],
        dropped: [{ tone: "ash blonde", where: "at the roots", side: null }],
      }),
    });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.sentence).toBe("copper through the lengths");
    /*
      SPELLED HERE rather than at the surface: a hair block is {tone, where}
      and a makeup surface is a plain word, and the customer is owed the same
      sentence either way. One shape crossing the boundary means the surface
      cannot say it two different ways.
    */
    expect(reading.dropped).toEqual(["ash blonde at the roots"]);
    expect(reading.outcome).toBe("delivered");
  });

  it("hands back a makeup sentence with its surfaces", async () => {
    const reading = await readWordsTake({
      intent: "makeup",
      bytes,
      contentType: "image/png",
      readMakeup: async () => ({
        ok: true,
        sentence: "a soft brown shadow and a nude lip",
        used: ["eyes", "lips"],
        dropped: ["brows"],
      }),
    });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.dropped).toEqual(["brows"]);
  });

  it("carries a refusal's own sentence, unchanged", async () => {
    /* Her sentence to read, not an exception to swallow — and never re-worded
       here, which is how two surfaces come to say different things about one
       wall. */
    const reading = await readWordsTake({
      intent: "hair",
      bytes,
      contentType: "image/png",
      readHair: async () => ({
        ok: false,
        refusal: { code: "noHairVisible", message: "I can't see any hair in that picture." },
      }),
    });
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.message).toBe("I can't see any hair in that picture.");
    /* And the tally's word for it — the two readers share one mapper, so the
       lanes cannot spell an outcome differently. */
    expect(reading.outcome).toBe("no_hair_visible");
  });

  it("asks the reader the intent names, and only that one", async () => {
    /* The positive control for the arm above: a lane that called both readers
       would spend twice and could pass every assertion here by accident. */
    let hairAsked = 0;
    let makeupAsked = 0;
    await readWordsTake({
      intent: "makeup",
      bytes,
      contentType: "image/png",
      readHair: async () => { hairAsked += 1; return { ok: false, refusal: { code: "noTransport", message: "no" } }; },
      readMakeup: async () => {
        makeupAsked += 1;
        return { ok: true, sentence: "a bare face", used: [], dropped: [] };
      },
    });
    expect(makeupAsked).toBe(1);
    expect(hairAsked).toBe(0);
  });
});
