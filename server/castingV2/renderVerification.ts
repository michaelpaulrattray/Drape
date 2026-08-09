/**
 * DOES THE PICTURE CONTAIN WHAT THE RECORD SAYS IT DOES? (D-185)
 *
 * # The asymmetry this closes
 *
 * A roll is judged before delivery. A refine shipped **sight-unseen** — the
 * only post-render check on this path was `detectRenderFault`, which looks for
 * damage (seams, duplication) and has nothing to say about whether the thing
 * the user asked for is actually there.
 *
 * The founder's own chain proved what that costs. `EYE COLOUR: pinker` was
 * present, verbatim, in three consecutive composed prompts; the renders went
 * pink irises → brown irises with pink eyeshadow → no pink at all. The record
 * was right every time and nobody ever looked at the picture.
 *
 * # Every named facet, not just the new one
 *
 * The check reads the WHOLE composed recipe, because the fact that went missing
 * had been written one step earlier and was merely being carried. A check
 * scoped to "what this edit changed" is a check that cannot see the defect it
 * exists for.
 *
 * # It fails OPEN on an outage, and that is deliberate
 *
 * Invariant 7 says a control refuses when a dependency is missing — and it
 * governs SECURITY controls, where allowing is a breach. Here a false negative
 * costs a wrong picture the user can undo for free; a refusal on an unreachable
 * reader destroys a render that is probably fine and hands back credits instead
 * of the face. D-114 inverted the same way for the same reason. So an outage
 * delivers, loudly.
 *
 * # And the reader is fallible, which is why retry comes before refusal
 *
 * The same reader misread pink-through-glasses irises as "deep brown" in D-183.
 * A verdict is therefore evidence, not proof: it buys a free re-render first,
 * and only a second failure spends the user's refusal. Repeated verify-failures
 * on a facet class whose renders look correct are a READER defect to surface,
 * not a render defect to refund — which is what the stored verdicts are for.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { facetHeading, facetOfSubject, type Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/renderVerification");

/** One facet, what it was asked to be, and whether the picture agrees. */
export type FacetCheck = {
  facet: Facet;
  asked: string;
  verified: boolean;
  /**
   * AN AFFIRMATIVE WITHOUT EVIDENCE IS NOT A READING (D-235).
   *
   * `verified` only means something when `read` is true. A row the reader
   * omitted, or an answer that names nothing it saw, is not a pass and not a
   * miss — it is silence, and silence is recorded as silence.
   *
   * This is the door the hair-up false pass came through: the prompt used to
   * ask for `saw` ONLY on a disagreement, so every affirmative was empty by
   * construction and there was nothing to check it against.
   */
  read: boolean;
  /** What the reader says it sees — required on every answer, either way. */
  saw?: string;
  /**
   * Whether this fact is one the product may REFUSE over (D-187).
   *
   * A closed-vocabulary value has a shared meaning: "green" is a value this
   * program defines and the reader can be held to. A free-text value like
   * "seafoam green" is the user's own words, and asking a reader to adjudicate
   * whether greenish-hazel is *distinctly* seafoam is asking it to arbitrate a
   * shade name nobody has defined — six legitimate renders were refunded that
   * way on the net's first live outing.
   *
   * Both kinds are checked and both are recorded, because the record is the
   * instrument. Only the binding kind spends a refusal.
   */
  binding: boolean;
  /**
   * WHAT WENT WRONG, IN THE CUSTOMER'S SENTENCE — not the reader's.
   *
   * `asked` is an instruction to a vision model and is phrased as one. It was
   * also being spliced verbatim into two customer-facing sentences ("came back
   * twice without …") and into the ledger line, so one string was doing three
   * jobs with three different grammars. The absence row is where that broke in
   * production: its `asked` is an assertion — *"no glasses — they have been
   * taken off and are not in the picture"* — and the receipt read **"came back
   * twice without no glasses — they have been taken off and are not in the
   * picture"**.
   *
   * A shortfall is a clause that completes *"the render came back ___"*, which
   * is the one frame both customer sentences and the ledger line share. It
   * defaults to `without <asked>`, so an ordinary fact reads exactly as it
   * always did; only a fact whose failure is not an absence has to say so.
   */
  shortfall?: string;
  /**
   * THE QUESTION THE PHOTOGRAPH CANNOT ANSWER (fable-118 ruling (b)).
   *
   * A pair is a pair — earrings come in twos, and CLAUDE.md law 8's founding
   * example is exactly this. But an ear behind her hair is not a bare ear, and
   * forcing that into pass-or-miss produces one of two lies: a pass that says
   * we delivered something nobody can see, or a refund for an earring that is
   * probably there.
   *
   * So it is a third answer. Recorded, surfaced in the table, and counted in
   * neither column — the same shape as `read: false`, for the same reason
   * (D-235's asymmetry: a question the picture cannot answer spends no refusal
   * and earns no credit).
   *
   * The founder's own specimens are why the default must stay strict: on
   * v#156 and v#157 the empty ear was fully visible, and both were passed.
   */
  occluded?: boolean;
};

