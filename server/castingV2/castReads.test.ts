/**
 * SIX WAYS THIS CAST COULD CARRY THEMSELVES — door 1's reader (#2196).
 *
 * ⚠ **THE REFUSAL ARMS BELOW ARE NOT IMAGINED FAILURES.** Every one of them is
 * a reply the real model actually sent during the measurement, pasted rather
 * than invented — which is the only reason to trust that the parser refuses
 * the things that happen rather than the things a test author thought of:
 *
 *  1. an entry carrying an extra field (`"name_unused": true` on all six);
 *  2. a reply whose per-entry braces were lost, so twelve keys arrived in ONE
 *     object and `JSON.parse` collapsed them to the last pair — **valid JSON
 *     of the declared shape holding one read**, which is the quiet failure the
 *     schema was wired for;
 *  3. prose carrying a raw end-of-sequence marker (`…decision.</s>`).
 *
 * The positive control is a real six-read reply from his own Pigman.
 */
import { describe, expect, it, vi } from "vitest";

import {
  CAST_READS_COUNT,
  CAST_READS_MAX_OUTPUT_TOKENS,
  CAST_READS_TIMEOUT_MS,
  castReadsCurrentBlock,
  castReadsSystemPrompt,
  createCastReadsReader,
  dropTrailingFragments,
  parseCastReads,
  trimTrailingJunk,
} from "./castReads";
import { castPronouns } from "./castPronouns";
import { castPersonaSystemPrompt } from "./castPersona";
import type { ReferenceImage, TextEngine, TextRequest } from "../providers/types";

const pronouns = castPronouns({ subject: { sex: "male" } });
const anchor: ReferenceImage = { bytes: Buffer.from("not-a-real-frame"), contentType: "image/png" };

/** Six well-formed reads, shaped as the measured replies are. */
const SIX = Array.from({ length: CAST_READS_COUNT }, (_, index) => ({
  label: `The reader ${index + 1}`,
  personality: `Stands still with the hands at rest number ${index + 1}. Moves late and all at once.`,
}));
const goodReply = JSON.stringify({ reads: SIX });

function engineReturning(text: string): { engine: TextEngine; seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  const engine: TextEngine = {
    id: "fake",
    complete: vi.fn(async (request: TextRequest) => {
      seen.push(request);
      return { text, provenance: { provider: "fake", model: "fake" }, latencyMs: 1 } as never;
    }),
  };
  return { engine, seen };
}

/* `boundForJudge` reads real image bytes with sharp; the fixture is not an
   image, so the bounder is stubbed for every arm that drives the reader. The
   parse arms need none of this and call `parseCastReads` directly. */
vi.mock("./judgeFrame", () => ({
  boundForJudge: vi.fn(async (image: ReferenceImage) => ({ image })),
}));

describe("the positive control first", () => {
  it("returns six reads from a well-formed reply", async () => {
    const { engine } = engineReturning(goodReply);
    const reads = await createCastReadsReader({ engine }).read({
      anchor, brief: "a tired bouncer", editSentences: [], current: null, pronouns,
    });
    expect(reads).toHaveLength(CAST_READS_COUNT);
    expect(reads?.[0]?.label).toBe("The reader 1");
  });

  it("reads a reply the model fenced as a code block", async () => {
    expect(parseCastReads("```json\n" + goodReply + "\n```")).toHaveLength(CAST_READS_COUNT);
  });
});

describe("a read that fails produces NOTHING — never a short list", () => {
  it("a reply that is not JSON derives no reads", () => {
    expect(parseCastReads("sorry, I can't do that")).toBeNull();
  });

  it("⚠ MEASURED — an entry carrying an extra field derives no reads (the schema is strict)", () => {
    const withExtra = JSON.stringify({
      reads: SIX.map((read) => ({ ...read, name_unused: true })),
    });
    expect(parseCastReads(withExtra)).toBeNull();
  });

  it("⚠ MEASURED — the lost-braces reply: valid JSON of the right shape holding ONE read", () => {
    /*
      This is the failure the wire schema exists for, and the one worth the
      most here: the model emitted twelve keys in a single object, so
      `JSON.parse` kept the last pair and the array came back length 1. The
      shape is legal; the content is five-sixths missing. Nothing throws.
    */
    const collapsed = JSON.stringify({ reads: [{ label: "The last one", personality: "Stands. Moves." }] });
    expect(parseCastReads(collapsed)).toBeNull();
  });

  it("five good reads and one unusable is still nothing — six or none", () => {
    const fiveGood = JSON.stringify({
      reads: [...SIX.slice(0, 5), { label: "", personality: "Stands. Moves." }],
    });
    expect(parseCastReads(fiveGood)).toBeNull();
  });

  it("two reads under one label derive nothing — the pick would be ambiguous", () => {
    const duped = JSON.stringify({
      reads: [...SIX.slice(0, 5), { ...SIX[0]! }],
    });
    expect(parseCastReads(duped)).toBeNull();
  });

  it("a label that came back as a clause is dropped, which takes the whole list with it", () => {
    const longLabel = "A".repeat(49);
    const bad = JSON.stringify({ reads: [...SIX.slice(0, 5), { label: longLabel, personality: "Stands. Moves." }] });
    expect(parseCastReads(bad)).toBeNull();
  });

  it("a reply cut off at the ceiling derives no reads and is not retried here", async () => {
    const seen: TextRequest[] = [];
    const engine: TextEngine = {
      id: "fake",
      complete: vi.fn(async (request: TextRequest) => {
        seen.push(request);
        return { text: goodReply, provenance: { provider: "f", model: "f" }, latencyMs: 1, truncated: true } as never;
      }),
    };
    const reads = await createCastReadsReader({ engine }).read({
      anchor, brief: null, editSentences: [], current: null, pronouns,
    });
    expect(reads).toBeNull();
    expect(seen).toHaveLength(1);
  });

  it("a transport failure derives no reads rather than throwing into the room", async () => {
    const engine: TextEngine = { id: "fake", complete: vi.fn(async () => { throw new Error("down"); }) };
    await expect(
      createCastReadsReader({ engine }).read({ anchor, brief: null, editSentences: [], current: null, pronouns }),
    ).resolves.toBeNull();
  });
});

