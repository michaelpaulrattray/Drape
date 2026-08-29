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
  BUILD_FAMILIES,
  CONCEPT_DESCRIPTION_MAX,
  CONCEPT_DESCRIPTION_MIN,
  CONCEPT_DESCRIPTION_TARGET,
  GOLDEN_NOTES,
  INVENTORY_NOTE,
  NOT_ABOUT_THE_PERSON,
  absenceClaimIn,
  describeConcept,
  notAboutThePersonIn,
} from "./conceptDescribe";
import { SUBJECT_INSTRUCTION } from "./interpreter";
import { ProviderError, type ProviderFailureClass, type TextEngine } from "../providers/types";

const PICTURE = { bytes: Buffer.from("a-picture"), contentType: "image/png" };

/**
 * A casting note that clears the floor with no forbidden word in it — and it is
 * a WOMAN so that it is not a paraphrase of {@link GOLDEN_NOTES}.plain, a man.
 *
 * ⚠ IT USED TO BE AN INVENTORY, and that is the point of this whole change. The
 * fixture it replaces named the cheekbones, the brows, the mouth, the earrings
 * and the exact hair cut in 292 characters — a perfectly good description of one
 * individual, and the thing his ruling calls a police report.
 *
 * ⚠ **AND IT THEN SAID "slight build" FOR A DAY — the exact phrase his second
 * ruling strikes first** (*"Drop: slight build, blunt bangs, bodysuit…"*). A
 * suite whose model of a GOOD note carries a shape the founder refuses teaches
 * every later seat the wrong target, and no arm could have caught it: nothing
 * in this module bans a body-size word, deliberately (see the module's own note
 * on why a word ban is refused here). It reads "compact, athletic" now — a build
 * FAMILY, which is what he asked for.
 */