/** A real miss: read, not verified, and the picture could have answered. */
export function isMiss(check: FacetCheck): boolean {
  return check.read && !check.verified && check.occluded !== true;
}

/** Read, contradicted by nothing, and unanswerable — neither pass nor miss. */
export function isOccluded(check: FacetCheck): boolean {
  return check.read && !check.verified && check.occluded === true;
}

export type RenderVerdict = {
  ok: boolean;
  checks: FacetCheck[];
  /** True when the reader could not be reached at all — delivered, not refused. */
  unavailable?: boolean;
  /** How many readings were taken. Two on a binding failure, three on a split. */
  readings?: number;
};

const SYSTEM_PROMPT = [
  "You check a photograph against a list of things that were asked for, one line each.",
  "",
  "For each item, answer whether that thing is VISIBLY TRUE in the photograph. You are not",
  "judging whether it looks good, whether it suits the person, or how well it was done —",
  "only whether it is there.",
  "",
  "Be strict about WHERE. Pink eyes means the irises are pink; pink eyeshadow on brown eyes",
  "is not pink eyes, it is a different thing in the same neighbourhood. Hair worn down is",
  "not hair worn up. An earring that is present but different from the one described is",
  "still present — describe the difference rather than failing it.",
  "",
  "A PAIR MEANS BOTH SIDES. 'Earrings' is two earrings, one on each ear — a single earring",
  "with the other ear BARE and VISIBLE is NOT present, however good the one is. Say so, and",
  "name which ear is empty.",
  "",
  'If the second side is HIDDEN — behind hair, turned away, out of frame — answer',
  '{"present":true,"occluded":true} and say in `saw` which side you cannot see. That is not',
  "a pass and not a failure; it is the honest answer to a question this photograph cannot",
  "settle. Use it only when the side is genuinely not visible.",
  "",
  "Be generous about DEGREE. A relative ask like 'pinker' or 'lighter' is satisfied by a",
  "visible move in that direction; it does not have to be extreme.",
  "",
  "SIZE AND PROMINENCE ARE DEGREE, NEVER PRESENCE. A hoop that is smaller, thinner or",
  "plainer than you pictured is still a hoop that is there. Only answer that a thing is",
  "not present when you cannot find it at all. Never invent a strength the ask did not",
  "name and then fail the picture against it.",
  "",
  "AN ASK CAN BE AN ABSENCE. A line phrased as a removal — 'no glasses, they have been",
  "taken off' — is VISIBLY TRUE when the thing is NOT in the picture, and false when it",
  "is still there. Answer it the same way: `present` means the line is true of the",
  "photograph, and `saw` names what is at that place now — 'bare eyes, no frames',",
  "'she is still wearing the glasses'.",
  "",
  "JUDGE INTENSITY AGAINST THEIR OWN WORDS. If the ask carries a strength — 'light",
  "freckles', 'a faint tan', 'subtle', 'a hint of', 'heavy', 'bold' — then that is the",
  "target, and the render is correct when it matches it. For a LIGHT ask, faint is a PASS",
  "and heavy is the miss; do not wait for a subtle thing to become obvious before you will",
  "say it is there. Look closely at the region named before calling a quiet change absent.",
  "Where the ask names no strength, any rendering you can see counts.",
  "",
  "Be generous about SHADE NAMES too. Someone's own words for a colour — 'seafoam green',",
  "'the colour of rosé', 'dusty pink' — are satisfied by a colour plainly in that family.",
  "You are not judging whether it is the exact shade they imagined; you are judging whether",
  "the colour changed to the thing they named.",
  "",
  'Reply with JSON: {"results":[{"id":1,"present":true|false,"occluded":true,"saw":"..."}]}',
  '— `occluded` is optional and only ever appears beside "present":true — and nothing',
  "else.",
  "",
  "`saw` is REQUIRED on EVERY line, whether present is true or false. Name what you",
  "actually see for that feature in this photograph — 'hair gathered at the nape',",
  "'hair loose past the shoulders' — under 90 characters. Describe the picture, not",
  "the request: never restate the asked-for wording back as what you saw.",
  "",
  "A line with no `saw` is discarded as unanswered. Do not answer without saying what",
  "you saw.",
].join("\n");

