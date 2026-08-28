/**
 * UPLOAD A CONCEPT — a picture in, a description of THE PERSON out, and
 * nothing else (#185, founder-ordered 2026-08-28).
 *
 * His words, verbatim:
 *
 * > *"the upload a person should be upload a concept or somthing like that …
 * > if you have a model already or concept or image you can upload it the
 * > image analyzer will analyze and describe it to the authour and cast it
 * > with the description . it should only describe the person in the image not
 * > the lighting or background or framing nothing that contradicts our house
 * > locks. that way its easy for someone to upload an image and get a prompt
 * > to create someone similar without having to type it all out."*
 *
 * # A TYPE, NOT AN INVENTORY — his ruling on the first live read (2026-08-28)
 *
 * The road shipped, he looked at what came back, and he corrected the reader's
 * whole job. Verbatim, on #185:
 *
 * > *"Too much inventory. For a cast studio it should come back as a type, not
 * > a police report. That 1,082-character read will lock eye colour, exact
 * > buzz, temple grey, brow shape, shirt cut, 'no tattoos.' Then eight renders
 * > of the same man. That's the old MAX-clone problem, just coming from the
 * > uploader instead of the author."*
 *
 * > *"Upload-a-concept has two jobs. Default to the first: **Cast this role**
 * > — eight different people who could replace the photo. **Match this face**
 * > — only if the user later asks for a lookalike. Right now the reader is
 * > doing job 2 by accident."*
 *
 * KEEP (his list): sex · age BAND · heritage family if actually visible ·
 * build language · hair world · wardrobe world · type. DROP: exact eye colour ·
 * exact brow · exact fade or temple map · seams and garment construction ·
 * *"no jewellery, makeup, or tattoos"* · anything you only noticed by staring.
 * His success test, which is the acceptance drive: **two different uploads of
 * two different men come back as two different types**, and eight renders of
 * one upload are eight different faces in that type.
 *
 * ⚠ **MATCH THIS FACE IS A NAMED SECOND MODE AND IT IS NOT BUILT** — recorded
 * here so it does not vanish into a closed issue. It is not a describer mode
 * at all when it comes: a lookalike is an IMAGE-anchored road (the Follow's
 * own mechanism, #177), and this reader has one job. Nothing below is a step
 * toward it.
 *
 * # THE PHOTOGRAPH IS NEVER KEPT AND NEVER RENDERED
 *
 * This is the whole shape of the feature and everything else follows from it.
 * The bytes ride ONE text call as an inline data URI (`openrouterText.ts`'s
 * `userContent` — read at the code, not assumed: images are base64 in the
 * request body, never fetched from an address) and are dropped when it
 * returns. There is no storage write, no row, no table, no migration and no
 * purge path, because there is nothing kept to purge — which is also why this
 * road is outside the ink studio's widening-tripwire class entirely: no
 * stranger's photograph ever reaches a permanently public R2 URL.
 *
 * What survives the call is WORDS, and they land in the customer's own brief
 * box where she can read and edit them before she spends anything. So the
 * engine is given a TYPE, never a face — and the likeness wall
 * (`briefCompiler.ts`'s `LIKENESS_MESSAGE`) still stands in front of the
 * compile exactly as it does for a brief she typed, for free, because this
 * road adds no path around it.
 *
 * # WHAT IT MAY NOT SAY, AND WHY THAT IS CODE RATHER THAN AN INSTRUCTION
 *
 * `houseBlock.ts` is appended to every authored prompt BY CODE and owns the
 * capture, the realism, the framing and the negatives. A description that
 * arrives saying *"soft studio lighting, shallow depth of field, cropped at
 * the chest"* does not add to that block — it ARGUES with it, in the same
 * prompt, and the founder's sentence names exactly this ("nothing that
 * contradicts our house locks").
 *
 * Working law 3 says a backstop tested only through a model that usually
 * behaves is untested, so the rule is not left to {@link RULES}: the returned
 * text is SWEPT (`notAboutThePersonIn`) and a description carrying a forbidden
 * word is re-asked once and then refused. The instruction is the primary
 * control; the sweep is the one that can be driven.
 *
 * # HERITAGE IS NAMED, AND IT WAS ADDED BY LOOKING (law 9)
 *
 * The first real drive read three delivered frames well and one of them was a
 * South Asian man the description called *"warm olive-brown"* and nothing else.
 * That is the founder's own success test failing quietly — *"a prompt to create
 * someone SIMILAR"* — because heritage is the single strongest type fact and a
 * brief without it casts a different person. It is house vocabulary rather than
 * a new claim: `describeHeritage` already writes it into the family clause, and
 * the compiled brief has carried a heritage field since long before this road.
 * The instruction asks for it now, and the re-drive is on the record.
 *
 * # ITS ONE DECLARED LIMIT
 *
 * The sweep holds almost nothing about resemblance, and it must not: a phrase
 * ban wide enough to catch *"looks like X"* also catches *"features reminiscent
 * of South Asian ancestry"*, which is the road's own subject matter — measured,
 * on a real frame, and recorded beside {@link NOT_ABOUT_THE_PERSON}. The
 * protection against a named likeness is structural and lives elsewhere: the
 * photograph does not ride, and `briefCompiler.ts`'s likeness wall stands in
 * front of the compile for a description exactly as for a brief she typed —
 * free, before the claim, the reader's judgement taken twice. A "is this a
 * famous person" vision gate is deliberately NOT built: a reader's verdict
 * turning a customer away is what law 9 and the fable-1052 class forbid, and
 * nothing in his order asks for one.
 *
 * # A READ THAT NEVER ARRIVED IS ASKED AGAIN — #193, and the measurement
 *
 * Six live reads on production frames, one came back `unreadable`, and **the
 * frame that refused answered cleanly three times out of three immediately
 * afterwards** (`scripts/_e76-unreadable-probe-disposable.mts`). So the refusal
 * was the coin and not the picture — and the one outcome this module declined
 * to re-ask was the one that is provably transient, while the outcomes it did
 * re-ask (a read forty characters too long) are the ones a second ask is least
 * likely to change.
 *
 * ⚠ **THE CARD NAMED ONE BRANCH AND THERE ARE THREE, so the repair is the
 * CLASS** (law 7). `{ reason: "unreadable", attempts: 1 }` is returned from an
 * unparseable reply, from a transport that threw, and — the one nobody had
 * counted — from `openrouterText.ts`'s **empty completion on a 200**, which
 * throws `ProviderError("unknown")` and is NOT in `RETRYABLE_FAILURES`, so it
 * gets exactly one shot where a timeout gets three. The two are
 * indistinguishable at the outcome: both branches return the same object, and
 * the original run's log is gone, **so which one the measured refusal came
 * from is unknown and is not asserted here**. Covering both is what makes that
 * not matter.
 *
 * What is NOT re-asked, and each for its own reason: `no_person` (a real
 * answer, not a failure — re-asking it is asking a reader to change a correct
 * verdict); `transport`, `rate_limit` and `timeout` (the transport's own
 * `withRetry` has already burned three attempts, and a fourth would put a
 * customer through ~4x a dead provider's deadline on a synchronous route);
 * `capability`, which is a CANCEL; a throw that is not a `ProviderError` at
 * all, so a bug in our own code cannot be retried into invisibility; and a
 * second failure of any of these, which keeps today's sentence, because a read
 * that comes back as noise twice is the one case where *try a different
 * picture* is honest advice.
 */
