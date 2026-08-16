/**
 * THE DEGENERATE CASE FIRST, THROUGH THE NEW COMPOSITOR, ON A FIXTURE.
 *
 * fable-171's condition 1 on the compositor swap, and §6.2's first step: a
 * no-library cast with a words-only ask is the road every NEW cast travels, so
 * it is proved first and it is proved end to end — assembled recipe, loaded
 * bytes, dispatched request.
 *
 * The engine here is a recording fake rather than a provider. That is not a
 * convenience: the claims being tested are about **what gets sent**, and the
 * only place those can be read is the outgoing request (working law 5).
 */
import { describe, expect, it } from "vitest";

import { pronounsForSex } from "./castPronouns";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";
import { repaint, type ReferenceBytes, type RepaintEngine } from "./repaintRender";

const SHE = pronounsForSex("female");
const MASTER = { key: "casting-v2/candidates/master.png" };

const BYTES: Record<string, Buffer> = {
  "casting-v2/candidates/master.png": Buffer.from("the pristine master frame"),
  "mint/hair.png": Buffer.from("the hair crop minted from the delivered frame"),
  "mint/left.png": Buffer.from("the left hoop, cut per instance"),
};

const load = async (image: { key: string }): Promise<ReferenceBytes> => {
  const bytes = BYTES[image.key];
  if (!bytes) throw new Error(`no object at ${image.key}`);
  return { bytes, contentType: "image/png" };
};

type Sent = { prompt: string; references: readonly ReferenceBytes[]; width: number; height: number };

function recordingEngine(): RepaintEngine & { sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    id: "fake:recording",
    sent,
    async edit(request) {
      sent.push({
        prompt: request.prompt,
        references: request.references,
        width: request.width,
        height: request.height,
      });
      return {
        bytes: Buffer.from("the repainted frame"),
        contentType: "image/png",
        width: request.width,
        height: request.height,
        latencyMs: 1,
        provenance: { provider: "fal", model: "fake", providerRef: "req-1" },
      };
    },
  };
}

const hair: LibraryEntry = {
  slot: "hair", tier: "anatomy", noun: "hair",
  words: ["worn down"], carry: { key: "mint/hair.png" },
};

describe("the degenerate case — no library, words only, through the new compositor", () => {
  it("sends the master alone, with the identity clause and the ask", async () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;

    const engine = recordingEngine();
    const result = await repaint({ recipe, engine, load, width: 1024, height: 1536 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(engine.sent).toHaveLength(1); /* ONE generation. There is no second pass. */
    expect(engine.sent[0]!.references).toHaveLength(1);
    expect(engine.sent[0]!.references[0]!.bytes).toEqual(BYTES[MASTER.key]);
    expect(engine.sent[0]!.prompt).toBe(recipe.prompt);
    expect(engine.sent[0]!.prompt).toContain("Change only her lips: a soft nude lip gloss.");
  });

  it("delivers the engine's own frame — nothing is composited into it", async () => {
    /*
      D-241's whole point. The old path pasted delivered pixels back onto the
      master and blended the join; if anything here did that, these bytes would
      not be the bytes the engine returned.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
    });
    if (!recipe.ok) throw new Error("the degenerate recipe must assemble");

    const engine = recordingEngine();
    const result = await repaint({ recipe, engine, load, width: 1024, height: 1536 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frame.bytes.toString()).toBe("the repainted frame");
    expect(result.frame.width).toBe(1024);
    expect(result.frame.height).toBe(1536);
  });
});

describe("assert at the wire — the array that goes out is the recipe's array", () => {
  it("dispatches the references in the order the sentences name", async () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        { slot: "earring@left", tier: "item", noun: "wide gold hoop on her left ear",
          words: ["a wide gold hoop"], carry: { key: "mint/left.png" } },
        hair,
      ],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;

    const engine = recordingEngine();
    const result = await repaint({ recipe, engine, load, width: 1024, height: 1536 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    /* The sentence claims position 2 and position 3; the request must agree. */
    expect(engine.sent[0]!.prompt).toContain("Reference 2 is the exact wide gold hoop on her left ear");
    expect(engine.sent[0]!.prompt).toContain("Reference 3 is the exact hair she has");
    expect(engine.sent[0]!.references.map((reference) => reference.bytes.toString())).toEqual([
      BYTES[MASTER.key]!.toString(),
      BYTES["mint/left.png"]!.toString(),
      BYTES["mint/hair.png"]!.toString(),
    ]);
    expect(result.sent.keys).toEqual([MASTER.key, "mint/left.png", "mint/hair.png"]);
  });

  it("records the digest of every byte it actually dispatched", async () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hair],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    if (!recipe.ok) throw new Error("recipe must assemble");
    const result = await repaint({ recipe, engine: recordingEngine(), load, width: 1024, height: 1536 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sent.digests).toHaveLength(2);
    for (const digest of result.sent.digests) expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the pixel-frozen promise is checked, not assumed", () => {
  it("REFUSES when a carried crop's bytes are not the bytes that were minted", async () => {
    /*
      "Her earrings did not move when I changed her hair" is true only if the
      bytes that ride are the bytes the library minted. A crop that changed
      underneath us would quietly redraw a feature this render promised not to
      touch — and it would look like a render, not like a fault.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...hair, carry: { key: "mint/hair.png", sha: "deadbeefdead" } }],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    if (!recipe.ok) throw new Error("recipe must assemble");

    const engine = recordingEngine();
    const result = await repaint({ recipe, engine, load, width: 1024, height: 1536 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("referenceBytesChanged");
    expect(result.key).toBe("mint/hair.png");
    expect(engine.sent).toHaveLength(0); /* refused BEFORE a paid dispatch */
  });

  it("passes when the recorded digest is the short form of the real one", async () => {
    /* The library stores a short digest for reading; a prefix still proves the
       bytes did not change, so the guard must not refuse its own format. */
    const full = (await import("node:crypto"))
      .createHash("sha256").update(BYTES["mint/hair.png"]!).digest("hex");
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...hair, carry: { key: "mint/hair.png", sha: full.slice(0, 12) } }],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    if (!recipe.ok) throw new Error("recipe must assemble");
    const result = await repaint({ recipe, engine: recordingEngine(), load, width: 1024, height: 1536 });
    expect(result.ok).toBe(true);
  });

  it("REFUSES rather than paints when a named reference cannot be loaded", async () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...hair, carry: { key: "mint/vanished.png" } }],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    if (!recipe.ok) throw new Error("recipe must assemble");

    const engine = recordingEngine();
    const result = await repaint({ recipe, engine, load, width: 1024, height: 1536 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("referenceMissing");
    expect(engine.sent).toHaveLength(0);
  });
});