const CLEAN =
  "A woman in her early thirties, Mediterranean heritage, compact athletic build, dark hair "
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
    /*
      ⚠ THE FOURTH INSTANCE, AND IT WAS LIVE — measured on a real read while
      driving #204, not imagined for this arm. The reader wrote "a coarse dark
      beard framing a jagged-toothed mouth", the bare `framing` ban sent the
      note back, and a noisy second ask then told the customer we could not read
      her picture. `framed by` is the same shape and just as ordinary.
    */
    "a coarse dark beard framing a jagged-toothed mouth",
    "a face framed by long dark hair",
    "a jaw framed with heavy stubble",
  ])("leaves a person word alone: %s", (phrase) => {
    expect(notAboutThePersonIn(`A man with ${phrase}, standing squarely.`)).toBeNull();
  });

  /*
    AND THE PHOTOGRAPHIC SENSE IS STILL CAUGHT — the pair that makes the
    narrowing a narrowing rather than a deletion. Without this arm the entry
    above could be dropped altogether and nothing would go red.
  */
  it.each([
    ["the framing is tight on her face", "the framing"],
    ["tightly framed on the shoulders", "tightly framed"],
    ["framed from the chest up", "framed from"],
  ])("still catches the frame CLAIM: %s", (phrase, word) => {
    expect(notAboutThePersonIn(`A woman with dark hair, ${phrase}.`)).toBe(word);
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
describe("his specimens — the two shapes that pass and the one that fails", () => {
  const passing: ReadonlyArray<readonly [string, string]> = [
    ["plain — his passing man", GOLDEN_NOTES.plain],
    ["styled — his corrected goth line", GOLDEN_NOTES.styled],
    ["his second passing man (a fixture, not shown to the reader)", GOLDEN_NOTES.secondMan],
  ];

  it.each(passing)("%s passes both sweeps", (_name, note) => {
    expect(notAboutThePersonIn(note)).toBeNull();
    expect(absenceClaimIn(note)).toBeNull();
  });

  it.each(passing)("%s sits inside the enforced bound AND the announced target", (_name, note) => {
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_MIN);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_DESCRIPTION_MAX);
    expect(note.length).toBeGreaterThanOrEqual(CONCEPT_DESCRIPTION_TARGET.low);
    expect(note.length).toBeLessThanOrEqual(CONCEPT_DESCRIPTION_TARGET.high);
  });

  /*
    SHOWN, NOT DESCRIBED. A specimen teaches a level of detail an announced
    number cannot, and the whole of his second ruling is about level of detail.
  */
  it("shows the reader BOTH passing shapes — a plain subject and a styled one", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent[0]!.system).toContain(GOLDEN_NOTES.plain);
    expect(engine.sent[0]!.system).toContain(GOLDEN_NOTES.styled);
  });

  /*
    AND THE FAILING ONE, LABELLED. Two good notes show which side of the line to
    be on; only the pair shows where the line IS — his own instruction, verbatim:
    "Use the men as the passing examples. Use the current goth box as the failing
    example."
  */
  it("shows the reader the failing box too, and says it is wrong", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system;
    expect(system).toContain(INVENTORY_NOTE);
    const at = system.indexOf(INVENTORY_NOTE);
    /* Directly labelled, not merely present — an unlabelled bad specimen is a
       specimen. The word "WRONG" precedes it and the reason follows it. */
    expect(system.slice(Math.max(0, at - 260), at)).toContain("WRONG");
    expect(system.slice(at)).toContain("locks a body size");
  });

  it.each(passing)("%s is accepted by the reader end to end", async (_name, note) => {
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(note)) }))
      .toEqual({ ok: true, description: note, attempts: 1 });
  });

  /*
    ⚠ THE ARM THAT KEEPS THIS HONEST, and it asserts a NON-catch on purpose.

    His whole second ruling is that LENGTH IS NOT THE TEST, and the proof is his
    own failing box: it is 243 characters, over the floor, under the ceiling, and
    clean through both sweeps. **Nothing this module enforces at runtime can tell
    it from a good note** — which is exactly why the acceptance lives in the
    drive against known pictures and why a word ban was refused here.

    A future seat reading a green suite must not conclude the reader is fixed.
    This arm is where the suite says so out loud, and it goes RED the day someone
    adds the tempting word ban — at which point they have to come and read the
    module's reason rather than discover it afterwards.
  */
  it("CANNOT catch his failing box at runtime — the acceptance is the drive, not a bound", async () => {
    expect(INVENTORY_NOTE.length).toBeGreaterThan(CONCEPT_DESCRIPTION_MIN);
    expect(INVENTORY_NOTE.length).toBeLessThan(CONCEPT_DESCRIPTION_MAX);
    expect(notAboutThePersonIn(INVENTORY_NOTE)).toBeNull();
    expect(absenceClaimIn(INVENTORY_NOTE)).toBeNull();
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(INVENTORY_NOTE)) }))
      .toEqual({ ok: true, description: INVENTORY_NOTE, attempts: 1 });
  });

  /*
    ⚠ HIS BUILD RULING, MADE CONCRETE ON HIS OWN THREE SPECIMENS — and this is
    the arm that says WHERE the line falls, which no amount of instruction prose
    can. Both his passing men are PHYSICAL types ("rugged, no-nonsense fitness
    presence", "authoritative professional") and both name a build; his corrected
    goth line is a FASHION type and names none, which is his cut of "Athletic
    build" from the live read he was shown.

    A future seat that reads the ruling as "drop `athletic` from the list" makes
    the second half of this arm go red, and a seat that reads it as "never name a
    build" makes the first half go red. It is the boundary, held from both sides.

    The list comes from the module, never from a copy here — see BUILD_FAMILIES.
  */
  const buildWordsIn = (note: string) =>
    BUILD_FAMILIES.filter((word) => note.toLowerCase().includes(word));

  it("his styled specimen names NO build — a fashion type did not need one", () => {
    expect(buildWordsIn(GOLDEN_NOTES.styled)).toEqual([]);
  });

  it.each([
    ["his passing man", GOLDEN_NOTES.plain],
    ["his second passing man", GOLDEN_NOTES.secondMan],
  ])("%s DOES name one — the ruling is a boundary, not a ban", (_name, note) => {
    expect(buildWordsIn(note).length).toBeGreaterThan(0);
  });

  /* And it is the shape he refused, not a paraphrase of it — every word he
     struck by name is in it, so the fixture cannot quietly soften over time. */
  it("keeps the failing box as the words he actually struck", () => {
    for (const struck of ["slight build", "blunt bangs", "bodysuit", "choker", "eye harness"]) {
      expect(INVENTORY_NOTE.toLowerCase(), struck).toContain(struck);
    }
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

  it("tells 'there is no being in this picture' apart from 'the read failed'", async () => {
    expect(await describeConcept({ ...PICTURE, engine: engineSaying(said(null)) }))
      .toEqual({ ok: false, reason: "no_being", attempts: 1 });
    /* ⚠ `attempts` MOVED 1 -> 2 HERE AND IN THE ARM BELOW, and it is the whole
       of #193: a reply we could not read is now asked again once. The two
       REASONS are what this arm is about and neither moved. */
    expect(await describeConcept({ ...PICTURE, engine: engineSaying("") }))
      .toEqual({ ok: false, reason: "unreadable", attempts: 2 });
  });

  it("never re-asks 'there is no being in this picture' — a real answer is not a failure", async () => {
    const engine = engineSaying(said(null), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "no_being", attempts: 1 });
    expect(engine.sent).toHaveLength(1);
  });

  /*
    REVIEW OF #187, FINDING 1 — and it is the arm that catches OUR fault being
    told to the customer as HERS. Every one of these is a reply we could not
    read; none of them is the reader saying there is no being in the picture, and
    the sentence the route writes for those two is different.
  */
  it.each([
    ["prose instead of JSON", "Sure! Here is a description of the person in the image."],
    ["JSON truncated at the token ceiling", '{"description": "A woman in her ear'],
    ["an object we did not ask for", '{"caption": "a woman"}'],
    ["a bare string", '"a woman in her thirties"'],
    ["the wrong type", '{"description": 42}'],
  ])("calls a NON-EMPTY reply it cannot read 'unreadable', never 'no_being' — %s", async (_name, reply) => {
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
    for (const kept of ["age band", "heritage", "build family", "hair world", "wardrobe world", "type"]) {
      expect(system, kept).toContain(kept);
    }
    for (const dropped of ["eye colour", "brow shape", "staring", "does not", "no tattoos"]) {
      expect(system, dropped).toContain(dropped);
    }
    /*
      HIS SECOND RULING'S KEEP LIST — skin language, piercings, sparse tattoos
      and materials. They are what a STYLED subject is made of, and the first
      instruction had none of them, which is how a goth read came back as a
      packing list of the only nouns it had been given permission to use.
    */
    for (const kept of ["skin", "piercings", "tattoos", "materials"]) {
      expect(system, kept).toContain(kept);
    }
    /*
      AND THE GRANULARITY RULE ITSELF, with his own contrasts. This is the
      sentence that carries the whole second ruling — there is no sweep behind
      it, so an edit here changes the product with nothing else going red.
    */
    expect(system).toContain("worlds, never items");
    for (const rule of ["never the cut", "body size", "materials and mood", "never itemise"]) {
      expect(system, rule).toContain(rule);
    }
    /* The reason, which is what covers the cases his list could not enumerate. */
    expect(system).toContain("locked on every face");
    /* Never guess a heritage — his sentence, and it is a claim about a person. */
    expect(system).toContain("never guess");
    /* The announced target is a brief in itself, so it must actually be said. */
    expect(system).toContain(`${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters`);
  });

  /*
    HIS TWO CUTS (Crew reply #26, 2026-08-29), and NEITHER IS A WORD — which is
    why both arms are pointed at the RULE rather than at a banned token. He
    ratified the no-word-ban judgement in the same breath ("Proof is the output,
    not a word list"), so a future seat that turns either of these into a sweep
    is going against his word, not just against this module's argument.

    CUT ONE — "Athletic build: same class of mistake as slight build." `slight`
    was already out for being a SIZE and `athletic` is on the instruction's own
    closed list, so the cut cannot be a deletion from that list: it is that
    naming a build on a fashion type was the mistake at all.
  */
  it("names a build only where the build is part of the type — his first cut is a rule, not a word", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system.toLowerCase();
    expect(system).toContain("only where the build is part of the type");
    expect(system).toContain("leave the build out entirely");
    /* And the two halves that DID NOT move — the closed list still governs the
       case where a build is named, and a size is still never one of them. */
    expect(system).toContain("closed list");
    expect(system).toContain("heavy-set");
    expect(system).toContain("a body size or weight is never one of them");
  });

  /*
    CUT TWO — "spiked: filter bait; metal accents is enough." This one is the
    refusal coin (#129) reaching the describer, and the REASON is the load-
    bearing part: a rule travels to the hardware words his sentence could not
    enumerate, where a four-word ban would not.
  */
  it("names the material and never the hardware, WITH the refusal reason attached", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    const system = engine.sent[0]!.system.toLowerCase();
    const at = system.indexOf("name the material, never the hardware");
    expect(at, "the hardware rule itself").toBeGreaterThan(-1);
    /*
      ⚠ READ IN THE RULE'S OWN NEIGHBOURHOOD, NOT ACROSS THE WHOLE INSTRUCTION.
      The first cut of this arm asserted the reason with a bare `toContain` over
      the system prompt and a sabotage that DELETED the reason still passed it —
      the words "refused outright by the image engine" already appear hundreds of
      lines away, in the gloss under the failing specimen. An assertion satisfied
      by a sentence it is not about is not a guard; the sabotage driver's own
      selected-count line is what made the false pass visible.
    */
    const rule = system.slice(at, at + 400);
    expect(rule, "the material he asked for").toContain("metal accents");
    for (const hardware of ["spiked", "studded", "buckled", "chained"]) {
      expect(rule, hardware).toContain(hardware);
    }
    /* The why, not just the what — "that is not taste", in the same breath. */
    expect(rule, "the reason").toContain("refused outright by the image engine");
  });
});