/**
 * The preamble for the CLOSE reading — the magnified crop, on its own.
 *
 * # Why on its own, when riding along was so much tidier
 *
 * The first build sent the frame and the enlargement together in one call, so
 * that one pass could still weigh every fact at once. The court measured that
 * shape rather than assuming it, and it does not work: on run-12's frame 03 the
 * crop ALONE is right 5 times out of 5 and the frame-plus-crop pair is right
 * **once** out of 5. The full frame dominates — the reader looks at the
 * portrait, sees skin that reads clear at that size, and answers from it.
 *
 * A magnifier you are allowed to ignore is not a magnifier. So the small facets
 * get their own look, at the only size they survive.
 *
 * # And this does not reopen the one-pass argument
 *
 * One call over every fact exists because facets in the same neighbourhood must
 * be weighed against each other — pink irises against pink eyeshadow. That
 * applies to facets competing for one place on a face. It does not apply to
 * "are there freckles on this skin", which nothing else in the recipe can be
 * mistaken for, and for which the crop IS the whole photograph.
 */
const CLOSE_PROMPT = [
  "",
  "THIS IMAGE IS A MAGNIFIED CROP of a portrait — the person's face, enlarged, with no detail",
  "added or invented. You are looking closely on purpose, at fine surface things that are only",
  "a few pixels across in the full photograph. Judge only the lines below, from what is",
  "actually in this crop.",
].join("\n");

/**
 * Only a READ, BINDING miss spends the user's refusal. An unread check is
 * silence: it never refuses, and it never passes either.
 */
export function okOf(checks: ReadonlyArray<FacetCheck>): boolean {
  return checks.every((check) => !isMiss(check) || !check.binding);
}

/**
 * A CARRIED FACT IS NOT THE READER'S TO REFUSE — the pair law meeting the store
 * (fable-120's third condition).
 *
 * # The two things this settles, and why they are one function
 *
 * A carried facet's pixels were PASTED, not painted. fable-109 settled what
 * judges them: *"A carried fact is the one thing a stochastic reader must not
 * adjudicate, because the claim is not 'does this look freckled' — it is 'are
 * these the same pixels she already paid for'"*. The instrument for that is the
 * byte adjudicator, and it is deterministic.
 *
 * That law had no consumer on the refusal path, and ruling (c) has just given
 * one class of fact teeth. So today a carried earring that a reader cannot find
 * spends a binding refusal on the founder's own account — a false refusal
 * manufactured by two correct decisions meeting. **A carried miss is recorded
 * and never binding.** The verdict is untouched: the report's honesty column
 * still shows a carried fact the reader could not find, because that is exactly
 * the false-pass evidence the two-column report exists to collect.
 *
 * # And the one carried miss that is not a miss at all
 *
 * When this render's own fresh paint covers the ground a carried segment owns —
 * new hair falling over the ear the hoop was pasted onto — the picture cannot
 * answer the question. That is not absence and not delivery; it is the third
 * verdict ruling (b) introduced for a hidden second ear, arriving from the other
 * direction.
 *
 * It is taken from the assembly's OWN arithmetic rather than from a reader's
 * opinion or a new measurement: `supersededCandidates` is already computed at
 * paste time as the share of a carried segment's pixels that the fresh paint
 * later claimed, and already rides the row. A segment over that bar was
 * demonstrably painted over by this very render. Nothing here re-derives it —
 * a second answer to "was it covered" is how the two would come to disagree.
 *
 * Silence stays silence: a check with no reading is not promoted to occluded,
 * because `occluded` is an answer about a photograph and an unread check has
 * none (D-235's asymmetry).
 */