import { createModuleLogger } from "../logging/logger";
import { interpreterEngine } from "./interpreter";
import { ProviderError, type TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/conceptDescribe");

/**
 * THE CEILING IS THE ANTI-CLONE CONTROL — 300, and it was 1,200 (his ruling,
 * 2026-08-28).
 *
 * The first live read came back at **1,082 characters** and he named exactly
 * what that buys, verbatim: *"That 1,082-character read will lock eye colour,
 * exact buzz, temple grey, brow shape, shirt cut, 'no tattoos.' Then eight
 * renders of the same man. That's the old MAX-clone problem, just coming from
 * the uploader instead of the author."*
 *
 * So the bound is not a formatting preference and it is not about the
 * entrance's brief cap (it was already far under it). **Every detail the
 * description names is a detail all eight faces are forced to share**, because
 * the words go to the engine verbatim as the first paragraph of the prompt. A
 * casting note fits in a couple of sentences; an inventory does not. The
 * length is therefore the one control here that is STRUCTURAL — provable in
 * code, unable to over-refuse a legitimate word — and it carries what a word
 * ban cannot (see {@link ABSENCE_CLAIMS}'s note on what is deliberately NOT
 * banned).
 *
 * Announced and enforced are different numbers on purpose. The instruction
 * asks for **~150–250** (his own figures — an announced cap is a brief, and a
 * stated target writes the answer rather than filtering it); the code refuses
 * at 300, so an honest read that runs a little over its target is not thrown
 * away for a rounding. A longer read is never truncated mid-word — half a
 * sentence about a person is a claim nobody made.
 */
export const CONCEPT_DESCRIPTION_MAX = 300;

/** The target the reader is ASKED for, in his own numbers. Announced, not enforced. */
export const CONCEPT_DESCRIPTION_TARGET = { low: 150, high: 250 } as const;

/**
 * Below this there is no description, only a shrug wearing one.
 *
 * 100 rather than the target's 150: heritage is named only when it is actually
 * visible and the drop list takes several nouns out, so a legitimately sparse
 * read lands near 120 — and refusing a customer who is holding good type
 * language, over a floor his ruling never made hard, is over-enforcement.
 */
export const CONCEPT_DESCRIPTION_MIN = 100;

/**
 * WORDS ABOUT THE PICTURE, NOT ABOUT THE PERSON — swept out of the reply.
 *
 * Every entry is a claim about the photograph (its light, its set, its frame,
 * its camera, its rendering) or a resemblance claim, and each says which.
 *
 * ⚠ THE LIST IS DELIBERATELY NARROW, and that is the lesson of the typo gate
 * (which owned "shave" and blocked the founder's own bald ask). A word that
 * legitimately describes a PERSON is not on it, however photographic it looks
 * elsewhere: `sharp` stays (sharp cheekbones, a sharp jawline), `light` stays
 * (light brown hair), `soft` stays (soft features), `fair` stays. Where the
 * photographic sense needs banning and the human sense does not, the entry is
 * the PHRASE — `sharp focus`, not `sharp`.
 */
export const NOT_ABOUT_THE_PERSON: ReadonlyArray<{ word: string; because: string }> = [
  /* Light — his sentence names it first. */
  { word: "lighting", because: "the block owns the light (his sentence: 'not the lighting')" },
  { word: "backlit", because: "a light claim" },
  { word: "rim light", because: "a light claim" },
  { word: "key light", because: "a light claim" },
  { word: "softbox", because: "a light claim" },
  { word: "golden hour", because: "a light claim" },
  { word: "high key", because: "a light claim" },
  { word: "low key", because: "a light claim" },
  /* Set. */
  { word: "background", because: "the block owns the set (his sentence: 'not the background')" },
  { word: "backdrop", because: "a set claim" },
  { word: "studio", because: "a set claim, and the block already says it" },
  { word: "seamless", because: "a set claim (a seamless paper sweep)" },
  /* Frame — his sentence names it third, and #182 fixed the framing in code. */
  { word: "framing", because: "the block owns the frame (his sentence: 'not the framing')" },
  { word: "framed", because: "a frame claim" },
  /* ⚠ NO FORM OF `cropped` IS ON THIS LIST, AND IT TOOK THREE GOES TO ADMIT IT.
     Bare `cropped` swept "close-cropped stubble"; the narrowed `cropped at`
     still sweeps "cropped at the nape"; `tightly cropped` is what everyone
     calls short hair. The word belongs to hair and to garments at least as much
     as to a frame, so every ban wide enough to catch the photographic sense
     also refuses a good description of a person — the typo gate owning "shave"
     for the third time in one sitting. THE DECLARED GAP: a description saying
     "cropped at the chest" and nothing else photographic passes this sweep. The
     category is carried by the ten frame words around it and by {@link RULES};
     one uncatchable phrase is a better price than a ban that refuses haircuts.
     (Review of #187, finding 2 — and the class, not the instance.) */
  { word: "close-up", because: "a frame claim" },
  { word: "closeup", because: "a frame claim" },
  { word: "headshot", because: "a frame claim" },
  { word: "head-and-shoulders", because: "a frame claim" },
  { word: "waist-up", because: "a frame claim, and it contradicts the mid-torso pair (#182)" },
  { word: "chest up", because: "a frame claim, and it is the framing he REFUSED (#182)" },
  { word: "mid-torso", because: "a frame claim; the block says it, the description may not" },
  { word: "full body", because: "a frame claim" },
  { word: "full-length", because: "a frame claim" },
  { word: "portrait", because: "a frame claim about the picture" },
  /* Camera. */
  { word: "camera", because: "a capture claim" },
  { word: "lens", because: "a capture claim" },
  { word: "bokeh", because: "a capture claim" },
  { word: "depth of field", because: "a capture claim" },
  { word: "aperture", because: "a capture claim" },
  { word: "sharp focus", because: "a capture claim; bare 'sharp' is a face word and stays" },
  { word: "shallow focus", because: "a capture claim" },
  /* The artifact itself. */
  { word: "photograph", because: "it describes the picture, not the person" },
  { word: "photo", because: "it describes the picture, not the person" },
  { word: "image", because: "it describes the picture, not the person" },
  { word: "picture", because: "it describes the picture, not the person" },
  { word: "render", because: "it describes the picture, not the person" },
  /* Rendering quality — the prompt-soup words the block's negatives exist for. */
  { word: "8k", because: "a quality claim" },
  { word: "4k", because: "a quality claim" },
  { word: "high resolution", because: "a quality claim" },
  { word: "hyperrealistic", because: "a quality claim" },
  { word: "photorealistic", because: "a quality claim; the STYLE is the block's to state" },
  { word: "ultra detailed", because: "a quality claim" },
  { word: "masterpiece", because: "a quality claim" },
  { word: "award-winning", because: "a quality claim" },
  /*
    Resemblance — and this group is DELIBERATELY ALMOST EMPTY, which is a
    measurement rather than an oversight.

    It held `looks like`, `resembles`, `resembling` and `reminiscent of` until a
    real drive refused a perfectly good description of a South Asian man whose
    only sin was the phrase *"features reminiscent of…"* about his ANCESTRY.
    That is the `cropped` finding again in a different category: a phrase ban
    aimed at *who does this person look like* also catches *what kind of person
    is this*, and the second is the whole point of the road.

    What survives is only what cannot describe a person's own properties. The
    real control is not here at all and never was: `briefCompiler.ts`'s LIKENESS
    WALL stands in front of the compile, free before the claim, taken twice, for
    a description exactly as for a brief she typed — and it is BETTER placed
    than this sweep, because a refusal there leaves her holding editable words
    while a refusal here leaves her holding nothing.
  */
  { word: "look-alike", because: "only ever names somebody; the likeness wall is the real control" },
  { word: "lookalike", because: "only ever names somebody" },
  { word: "in the style of", because: "names an artist or a franchise, never a face" },
];

/** The first of {@link NOT_ABOUT_THE_PERSON} in `text` as a whole word or phrase, or null. */
export function notAboutThePersonIn(text: string): string | null {
  /* Whitespace normalised first, so a phrase split by a newline cannot slip —
     `promptAuthor.neverWrittenIn`'s own finding, reused rather than re-learned. */
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  for (const { word } of NOT_ABOUT_THE_PERSON) {
    const re = new RegExp(`(^|[^a-z0-9])${word.replace(/[-]/g, "\\-")}([^a-z0-9]|$)`);
    if (re.test(lower)) return word;
  }
  return null;
}

/**
 * WHAT THE PERSON DOES NOT HAVE — swept, and it is the ONE inventory habit
 * worth banning by shape (his drop list names it: *"no jewellery, makeup, or
 * tattoos"*).
 *
 * ⚠ THIS IS NOT A FOURTH INSTANCE OF THE TYPO-GATE CLASS, and the difference
 * is the reason it exists rather than being declined like the ones below. Every
 * ban that has burned this road was a ban on a word that describes a person in
 * one sense and a picture in another — `cropped` (a haircut AND a frame),
 * `reminiscent of` (an ancestry AND a likeness). **An absence claim has no
 * second sense.** A type is what somebody IS; "no tattoos" describes nobody,
 * and it does real harm downstream — it reaches the engine verbatim as a
 * negative in the first paragraph of the prompt, forcing all eight faces to
 * share a thing that was never in the picture to begin with, which is the
 * library's own presence-not-absence doctrine arriving from a new direction.
 *
 * The noun list is HIS THREE plus the one obvious sibling, and it stops there:
 * a wider list ("no facial hair", "no glasses") starts catching sentences that
 * a casting director would legitimately write.
 *
 * ⚠ WHAT IS DELIBERATELY **NOT** BANNED, so the next seat does not add it: the
 * rest of his drop list — exact eye colour, brow shape, the fade or temple map,
 * seams and garment construction. Those are ordinary person words, and a list
 * holding `brow`, `eyes` or `cut` would refuse good descriptions on the day it
 * shipped. They are carried by the INSTRUCTION and by
 * {@link CONCEPT_DESCRIPTION_MAX}, which is the honest division of labour here:
 * the length bound makes an inventory structurally impossible to fit, so the
 * nouns it would have carried have nowhere to go.
 */
export const ABSENCE_CLAIMS = {
  /** `no` / `without` / `free of` / `lacking`, optionally hedged with `visible` or `any`. */
  lead: "(?:no|without|free of|lacking)",
  nouns: ["tattoos?", "jewell?e?ry", "make-?up", "piercings?"],
} as const;

/** The absence claim in `text` (as written), or null. */
export function absenceClaimIn(text: string): string | null {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const re = new RegExp(
    `(^|[^a-z0-9])(${ABSENCE_CLAIMS.lead}\\s+(?:visible\\s+|any\\s+)*(?:${ABSENCE_CLAIMS.nouns.join("|")}))([^a-z0-9]|$)`,
  );
  const hit = re.exec(lower);
  return hit ? hit[2]! : null;
}

/**
 * HIS EXAMPLE, VERBATIM — and it is shown to the reader rather than described
 * to it.
 *
 * *"What should land in the brief box"*, his words on #185, from the picture
 * whose 1,082-character read produced the ruling. It is the single most useful
 * sentence in the instruction: an announced number tells a model what to aim
 * at, but a specimen tells it what LEVEL of detail means, and detail level is
 * the whole of what he corrected. It doubles as the suite's golden fixture —
 * whatever it must pass, a real read must pass.
 */
export const GOLDEN_NOTE =
  "A man in his mid-to-late forties, European heritage, rugged athletic build, "
  + "short dark hair with grey, fitted dark crew-neck. Rugged, no-nonsense fitness / "
  + "ex-military type.";

/**
 * ⚠ THE INSTRUCTION IS THE PRIMARY CONTROL AND IT IS HIS RULING, CLAUSE BY
 * CLAUSE — the keep list, the drop list, the numbers and the example are all
 * quoted from #185 rather than paraphrased.
 *
 * The one sentence here that is neither a keep nor a drop is the one that says
 * WHY (*"everything you name is locked on every face"*). A reader told the
 * reason for a rule holds it in the cases the rule did not enumerate, and the
 * drop list can never enumerate *"anything you only noticed by staring"*.
 */
const RULES = [
  "You are a casting director's reader. You are shown one picture and you write a SHORT CASTING NOTE",
  "about the person in it: their TYPE, so that eight DIFFERENT people who could all replace them",
  "could be cast from your words alone. You are not writing a description of this individual.",
  "",
  "WRITE, in one or two plain sentences: apparent sex; an age BAND, never an exact age",
  "(\"mid-to-late forties\"); the heritage family, but ONLY if it is genuinely visible — never guess one;",
  "build language (\"athletic\", \"broad\", \"slight\"); the hair WORLD (\"short crop, dark going grey\");",
  "the wardrobe WORLD (\"fitted dark crew-neck\"); and the TYPE itself",
  "(\"rugged, no-nonsense fitness / ex-military presence\").",
  "",
  "DO NOT CATALOGUE. Leave out exact eye colour, brow shape, the exact cut, fade or hairline,",
  "seams and garment construction, and anything you only noticed by staring. Never say what the person",
  "does NOT have — no \"no tattoos\", no \"no jewellery\", no \"no makeup\".",
  "EVERYTHING YOU NAME IS LOCKED ON EVERY FACE THAT GETS CAST, so each detail you list is a detail",
  "eight different people are forced to share.",
  "",
  "NEVER mention: the lighting, the background or set, the framing, crop or pose direction, the camera,",
  "lens, focus or depth of field, the resolution or quality of the picture, or the picture itself.",
  "Never name a real person or character, and never say who the subject looks like or resembles.",
  "Do not write a prompt, a list, a heading or a preamble — write the note and nothing else.",
  "",
  `Write about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters.`,
  "This is the length and the level of detail to aim for:",
  `"${GOLDEN_NOTE}"`,
  'Reply with JSON: {"description": "..."} — or {"description": null} if there is no person in the picture.',
].join("\n");

const ASK = "Describe the person in this picture.";

export type ConceptDescribeInput = {
  bytes: Buffer;
  contentType: string;
  /** `undefined` takes the house transport; `null` is "no transport", for the arms. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

export type ConceptDescribeOutcome =
  | { ok: true; description: string; attempts: number }
  /** Every refusal a customer may be shown, named. None of them is an exception. */
  | {
      ok: false;
      reason: "no_person" | "unreadable" | "not_about_the_person" | "not_a_casting_note" | "no_transport";
      attempts: number;
    };

/**
 * WHY A READ WAS SENT BACK — and every one of them can be SAID to the reader.
 *
 * ⚠ THIS TYPE EXISTS BECAUSE OF A DEFECT, and the defect is worth naming: the
 * length branch used to set `lastViolation = null` and re-ask with a
 * BYTE-IDENTICAL system and user message at temperature 0. That is a call
 * bought to receive the answer we already have — the model has been told
 * nothing new, so the second read is the first read, and the refusal was
 * decided before the call was made. It was nearly invisible at a 1,200
 * ceiling, where almost nothing ran over. At 300 it is the COMMON path.
 *
 * Its sibling one file over already had this right — `promptAuthor`'s trim
 * re-ask carries the reason AND the previous draft and drops the temperature —
 * so this is the pattern copied rather than invented. Swept for others in the
 * same shape (working law 7): `packageOrchestrator`'s second attempt is a
 * re-RENDER, and `refineInterpreter`'s echo pass re-asks with a constrained
 * vocabulary. One instance, and it is this one.
 *
 * ⚠ **AND THE RE-READ ABOVE IS A BYTE-IDENTICAL SECOND ASK ON PURPOSE — it is
 * NOT that defect coming back, and the next seat must not "fix" it.** That
 * defect was *the answer was wrong and the model was told nothing new*: a
 * `Fault` is a thing the reader SAID, and asking again in silence could only
 * produce the sentence we already have. A read that never arrived has nothing
 * to quote and nothing to correct — there is no fault to name — and the
 * measurement is that an unchanged second ask is exactly what fixes it (3 of 3
 * on the refusing frame). That is why the retry carries `fault: null` rather
 * than a fifth `Fault` member: this union's contract is *what can be SAID to
 * the reader*, and "your previous answer" is a claim about an answer we may
 * never have received.
 */
type Fault =
  | { kind: "picture"; word: string }
  | { kind: "absence"; phrase: string }
  | { kind: "long"; length: number }
  | { kind: "brief"; length: number };

/**
 * WAS THAT A FAILURE WORTH ASKING AGAIN — read off the provider's own published
 * taxonomy, never re-derived here.
 *
 * `unknown` is the empty-200: a real 200 carrying no completion, which
 * `openrouterText.ts` logs with the provider's own finish reasons and throws
 * as `unknown` precisely because a ceiling hit, a stop sequence and a silent
 * upstream refusal are indistinguishable from here. It is deliberately absent
 * from `RETRYABLE_FAILURES` — widening THAT set would change every `withRetry`
 * caller in the product, including the paid image paths, to repair one text
 * read (`providerContract.test.ts` pins the set for exactly this reason). So
 * the second ask is bought HERE, by the one caller that wants it, and every
 * other class stays terminal.
 *
 * Read at the layers rather than assumed: nothing between the throw and this
 * catch re-wraps it — `withRetry` rethrows `lastError` as it stands,
 * `ProviderQueue.run` records the failure and rethrows, and `throughCensus`
 * does the same. So the error arrives whole and `instanceof` is enough; there
 * is no `cause` chain to walk.
 */
function worthAskingAgain(error: unknown): boolean {
  return error instanceof ProviderError && error.failureClass === "unknown";
}

/** The sentence the reader is given on the second ask. It always names the fault. */
function reAsk(fault: Fault): string {
  switch (fault.kind) {
    case "picture":
      return `Your previous answer used "${fault.word}", which describes the picture rather than the person. Write it again without that.`;
    case "absence":
      return `Your previous answer said "${fault.phrase}". Never say what the person does NOT have — describe only what is there. Write it again without that.`;
    case "long":
      return `Your previous answer was ${fault.length} characters — that is an inventory, not a casting note. Write it again in about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters, keeping only sex, age band, heritage if visible, build, hair world, wardrobe world and type.`;
    case "brief":
      return `Your previous answer was only ${fault.length} characters and says too little to cast from. Write it again at about ${CONCEPT_DESCRIPTION_TARGET.low}–${CONCEPT_DESCRIPTION_TARGET.high} characters.`;
  }
}

/** The first fault in a read, in the order a customer would care about them. */
function faultIn(description: string): Fault | null {
  if (description.length > CONCEPT_DESCRIPTION_MAX) return { kind: "long", length: description.length };
  if (description.length < CONCEPT_DESCRIPTION_MIN) return { kind: "brief", length: description.length };
  const word = notAboutThePersonIn(description);
  if (word) return { kind: "picture", word };
  const phrase = absenceClaimIn(description);
  if (phrase) return { kind: "absence", phrase };
  return null;
}

/**
 * THREE ANSWERS, NOT TWO (review of #187, finding 1).
 *
 * This returned `string | null` and the caller separated the two meanings of
 * that `null` by asking whether the reply was non-empty — so ANY unparseable
 * non-empty reply (prose instead of JSON, or JSON truncated at the token
 * ceiling) was read as *"there is nobody in your picture"*, which is our fault
 * told to the customer as hers. The reader saying **nobody is here** and the
 * transport handing back **something we cannot read** are different facts and
 * they get different names.
 */
type Parsed =
  | { kind: "described"; description: string }
  | { kind: "said_none" }
  | { kind: "unparseable" };

function parse(raw: string): Parsed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return { kind: "unparseable" };
  }
  if (!parsed || typeof parsed !== "object") return { kind: "unparseable" };
  const value = (parsed as Record<string, unknown>).description;
  /* The documented "nobody here" shape is an explicit null. A MISSING key is
     not that answer — it is an object we did not ask for. */
  if (value === null) return { kind: "said_none" };
  if (typeof value !== "string") return { kind: "unparseable" };
  const plain = value.replace(/\s+/g, " ").trim();
  /* An empty string is the same shrug as a null, said differently. */
  return plain.length > 0 ? { kind: "described", description: plain } : { kind: "said_none" };
}

