/**
 * The makeup reader's doors, driven directly.
 *
 * Every refusal here is reachable with a fake transport, which is the point:
 * this road's guard cannot be tested through a model that usually behaves
 * (working law 3). The engine is a stub that returns whatever a case needs,
 * including malformed replies a real one would rarely produce and this one must
 * survive.
 *
 * Two disciplines the file keeps on purpose:
 *
 * - **the hair backstop gets both controls** — a hair answer is refused AND a
 *   cosmetic answer that merely contains a hair-adjacent word is admitted. A
 *   guard proven only in the direction it was written for is how a rule ends up
 *   banning the carve-out it was built to protect;
 * - **the cap is asserted against the DESTINATION's constant**, imported, never
 *   retyped — a sentence that passes here and is refused by `refineDelta` would
 *   kill her ask for a reason she cannot see.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { MAX_MAKEUP_LENGTH } from "./refineDelta";
import {
  MAKEUP_SLOTS,
  MAKEUP_SLOT_MAX_LENGTH,
  composeMakeupSentence,
  readMakeupFromReference,
  readMakeupSlot,
} from "./makeupFromReference";

/** A transport that answers with exactly the text a case needs. */
function engineReturning(text: string, capture?: (request: TextRequest) => void): TextEngine {
  return {
    id: "fake",
    complete: async (request) => {
      capture?.(request);
      return { text } as Awaited<ReturnType<TextEngine["complete"]>>;
    },
  };
}

function engineThrowing(): TextEngine {
  return {
    id: "fake",
    complete: async () => {
      throw new Error("transport died");
    },
  };
}

const REFERENCE = {
  bytes: Buffer.from("not really a jpeg"),
  contentType: "image/jpeg",
};

/**
 * A clean read of a face wearing a full look.
 *
 * **It carries `subject` because the reply contract now requires it** (the
 * out-of-class door, ordered fable-1068 §4): the class question is asked before
 * the surfaces and admission is POSITIVE, so a fixture that does not answer it
 * is a reply the door could not judge and is refused as `unreadable`. Every
 * fixture below that expects to reach the surfaces therefore answers it — which
 * is the contract change stated in the fixtures rather than hidden in a helper.
 */
const FULL_FACE = JSON.stringify({
  subject: "cosmetics",
  eyes: "soft brown smoky shadow",
  lips: "nude matte lip",
  brows: "brushed up",
  complexion: "dewy skin",
});