export function settleCarriedChecks(
  verdict: RenderVerdict,
  carried: {
    /** Facets present in this frame because a segment was pasted. */
    facets: readonly string[];
    /** The assembly's own record of segments this render's paint covered. */
    superseded?: ReadonlyArray<{ facet: string }>;
  },
): RenderVerdict {
  if (carried.facets.length === 0) return verdict;
  const isCarried = new Set(carried.facets);
  const coveredByThisPaint = new Set((carried.superseded ?? []).map((entry) => entry.facet));
  let changed = false;
  const checks = verdict.checks.map((check) => {
    if (!isCarried.has(check.facet) || !isMiss(check)) return check;
    changed = true;
    return {
      ...check,
      binding: false,
      ...(coveredByThisPaint.has(check.facet) ? { occluded: true } : {}),
    };
  });
  return changed ? { ...verdict, checks, ok: okOf(checks) } : verdict;
}

const keyOf = (check: FacetCheck): string => `${check.facet}|${check.asked}`;

/**
 * FACETS WITH A MEASURED UNRELIABILITY PRIOR (D-235).
 *
 * D-194 re-reads binding MISSES, because a miss is about to spend a refusal.
 * That asymmetry was right for the refusal path and wrong for the delivery
 * path: an affirmative was never re-read, so a false pass was single-sampled
 * and free to produce — and a false pass is worse than a refusal, because it
 * charges for non-compliance.
 *
 * Re-reading every affirmative would double the reading cost of every render.
 * So this is a TARGETED list, and the entry bar is measured disagreement, not
 * suspicion. It is seeded with the one facet that has a rap sheet:
 *
 *   - `hairWorn` — production operation 92e327ab ("tie her hair up"): affirmed
 *     on one reading with no `saw`, delivered and charged with the hair
 *     visibly still down. Refunded as a correction, 2026-08-07.
 *
 * The reliability report is what earns a facet its place here — a class whose
 * audited false-pass count is non-zero gets added, and one that stops
 * disagreeing can be argued back off. Do not add a facet on a hunch; a hunch
 * costs every user of that facet an extra vision call on the happy path.
 */
const UNRELIABLE_FACETS: ReadonlySet<Facet> = new Set<Facet>([facetOfSubject("hairWorn")]);

/** Test seam: the guard is only honest if it can be driven without an LLM. */
export function facetsWithUnreliabilityPrior(): Facet[] {
  return Array.from(UNRELIABLE_FACETS);
}

/**
 * One vision pass over every named fact in the recipe.
 *
 * A single call rather than one per facet: the reader is looking at one
 * photograph, and asking it eight times costs eight times as much for a worse
 * answer — it cannot weigh "the pink is on the lids not the irises" without
 * seeing both questions at once.
 */