/**
 * ONE read, one re-ask, then an honest refusal.
 *
 * The re-ask exists because the sweep is a blunt instrument by design: a
 * describer that mentioned the light once will usually not mention it twice
 * when told which word it used. A SECOND violation is not argued with — the
 * customer gets a sentence and her own empty brief box, which is the state she
 * was already in, rather than a description quietly stripped of a word and
 * handed over as though it had been written that way.
 */
export async function describeConcept(input: ConceptDescribeInput): Promise<ConceptDescribeOutcome> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) return { ok: false, reason: "no_transport", attempts: 0 };

  /**
   * One read. Either an outcome the customer gets, or an ask to go again —
   * naming the fault where there IS one, and `null` where no usable answer
   * arrived at all.
   */
  const read = async (attempt: number, previous: Fault | null):
    Promise<ConceptDescribeOutcome | { ok: "retry"; fault: Fault | null }> => {
    let reply: { text?: string | null; truncated?: boolean };
    try {
      reply = await engine.complete({
        about: "describe",
        system: RULES,
        user: previous ? `${ASK} ${reAsk(previous)}` : ASK,
        images: [{ bytes: input.bytes, contentType: input.contentType }],
        json: true,
        temperature: 0,
        /* The describer's own preamble is spent before the object — the face
           scan measured an EMPTY completion at 200 on a two-field ask. This
           read is longer than that one, so the ceiling is larger. Unused
           ceiling costs nothing; billing is per token produced. */
        maxOutputTokens: 900,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch (error) {
      /* The signal is checked as well as the class: a customer who has
         navigated away is not waiting for a second opinion. */
      const again = worthAskingAgain(error) && input.signal?.aborted !== true;
      log.warn(
        { err: error, attempt, again },
        "[conceptDescribe] the reader did not answer",
      );
      return again
        ? { ok: "retry", fault: null }
        : { ok: false, reason: "unreadable", attempts: attempt };
    }

    const parsed = parse(reply.text ?? "");
    /* `{"description": null}` is the reader saying there is no person here, and
       it is a different answer from a read that failed — only one of the two is
       worth telling her to try a different picture about. */
    if (parsed.kind === "said_none") return { ok: false, reason: "no_person", attempts: attempt };
    if (parsed.kind === "unparseable") {
      /* `truncated` is the provider's own `finish_reason === "length"` — the
         reply is a FRAGMENT, which is one of the shapes that lands here, and
         it was being dropped. Logged rather than branched on: a named "write
         it shorter" re-ask is worth building when the number says it happens,
         and at a 900-token ceiling against a 300-character target it should be
         near zero. Buy the incidence before the branch. */
      log.warn(
        { attempt, truncated: reply.truncated === true },
        "[conceptDescribe] the reply was not a description we could read",
      );
      return { ok: "retry", fault: null };
    }
    const { description } = parsed;
    const fault = faultIn(description);
    if (!fault) return { ok: true, description, attempts: attempt };
    log.warn({ attempt, fault, length: description.length }, "[conceptDescribe] the read was sent back");
    /* NEVER truncated and never stripped — re-asked, naming the fault. */
    return { ok: "retry", fault };
  };

  const first = await read(1, null);
  if (first.ok !== "retry") return first;
  const second = await read(2, first.fault);
  if (second.ok !== "retry") return second;
  /* No usable answer, twice. Today's sentence, unchanged — it already says
     "just now", and a reader that comes back as noise twice is the one case
     where looking for a different picture is honest advice. */
  if (second.fault === null) return { ok: false, reason: "unreadable", attempts: 2 };
  /*
    TWO FAMILIES OF SECOND FAILURE, and they are different sentences to her
    because they are different facts. A read that keeps describing the PICTURE,
    or keeps CATALOGUING, is ours — she should try again rather than go looking
    for a better photograph of our problem. A read that keeps coming back as a
    shrug is the only one where a different picture is the honest advice, and it
    takes `unreadable`'s sentence, which already says "just now".
  */
  const reason = second.fault.kind === "picture"
    ? "not_about_the_person"
    : second.fault.kind === "brief" ? "unreadable" : "not_a_casting_note";
  return { ok: false, reason, attempts: 2 };
}