describe("⚠ MEASURED — transport markers never reach a customer's card", () => {
  it("strips an end-of-sequence marker left after the last full stop", () => {
    const littered = JSON.stringify({
      reads: SIX.map((read) => ({ ...read, personality: `${read.personality}</s>` })),
    });
    const reads = parseCastReads(littered);
    expect(reads).toHaveLength(CAST_READS_COUNT);
    for (const read of reads ?? []) expect(read.personality).not.toContain("</s>");
  });

  it("strips the other marker the same run produced, without naming it", () => {
    /* The point of a positive rule rather than a denylist: this marker is a
       different one and no code anywhere mentions it. */
    expect(trimTrailingJunk("Stands still. Moves late.»,", { sentence: true })).toBe("Stands still. Moves late.");
  });

  it("keeps a clean line exactly as it is", () => {
    expect(trimTrailingJunk("Stands still. Moves late.", { sentence: true })).toBe("Stands still. Moves late.");
  });

  it("a line with no sentence end at all is left alone for the cap to judge", () => {
    expect(trimTrailingJunk("no full stop here", { sentence: true })).toBe("no full stop here");
  });

  it("a label is cut at its last letter, and an accented one survives", () => {
    expect(trimTrailingJunk("The quiet one</s>", { sentence: false })).toBe("The quiet one");
    expect(trimTrailingJunk("The blasé one", { sentence: false })).toBe("The blasé one");
  });
});

describe("the ask, asserted at the wire", () => {
  async function drive(current: string | null = null, edits: readonly string[] = []) {
    const { engine, seen } = engineReturning(goodReply);
    await createCastReadsReader({ engine }).read({
      anchor, brief: "a tired bouncer", editSentences: edits, current, pronouns,
    });
    return seen[0]!;
  }

  it("files its price under its own census word, so the door's cost is answerable", async () => {
    expect((await drive()).about).toBe("reads");
  });

  it("⚠ asks the provider to ENFORCE the shape, not merely to hope for an object", async () => {
    const request = await drive();
    expect(request.json).toBe(true);
    expect(request.jsonSchema?.name).toBe("cast_reads");
    /* Derived from the parser's own zod object — so the thing enforced and the
       thing checked cannot drift apart. */
    const schema = request.jsonSchema?.schema as { properties?: { reads?: { items?: { properties?: unknown; additionalProperties?: boolean } } } };
    expect(schema.properties?.reads?.items?.additionalProperties).toBe(false);
    expect(Object.keys((schema.properties?.reads?.items?.properties ?? {}) as object).sort()).toEqual(["label", "personality"]);
  });

  it("posts exactly ONE picture — the frame they signed", async () => {
    expect((await drive()).images).toHaveLength(1);
  });

  it("carries the ceiling and the deadline this road declares", async () => {
    const request = await drive();
    expect(request.maxOutputTokens).toBe(CAST_READS_MAX_OUTPUT_TOKENS);
    expect(request.timeoutMs).toBe(CAST_READS_TIMEOUT_MS);
    expect(request.reasoning).toBe("off");
  });

  it("⚠ carries the line already on the card, so the six are alternatives to it", async () => {
    const current = "Stands planted and square, chin level.";
    expect((await drive(current)).user).toContain(current);
  });

  it("says so plainly when there is no line yet, rather than sending an empty heading", () => {
    expect(castReadsCurrentBlock(null)).toContain("nothing to differ from");
    expect(castReadsCurrentBlock("   ")).toContain("nothing to differ from");
  });

  it("carries THEIR pronouns into the instruction, not a default", async () => {
    const request = await drive();
    expect(request.system).toContain('"he", "him", "his"');
  });
});