describe("readMakeupSlot", () => {
  it("keeps a phrase, normalised", () => {
    expect(readMakeupSlot("  Soft   Brown Smoky Shadow. ")).toEqual({ kind: "value", value: "soft brown smoky shadow" });
  });

  it("reads every spelling of nothing as nothing — the bug that reached the slot once", () => {
    /* `makeup: "none — a bare face"` is on the record as a value that became an
       instruction (D-172). Every one of these must be null, not a string. */
    for (const nothing of ["null", "none", "None", "n/a", "N/A", "unknown", "unclear", "nothing", "bare", "none — a bare face"]) {
      expect(readMakeupSlot(nothing)).toEqual({ kind: "absent" });
    }
  });

  it("reads an ABSENCE described as a presence as nothing — the measured tells", () => {
    /* From the first real specimen: `brows: "naturally groomed, unfilled"` on a
       bare face. The reader was right about the face and reported the absence
       in a slot contracted to answer null. */
    expect(readMakeupSlot("naturally groomed, unfilled")).toEqual({ kind: "absent" });
    expect(readMakeupSlot("brows untinted")).toEqual({ kind: "absent" });
    expect(readMakeupSlot("no makeup on the lips")).toEqual({ kind: "absent" });
    expect(readMakeupSlot("not wearing any base")).toEqual({ kind: "absent" });
  });

  it("KEEPS 'natural', because a natural look is a real thing to copy", () => {
    /*
      The carve-out the absence guard must not eat. "Natural" names a look a
      person wears and a customer asks for; banning it would be the guard
      banning what it exists to protect — the misaimed-guard mistake, applied in
      advance rather than after the incident.
    */
    expect(readMakeupSlot("natural matte finish")).toEqual({ kind: "value", value: "natural matte finish" });
    expect(readMakeupSlot("soft natural rose tint")).toEqual({ kind: "value", value: "soft natural rose tint" });
    expect(readMakeupSlot("naturally groomed brows")).toEqual({ kind: "value", value: "naturally groomed brows" });
  });

  it("refuses a non-string, because a model's JSON is input and not a promise", () => {
    expect(readMakeupSlot(42)).toEqual({ kind: "absent" });
    expect(readMakeupSlot(null)).toEqual({ kind: "absent" });
    expect(readMakeupSlot({ eyes: "x" })).toEqual({ kind: "absent" });
    expect(readMakeupSlot(["x"])).toEqual({ kind: "absent" });
  });

  it("calls an over-long answer TOO LONG and never ABSENT — they are opposite facts", () => {
    /*
      THE REGRESSION THE FIRST POSITIVE CONTROL BOUGHT (opus-694).

      A black winged smoky eye came back as `"smoky shadow, winged liner,
      lashes"` — 34 characters against a cap of 32 — and returned null, the same
      value this reader uses for "nothing was applied here". The loudest makeup
      in the picture vanished into a word meaning its opposite, and nothing
      reported it. The two facts are distinct here now, and the boundary is
      asserted at the boundary rather than near it.
    */
    expect(readMakeupSlot("x".repeat(MAKEUP_SLOT_MAX_LENGTH)))
      .toEqual({ kind: "value", value: "x".repeat(MAKEUP_SLOT_MAX_LENGTH) });
    expect(readMakeupSlot("x".repeat(MAKEUP_SLOT_MAX_LENGTH + 1)))
      .toEqual({ kind: "tooLong", length: MAKEUP_SLOT_MAX_LENGTH + 1 });
  });

  it("fits the eye description that convicted the old cap", () => {
    /* The measured specimen, at its measured length. If the cap is ever tightened
       back under this, the frame that found it says so immediately. */
    const eye = "smoky shadow, winged liner, lashes";
    expect(eye.length).toBe(34);
    expect(readMakeupSlot(eye)).toEqual({ kind: "value", value: eye });
  });

  it("scrubs a brand, and refuses the answer if scrubbing empties it", () => {
    const scrubbed = readMakeupSlot("Chanel red lip");
    expect(scrubbed.kind).toBe("value");
    if (scrubbed.kind !== "value") return;
    expect(scrubbed.value).not.toContain("chanel");
  });
});

describe("composeMakeupSentence", () => {
  it("composes in the artist's order, not the object's", () => {
    const { sentence, used } = composeMakeupSentence({
      complexion: "dewy skin",
      brows: "brushed up",
      lips: "nude matte lip",
      eyes: "smoky shadow",
    });
    expect(used).toEqual(["eyes", "lips", "brows", "complexion"]);
    expect(sentence).toBe("smoky shadow, nude matte lip, brushed up, dewy skin");
  });

  it("skips a surface with nothing on it without leaving a hole", () => {
    const { sentence, used, dropped } = composeMakeupSentence({
      eyes: "winged liner",
      lips: null,
      brows: null,
      complexion: "matte base",
    });
    expect(sentence).toBe("winged liner, matte base");
    expect(used).toEqual(["eyes", "complexion"]);
    expect(dropped).toEqual([]);
  });

  /*
    The drop path survives, and what it is FOR changed on 2026-08-18. With the
    budget derived from the slot contract, four legal answers always fit — so
    this can only fire on answers longer than the contract allows, which
    `readMakeupSlot` refuses upstream. It is the emergency path, and it is
    tested by handing the composer something the reader would never give it.
  */
  it("drops rather than overflowing if it is handed answers past the contract", () => {
    const long = "x".repeat(MAKEUP_SLOT_MAX_LENGTH + 20);
    const { sentence, used, dropped } = composeMakeupSentence({
      eyes: long,
      lips: long,
      brows: long,
      complexion: long,
    });
    expect(sentence.length).toBeLessThanOrEqual(MAX_MAKEUP_LENGTH);
    expect(used).toEqual(["eyes", "lips"]);
    /* Not silence: the surfaces that did not fit come back named. */
    expect(dropped).toEqual(["brows", "complexion"]);
  });

  /*
    HIS VERDICT, AS A TEST — *"for 2) specimen 1 did it get the
    blusher/highlight and bronzer?"* (fable-950 §1). It did not, and this is the
    frame's own answer rather than a fixture I invented: four reads of specimen
    1 through the shipped reader and the shipped transport, three of which came
    back with exactly these four values.

    Written against EVERY SURFACE THE READER VALUED rather than against a
    number, so it cannot pass by the cap being nudged to fit one specimen.
  */
  it("carries every surface the reader valued — a copied look is four surfaces, not two", () => {
    const asRead = {
      eyes: "smoky black shadow, winged liner, lashes",
      lips: "matte red lipstick",
      brows: "filled, defined arch",
      complexion: "foundation with contour and highlight",
    };
    const { sentence, used, dropped } = composeMakeupSentence(asRead);
    expect(dropped).toEqual([]);
    expect(used).toEqual([...MAKEUP_SLOTS]);
    /* And his own words are in it — the cheek work is the thing he missed. */
    expect(sentence).toContain("contour and highlight");
  });

  /*
    THE BUDGET IS DERIVED, NOT CHOSEN — so a surface can never be dropped for
    room that the slot contract already promised it. Before this, the sentence
    cap was a number judged in the destination and the slot cap a number judged
    here, and nothing anywhere checked that the second could fit inside the
    first: four legal slot answers needed 121 characters of an 80-character
    budget, and surfaces three and four were routinely lost.
  */
  it("has room for every slot answering at its maximum", () => {
    expect(MAX_MAKEUP_LENGTH).toBeGreaterThanOrEqual(
      MAKEUP_SLOTS.length * MAKEUP_SLOT_MAX_LENGTH + (MAKEUP_SLOTS.length - 1) * 2,
    );
  });

  it("never exceeds the cap for any combination of maximum-length answers", () => {
    /* The cap is the whole reason this composes rather than concatenating. */
    const worst = "y".repeat(MAKEUP_SLOT_MAX_LENGTH);
    const { sentence } = composeMakeupSentence(
      Object.fromEntries(MAKEUP_SLOTS.map((slot) => [slot, worst])),
    );
    expect(sentence.length).toBeLessThanOrEqual(MAX_MAKEUP_LENGTH);
  });

  it("returns an empty sentence when every surface is bare", () => {
    const { sentence, used } = composeMakeupSentence({
      eyes: null, lips: null, brows: null, complexion: null,
    });
    expect(sentence).toBe("");
    expect(used).toEqual([]);
  });
});

