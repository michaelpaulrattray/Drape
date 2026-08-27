/**
 * UPLOAD A CONCEPT — the reader, and the sweep that stops it describing the
 * PICTURE (#185).
 *
 * Every reading is DICTATED through a fake transport (working law 3): the live
 * describer mostly behaves, so a suite that reached it would be measuring a
 * model's good manners and calling it a control — and would spend house money
 * on every `pnpm test`.
 *
 * What a unit suite CANNOT answer is whether the words are about the person in
 * the picture. That is the positive control and it is a real drive:
 * `scripts/_concept-describe-drive-disposable.mts` puts a delivered frame whose
 * facts are known through the shipped reader and asks whether those facts come
 * back. A describer returning prose that fits anybody would pass every arm
 * below.
 */
import { describe, expect, it, vi } from "vitest";

import {
  CONCEPT_DESCRIPTION_MAX,
  CONCEPT_DESCRIPTION_MIN,
  NOT_ABOUT_THE_PERSON,
  describeConcept,
  notAboutThePersonIn,
} from "./conceptDescribe";
import type { TextEngine } from "../providers/types";

const PICTURE = { bytes: Buffer.from("a-picture"), contentType: "image/png" };

/** A description long enough to clear the floor, with no forbidden word in it. */
const CLEAN =
  "A woman in her early thirties, slight build, with a narrow face and high cheekbones, "
  + "dark brown hair cut to the jaw and worn straight, olive skin, thick unshaped brows, "
  + "a level unsmiling mouth and a still, direct bearing. She wears a plain black crew-neck "
  + "and small gold hoops.";

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

const said = (description: string | null) => JSON.stringify({ description });

/** Transports fence their JSON; `parse` strips it, and that must keep working. */
const NL = String.fromCharCode(10);
const FENCE = "```json" + NL;
const FENCE_END = NL + "```";

describe("the sweep — words about the picture, not about the person", () => {
  /*
    THE NEGATIVE CONTROL, and it is the arm that matters (law 2). A sweep that
    cannot fire is a green suite standing over an open door, so every entry is
    driven through a sentence that a describer would plausibly write.
  */
  it.each(NOT_ABOUT_THE_PERSON.map((entry) => entry.word))(
    "catches %s inside ordinary prose",
    (word) => {
      expect(notAboutThePersonIn(`A woman with dark hair, ${word} and a level mouth.`)).toBe(word);
    },
  );

  /*
    THE POSITIVE CONTROL FOR THE LIST'S NARROWNESS — the typo gate's lesson,
    which owned "shave" and blocked the founder's own bald ask. Each of these
    is a real thing to say about a PERSON and none of them may be swept.
  */
  it.each([
    "sharp cheekbones and a sharp jawline",
    "light brown hair with lighter ends",
    "soft features and a soft mouth",
    "fair skin that freckles",
    "a full mouth and a full head of hair",
    "close-cropped stubble on a heavy jaw",
    "a rendered-in-ink sleeve",
    /* The real-drive finding: an ANCESTRY hedge is the road's own subject. */
    "features reminiscent of South Asian ancestry",
    "a build resembling a swimmer's",
    "hair that looks like it was cut at home",
    /* The review's finding 2 — every form of `cropped` belongs to hair too. */
    "hair cropped at the nape and longer on top",
    "tightly cropped hair going grey at the sides",
    "a cropped denim jacket over a tee",
  ])("leaves a person word alone: %s", (phrase) => {
    expect(notAboutThePersonIn(`A man with ${phrase}, standing squarely.`)).toBeNull();
  });

  it("does not fire on a substring — 'lighting' is banned, 'delighting' is not a word about the picture", () => {
    expect(notAboutThePersonIn("A delighting, slighting expression.")).toBeNull();
  });

  it("catches a PHRASE broken across lines, which is how one would actually slip", () => {
    /* No other banned word in this sentence, so the hit can only be the split phrase. */
    expect(notAboutThePersonIn("A woman with red hair, warm in the golden\nhour, unsmiling."))
      .toBe("golden hour");
  });

  it("has a reason on every entry — a ban nobody wrote down is a ban nobody can argue with", () => {
    for (const entry of NOT_ABOUT_THE_PERSON) {
      expect(entry.because.length, entry.word).toBeGreaterThan(5);
    }
  });
});

