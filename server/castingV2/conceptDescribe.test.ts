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
  CONCEPT_DESCRIPTION_TARGET,
  GOLDEN_NOTE,
  NOT_ABOUT_THE_PERSON,
  absenceClaimIn,
  describeConcept,
  notAboutThePersonIn,
} from "./conceptDescribe";
import { ProviderError, type ProviderFailureClass, type TextEngine } from "../providers/types";

const PICTURE = { bytes: Buffer.from("a-picture"), contentType: "image/png" };

/**
 * A casting note that clears the floor with no forbidden word in it — and it is
 * a WOMAN so that it is not a paraphrase of {@link GOLDEN_NOTE}, which is a man.
 *
 * ⚠ IT USED TO BE AN INVENTORY, and that is the point of this whole change. The
 * fixture it replaces named the cheekbones, the brows, the mouth, the earrings
 * and the exact hair cut in 292 characters — a perfectly good description of one
 * individual, and the thing his ruling calls a police report.
 */
const CLEAN =
  "A woman in her early thirties, Mediterranean heritage, slight build, dark hair "
  + "worn to the jaw, plain black crew-neck. Still, direct, unadorned — a quiet "
  + "gallerist or architect type.";

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

/**
 * A transport that throws what it is given, then answers — and COUNTS.
 *
 * The count is the arm, not a convenience: the whole risk of asking again after
 * a throw is that it is bought on top of `withRetry`'s own three attempts, so
 * "did it call twice" is the only question that separates a repair from a
 * latency regression on a synchronous route (advisor, this shift).
 */
function engineThrowing(error: unknown, ...then: string[]):
  TextEngine & { calls: () => number; sent: { system: string; user: string }[] } {
  let index = 0;
  const sent: { system: string; user: string }[] = [];
  const engine = {
    id: "fake",
    sent,
    calls: () => index,
    complete: vi.fn(async (request: { system: string; user: string }) => {
      sent.push({ system: request.system, user: request.user });
      index += 1;
      if (index === 1) throw error;
      const text = then[Math.min(index - 2, then.length - 1)];
      if (text === undefined) throw error;
      return { text, provenance: { provider: "fake", model: "fake" } as never, latencyMs: 1 };
    }),
  };
  return engine as never;
}

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

/*
  THE ABSENCE SWEEP (#185, his drop list: *"no jewellery, makeup, or tattoos"*).

  The negative control is every shape a describer would actually write it in;
  the positive control is the arm that matters, because this list is one wrong
  word away from being the fourth typo-gate instance. HIS OWN EXAMPLE contains
  "no-nonsense" — a ban that fires on it would refuse the sentence he wrote as
  the target.
*/
describe("the absence sweep — what the person does NOT have", () => {
  it.each([
    "no tattoos",
    "no visible tattoos",
    "no jewellery",
    "no jewelry",
    "no makeup",
    "no make-up",
    "no piercings",
    "without tattoos",
    "free of tattoos",
    "lacking makeup",
    "no any visible tattoos",
  ])("catches %s", (phrase) => {
    expect(absenceClaimIn(`A man in his forties, broad, ${phrase}, a labourer type.`)).toBe(phrase);
  });

  it.each([
    /* HIS OWN WORDS — the arm this list would have broken first. */
    "rugged, no-nonsense fitness type",
    "clean-shaven with a heavy jaw",
    /* A PRESENT tattoo is the road's own subject and must never be swept. */
    "visible tattoos on both forearms",
    "a tattooed sleeve and heavy silver jewellery",
    "hair going grey without a parting",
    "an unadorned, plain-dressing type",
    "no-frills workwear",
  ])("leaves a present-tense person word alone: %s", (phrase) => {
    expect(absenceClaimIn(`A woman in her thirties, ${phrase}, slight build.`)).toBeNull();
  });

  it("catches an absence claim split across lines, the way one would actually slip", () => {
    expect(absenceClaimIn("A broad man in his fifties, no\ntattoos, dark hair.")).toBe("no tattoos");
  });

  it("does not fire on a substring — 'nobody' is not 'no'", () => {
    expect(absenceClaimIn("A face nobody forgets, tattoos across the knuckles.")).toBeNull();
  });
});