describe("readMakeupFromReference", () => {
  it("returns a sentence inside the destination's cap, all four surfaces intact", async () => {
    /* This fixture composed to 62 of 80 and was read as proof the cap was the
       right size. It was not — a HAND-WRITTEN full face fits where the real
       reader's own words did not, and four reads of a real frame needed 121.
       The fixture is kept because it still proves all four surfaces survive a
       clean read; it is no longer quoted as evidence about the budget, which
       is now derived rather than judged against a specimen. */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(FULL_FACE),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.sentence).toBe(
      "soft brown smoky shadow, nude matte lip, brushed up, dewy skin",
    );
    expect(outcome.sentence.length).toBeLessThanOrEqual(MAX_MAKEUP_LENGTH);
    expect(outcome.used).toEqual(["eyes", "lips", "brows", "complexion"]);
    expect(outcome.dropped).toEqual([]);
  });

  it("asks for cosmetics only, and says so at the wire", async () => {
    /* Assert at the wire: the fence is a property of the request that is SENT,
       not of a constant sitting near it. */
    let sent: TextRequest | undefined;
    await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(FULL_FACE, (request) => { sent = request; }),
    });
    expect(sent).toBeDefined();
    const user = sent?.user ?? "";
    expect(user).toMatch(/COSMETICS THAT WERE APPLIED/);
    expect(user).toMatch(/never describe the person/i);
    expect(user).toMatch(/not their hair/i);
    expect(user).toMatch(/Never name a brand/i);
    /* The presence gate is ASKED — the half that is proven here; that it is
       CONSULTED is proven by the three cases above it. A gate present in the
       prompt and ignored in the code is the exact shape this pair rules out. */
    expect(user).toMatch(/is this face wearing makeup that was APPLIED/i);
    expect(user).toMatch(/those are the PERSON, not makeup/);
    expect(user).toMatch(/"wearing"/);
    expect(sent?.temperature).toBe(0);
    expect(sent?.json).toBe(true);
    /* The picture goes to the reader and nowhere else — one image, hers. */
    expect(sent?.images).toHaveLength(1);
    expect(sent?.images?.[0]?.bytes).toBe(REFERENCE.bytes);
  });

  it("survives a fenced code block, which is how this transport often replies", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning("```json\n" + FULL_FACE + "\n```"),
    });
    expect(outcome.ok).toBe(true);
  });

  it("refuses rather than guesses when the reply is not JSON", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning("She looks lovely!"),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("unreadable");
  });

  it("refuses when the transport dies, and says nothing about her face", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineThrowing(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("unreadable");
  });

  it("refuses when there is no transport at all", async () => {
    const outcome = await readMakeupFromReference({ ...REFERENCE, engine: null });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("noTransport");
  });

  /* ---- the presence gate (opus-693 §4, ruled fable-946 §4) ---- */

  it("stops on an explicit 'no', even when the surfaces are full of prose", async () => {
    /*
      THE FAILURE THIS EXISTS FOR, driven directly. The first real specimen
      delivered a sentence for a bare face because the reader always finds
      something to say. The gate is asked FIRST and consulted FIRST, so its
      answer ends the read whatever the surfaces claim.
    */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(JSON.stringify({
        subject: "cosmetics",
        wearing: "no",
        eyes: "soft shadow",
        lips: "natural mauve tint",
        brows: "naturally groomed",
        complexion: "natural matte finish",
      })),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("noMakeupVisible");
  });

  it("does NOT treat a missing gate answer as 'she is bare'", async () => {
    /* The other direction, and it matters: refusing on an absent field would
       turn every malformed reply into a claim about a real person's face. Only
       an explicit negative closes the gate. */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(FULL_FACE),
    });
    expect(outcome.ok).toBe(true);
  });

  it("REPORTS a surface whose answer was too long, rather than losing it", async () => {
    /* The end-to-end half of the same defect: `readMakeupSlot` now tells the
       two facts apart, and this proves the caller passes the distinction on to
       her instead of absorbing it. A surface she is told about is one she can
       type herself; a surface she is not told about is gone. */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(JSON.stringify({
        subject: "cosmetics",
        wearing: "yes",
        eyes: "x".repeat(MAKEUP_SLOT_MAX_LENGTH + 1),
        lips: "matte red",
      })),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.sentence).toBe("matte red");
    expect(outcome.used).toEqual(["lips"]);
    expect(outcome.dropped).toContain("eyes");
  });

  it("admits when the gate says yes", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(JSON.stringify({ subject: "cosmetics", wearing: "yes", eyes: "winged liner" })),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.sentence).toBe("winged liner");
  });

  it("says a bare face is a bare face instead of filing the words 'bare face'", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(
        JSON.stringify({ subject: "cosmetics", eyes: null, lips: "none", brows: null, complexion: "n/a" }),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("noMakeupVisible");
  });

  /* ---- the hair backstop, in BOTH directions ---- */

  it("refuses BY NAME when the read came back describing hair (D-176)", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(
        JSON.stringify({ subject: "cosmetics", eyes: "soft shadow", lips: null, brows: null, complexion: "pink hair colour" }),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("namesHair");
    /* Never silent about a partial take — the upload door's own rule. */
    expect(outcome.refusal.message).toContain("Nothing was charged");
  });

  it("ADMITS the cosmetics a hair word sits beside — the carve-out the guard exists to protect", async () => {
    /* `namesHairColour` knows "bleached brows" and "tinted moisturiser" are
       cosmetics whatever verb is next to them. If this ever reddens, the
       backstop has started banning makeup. */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(
        JSON.stringify({ subject: "cosmetics", eyes: null, lips: null, brows: "bleached brows", complexion: "tinted moisturiser" }),
      ),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.sentence).toBe("bleached brows, tinted moisturiser");
  });

  it("keeps nothing — the reference is not written, stored or hashed anywhere", async () => {
    /*
      The fence is an ABSENCE (fable-941 §1). There is no storage seam to stub
      here, and that is the assertion: this module imports no storage, no
      database and no manifest, so a future edit that adds one has to add the
      import too.

      AND THE CHECKER GETS A POSITIVE CONTROL, in the same test, because an
      absence assertion that cannot fail proves nothing (working law 2). The
      same three patterns are run against `inkUploadService.ts` — the module on
      this very road that DOES keep bytes — and every one of them must fire
      there. If a rename ever makes these patterns inert, this half reddens
      first and the green half stops being believed.
    */
    const fs = await import("node:fs/promises");
    const read = (name: string) => fs.readFile(new URL(`./${name}`, import.meta.url), "utf8");

    const keepsBytes = [/from "\.\.\/storage"/, /from "\.\.\/db\//, /storagePut/];

    const control = await read("inkUploadService.ts");
    for (const pattern of keepsBytes) expect(control).toMatch(pattern);

    const source = await read("makeupFromReference.ts");
    for (const pattern of keepsBytes) expect(source).not.toMatch(pattern);
    expect(source).not.toMatch(/createStorageCleanupManifest|withTransaction/);
  });
});