describe("what the instruction asks for", () => {
  const instruction = castReadsSystemPrompt(pronouns);

  it("asks for exactly six, and says so where the shape is declared too", () => {
    expect(instruction).toContain("You write 6 alternative reads");
    expect(instruction).toContain("with exactly 6 entries");
  });

  it("⚠ names the field `label`, which is what stopped the reader fighting the shared rule", () => {
    expect(instruction).toContain('{"reads": [{"label": "...", "personality": "..."}, …]}');
    expect(instruction).toContain("It is never this");
    expect(instruction).toContain("performer's own name");
  });

  it("requires the six to differ from each other, not six rewordings of one", () => {
    expect(instruction).toContain("genuinely different from EACH OTHER");
  });

  it("holds them to ONE person — the same body and face in every read", () => {
    expect(instruction).toContain("are the SAME person");
  });

  it("⚠ ships NO list of his six names, so they cannot arrive on every cast", () => {
    /*
      His frame's names are the SHAPE of a label and never a menu — his own N3
      ruling (*"we really cannot be working from fixed lists"*), and #2136
      measured what an exemplar's wording does when nothing stops it.
    */
    for (const name of [
      "The patient hulk", "The wounded animal", "The old soldier",
      "The quiet professional", "Sunny and open", "The nervous smiler",
    ]) {
      expect(instruction).not.toContain(name);
    }
  });

  it("marks the one example it DOES carry as form whose wording is unavailable", () => {
    expect(instruction).toContain("WORDING is not available");
  });
});

describe("#2238 — a read is held short by the instruction and ends on a whole sentence", () => {
  const instruction = castReadsSystemPrompt(pronouns);

  it("asks for one new fact per clause and his examples' length, with no cutting cap", () => {
    expect(instruction).toContain("Every clause adds one NEW thing the camera can see");
    expect(instruction).toContain("never restate a");
    expect(instruction).toContain("Aim for about 300 to 330 characters per description");
    expect(instruction).toContain("End on a full sentence.");
  });

  it("the safety net is still the card's own 500, so a 420-character read is kept whole", () => {
    const long = "Stands square with both hands flat on the counter and the gaze parked on the door, ".repeat(4).trim()
      + " Answers late and all at once.";
    expect(long.length).toBeGreaterThan(330);
    expect(long.length).toBeLessThan(500);
    const reads = parseCastReads(JSON.stringify({ reads: SIX.map((read, i) => (i === 0 ? { ...read, personality: long } : read)) }));
    expect(reads?.[0]?.personality).toBe(long);
  });

  it("⚠ MEASURED — the stray \"able.\" his own Pigman got is cut off, leaving the whole sentence", () => {
    const stray = "Stands wide-legged and chest forward, holding the new ground. Reacts instantly to proximity with a hard stamp forward. able.";
    expect(dropTrailingFragments(stray)).toBe(
      "Stands wide-legged and chest forward, holding the new ground. Reacts instantly to proximity with a hard stamp forward.",
    );
    const reads = parseCastReads(JSON.stringify({
      reads: SIX.map((read, i) => (i === 2 ? { ...read, personality: stray } : read)),
    }));
    expect(reads).toHaveLength(CAST_READS_COUNT);
    expect(reads?.[2]?.personality.endsWith("able.")).toBe(false);
    expect(reads?.[2]?.personality.endsWith("stamp forward.")).toBe(true);
  });

  it("a fragment glued on with no space, or behind a marker, goes too", () => {
    expect(dropTrailingFragments("Stands still. Moves late and all at once.able.")).toBe("Stands still. Moves late and all at once.");
    expect(dropTrailingFragments("Stands still. Moves late and all at once.</s>able.")).toBe("Stands still. Moves late and all at once.");
  });

  it("a whole read is left exactly as it is (negative control)", () => {
    for (const whole of [
      "Stands still with the hands at rest. Moves late and all at once.",
      "Still as furniture; the eyes track without the head turning. Moves only when it matters, then all at once.",
      "Back straight, heels together. Never hurries.",
    ]) {
      expect(dropTrailingFragments(whole)).toBe(whole);
    }
  });

  it("nothing whole left means nothing kept — and six-or-nothing drops the list", () => {
    expect(dropTrailingFragments("able.")).toBe("");
    expect(dropTrailingFragments("and then")).toBe("");
    const bad = JSON.stringify({ reads: SIX.map((read, i) => (i === 0 ? { ...read, personality: "able." } : read)) });
    expect(parseCastReads(bad)).toBeNull();
  });
});

describe("#2238 — every read says where the eyes are, and only visible things set it moving", () => {
  const instruction = castReadsSystemPrompt(pronouns);

  it("makes the gaze a hard requirement of every read's first sentence", () => {
    expect(instruction).toContain("FOR EVERY READ, the first sentence must state BOTH the posture AND where the");
    expect(instruction).toContain("eyes are");
  });

  it("requires a visible or audible trigger for any change, never a thought or a decision", () => {
    expect(instruction).toContain("is set off by something the camera\ncan see or hear");
    expect(instruction).toContain("Never by a thought, a decision, a\nrealisation or a feeling; the camera cannot see those happen.");
  });

  it("⚠ the Sign's own instruction carries neither clause (its golden holds the rest)", () => {
    const sign = castPersonaSystemPrompt(pronouns);
    expect(sign).not.toContain("FOR EVERY READ");
    expect(sign).not.toContain("Never by a thought, a decision");
    expect(sign).not.toContain("Aim for about 300 to 330 characters");
  });
});