export async function verifyRender(input: {
  bytes: Buffer;
  contentType: string;
  /**
   * A MAGNIFIED CROP OF THE SAME FRAME, when the recipe names something too
   * small to survive the reader's own downsample.
   *
   * # Measured, not supposed
   *
   * Run-12 scored `marks` at 25% and the story was a broken reader. Its court
   * (`scripts/calibration/marks-reader-court.mts`) put eight cases to the
   * production reader five times at each of three lenses — **120 readings, zero
   * split verdicts**. The reader agrees with itself perfectly at temperature 0.
   * What changes the answer is what it is shown:
   *
   *     portrait (today)              6/8 cases unanimous, 30/40 readings right
   *     face crop                     7/8                  35/40
   *     face crop, enlarged 2x        8/8                  40/40
   *
   * Her freckles are a few pixels across in a 1024x1536 portrait and do not
   * survive the downsample a vision model applies before it ever sees them. So
   * this is not a second reading and not a rewritten question — it is the same
   * question with the pixels intact.
   *
   * # Why it rides in the SAME call
   *
   * One pass over every fact is the design (a reader that cannot see the eyes
   * and the eyeshadow together cannot tell them apart), and a separate call for
   * the small facets would break it as surely as asking eight times would. The
   * transport already takes a list of images.
   *
   * # Why it cannot manufacture what it is looking for
   *
   * The upscale is nearest-neighbour, so it invents no pigment, and the court's
   * three clear-skin cases — her own bare master, the frame that lost its
   * freckles, and a specimen with none — stay unanimously ABSENT at this lens.
   * A magnifier whose failure mode is seeing things would have broken there.
   */
  detail?: {
    bytes: Buffer;
    contentType: string;
    /**
     * Exactly which facets this crop is entitled to answer.
     *
     * Declared by the caller rather than inferred here, because the caller is
     * the one that knows what the crop contains: a face-skin crop can answer
     * "are there freckles" and has no business answering "is her hair up".
     */
    answers: ReadonlyArray<Facet>;
  };
  /** `binding` false means checked and recorded, never refunded (D-187). */
  facts: ReadonlyArray<{ facet: Facet; asked: string; binding?: boolean; shortfall?: string }>;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<RenderVerdict> {
  if (input.facts.length === 0) return { ok: true, checks: [] };
  const engine = input.engine ?? interpreterEngine();
  if (!engine) {
    log.warn({}, "[renderVerification] no reader — delivering unverified");
    return { ok: true, checks: [], unavailable: true };
  }

  const verdict = await readOnce({
    engine,
    system: SYSTEM_PROMPT,
    image: { bytes: input.bytes, contentType: input.contentType },
    facts: input.facts,
    signal: input.signal,
  });

  /* Nothing to sharpen if the frame reading produced no checks to sharpen —
     an unavailable reader is already delivering unverified, and a second call
     would be paid for to merge into an empty list. */
  if (verdict.unavailable) return verdict;
  const closely = input.detail
    ? input.facts.filter((fact) => input.detail!.answers.includes(fact.facet))
    : [];
  if (!input.detail || closely.length === 0) return verdict;

  /*
    THE CLOSE READING, and it REPLACES the frame's answer for these facets.

    Not a vote and not a tie-break. The court settled which instrument is
    trustworthy for them — 40/40 on the crop against 30/40 on the portrait,
    with every portrait error a false negative and every clear-skin control
    unanimously absent at both. Averaging a sound reading with a blind one
    would only make the blindness quieter.

    An unavailable or unreadable close pass changes nothing: the frame's verdict
    stands, exactly as it does today. A magnifier is an improvement to a
    reading, never a precondition for one.
  */
  const close = await readOnce({
    engine,
    system: SYSTEM_PROMPT + CLOSE_PROMPT,
    image: { bytes: input.detail.bytes, contentType: input.detail.contentType },
    facts: closely,
    signal: input.signal,
  });
  if (close.unavailable) return verdict;

  const closeBy = new Map(close.checks.map((check) => [keyOf(check), check]));
  const checks = verdict.checks.map((check) => {
    const closer = closeBy.get(keyOf(check));
    return closer?.read ? closer : check;
  });
  return { ...verdict, checks, ok: okOf(checks) };
}

/** One reading of one image over a list of facts. */
async function readOnce(input: {
  engine: TextEngine;
  system: string;
  image: { bytes: Buffer; contentType: string };
  facts: ReadonlyArray<{ facet: Facet; asked: string; binding?: boolean; shortfall?: string }>;
  signal?: AbortSignal;
}): Promise<RenderVerdict> {
  const { engine } = input;
  const lines = input.facts.map((fact, index) =>
    `${index + 1}. ${facetHeading(fact.facet)}: ${fact.asked}`);

  try {
    const reply = await engine.complete({
      system: input.system,
      user: lines.join("\n"),
      images: [input.image],
      json: true,
      temperature: 0,
      maxOutputTokens: 700,
      signal: input.signal,
    });
    const parsed = JSON.parse(
      reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
    );
    const results = Array.isArray(parsed?.results) ? parsed.results : null;
    if (!results) {
      log.warn({ reply: reply.text.slice(0, 200) }, "[renderVerification] unreadable verdict — delivering");
      return { ok: true, checks: [], unavailable: true };
    }

    const checks: FacetCheck[] = input.facts.map((fact, index) => {
      const row = results.find((entry: { id?: unknown }) => Number(entry?.id) === index + 1);
      const saw = typeof row?.saw === "string" ? row.saw.trim().slice(0, 90) : undefined;
      /*
        THE EVIDENCE RULE IS ASYMMETRIC, AND THE ASYMMETRY IS THE POINT.

        An AFFIRMATIVE must name what it saw or it is not a reading: that is the
        door the hair-up false pass came through, and an evidence-free yes is
        the single cheapest way to charge for non-compliance.

        A NEGATIVE without evidence stays a miss. Making this rule symmetric
        looked tidier and was wrong — it would have delivered and CHARGED for a
        render the reader believed was non-compliant, manufacturing the exact
        false pass this guard exists to prevent. Every silence is resolved in
        the direction that does not take the user's money. A miss is already
        protected from reader flake by the two readings of D-194.
      */
      const answered = row !== undefined && typeof row.present === "boolean";
      const read = answered && (row.present === false || (saw !== undefined && saw.length > 0));
      /*
        THE THIRD ANSWER, AND IT NEEDS ITS EVIDENCE LIKE ANY OTHER (fable-118).

        `occluded` only means anything on an affirmative that named what it saw.
        A bare `{"occluded":true}` with no reading behind it would be a way to
        answer nothing and be counted in neither column — which is precisely the
        laundromat the evidence rule exists to prevent.
      */
      const occluded = read && row.present === true && row.occluded === true;
      return {
        facet: fact.facet,
        asked: fact.asked,
        /* An unanswerable question is not a pass. It is not a miss either —
           `isMiss`/`isOccluded` are what tell the two apart downstream. */
        verified: read && row.present === true && !occluded,
        read,
        binding: fact.binding !== false,
        ...(occluded ? { occluded: true } : {}),
        ...(saw ? { saw } : {}),
        ...(fact.shortfall ? { shortfall: fact.shortfall } : {}),
      };
    });

    /*
      If NOTHING came back readable, the reader spoke without answering. That is
      an instrument failure, not eight separate silences, and it is reported as
      one — otherwise a reader that quietly stopped emitting `saw` would read as
      a clean sheet forever.
    */
    if (checks.length > 0 && checks.every((check) => !check.read)) {
      log.warn(
        { facts: checks.length, reply: reply.text.slice(0, 200) },
        "[renderVerification] every affirmative named nothing it saw — delivering unverified",
      );
      return { ok: true, checks, unavailable: true };
    }
    const unread = checks.filter((check) => !check.read);
    if (unread.length > 0) {
      log.warn(
        { unread: unread.map((check) => check.facet) },
        "[renderVerification] answers with no evidence — recorded as unread, not as passes",
      );
    }
    /* Everything is recorded; only a BINDING failure spends the user's refusal. */
    return { ok: okOf(checks), checks };
  } catch (error) {
    log.warn({ err: error }, "[renderVerification] the reader could not be reached — delivering");
    return { ok: true, checks: [], unavailable: true };
  }
}

/**
 * A BINDING FAILURE NEEDS TWO READERS TO AGREE (D-194).
 *
 * Measured on the trial's own data: the same reader, given the same prompt and
 * the same image twice, **disagreed with itself on 21% of judgements** — 7
 * reversals in 33 pairs, five of them on one facet in one direction. Chain 3
 * position 1 is the exhibit the founder named: a render the service passed, and
 * an independent re-read of that same picture said the fact was missing.
 *
 * A single reading is therefore not evidence enough to spend somebody's refusal
 * on. So a binding miss is re-read before it counts:
 *
 *   - agree it is missing → it is missing;
 *   - disagree → a third reading breaks the tie;
 *   - anything that does not reach a majority stays DELIVERED.
 *
 * The cost is bounded and lands only where it is already expensive: extra
 * readings happen exclusively on a render that is about to be re-rendered or
 * refunded, never on the happy path. One or two more vision calls against a 25
 * credit refund and a wasted image.
 */
export async function confirmVerdict(
  first: RenderVerdict,
  reread: () => Promise<RenderVerdict>,
): Promise<RenderVerdict> {
  const original = new Map(first.checks.map((check) => [keyOf(check), check]));
  const bindingMisses = first.checks.filter((c) => isMiss(c) && c.binding);
  /* (b) The delivery-path half: an affirmative on a facet with a rap sheet. */
  const suspectPasses = first.checks.filter(
    (c) => c.read && c.verified && UNRELIABLE_FACETS.has(c.facet),
  );
  if ((bindingMisses.length === 0 && suspectPasses.length === 0) || first.unavailable) {
    return { ...first, readings: 1 };
  }

  const second = await reread();
  if (second.unavailable) {
    /* No second opinion available. One reading never refuses on its own. */
    log.warn({}, "[renderVerification] no second opinion — delivering rather than refusing");
    return { ...first, ok: true, readings: 1 };
  }
  const secondBy = new Map(second.checks.map((check) => [keyOf(check), check]));

  /*
    AN AFFIRMATION ON AN UNRELIABLE FACET LOSES TO DISAGREEMENT.

    Not a majority — a demotion. The asymmetry is deliberate and it is the
    founder's bar talking: a false pass charges for non-compliance, so on the
    facets that have actually produced one, the benefit of the doubt runs the
    other way. Where the facet is advisory this costs nothing but an honest
    record; where it is binding the demoted check still has to survive the
    majority of three below before it spends anybody's refusal.
  */
  let checks = first.checks.map((check) => {
    if (!(check.read && check.verified && UNRELIABLE_FACETS.has(check.facet))) return check;
    const other = secondBy.get(keyOf(check));
    if (!other || !other.read || other.verified) return check;
    log.warn(
      { facet: check.facet, asked: check.asked, saw: other.saw },
      "[renderVerification] affirmation withdrawn on re-read — recorded as a miss, not a pass",
    );
    return { ...check, verified: false, saw: other.saw };
  });

  const contested = checks.filter((c) => isMiss(c) && c.binding);
  /* Two readings that AGREE are what a refusal is made of; a split needs a third. */
  const split = contested.some((check) => {
    const other = secondBy.get(keyOf(check));
    if (!other || !other.read) return true;
    return original.get(keyOf(check))!.verified !== other.verified;
  });
  if (contested.length === 0 || !split) {
    return { ...first, checks, ok: okOf(checks), readings: 2 };
  }

  const third = await reread();
  if (third.unavailable) return { ...first, checks, ok: true, readings: 2 };
  const thirdBy = new Map(third.checks.map((check) => [keyOf(check), check]));

  /* Majority of three, per fact, voting the FIRST reading rather than the
     demoted one — otherwise the second reading would be counted twice. */
  checks = checks.map((check) => {
    if (!(isMiss(check) && check.binding)) return check;
    const key = keyOf(check);
    const votes = [original.get(key), secondBy.get(key), thirdBy.get(key)]
      .filter(Boolean)
      .filter((vote) => vote!.verified === false).length;
    return votes >= 2 ? check : { ...check, verified: true, saw: undefined };
  });
  return { ...first, checks, ok: okOf(checks), readings: 3 };
}

/** The facets that failed and are worth acting on. */
export function missingFacts(verdict: RenderVerdict): string[] {
  return verdict.checks
    .filter((check) => isMiss(check) && check.binding)
    .map((check) => check.asked);
}

/**
 * THE SAME FAILURES, IN THE SENTENCE A CUSTOMER READS.
 *
 * Separate from `missingFacts` on purpose: that one is for the log, where the
 * reader's own phrasing is what an engineer wants to see. This one completes
 * *"the render came back ___"*, which is the frame the refusal message and the
 * ledger line both use, so neither has to reshape a string written for a vision
 * model. See `FacetCheck.shortfall`.
 */
export function shortfalls(verdict: RenderVerdict): string[] {
  return verdict.checks
    .filter((check) => isMiss(check) && check.binding)
    .map((check) => check.shortfall ?? `without ${check.asked}`);
}

/**
 * Clauses as a person would say them: "a", "a and b", "a, b and c".
 *
 * An Oxford-comma-free list because these are read aloud in a sentence, not
 * scanned in a table, and "without freckles, with glasses still in the picture"
 * reads as a fragment where "and" reads as English.
 */
export function joinClauses(clauses: ReadonlyArray<string>): string {
  if (clauses.length <= 1) return clauses[0] ?? "";
  return `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}

/** Failures the product will NOT refuse over — the reader-defect watch list. */
export function advisoryMisses(verdict: RenderVerdict): FacetCheck[] {
  return verdict.checks.filter((check) => isMiss(check) && !check.binding);
}

/** Facts the reader was asked about and said nothing usable on. Never a pass. */
export function unreadFacts(verdict: RenderVerdict): FacetCheck[] {
  return verdict.checks.filter((check) => !check.read);
}