/**
 * #204 — THE SUBJECT IS A BEING, NOT A PERSON.
 *
 * His own card, filed after a creature upload was told *"I couldn't find a
 * person in that picture."* These arms pin the two halves a unit suite can
 * actually hold: that the instruction says so, and that this door and the roll
 * road's wall draw the SAME line. What a suite cannot answer — whether a real
 * creature photograph now reads — is the drive's job, and it is on the record.
 */
describe("the being, not the person (#204)", () => {
  const systemOf = async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    return engine.sent[0]!.system;
  };

  it("asks about a creature as well as a person, in the ask itself", async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent[0]!.user.toLowerCase()).toContain("creature");
  });

  it("tells the reader the studio casts beings, and how to write one", async () => {
    const system = (await systemOf()).toLowerCase();
    for (const kind of ["creatures", "aliens", "robots"]) {
      expect(system, kind).toContain(kind);
    }
    /* A creature's note is the same note: the taxonomy applies rather than a
       second vocabulary being invented for it. */
    for (const world of ["scales", "horns", "build family"]) {
      expect(system, world).toContain(world);
    }
  });

  /*
    ⚠ THE ARM THAT KEEPS TWO DOORS TELLING ONE STORY.

    This reader and the roll road's own wall answer the same question about the
    same boundary, in two files, from two instructions. A customer told by the
    compiler that creatures can be cast, and by this reader that her creature
    picture has nobody in it, has met a product that disagrees with itself —
    which is exactly the state #204 was filed from, with the disagreement
    sitting between this door and the mission.

    It is a COMPARISON rather than a copied literal: the nouns are asserted
    present in BOTH texts, so either one drifting reddens it (law 4 — a second
    list shadowing a source of truth always drifts from it; here neither is the
    source, so the arm holds them together instead).
  */
  it("draws the same line the roll road's wall draws — beings in, things out", async () => {
    const describer = (await systemOf()).toLowerCase();
    const wall = SUBJECT_INSTRUCTION.toLowerCase();
    for (const being of ["creature", "robot", "alien"]) {
      expect(describer, `describer: ${being}`).toContain(being);
      expect(wall, `wall: ${being}`).toContain(being);
    }
    for (const thing of ["object", "vehicle", "landscape", "building"]) {
      expect(describer, `describer: ${thing}`).toContain(thing);
      expect(wall, `wall: ${thing}`).toContain(thing);
    }
  });

  /*
    THE IP GUARD, and the arm says out loud that it is INSTRUCTIONAL. There is
    no vision gate asking "is this a famous character" and there must not be —
    a reader's verdict that turns a customer away is what law 9 and the
    fable-1052 class forbid, and #204 asks for none. So this arm proves the
    instruction carries the rule; it cannot prove the model obeys it, and a
    green suite here is not evidence that it does.
  */
  it("carries the IP rule — a known character comes back as a type, never a name", async () => {
    const system = (await systemOf()).toLowerCase();
    expect(system).toContain("recognizable character");
    expect(system).toContain("never its name");
    expect(system).toContain("franchise");
  });

  it("describes the being and never the medium — a drawing is a picture OF somebody", async () => {
    const system = (await systemOf()).toLowerCase();
    expect(system).toContain("never the medium");
  });

  /* The one thing that must NOT have widened: a picture with no being in it. */
  it("still refuses a picture with no being in it, and does not re-ask it", async () => {
    const engine = engineSaying(said(null), said(CLEAN));
    expect(await describeConcept({ ...PICTURE, engine }))
      .toEqual({ ok: false, reason: "no_being", attempts: 1 });
    expect(engine.sent).toHaveLength(1);
  });
});