describe("the reader", () => {
  it("returns the description when it is about the person", async () => {
    const outcome = await describeConcept({ ...PICTURE, engine: engineSaying(said(CLEAN)) });
    expect(outcome).toEqual({ ok: true, description: CLEAN, attempts: 1 });
  });

  it("sends the BYTES with the ask, so nothing is ever fetched from an address", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const request = (engine.complete as unknown as { mock: { calls: [Record<string, unknown>][] } })
      .mock.calls[0]![0];
    expect(request.images).toEqual([{ bytes: PICTURE.bytes, contentType: "image/png" }]);
  });

  it("re-asks ONCE, naming the word it used, and takes a clean second answer", async () => {
    const engine = engineSaying(
      said(`${CLEAN} Shot against a grey background.`),
      said(CLEAN),
    );
    const outcome = await describeConcept({ ...PICTURE, engine });
    expect(outcome).toEqual({ ok: true, description: CLEAN, attempts: 2 });
    expect(engine.sent[1]?.user).toContain("background");
  });

  it("refuses rather than STRIPPING the word — a description quietly edited is one nobody wrote", async () => {
    const dirty = `${CLEAN} Soft studio lighting.`;
    const outcome = await describeConcept({ ...PICTURE, engine: engineSaying(said(dirty), said(dirty)) });
    expect(outcome).toEqual({ ok: false, reason: "not_about_the_person", attempts: 2 });
  });

  it("tells 'there is nobody in this picture' apart from 'the read failed'", async () => {
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(null)) }))
      .toEqual({ ok: false, reason: "no_person", attempts: 1 });
    expect(await describeConcept({ ...PICTURE, engine: engineSaying("") }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
  });

  /*
    REVIEW OF #187, FINDING 1 — and it is the arm that catches OUR fault being
    told to the customer as HERS. Every one of these is a reply we could not
    read; none of them is the reader saying there is nobody in the picture, and
    the sentence the route writes for those two is different.
  */
  it.each([
    ["prose instead of JSON", "Sure! Here is a description of the person in the image."],
    ["JSON truncated at the token ceiling", '{"description": "A woman in her ear'],
    ["an object we did not ask for", '{"caption": "a woman"}'],
    ["a bare string", '"a woman in her thirties"'],
    ["the wrong type", '{"description": 42}'],
  ])("calls a NON-EMPTY reply it cannot read 'unreadable', never 'no_person' — %s", async (_name, reply) => {
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(reply) }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
  });

  it("still reads a description the transport wrapped in a fenced code block", async () => {
    const outcome = await describeConcept({
      ...PICTURE,
      engine: engineSaying(FENCE + said(CLEAN) + FENCE_END),
    });
    expect(outcome).toEqual({ ok: true, description: CLEAN, attempts: 1 });
  });

  it("degrades to a refusal, never an exception, when the transport throws", async () => {
    const engine = {
      id: "fake",
      complete: vi.fn(async () => { throw new Error("upstream is down"); }),
    } as never as TextEngine;
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
  });

  it("says so when there is no transport at all, rather than pretending", async () => {
    expect(await describeConcept({ ...PICTURE, engine: null }))
      .toEqual({ ok: false, reason: "no_transport", attempts: 0 });
  });

  it("refuses a shrug — a description shorter than the floor is not a description", async () => {
    const shrug = said("A person.");
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(shrug, shrug) }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
  });

  /*
    NOT TRUNCATED. A description cut mid-sentence would land in her brief box
    as a claim nobody made, and she cannot tell one from a read one.
  */
  it("re-asks rather than truncating an over-long read, and refuses if it comes back long again", async () => {
    const long = said(`${"a tall man with cropped grey hair and a heavy brow, ".repeat(40)}`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(long, long) }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
  });

  it("keeps the bound under the entrance's own brief cap, so she is never refused on text she did not write", () => {
    expect(CONCEPT_DESCRIPTION_MAX).toBeLessThan(2000);
    expect(CONCEPT_DESCRIPTION_MIN).toBeLessThan(CONCEPT_DESCRIPTION_MAX);
  });

  it("tells the reader what it may not say — the instruction is the primary control, the sweep is the provable one", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system.toLowerCase();
    for (const category of ["lighting", "background", "framing", "camera", "resembles"]) {
      expect(system, category).toContain(category);
    }
  });
});
