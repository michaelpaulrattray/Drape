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
 */
import { createModuleLogger } from "../logging/logger";
import { interpreterEngine } from "./interpreter";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/conceptDescribe");

/**
 * The description's own ceiling.
 *
 * Well under the entrance's `BRIEF_TEXT_MAX_AUTHOR_ROAD` (4,000) and under the
 * house road's 2,000 as well, so a customer can never be refused at the roll
 * on text SHE DID NOT WRITE — she still has room to add her own sentence to
 * what came back. A longer read is not truncated mid-word: it is refused and
 * re-asked, because half a sentence about a person is a claim nobody made.
 */
export const CONCEPT_DESCRIPTION_MAX = 1200;

/** Below this there is no description, only a shrug wearing one. */
export const CONCEPT_DESCRIPTION_MIN = 40;

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
  /* ⚠ BARE `cropped` IS NOT ON THIS LIST AND THAT IS MEASURED, NOT AN
     OVERSIGHT. It was, until its own positive-control arm caught it sweeping
     "close-cropped stubble" — a hair word, and "a cropped jacket" is a garment.
     The typo gate owned "shave" the same way and blocked the founder's own bald
     ask. The photographic sense is banned as a PHRASE instead; the declared
     gap is that a bare "cropped" used about the frame and nowhere near another
     frame word would pass, which is what the instruction is for. */
  { word: "cropped at", because: "a frame claim; bare 'cropped' is a hair and garment word and stays" },
  { word: "tightly cropped", because: "a frame claim" },
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

const RULES = [
  "You are a casting director's reader. You are shown one picture and you describe THE PERSON IN IT",
  "so that a different person of the same type could be cast from your words alone.",
  "",
  "DESCRIBE, in plain prose, only: apparent sex, apparent age, apparent heritage or ancestry, build, face and bone structure,",
  "hair (colour, length, cut, texture), skin character, facial hair, eyes and brows, expression and bearing,",
  "visible styling — garments, jewellery, makeup, tattoos — and any distinctive feature that makes this",
  "person recognisable as a TYPE.",
  "",
  "NEVER mention: the lighting, the background or set, the framing, crop or pose direction, the camera,",
  "lens, focus or depth of field, the resolution or quality of the picture, or the picture itself.",
  "Never name a real person or character, and never say who the subject looks like or resembles.",
  "Do not write a prompt, a list, a heading or a preamble — write the description and nothing else.",
  "",
  `Keep it under ${CONCEPT_DESCRIPTION_MAX} characters.`,
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
  | { ok: false; reason: "no_person" | "unreadable" | "not_about_the_person" | "no_transport"; attempts: number };

function parse(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(
      raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
    );
    if (!parsed || typeof parsed !== "object") return null;
    const value = (parsed as Record<string, unknown>).description;
    if (typeof value !== "string") return null;
    const plain = value.replace(/\s+/g, " ").trim();
    return plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
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

  let lastViolation: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let reply: { text?: string | null };
    try {
      reply = await engine.complete({
        about: "describe",
        system: RULES,
        user: lastViolation
          ? `${ASK} Your previous answer used "${lastViolation}", which describes the picture rather than the person. Write it again without that.`
          : ASK,
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
      log.warn({ err: error, attempt }, "[conceptDescribe] the reader did not answer");
      return { ok: false, reason: "unreadable", attempts: attempt };
    }

    const description = parse(reply.text ?? "");
    /* `{"description": null}` is the reader saying there is no person here, and
       it is a different answer from a read that failed — only one of the two is
       worth telling her to try a different picture about. */
    if (description === null) {
      return { ok: false, reason: reply.text ? "no_person" : "unreadable", attempts: attempt };
    }
    if (description.length < CONCEPT_DESCRIPTION_MIN || description.length > CONCEPT_DESCRIPTION_MAX) {
      log.warn(
        { attempt, length: description.length },
        "[conceptDescribe] the description was outside the bound — not truncated, re-asked",
      );
      lastViolation = null;
      if (attempt === 2) return { ok: false, reason: "unreadable", attempts: attempt };
      continue;
    }

    const violation = notAboutThePersonIn(description);
    if (!violation) return { ok: true, description, attempts: attempt };

    log.warn({ attempt, violation }, "[conceptDescribe] the description described the picture");
    lastViolation = violation;
  }
  return { ok: false, reason: "not_about_the_person", attempts: 2 };
}