/**
 * HIS REPLY 28 — THE LINE BETWEEN A FEATURE AND THE WARDROBE.
 *
 * The drive for #185 found one subject of thirteen carrying a named *"mechanical
 * eye-piece"* through BOTH arms, and that was put to him as a question rather
 * than patched. He ruled (verbatim): *"Treat it as part of the being. The
 * clothes cut does not strip a face … On the body as anatomy → feature. On the
 * outfit as styling → materials, not a named piece. Strapped on, but replacing
 * a body part → feature."*
 *
 * ⚠ THE PLACEMENT IS THE FIX, so an arm asserts it. The defect was the WARDROBE
 * rule reaching something it was never about, so the feature rule sits above it
 * and the accessory clause is scoped to a WORN one. A suite that only asked
 * "are his words somewhere in the prompt" would pass on an instruction that
 * still told the reader to strip a cyborg's eye two lines later.
 *
 * What a suite CANNOT answer is whether a real cyborg photograph now reads the
 * way he asked — that is the drive, and his own sentence says so: *"Use this
 * rule, then check the output."*
 */
describe("feature or wardrobe — his reply 28", () => {
  const systemOf = async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    return engine.sent[0]!.system;
  };

  it("draws his three lines, in the feature rule's own neighbourhood", async () => {
    const system = (await systemOf()).toLowerCase();
    const at = system.indexOf("the clothes cut does not strip a face");
    expect(at, "his own sentence, as the rule's heading").toBeGreaterThan(-1);
    /* The rule wraps across source lines; a phrase is judged on the sentence, not the layout. */
    const rule = system.slice(at, at + 900).replace(/\s+/g, " ");
    /* On the body as anatomy -> feature. */
    expect(rule, "anatomy is a feature").toContain("anatomy");
    expect(rule, "a machine part fitted into the body").toContain("mechanical eye");
    /* Strapped on, but replacing a body part -> feature. */
    expect(rule, "his third line").toContain("replacing a body part");
    /* On the outfit as styling -> the wardrobe rule. */
    expect(rule, "styling routes to wardrobe").toContain("styling");
    /* His own three specimens of the line. */
    expect(rule, "a choker").toContain("a choker is an accessory");
    expect(rule, "a horn").toContain("a horn is a feature");
  });

  it("asks for a TYPE and not a SKU, naming both of the products he refused", async () => {
    const system = (await systemOf()).toLowerCase();
    const at = system.indexOf("the clothes cut does not strip a face");
    const rule = system.slice(at, at + 900).replace(/\s+/g, " ");
    for (const type of ["fitted mechanical eye", "integrated facial hardware"]) {
      expect(rule, type).toContain(type);
    }
    for (const sku of ["spiked eye", "mechanical eye piece"]) {
      expect(rule, sku).toContain(sku);
    }
    /* And it must not tell the reader to drop it — "flattening it costs the character". */
    expect(rule, "never flatten the being's own hardware").toContain("flatten");
  });

  it("scopes the accessory ban to a WORN one — the clause that was stripping the face", async () => {
    const system = (await systemOf()).toLowerCase();
    const at = system.indexOf("- wardrobe:");
    expect(at, "the wardrobe rule").toBeGreaterThan(-1);
    const rule = system.slice(at, at + 500).replace(/\s+/g, " ");
    expect(rule, "the ban is about what is WORN").toContain("worn accessory");
    expect(rule, "and it says so out loud").toContain("not an accessory");
  });

  it("puts the feature rule ABOVE the wardrobe rule — the placement IS the repair", async () => {
    const system = (await systemOf()).toLowerCase();
    const feature = system.indexOf("the clothes cut does not strip a face");
    const wardrobe = system.indexOf("- wardrobe:");
    expect(feature).toBeGreaterThan(-1);
    expect(wardrobe).toBeGreaterThan(-1);
    expect(feature, "the line is drawn before the rule that was crossing it").toBeLessThan(wardrobe);
  });
});