/**
 * THE OUT-OF-CLASS DOOR — ordered fable-1068 §4, driven red-first.
 *
 * The defect it exists for was found while pricing the attach read (opus-785
 * §3): the shipped reader was handed a photograph of a bald, bearded man with
 * metal implants across his scalp and jaw and one glowing red eye — no
 * cosmetics anywhere in it — and answered in the makeup vocabulary with no
 * hedge, describing prosthetics as a look. Harmless there; the same reader is
 * about to be handed a customer's own uploaded photograph, with its sentence
 * riding into a paid render.
 *
 * **These fixtures are AUTHORED, not the record.** The pricing script kept the
 * composed sentence and not the raw reply, so nothing here is quoted as the
 * reader's own words — a reconstruction presented as a record is a claim
 * wearing a fact's clothes. What these arms prove is the DOOR: given a reply
 * that names its subject, the module refuses or admits correctly. That the real
 * reader NAMES it is a different question, and it is bought with the real
 * reader on the two specimens (`scripts/court-out-of-class-disposable.mts`).
 */
describe("the out-of-class door", () => {
  const PROSTHETICS = JSON.stringify({
    subject: "prosthetics",
    wearing: "yes",
    eyes: "glowing red iris effect",
    lips: null,
    brows: "mechanical seam detailing",
    complexion: "prosthetic circuitry, metallic implant detailing",
  });

  it("refuses a subject that is not cosmetics, however fluent the surfaces are", async () => {
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(PROSTHETICS),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("outOfClass");
    /* The sentence names what happened without repeating the reader's prose —
       a reader's words are a pointer to look, never a fact to hand a customer
       (law 9). */
    expect(outcome.refusal.message).toMatch(/isn't makeup/i);
    expect(outcome.refusal.message).toMatch(/nothing was charged/i);
  });

  it("does not let four confident surfaces outvote the class answer", async () => {
    /*
      THE ORDERING IS THE POINT, and it is the presence gate's own argument
      (fable-946 §4). The failure this door exists for is a reader that finds
      something to say about every picture, so the place to stop it is BEFORE
      its prose is consulted at all — not as a tiebreak after four fluent
      phrases have been composed into a sentence.
    */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(PROSTHETICS),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).not.toBe("noMakeupVisible");
  });

  it("reads an unanswered class question as unreadable, never as a verdict about the face", async () => {
    /*
      A reply that never answered the class question is a reply this door could
      not judge — so it takes the existing `unreadable` sentence rather than a
      new one. Refusing a transport hiccup with *"what's on that face isn't
      makeup"* would be a CLAIM about a real person's photograph, produced by a
      reader that said nothing of the kind. That is the presence gate's scar
      (`undefined` is not `no`) applied to the class question, and it is why
      strictness here buys a different code rather than the same sentence.
    */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(JSON.stringify({
        wearing: "yes",
        eyes: "soft brown smoky shadow",
        lips: "nude matte lip",
      })),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("unreadable");
  });

  it("admits the carve-out it exists to protect — a named cosmetic subject reads through", async () => {
    /*
      THE POSITIVE CONTROL, kept in the same file as the refusal (working law
      2). A door proven only in the direction it was written for is how a guard
      ends up refusing everybody, and this repository has already banned a
      carve-out once that way (the `shave`/`shape` typo gate).
    */
    const outcome = await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(JSON.stringify({ subject: "cosmetics", wearing: "yes", ...JSON.parse(FULL_FACE) })),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.sentence).toBe("soft brown smoky shadow, nude matte lip, brushed up, dewy skin");
  });

  it("asks the class question at the wire, with the out-of-class answers named", async () => {
    /*
      ASSERT AT THE WIRE (invariant 5). And the second half is the one that
      matters: naming the out-of-class ANSWERS is the whole mechanism. A reader
      offered only *cosmetics* and *nothing* has no word for a prosthetic and
      will reach for the nearest one it has — which is the defect, not a fix.
    */
    let sent: TextRequest | undefined;
    await readMakeupFromReference({
      ...REFERENCE,
      engine: engineReturning(FULL_FACE, (request) => { sent = request; }),
    });
    const user = sent?.user ?? "";
    expect(user).toMatch(/"subject"/);
    expect(user).toMatch(/prosthetics/i);
    expect(user).toMatch(/mask/i);
    expect(user).toMatch(/body paint/i);
  });
});