/**
 * THE CARRIED CROPS ARE FETCHED TOGETHER — and the refusal still names the same
 * one (fable-695 §4b, stage 2).
 *
 * These are storage reads of objects the recipe already names, independent by
 * construction, and they were issued one after another on the customer's paid
 * wait. Issuing them together is safe in a way the provider calls are not — but
 * it puts one guarantee at risk that nothing else here would have caught: with
 * loads running at once, "the first one that failed" and "the first one in the
 * recipe" stop being the same reference, and a render could name a different
 * missing crop each time it refused.
 */
describe("the references are loaded at once, in the recipe's own order", () => {
  const threeReferences = () => assembleRecipe({
    master: MASTER, pronouns: SHE, library: [hair],
    asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
  });

  it("issues the loads together rather than one after another", async () => {
    const recipe = threeReferences();
    if (!recipe.ok) throw new Error("the recipe must assemble");
    expect(recipe.references.length, "more than one thing to fetch").toBeGreaterThan(1);

    let inFlight = 0;
    let peak = 0;
    const watching = async (image: { key: string }): Promise<ReferenceBytes> => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      /* A real tick: an `async` that never yields cannot overlap with anything,
         so a watcher without one reports "serial" whatever the caller does. */
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return load(image);
    };

    const result = await repaint({
      recipe, engine: recordingEngine(), load: watching, width: 1024, height: 1536,
    });
    expect(result.ok).toBe(true);
    expect(peak, "more than one crop on the wire at once").toBeGreaterThan(1);
  });

  it("names the FIRST missing reference in the recipe, not the first to fail", async () => {
    /*
      The discriminating case. The LAST reference fails immediately and the
      FIRST fails slowly, so a loop that reported whichever rejected soonest
      would name the wrong crop — and it would name a different one on a
      different day, which is the sort of report nobody can act on.
    */
    const recipe = threeReferences();
    if (!recipe.ok) throw new Error("the recipe must assemble");
    const first = recipe.references[0]!.image.key;
    const last = recipe.references[recipe.references.length - 1]!.image.key;
    expect(first).not.toBe(last);

    const perverse = async (image: { key: string }): Promise<ReferenceBytes> => {
      if (image.key === last) throw new Error("gone immediately");
      if (image.key === first) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        throw new Error("gone slowly");
      }
      return load(image);
    };

    const result = await repaint({
      recipe, engine: recordingEngine(), load: perverse, width: 1024, height: 1536,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("referenceMissing");
    expect(result.key, "the recipe's order decides which crop is named").toBe(first);
    expect(result.detail).toContain("gone slowly");
  });

  it("refuses rather than throwing when a load rejects", async () => {
    /* `Promise.all` would reject here and leave the sibling rejections
       unhandled — a crash in a render that was only going to refuse. */
    const recipe = threeReferences();
    if (!recipe.ok) throw new Error("the recipe must assemble");
    const allGone = async (): Promise<ReferenceBytes> => { throw new Error("storage is down"); };
    const result = await repaint({
      recipe, engine: recordingEngine(), load: allGone, width: 1024, height: 1536,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("referenceMissing");
  });
});