/**
 * #231 — HIS THREE REMAINING READER RULES, from the feline-deity miss.
 *
 * Verbatim: *"If skin is bare, write hairless. Never invent fur. · … ·
 * Materials, not collar plating and an arm bracer. · LOW still has to keep
 * visible species facts. Hairless is a fact, not MAX taste."*
 *
 * These are arms on the INSTRUCTION and they are honest about what that is
 * worth: the instruction is the primary control here and a suite cannot prove a
 * model obeys it. What they prevent is the rule silently leaving the prompt —
 * which is how this reader lost things before. The acceptance is the drive
 * against his own pictures (`scripts/_shift103-reader-court-disposable.mts`).
 *
 * ⚠ EVERY SLICE HAS A NON-EMPTY FLOOR. An arm that slices a prompt from an
 * anchor it cannot find, and then asserts only what is absent, passes on the
 * empty string — foreman-102 found two live instances of exactly that, one of
 * them in this very file.
 */
describe("#231 — his three remaining reader rules", () => {
  const systemOf = async () => {
    const engine = engineSaying(said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    return engine.sent[0]!.system;
  };

  const sliceFrom = (system: string, anchor: string, length: number) => {
    const at = system.indexOf(anchor);
    expect(at, `anchor: ${anchor}`).toBeGreaterThan(-1);
    const slice = system.slice(at, at + length).replace(/\s+/g, " ");
    expect(slice.length, `anchor: ${anchor} — a slice with nothing in it asserts nothing`)
      .toBeGreaterThan(anchor.length);
    return slice;
  };

  it("rule 1 — tells the reader to WRITE hairless when the skin is bare", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- surface:", 500);
    expect(rule, "his own word").toContain("hairless");
    expect(rule, "as an instruction to write it, not as a passing mention")
      .toContain("if the skin is bare, write it");
  });

  /*
    HIS SENTENCE HAS TWO HALVES AND THE SECOND IS THE ONE THAT MISSED. The
    feline deity did not merely go unlabelled — it came back with fur it does
    not have, which is a positive claim about a surface. A rule that only said
    "say hairless" leaves inventing a coat permitted.
  */
  it("rule 1 — and forbids INVENTING fur on a being that has none", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- surface:", 500);
    expect(rule, "the half of his sentence that was the actual miss").toContain("never invent fur");
  });

  /*
    ⚠ THE CLAUSE THE SABOTAGE SWEEP FOUND UNARMED — and it is the half that
    actually moved the number. His fixture is a sphynx: bare skin, and the
    reader wrote "short violet-blue fur" 4/4 while the rule said only "if the
    skin is bare, write it". What it was missing is the INFERENCE: the model was
    not failing to look, it was reading "cat" and writing a coat. 0/4 -> 3/4 on
    the re-drive after this clause landed.
  */
  it("rule 1 — and forbids inferring a coat from the KIND of being", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- surface:", 700);
    expect(rule, "the inference, not just the observation")
      .toContain("do not infer a coat from the kind of being");
    expect(rule, "a feline may be bare-skinned").toContain("bare-skinned");
  });

  it("rule 3 — worn ornament and armour take the MATERIALS rule, in his own words", async () => {
    const rule = sliceFrom((await systemOf()).toLowerCase(), "- wardrobe:", 1200);
    for (const world of ["ornamented metal", "banded gold"]) {
      expect(rule, `his replacement language: ${world}`).toContain(world);
    }
    for (const sku of ["collar plating", "arm bracer"]) {
      expect(rule, `the piece he named: ${sku}`).toContain(sku);
    }
  });

  /*
    THE PLACEMENT IS THE RULING. His own law (Crew reply 28) draws the line by
    WHERE the thing sits: fitted INTO the body is a feature, strapped ON is
    styling. A plate over a shoulder therefore belongs to the wardrobe rule, and
    an arm that only checked the words were somewhere in the prompt would pass
    with them under the feature rule, where they would mean the opposite.
  */
  it("rule 3 — and puts them under WARDROBE rather than under the feature rule", async () => {
    const system = (await systemOf()).toLowerCase();
    const feature = system.indexOf("the clothes cut does not strip a face");
    const wardrobe = system.indexOf("- wardrobe:");
    const ornament = system.indexOf("worn ornament and armour");
    expect(feature, "the feature rule").toBeGreaterThan(-1);
    expect(wardrobe, "the wardrobe rule").toBeGreaterThan(-1);
    expect(ornament, "his ornament clause").toBeGreaterThan(-1);
    expect(ornament, "strapped ON is styling — it belongs after the wardrobe rule opens")
      .toBeGreaterThan(wardrobe);
    expect(feature).toBeLessThan(wardrobe);
  });

  /*
    RULE 4 IS ABOUT THE LENGTH TARGET, and that is a reading rather than a
    transcription: nothing in this module has a LOW or a MAX. At LOW no author
    is called and the description IS the prompt's first paragraph; at MAX the
    brief is the first paragraph by code. So a fact that reaches the note
    survives both settings structurally, and the only force here that would drop
    one is the announced ~150–250 target. The arm therefore asserts the rule
    sits WITH that target: moved away from it, it is a sentence about nothing.
  */
  /*
    ⚠ IT IS A PRIORITY RULE AND IT USED TO BE A LICENCE, which is a correction
    made by driving it rather than by reading it back. The first wording said a
    species fact is kept "even when the note runs a little long" — an
    instruction to overrun a bound the CODE REFUSES at 300 characters, so it
    bought re-asks rather than facts. What he actually ruled is an ORDER OF
    PRECEDENCE: hairlessness is a fact, styling is taste, and the taste is what
    goes when they will not both fit.
  */
  it("rule 4 — a species fact outranks styling when the note will not all fit", async () => {
    const system = (await systemOf()).toLowerCase();
    const rule = sliceFrom(system, "a visible species fact outranks everything else", 400);
    expect(rule, "the facts he named").toContain("hairlessness");
    expect(rule, "the facts he named").toContain("a tail");
    expect(rule, "and which way round to cut").toContain("cut the styling and keep the anatomy");
    expect(rule, "it must not license overrunning the ceiling the code enforces")
      .not.toContain("runs a little long");

    const at = system.indexOf("a visible species fact outranks everything else");
    const target = system.indexOf("two or three short sentences");
    expect(target, "the announced target").toBeGreaterThan(-1);
    expect(Math.abs(target - at), "the rule stands with the target it is about")
      .toBeLessThan(600);
  });

  /*
    ⚠ THE RETRY PATH WAS STRIPPING THE VERY FACTS RULE 4 PROTECTS, and no arm on
    the instruction could have seen it: the `long` re-ask carried its own KEEP
    LIST — "sex, age band, heritage, build family, hair world, skin and marking
    world, wardrobe materials and type" — with no tail, no surface and no kind
    of being on it. So a creature note that ran over the ceiling was told, in
    our own words, to come back without its species. Found by driving his own
    fixture; it is the second half of rule 4 and the more load-bearing one,
    because it fires exactly when the note is under pressure.
  */
  it("rule 4 — and the LONG re-ask keeps them rather than listing them away", async () => {
    const long = `${"A ".repeat(60)}creature note far over the ceiling.`.padEnd(CONCEPT_DESCRIPTION_MAX + 40, "x");
    const engine = engineSaying(said(long), said(CLEAN));
    await describeConcept({ ...PICTURE, engine });
    expect(engine.sent.length, "the read was sent back once").toBe(2);
    const reask = engine.sent[1]!.user.toLowerCase();
    expect(reask, "the fault it names").toContain("inventory, not a casting note");
    for (const fact of ["hairless", "a tail", "ears", "horns", "kind of being"]) {
      expect(reask, `the re-ask must keep: ${fact}`).toContain(fact);
    }
    expect(reask, "and say which way to cut").toContain("cut the styling");
  });

  /*
    ⚠ AND A RE-ASK THAT FIXES THE FAULT CAN STILL BE THROWN AWAY. Driven on his
    feline fixture: the re-ask came back SHORTER and CORRECT — "bare violet-blue
    hide", the fact rule 1 exists for — as bare prose with no JSON around it, so
    `parse` could not read it and she was told we could not read her picture.
    The system turn carries the envelope on every call; a model that has just
    been told it got something wrong drops it anyway. One sentence on the turn
    being corrected is the whole repair.
  */
  it("every re-ask restates the JSON envelope, whatever the fault was", async () => {
    const faults: ReadonlyArray<readonly [string, string]> = [
      ["long", said("x".repeat(CONCEPT_DESCRIPTION_MAX + 20))],
      ["brief", said("too short")],
      ["picture", said(`${CLEAN} Shot with a shallow depth of field.`)],
      ["absence", said(`${CLEAN} No tattoos.`)],
    ];
    for (const [name, first] of faults) {
      const engine = engineSaying(first, said(CLEAN));
      await describeConcept({ ...PICTURE, engine });
      expect(engine.sent.length, `${name}: it was sent back`).toBe(2);
      expect(engine.sent[1]!.user, `${name}: the envelope is restated`)
        .toContain('{"description": "..."}');
    }
  });
});