/*
  HIS GOLDEN NOTE IS THE SUITE'S FIXTURE, and every bound in the file is
  measured against it. If a rule here would refuse the sentence he wrote as the
  target, the rule is wrong and not the sentence — this is the arm that says so.
*/
describe("the golden note — his own example of what should land in the brief box", () => {
  it("passes both sweeps", () => {
    expect(notAboutThePersonIn(GOLDEN_NOTE)).toBeNull();
    expect(absenceClaimIn(GOLDEN_NOTE)).toBeNull();
  });

  it("sits inside the enforced bound AND inside the announced target", () => {
    expect(GOLDEN_NOTE.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_MIN);
    expect(GOLDEN_NOTE.length).toBeLessThanOrEqual(CONCEPT_DESCRIPTION_MAX);
    expect(GOLDEN_NOTE.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_TARGET.low);
    expect(GOLDEN_NOTE.length).toBeLessThanOrEqual(CONCEPT_DESCRIPTION_TARGET.high);
  });

  it("is what the reader is shown, not merely what it is told", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent[0]!.system).toContain(GOLDEN_NOTE);
  });

  it("is accepted by the reader end to end", async () => {
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(GOLDEN_NOTE)) }))
      .toEqual({ ok: true, description: GOLDEN_NOTE, attempts: 1 });
  });

  /*
    THE FIXTURE THAT PRODUCED THE RULING. A 1,082-character read is what he saw
    and refused; the bound exists to make it unshippable, and this arm is the
    negative control that proves the bound can fire on the real specimen shape.
  */
  it("refuses the 1,082-character shape that produced the ruling", async () => {
    const inventory = ("A man in his mid-forties with pale blue eyes, a heavy squared brow, "
      + "a number-two fade tight at the temples with grey coming in above the ears, ").repeat(8);
    expect(inventory.length).toBeGreaterThan(1000);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(inventory), said(inventory)) }))
      .toEqual({ ok: false, reason: "not_a_casting_note", attempts: 2 });
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
    /* ⚠ `attempts` MOVED 1 -> 2 HERE AND IN THE ARM BELOW, and it is the whole
       of #193: a reply we could not read is now asked again once. The two
       REASONS are what this arm is about and neither moved. */
    expect(await describeConcept({ ...PICTURE, engine: engineSaying("") }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
  });

  it("never re-asks 'there is nobody in this picture' — a real answer is not a failure", async () => {
    const engine = engineSaying(said(null), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "no_person", attempts: 1 });
    expect(engine.sent).toHaveLength(1);
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
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
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

  /*
    #193 — A READ THAT NEVER ARRIVED IS ASKED AGAIN, AND ONLY THAT CLASS IS.

    The measurement behind it: one refusal in six on production frames, and the
    frame that refused then read cleanly 3 of 3. The card named the unparseable
    branch; there are THREE branches returning that same object and the original
    log is gone, so both plausible ones are covered and the third — the classes
    the transport has already retried three times — is proven NOT to be, because
    a fourth attempt on a dead provider is the latency regression this repair
    could have been.
  */
  it("asks again ONCE when the reply is one we cannot read, and takes a clean second answer", async () => {
    const engine = engineSaying("Sure! Here is the description:", said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: true, description: CLEAN, attempts: 2 });
  });

  it("asks that second time with the ORIGINAL words — there is no fault to name", async () => {
    const engine = engineSaying("not json at all", said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent).toHaveLength(2);
    expect(engine.sent[1]!.user).toBe(engine.sent[0]!.user);
    expect(engine.sent[1]!.system).toBe(engine.sent[0]!.system);
  });

  it("asks again on an EMPTY COMPLETION ON A 200 — the one-shot the transport does not retry", async () => {
    const engine = engineThrowing(
      new ProviderError("unknown", "The interpreter returned nothing"),
      said(CLEAN),
    );
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: true, description: CLEAN, attempts: 2 });
    expect(engine.calls()).toBe(2);
  });

  /*
    ⚠ THIS ARM EXISTS BECAUSE A SABOTAGE REDDENED NOTHING. The control that
    makes the re-read invent a fault to name was aimed at the CATCH path, and
    every arm asserting "the second ask is the original words" reached the
    module through the UNPARSEABLE path — so the two re-reads were a fixture
    family sharing a property, and one of them was unproven. The outcome and
    the call count cannot see it: a re-read carrying an invented fault still
    returns a clean description on the second call.
  */
  it("asks that second time with the ORIGINAL words after a throw, too", async () => {
    const engine = engineThrowing(
      new ProviderError("unknown", "The interpreter returned nothing"),
      said(CLEAN),
    );
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent).toHaveLength(2);
    expect(engine.sent[1]!.user).toBe(engine.sent[0]!.user);
    expect(engine.sent[1]!.system).toBe(engine.sent[0]!.system);
  });

  /*
    THE ARM THAT PROVES THE LINE, and it is the one the advisor asked for by
    name. `withRetry` has already spent three attempts on a timeout before this
    module ever sees it; a fourth would put a customer through roughly four
    times a dead provider's deadline on a synchronous route. The COUNT is the
    assertion — the outcome alone cannot tell one call from two.
  */
  it.each<ProviderFailureClass>([
    "timeout",
    "transport",
    "rate_limit",
    /* Not a retried one — a CANCEL. Nobody is waiting for a second opinion. */
    "capability",
  ])("calls ONCE on a failure the transport already retried, or a cancel — %s", async (failureClass) => {
    const engine = engineThrowing(new ProviderError(failureClass, "already retried"), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
    expect(engine.calls()).toBe(1);
  });

  it("calls ONCE on a throw that is not a ProviderError — our own bug is not retried into invisibility", async () => {
    const engine = engineThrowing(new TypeError("cannot read properties of undefined"), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
    expect(engine.calls()).toBe(1);
  });

  it("does not ask again once she has navigated away — an aborted read has nobody waiting", async () => {
    const controller = new AbortController();
    controller.abort();
    const engine = engineThrowing(
      new ProviderError("unknown", "The interpreter returned nothing"),
      said(CLEAN),
    );
    expect(await describeConcept({ ...PICTURE, engine, signal: controller.signal }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 1 });
    expect(engine.calls()).toBe(1);
  });

  it("keeps today's sentence when the read comes back as noise TWICE", async () => {
    const engine = engineSaying("still not json", "still not json");
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
    expect(engine.sent).toHaveLength(2);
  });

  it("spends its ONE second ask on the re-read — an unreadable then a fault is still terminal", async () => {
    const engine = engineSaying("not json", said("A person."), said(CLEAN));
    /* The re-read buys the second ask; that second answer is a FAULT (too
       short). The module allows exactly two reads, so the third reply is never
       fetched and the shrug is terminal — a re-read does not buy a third. */
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
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
      .toEqual({ ok: false, reason: "not_a_casting_note", attempts: 2 });
  });

  /*
    ⚠ THE ARM THAT WOULD HAVE CAUGHT THE BLIND RE-ASK, and it is the reason the
    fault type exists. The length branch used to re-ask with a BYTE-IDENTICAL
    system and user message at temperature 0 — a call bought to receive the
    answer we already had, with the refusal decided before it was made. Nothing
    went red, because a re-ask that says nothing still returns a string.

    So the assertion is on THE WORDS THAT GO OUT (assert at the wire, invariant
    5's shape): the second ask must differ from the first AND name the fault.
  */
  it("re-asks an over-long read by NAMING the length and the target, never with the same words again", async () => {
    const long = "a tall man with cropped grey hair and a heavy brow, ".repeat(40);
    const engine = engineSaying(said(long), said(CLEAN));
    const outcome = await describeConcept({ ...PICTURE, engine });
    expect(outcome).toEqual({ ok: true, description: CLEAN, attempts: 2 });
    expect(engine.sent[1]!.user).not.toBe(engine.sent[0]!.user);
    /* The read is whitespace-normalised before it is measured, so the number
       the reader is told is the length of what we ACTUALLY judged. */
    expect(engine.sent[1]!.user).toContain(String(long.trim().length));
    expect(engine.sent[1]!.user).toContain(String(CONCEPT_DESCRIPTION_TARGET.high));
    expect(engine.sent[1]!.user.toLowerCase()).toContain("inventory");
  });

  it("re-asks a too-short read by naming that too, rather than asking again in silence", async () => {
    const engine = engineSaying(said("A man."), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine })).toEqual({ ok: true, description: CLEAN, attempts: 2 });
    expect(engine.sent[1]!.user).not.toBe(engine.sent[0]!.user);
    expect(engine.sent[1]!.user).toContain("6 characters");
  });

  it("re-asks an ABSENCE claim naming the phrase, and takes the clean second answer", async () => {
    const engine = engineSaying(said(`${CLEAN} She wears no jewellery.`), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine })).toEqual({ ok: true, description: CLEAN, attempts: 2 });
    expect(engine.sent[1]!.user).toContain("no jewellery");
  });

  it("refuses an absence claim that comes back twice — as OUR fault, not her picture's", async () => {
    const dirty = said(`${CLEAN} No tattoos.`);
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(dirty, dirty) }))
      .toEqual({ ok: false, reason: "not_a_casting_note", attempts: 2 });
  });

  it("keeps a second-shrug on 'unreadable' — the one refusal where a different picture IS the advice", async () => {
    const shrug = said("A man.");
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(shrug, shrug) }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
  });

  it("keeps the bound under the entrance's own brief cap, so she is never refused on text she did not write", () => {
    expect(CONCEPT_DESCRIPTION_MAX).toBeLessThan(2000);
    expect(CONCEPT_DESCRIPTION_MIN).toBeLessThan(CONCEPT_DESCRIPTION_MAX);
  });

  /*
    HIS NUMBERS, PINNED. ~150–250 announced, and the ceiling is what stops an
    inventory — a bound that drifted back up would restore the defect silently,
    since nothing else in the product measures the length of this text.
  */
  it("holds the anti-clone ceiling at a casting note's size, not a police report's", () => {
    expect(CONCEPT_DESCRIPTION_MAX).toBeLessThanOrEqual(300);
    expect(CONCEPT_DESCRIPTION_TARGET.low).toBe(150);
    expect(CONCEPT_DESCRIPTION_TARGET.high).toBe(250);
    expect(CONCEPT_DESCRIPTION_TARGET.low).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_MIN);
    expect(CONCEPT_DESCRIPTION_TARGET.high).toBeLessThanOrEqual(CONCEPT_DESCRIPTION_MAX);
  });

  it("tells the reader what it may not say — the instruction is the primary control, the sweep is the provable one", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system.toLowerCase();
    for (const category of ["lighting", "background", "framing", "camera", "resembles"]) {
      expect(system, category).toContain(category);
    }
  });

  /*
    HIS KEEP AND DROP LISTS ARE THE INSTRUCTION (#185). The sweeps cannot carry
    the drop list — banning `brow`, `eyes` or `cut` by word would refuse good
    descriptions of people on the day it shipped — so the instruction is the
    only thing standing behind most of his ruling, and a silent edit to it is
    the whole feature drifting back. This arm makes that edit go red.
  */
  it("carries his keep and drop lists, and the REASON — a rule without its why does not generalise", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system.toLowerCase();
    for (const kept of ["age band", "heritage", "build", "hair world", "wardrobe world", "type"]) {
      expect(system, kept).toContain(kept);
    }
    for (const dropped of ["eye colour", "brow shape", "staring", "does not", "no tattoos"]) {
      expect(system, dropped).toContain(dropped);
    }
    /* The reason, which is what covers the cases his list could not enumerate. */
    expect(system).toContain("locked on every face");
    /* Never guess a heritage — his sentence, and it is a claim about a person. */
    expect(system).toContain("never guess");
    /* The announced target is a brief in itself, so it must actually be said. */
    expect(system).toContain(`${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters`);
  });
});
