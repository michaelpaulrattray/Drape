/**
 * THE OPEN LANE'S ACCEPTANCE PATH — step 5a's arms.
 *
 * Every reading here is DICTATED. The guards being driven are ones the model
 * usually satisfies, so a suite that reached a real transport would be testing
 * its good behaviour and calling it a control (law 3). The engine says exactly
 * what each arm needs it to say, and the doors are proved by what they refuse.
 */
import { describe, expect, it, vi } from "vitest";

import { acceptOpenKind } from "./openLaneAccept";
import type { TextEngine } from "../providers/types";

/** A transport that says exactly what it is told to. */
function engineSaying(text: string): TextEngine {
  return {
    id: "fake",
    complete: vi.fn(async () => ({
      text,
      provenance: { provider: "fake", model: "fake" } as never,
      latencyMs: 1,
    })),
  };
}

/** What `readDelta` hands over: the subject it did not own and its value. */
const unowned = (subject: string, value: unknown) => [{ subject, value }];

describe("the open lane's acceptance path", () => {
  it("does nothing at all when the reader owned every subject", async () => {
    /* The property that makes this safe to put on the live interpreter path:
       an ordinary ask never reaches the lane and never spends its call. */
    const engine = engineSaying('{"kind":"fangs"}');
    const opened = await acceptOpenKind({
      instruction: "give her green eyes", unowned: [], engine,
    });

    expect(opened).toBeNull();
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it("names the kind and files the customer's own words", async () => {
    const opened = await acceptOpenKind({
      instruction: "give him long slender fangs",
      unowned: unowned("fangs", "long slender fangs"),
      engine: engineSaying('{"kind":"fangs"}'),
    });

    expect(opened).toEqual({
      ok: true,
      kind: "fangs",
      ask: { noun: "fangs", words: "long slender fangs" },
      outcome: "words_only",
    });
  });

  it("REFUSES a key the closed lane already owns — a routing bug, never a new kind", async () => {
    /*
      §8 step 0, the choice that cannot be retrofitted: the lane is a FALLBACK,
      not a peer. `antlers` folds to the closed subject `horns`, which the
      catalogue owns with a vocabulary, a court and a per-side carrier. Minting
      `open:antlers` beside it would put two keys over one feature — and it is
      how *"give her wings"* would stop being eyeliner.
    */
    const opened = await acceptOpenKind({
      instruction: "give him antlers",
      unowned: unowned("antlers", "antlers"),
      engine: engineSaying('{"kind":"antlers"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "collides", outcome: "refused" });
  });

  it("⚠ RESCUES THE ORB when the namer answers about the HORNS beside it", async () => {
    /*
      fable-1371 §A, mechanism bought at the raw reply (opus-1026 §2). The
      founder asked for both features in one sentence and paid 25 credits for it:

        interpreter  {"free": {"horns": "…", "orb": "…"}}    ← BOTH, correctly
        normalizer   {"kind": "horns"}                       ← the CLOSED one
        → collides → refused as a routing bug → the orb filed NOTHING

      A sentence naming ONE uncatalogued thing is fully determined and the namer
      answers correctly, 2/2. TWO — one closed, one open — is under-determined,
      and it picks the first salient noun. The collision guard then did its job
      on the wrong noun.

      The engine here says what the real one said, so the arm is the incident.
    */
    const opened = await acceptOpenKind({
      instruction: "give her two smooth bone-white horns rising from the top of her head, "
        + "and a glowing red vertical slit orb embedded in the centre of her forehead",
      unowned: unowned("orb", "a glowing red vertical slit orb embedded in the centre of her forehead"),
      engine: engineSaying('{"kind":"horns"}'),
    });

    expect(opened).toEqual({
      ok: true,
      kind: "orb",
      ask: {
        noun: "orb",
        words: "a glowing red vertical slit orb embedded in the centre of her forehead",
      },
      outcome: "words_only",
    });
  });

  it("⚠ CONTROL — the routing guard is NOT weakened: a colliding SUBJECT still refuses", async () => {
    /*
      The load-bearing half. The rescue reads the parse's own unowned key through
      the SAME `closedSubjectFor`, so §1's measured routing bug — a reply keying
      a closed subject under a name the free lane does not hold — refuses exactly
      as it did. Without this arm the fix is indistinguishable from switching the
      collision guard off whenever anything is unowned.
    */
    const opened = await acceptOpenKind({
      instruction: "give her rosy cheeks",
      unowned: unowned("cheeks", "rosy"),
      engine: engineSaying('{"kind":"cheekbones"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "collides", outcome: "refused" });
  });

  it("CONTROL — a subject key that is not a plain noun is not rescued", async () => {
    /* The rescue reads a KEY, and a key that could not be a kind is left alone:
       the namer's refusal stands rather than being replaced by nonsense. */
    const opened = await acceptOpenKind({
      instruction: "give her antlers and a third eye",
      unowned: unowned("a third eye on her forehead, glowing", "glowing"),
      engine: engineSaying('{"kind":"antlers"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "collides", outcome: "refused" });
  });

  it("REFUSES words the customer's own sentence does not contain", async () => {
    /*
      Every guard the free lane runs, the open lane runs (§2 property 3) — and
      containment matters MORE here, because there is no vocabulary to fall back
      on. *"A scar on her cheek"* stays that; it does not become a long knife
      scar, and an open kind has nothing but these words to be painted from.
    */
    const opened = await acceptOpenKind({
      instruction: "give him fangs",
      unowned: unowned("fangs", "enormous dripping blood-stained fangs"),
      engine: engineSaying('{"kind":"fangs"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "unfileable", kind: "fangs", outcome: "refused" });
  });

  it("CONTROL — the same door PASSES the words they did say", async () => {
    /*
      Without this arm the refusal above is satisfied by a door that refuses
      everything, which is the same verdict wearing a different word.
    */
    const opened = await acceptOpenKind({
      instruction: "give him enormous fangs",
      unowned: unowned("fangs", "enormous fangs"),
      engine: engineSaying('{"kind":"fangs"}'),
    });

    expect(opened).toMatchObject({ ok: true, kind: "fangs" });
  });

  it("REFUSES the stage — wall (b) does not fall because a lane opened beside it", async () => {
    /*
      §2, property 3, and the arm exists because this door nearly dropped it.
      The closed reader refuses a garment by having no subject to file it under,
      so `coat` arrives here as an unowned subject exactly like `fangs` does. A
      lane that accepted it would turn the one wall keeping a face edit from
      repainting the room into its own front door.

      The garment is in the KEY and not in the value, which is why the lexicon
      is asked of the noun as well as the words.
    */
    const opened = await acceptOpenKind({
      instruction: "put her in a red coat",
      unowned: unowned("coat", "red"),
      engine: engineSaying('{"kind":"coat"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "unfileable", outcome: "refused" });
  });

  it("REFUSES a stage word hiding in the WORDS as well as the noun", async () => {
    const opened = await acceptOpenKind({
      instruction: "give him fangs against a red backdrop",
      unowned: unowned("fangs", "fangs against a red backdrop"),
      engine: engineSaying('{"kind":"fangs"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "unfileable", kind: "fangs" });
  });

  it("CONTROL — the accessory carve-out survives the stage wall here too", async () => {
    /* *"Wearing"* is how anyone describes an earring, and it is exempt in the
       lexicon. An open kind said the same way must not be refused on the one
       verb the carve-out exists for. */
    const opened = await acceptOpenKind({
      instruction: "give him wearing small bone amulets",
      unowned: unowned("amulets", "wearing small bone amulets"),
      engine: engineSaying('{"kind":"amulets"}'),
    });

    expect(opened).toMatchObject({ ok: true, kind: "amulets" });
  });

  it("fails CLOSED with no transport — no key, and no kind to record demand against", async () => {
    /* A lane that guessed its own key when the transport was down would file
       demand rows for a noun nobody produced. */
    const opened = await acceptOpenKind({
      instruction: "give him fangs",
      unowned: unowned("fangs", "fangs"),
      engine: null,
    });

    expect(opened).toEqual({ ok: false, reason: "unreadable", outcome: "unreadable" });
    expect(opened).not.toHaveProperty("kind");
  });

  it("refuses a value that is not words at all", async () => {
    const opened = await acceptOpenKind({
      instruction: "give him fangs",
      unowned: unowned("fangs", { length: "long" }),
      engine: engineSaying('{"kind":"fangs"}'),
    });

    expect(opened).toMatchObject({ ok: false, reason: "unfileable", kind: "fangs" });
  });

  it("reads the FIRST unowned subject and spends exactly one call for the sentence", async () => {
    /*
      One open kind per instruction, declared: the normalizer is asked *what is
      the THING* of a whole sentence, and its three stability bars were measured
      on that question. One call per unowned subject would be a question nobody
      measured.
    */
    const engine = engineSaying('{"kind":"fangs"}');
    const opened = await acceptOpenKind({
      instruction: "give him fangs and gills",
      unowned: [
        { subject: "fangs", value: "fangs" },
        { subject: "gills", value: "gills" },
      ],
      engine,
    });

    expect(opened).toMatchObject({ ok: true, kind: "fangs" });
    expect(engine.complete).toHaveBeenCalledTimes(1);
  });
});
