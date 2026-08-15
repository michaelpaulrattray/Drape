/**
 * One refinement instruction → one absolute delta, or an honest refusal (§10).
 *
 * # It runs at ENTRY, and that is where the money argument lives
 *
 * This is a free text call, and it happens before anything is claimed or
 * charged. So "make her older" costs the user nothing and tells them the truth
 * immediately, instead of taking 25 credits to produce a picture that was never
 * going to be what they asked for. Same arrow as the roll's compile-and-admit-
 * first: refuse while it is still free.
 *
 * # Fail CLOSED, unlike the brief interpreter
 *
 * `interpretBrief` fails open — an interpreter outage must not lose someone
 * their roll, so it compiles from the raw sentence instead. **This one must
 * not.** There is no meaningful fallback for "which axis did they mean": the
 * alternatives are guessing at a paid edit of someone's face, or sending raw
 * text to the image model while persisting nothing, which is the record-lies
 * class §10 exists to prevent. An outage here refuses, and nobody is charged.
 *
 * # The code owns the vocabulary, the model owns only the reading
 *
 * D-89's gate, one surface along. The reply is validated against closed
 * vocabularies (`readDelta`), so the interpreter can only ever choose among
 * values this build knows how to render. A model that invents "violet" gets an
 * unreadable reply and a refusal, not a persisted axis nothing composes.
 */
import { EYE_COLOURS, EYE_SHAPES, HAIR_TEXTURES } from "../../shared/castingRealization";
import { HAIR_COLOURS } from "../../shared/castingVocabularies";
import { REFINABLE_CUT_NAMES } from "./hairStyles";
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { declarativeStateRule } from "./declarativeState";
import { readDelta, stageWordIn, type FreeLaneCheck, type RefineParse } from "./refineDelta";
import { freeSubjectGuidance } from "./refineSubjects";
import { closedSubjectFor } from "./openLaneKind";
import { REFINE_REFUSALS } from "./refineRefusals";
import { readRemovalSubject } from "./refineRemoval";
import { namesUnknownProperNoun } from "./properNouns";

const log = createModuleLogger("castingV2/refineInterpreter");

/** Unwrap a markdown-fenced reply. Returns the text unchanged when unfenced. */
function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^`{3}[a-zA-Z]*\s*/, "")
    .replace(/`{3}\s*$/, "")
    .trim();
}

/**
 * The first complete JSON object in a reply, ignoring anything after it.
 *
 * Same argument as the fence stripper, one habit along: the model occasionally
 * writes its object and then a sentence of commentary, and a bare `JSON.parse`
 * then throws — which the user reads as "that did not come through clearly"
 * about an instruction that was in fact understood perfectly. The corpus caught
 * it on "green eyes, pink hair": a two-facet ask, correctly parsed, lost to a
 * trailing remark.
 *
 * Balanced scan rather than a greedy slice to the last brace, and string-aware,
 * so a `}` inside a value cannot truncate the object.
 */
function firstObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text;
}

/**
 * The one hard instruction: say what they meant, or say you cannot.
 *
 * `outOfTier` carries the user's own subject back, so the refusal can name what
 * was asked rather than saying "unsupported" — a refusal that does not
 * demonstrate it understood reads as a bug rather than as a boundary.
 */
const BASE_PROMPT = [
  "You read ONE short instruction from someone adjusting a face they are casting, and you",
  "translate it into a structured edit. You never write prose and you never explain.",
  "",
  "You can change ANYTHING ABOUT THE PERSON THEMSELVES. Some things have exact vocabularies",
  "and must use them; everything else about the person goes in the free lane.",
  "",
  "EXACT VOCABULARIES — use the listed word, never a near miss, never free text:",
  `  eyeColour   — one of: ${EYE_COLOURS.join(", ")}`,
  `  eyeShape    — one of: ${EYE_SHAPES.join(", ")}`,
  `  hairColour  — one of: ${HAIR_COLOURS.join(", ")}`,
  `  hairTexture — one of: ${HAIR_TEXTURES.join(", ")}`,
  `  hairStyle   — one of: ${REFINABLE_CUT_NAMES.join(", ")}`,
  "  makeup      — free text, in the user's own terms",
  "",
  "THE FREE LANE — anything else about the person, keyed by subject:",
  `  free: { "<subject>": "<their words>" }, subject one of: ${freeSubjectGuidance()}`,
  "",
  "Reply with JSON and nothing else.",
  "",
  "Use an exact vocabulary ONLY when the user names something IN it. A near miss is not a",
  "match: a mullet is not a wolf cut, cornrows are not braids, seafoam is not green-grey. If",
  "their word is not on the list, put THEIR WORD in the free lane — that is what it is for, and",
  "substituting the nearest listed value silently gives them something they did not ask for.",
  "A cut is hairStyle, not hairTexture;",
  "hairTexture is curl pattern only. Relative asks resolve against the CURRENT values you are",
  "given: 'greener' from hazel is green, 'shorter' from a bob is a pixie.",
  "",
  "The current values are given so RELATIVE asks can resolve. Never restate one. If the hair is",
  "already copper and they ask for pastel pink, write pastel pink and NOTHING about copper —",
  "echoing the current value beside the new one asks for both at once.",
  "",
  "ONE INSTRUCTION WRITES ONLY THE FACETS ITS WORDS STATE. 'Tied up' states how the hair is",
  "WORN and nothing else — it is not a cut, so hairStyle must stay untouched. Never fill a",
  "facet the sentence did not mention; a fact they did not state will contradict one they do.",
  "",
  "BARE-TERM OWNERSHIP — beauty words overload, so each one has ONE default:",
  '  "fox eyes" alone is the eye SHAPE (eyeShape: \"fox eyes\"). Only "fox eye liner",',
  '  "fox eye makeup" or "fox eye look" mean makeup.',
  '  A bare colour word is the colour they were BORN with.',
  '  A DYE WORD OWNS THE HAIR DRAWER (D-177): "dyed pink", "bleached blonde", "box colour',
  '  red", highlights, balayage, ombre. Dyeing is a thing done to HAIR, so the dye word',
  '  names the drawer just as "hair" does — never makeup.',
  '  UNLESS the value names another feature: "bleached brows", "tinted moisturizer",',
  '  "tinted lip" are MAKEUP. The dye word names the act; the feature names what it was',
  "  done to, and the feature wins.",
  '  "freckles", "a beauty mark", "a scar" are marks on the skin, not drawn on.',
  '  A SHAPE is ink even when they do not say "tattoo": a star, a heart, a rose, initials,',
  '  a word, a symbol. Marks are what skin does by itself — freckles, moles, scars,',
  '  birthmarks, vitiligo. Anything DRAWN on the skin belongs to the free-lane subject "ink".',
  "  A CONDITION OF THE SKIN IS NOT A MARK. A mark is ONE THING YOU COULD POINT AT —",
  '  "a mole on her left cheek", "a scar through her eyebrow", "freckles across her nose".',
  "  A quality spread over her skin with no one place — acne, weathered or sun-damaged",
  "  skin, ruddiness, dryness, being freckly in general — is skinCharacter, in their words.",
  '  "acne on her face" is skinCharacter: "acne". "A mole on her cheek" is marks.',
  '  "contoured cheekbones" is makeup; "high cheekbones" is structure.',
  '  A COLOUR PHRASE THAT SAYS "HAIR" IS HAIR. "Pastel pink hair color", "pink hair",',
  '    "hair color pink" — the word hair names the drawer, so it is never makeup. What a',
  '    colour is ATTACHED to decides: "pink blush" and "pink lip" are makeup, because those',
  "    name a cosmetic. The colour word on its own decides nothing.",
  "Correction phrases ALWAYS win over the default, in either direction.",
  "",
  "FREE-LANE RULES, and they are strict:",
  "  - Use the user's OWN WORDS. Never elaborate, never add detail they did not give.",
  '    "a scar on her cheek" stays that. It does NOT become "a long knife scar".',
  ...declarativeStateRule(),
  "  - One entry per subject, holding the WHOLE current answer for that subject.",
  "  - marks, ink and statedAccessories hold a SET. Give them as a JSON ARRAY of separate",
  '    items — ["small gold hoops", "thin wire glasses"] — never one run-on sentence, and',
  "    restate ALL of them including ones stated earlier, not only the new one. Each item is",
  "    one thing, in their words, so it can be taken back on its own later.",
  /*
    A PROHIBITION WITHOUT A SUBSTITUTION LOSES THE ASK (fable-404, measured).

    This line used to stop at "never name a brand", and the model read it as a
    licence to drop the whole sentence: the founder asked for *"miu miu styled
    glasses"* and the recipe was handed the bare noun `glasses`. Bench: with the
    old line, the aesthetic survived 3 of 12 brand asks — and all three were the
    one arm whose brand the scrub does not know, so the model kept the styling
    exactly when it kept the name. It treats "lose the brand" and "lose the look"
    as one lever, because nothing told it they were two.

    The repair is the rule this same prompt already applies to the likeness wall
    twenty lines down — serve the honest half, file the VALUE, never the name —
    and it is `scrubBrands`'s own doctrine in the layer below ("removes the name
    and keeps the sentence"). Both halves still hold: the scrub runs over every
    filed item regardless, because instruction-following is a tendency.
  */
  "  - Never name a brand, a product, or a real person — and SERVE THE ASK ANYWAY.",
  "    A house name is a LOOK, not a wall: keep every word describing what they want",
  '    and drop only the name. "miu miu styled glasses" files ["styled glasses"],',
  '    never ["glasses"]; "chanel inspired pearl earrings" files ["inspired pearl',
  '    earrings"]. Losing their description is losing their ask.',
  "",
  "ADORNMENT IS THE PERSON, NOT THE STAGE. Earrings, hoops, studs, a nose ring, a septum ring,",
  "glasses, a chain, a wedding ring, any piercing — things worn ON them — are ordinary refinements",
  "and file under statedAccessories in their own words. Only GARMENTS, HEADWEAR, the backdrop,",
  "props and the scene are the stage.",
  "",
  "WALLS — four things that are never possible. Reply with the wall, not an attempt:",
  '  likeness: making them look like a specific real person -> {"wall": "likeness"}',
  "    BUT A HYBRID ASK SERVES ITS HONEST HALF. Make her eyes green LIKE a named person",
  "    carries a real value — green — riding a comparison. File the VALUE and set",
  '    "droppedReference": true beside it; never put the name anywhere. Only a PURE',
  "    likeness ask with no extractable value (more Rihanna, give her that actress's face)",
  "    is the wall. Serve what they asked for; refuse only what cannot be served.",
  '  stage: garments, headwear, the backdrop, props, the scene -> {"wall": "stage", "asked": "<what, briefly>"}',
  '  content: anything unsafe or explicit -> {"wall": "content"}',
  "    A BODY TATTOO IS NEVER THIS WALL. A chest piece, a back piece, a sleeve — those are",
  "    ink placements, so they go to the ink subject and the gate answers them. Sending them",
  "    here tells the user it can never be rendered when the body-art studio is coming.",
  /*
    THE SAME SENTENCE, SAME SHAPE, FOR FANTASTICAL ANATOMY (OPEN_LANE_DESIGN
    NOTE §2, approved as a standalone rider).

    Measured 3/3 on the real transport: *"give her horns"* claimed the CONTENT
    wall, whose message tells the user the thing can never be rendered. Horns
    are not unsafe and the open lane is on the roadmap, so that is the wrong
    thing to say — the identical mistake this block already corrects one line
    up for a sleeve tattoo.

    It is a request and not a control, which is why it was measured before and
    after rather than asserted; the honest destination is the unbacked stage
    sentence, which is code and does not depend on the model obeying this.
  */
  "    NOR IS FANTASTICAL ANATOMY. Horns, antlers, wings, a tail, scales, pointed ears —",
  "    those are things on the PERSON that this simply cannot name yet, not unsafe ones.",
  '    Reply {"wall": "stage", "asked": "<the thing, in their words>"} and the code says the',
  "    honest sentence. Sending them here tells the user it can never be rendered.",
  "",
  "SUBJECTIVE asks are a wall too — prettier, hotter, better looking, more attractive. They name",
  'a judgement rather than a feature, so reply {"wall": "stage", "asked": "how attractive they look"}.',
  "",
  "Casting decisions are NOT refinements: age, heritage and sex are who was cast rather",
  'than how they look today. Reply {"wall": "stage", "asked": "her age"} and the like — rolling',
  "again is the honest answer to those.",
  /*
    A COLOURING CONDITION IS NOT A CASTING DECISION — and this line is what makes
    fable-363 ruling 1 reach its own bar.

    The stage-wall backstop below is the ruled fix, and driven on the real
    transport it did NOT recover the sentence it was built for: *"make her
    albino"* filed 0/5 with the backstop and 0/5 without it, identically, and the
    re-look's reply said why — it came back `asked: "her albinism"` and
    `asked: "her age"`, which is THIS sentence, quoted. The model was never
    flipping a coin on albinism. It was obeying an instruction, and it reads
    albinism as heritage.

    The founder called *"make her albino"* a genuine ask (fable-361 §2), so the
    sentence over-captures. It is narrowed here rather than at the wall, because
    the wall was never the door: a backstop that overrode a ruled product
    position would be the wrong repair in the right place.

    # The four words are untouched, and that is measured, not intended

    Narrowing this could have opened age, heritage, sex or build — a scope change
    nobody asked for, on a door that charges. Driven n=5 each with this line in
    place (`scripts/probe-casting-decision-carveout-disposable.mts`,
    `output/carveout-probe/probe.txt`):

        make her albino                 5/5 FILE   (0/5 before)
        give her vitiligo on her hands  5/5 FILE
        let her hair go grey            5/5 FILE
        make her look older   (age)     0/5 file — still refuses
        make her korean  (heritage)     0/5 file — still refuses
        make her a man        (sex)     0/5 file — still refuses
        make her more muscular (build)  0/5 file — still refuses
        put her on a beach   (scene)    0/5 file — still refuses

    And the albino filing decomposes 5/5 into skin, hair, brows, lashes and eyes
    together — the whole-person reading working law 8 asks for, which the model
    knew all along and was being refused for.
  */
  /*
    BUILD COMES OUT OF THAT SENTENCE — fable-381 §A.2, on the founder's own ask
    in fable-360 ruling 3 (*"We need body shape/build — larger bust, smaller
    waist, bigger arms, bigger chest etc — this would need a row"*).

    It is the same repair as the colouring carve-out one line down, for the same
    reason: the 18/18 refusal measured in the body-row note was never a model
    being vague. It was a model obeying a ruled instruction precisely, and six of
    those eighteen refusals came back worded *"her build"* — the brief, quoted
    back. A code-side backstop cannot reach a refusal the prompt genuinely
    instructs, so the instruction is what changes.

    **`age` and `sex` are untouched and that is measured, not intended** — the
    probe drives them as controls beside the six body sentences, exactly as the
    albino carve-out did.
  */
  "  A BUILD IS NOT A CASTING DECISION. Her figure is how she looks today, not who was cast:",
  "  a larger bust or chest, broader shoulders, bigger or slimmer arms, a more athletic or",
  "  slighter build. Those file normally in the free lane, under bust, shoulders, arms or",
  "  build — and a whole-figure word like athletic, curvy or slight is build.",
  '  Her WAIST files under waist in the same way. Whether this photograph contains her waist',
  "  is not yours to decide; file it and the product answers that itself.",
  "  What stays a casting decision is her AGE, her HERITAGE and her SEX.",
  "",
  "  A COLOURING CONDITION IS NOT HERITAGE. Albinism, vitiligo, going grey, sun damage — those",
  "  are how her colouring IS, not who was cast, so they file normally. Albinism is the whole",
  "  person's colouring: file the skin, the hair, the brows and lashes, and the eyes together,",
  "  because a pale face under unchanged dark hair is not what they asked for.",
  "",
  'If the instruction is empty or you genuinely cannot tell what is wanted, reply {"unclear": true}.',
].join("\n");

/*
  THE REMOVAL SECTION, WITHHELD ON THE FALL-THROUGH PASS (D-163 rule 3).

  When a removal names something no earlier step matches, the feature came from
  the dice rather than from an instruction, and the ask is an ordinary content
  edit. Asking the same prompt again would classify it as a removal again — so
  the second pass is given a prompt that has never heard of removal, and reads
  "remove her freckles" as the edit it now is.
*/
const REMOVAL_PROMPT = [
  "",
  "TAKING SOMETHING BACK — two shapes, and you only classify them. You never decide what to",
  "delete, and you are not shown what has been asked for so far.",
  '  Bare "undo", "go back", "revert", "previous", "nevermind" with NOTHING named ->',
  '    {"navigate": true}',
  '  Naming what should go — "remove the hoops", "get rid of the earrings", "take those off",',
  '    "lose the lipstick", "undo the fringe", "no more freckles" ->',
  '    {"remove": {"subject": "<the subject it belongs to>", "match": "<their own words for what',
  '    should go>", "whole": <true if they meant the whole subject, false if one thing in it>}}',
  '  subject uses the SAME names as everything above: a free-lane subject, or one of',
  "    eyeColour, eyeShape, hairColour, hairTexture, hairStyle, makeup.",
  '  Put THEIR words in match, never yours, ALWAYS — even when they meant the whole subject,',
  '    and even when you are also sending items. Their noun is the only record of what they',
  '    pointed at; leaving it out throws away the one fact only they can supply.',
  '  "remove the makeup" means all of it -> match "makeup", whole true.',
  '  "remove the smokey eye" names one thing -> match "smokey eye", whole false.',
  '  "take her jewellery off" means all of it -> whole true. "take her earrings off" names one',
  '    thing in it -> whole false. When you are not sure they meant ALL of it, say false.',
  '  WHEN SOMETHING IS ALREADY FILED, name it by ECHOING the stored text EXACTLY, in an',
  '    "items" array, ALONGSIDE their own words:',
  '    {"remove": {"subject": "statedAccessories", "match": "earrings", "items": ["small gold hoops"]}}.',
  '    Copy the stored string character for character — do not rephrase it, do not shorten it.',
  '    "Remove the earrings" against ["small gold hoops"] echoes ["small gold hoops"], because',
  '    hoops ARE earrings. Naming a CATEGORY echoes every filed item in it; naming ONE thing',
  '    echoes only that one. If nothing filed is what they mean, send no items.',
  '  A PRONOUN with no noun is pointing, not naming: "take those off", "get rid of that",',
  '    "lose it", "undo that". Nobody who has not seen the list can know what "those" is, so',
  '    reply {"navigate": true} — taking away the thing just added is going back a step, which',
  "    is what they mean and it is free.",
  '  But "take the HOOPS off" NAMES the thing, and so does "lose the lipstick" and "get rid of',
  '    the fringe". A named thing is always a remove, whatever the sentence is shaped like.',
  "    Only the bare pronoun navigates.",
].join("\n");

const SYSTEM_PROMPT = BASE_PROMPT + REMOVAL_PROMPT;

/**
 * THE PARSER'S TOKEN CEILING — and why it is no longer 600.
 *
 * Measured 2026-08-09 on the shipped configuration: `remove her glasses, then
 * fox eyes` came back EMPTY on a 200 **three times in a row**, `finish_reason:
 * length`, with reasoning in the completion, and a fourth reading returned
 * truncated JSON. An empty-on-200 at `length` is not a model declining; it is a
 * model spending its whole allowance thinking and never reaching the answer.
 * The same model, the same prompt and the same contract finish the sentence
 * when they are allowed to.
 *
 * A ceiling is not a quality control. Nothing here asks for a longer answer —
 * the reply is a small JSON object either way, and a run that would have fitted
 * in 600 tokens costs exactly what it always did, because output is billed by
 * what is produced rather than by what was permitted. What the old number bought
 * was a person being told *"that didn't come through clearly"* about a sentence
 * the parser had read perfectly.
 *
 * Exported so the ceiling can be driven from a bench rather than retyped there:
 * a driver that hardcodes its own copy is measuring its copy.
 */
export const REFINE_PARSE_MAX_TOKENS = 4000;

/** Test seam: the bench measures the REAL prompt, or it measures nothing. A
 *  small hand-written prompt does not make this model reason, and a driver that
 *  cannot reproduce the failure cannot measure the fix. */
export function refineParseSystemPrompt(mode?: "classify" | "edit"): string {
  return mode === "edit" ? BASE_PROMPT : SYSTEM_PROMPT;
}

/**
 * The hybrid-likeness pass's one extra line (D-181).
 *
 * The measured behaviour was 7-of-9 refuse and 2-of-9 file for the SAME input.
 * The model was deciding whether to serve or refuse, and it decided differently
 * each time — a coin-flip wall. So the CODE decides, and this pass is how the
 * decision is carried out: the comparison is already gone, tell it so, and ask
 * only for the value the person actually named.
 */
const HYBRID_CONSTRAINT = [
  "",
  "",
  "THE COMPARISON IS NOT AVAILABLE, and that part is already settled — do not refuse over it",
  "again. If the instruction names a real person only as a COMPARISON for some feature, file",
  "the feature they named and nothing else. Never write the name, never describe the person,",
  "never approximate their face. If the instruction carries no feature at all — only the",
  'person — then it is a pure likeness ask and you reply {"wall": "likeness"}.',
].join("\n");

/**
 * THE STAGE RE-LOOK — what the code says when it overrides an unbacked wall
 * (fable-363 ruling 1).
 *
 * # It does not tell the model the answer, and that is deliberate
 *
 * The obvious wording — *"this is not a stage ask, file it"* — would be a
 * different defect wearing the fix's clothes. `stageWordIn` is a LEXICON with no
 * `beach` and no `sofa` in it, so *"put her on a beach"* also arrives here
 * unbacked, and a constraint that pushes toward filing would push a genuine
 * scene ask into whichever facet would take its words. **A safe refusal turned
 * into a wrong render is worse than the wrong refusal being fixed.**
 *
 * So this states what the code actually established — that their sentence names
 * no scenery the code can see — and then asks for a JUSTIFIED answer either way.
 * A wall re-claimed with the offending word named STANDS, and that word is
 * logged: it is the evidence that would widen `STAGE_WORDS`, which is fable-363's
 * own audit condition met by the mechanism rather than by a promise.
 *
 * Both halves are driven in the suite against an engine that always claims the
 * wall, because a backstop tested only through a model that usually behaves is
 * not tested (working law 3).
 *
 * # WHAT THIS DOES NOT FIX, measured and named rather than hoped past
 *
 * Driven on the real transport, n=5 per sentence, twice: every scene, wardrobe
 * and prop ask still refuses **5/5** — including *"put her on a beach"* and
 * *"photograph her in a forest at sunset"*, which the lexicon cannot back and
 * which are held by this constraint alone. Nothing scenery-shaped filed, in 50
 * samples. And *"give her freckles across her nose"* recovers **5/5**.
 *
 * But *"make her albino"* and *"make her look older"* still refused **0/5** with
 * this constraint in place — measured **identically with the backstop and
 * without it**, so on the sentence it was built for the backstop recovered
 * nothing. The re-look's own reply said why: it came back `asked: "her age"` and
 * `asked: "her albinism"` — the base prompt's OWN EXAMPLE STRING, quoted from
 * the ruled sentence *"Casting decisions are NOT refinements: age, heritage, sex
 * and build are who was cast rather than how they look today."* The model was
 * not flipping a coin there; it was obeying an instruction, and it reads
 * albinism as heritage.
 *
 * **So the repair went to the sentence, not to the wall** — see the colouring
 * carve-out beside it in `BASE_PROMPT`, where albino now files 5/5 and all four
 * casting words still refuse 5/5. A backstop that overrode a ruled product
 * position from a re-look constraint would have been the wrong repair in the
 * right place.
 *
 * What this backstop is for, then, is the case it can actually adjudicate: a
 * model claiming scenery in a sentence naming none. Its cost is one extra text
 * call, and only on a refusal.
 */
/**
 * AND THE ONE THING THE RE-LOOK COULD NOT SAY UNTIL THE VOCABULARY GREW.
 *
 * Measured on the day horns was promoted: *"give her curved ram horns"* and
 * *"she should have small goat horns"* filed correctly 3/3 each, and *"add
 * horns to her head"* claimed the stage wall 3/3 — through the re-look, which
 * had already told it the code found no scenery. The model was not flipping a
 * coin; it reads "add X to her head" as putting a THING on a person, which is
 * what the stage wall is for, and nothing in the constraint told it otherwise.
 *
 * The product knows better than the model here, and it knows it MECHANICALLY:
 * the word it claimed is one of the subjects the closed vocabulary owns. So the
 * re-look is handed that fact by name, derived from the same table the guidance
 * list comes from — every kind promoted after this one inherits the sentence
 * without anybody writing it a line.
 *
 * It never widens what may be filed: an unowned word produces no sentence at
 * all, and the refusal falls through exactly as before.
 */
function ownedWordConstraint(claimed: string): string {
  const subject = closedSubjectFor(claimed);
  if (subject === null) return "";
  return [
    "",
    `THEIR WORD "${claimed}" IS ONE OF THE SUBJECTS YOU MAY FILE — it belongs to \`${subject}\`, which is`,
    "a fact about the PERSON rather than the scene. It is not a prop, a garment or a piece of set",
    "dressing, whatever the sentence around it looks like. File it under that subject in their own",
    "words.",
  ].join("\n");
}

const STAGE_RELOOK_CONSTRAINT = [
  "",
  "",
  "THE CODE HAS CHECKED THEIR SENTENCE FOR SCENERY, WARDROBE AND PROPS AND FOUND NONE, so a",
  "refusal on those grounds is not yet earned. Read the instruction once more. If it is about",
  "the PERSON — her face, hair, skin, body, colouring or adornment — file it normally.",
  'If it genuinely is about the scene, the setting, a garment or a prop, reply {"wall": "stage"}',
  'again AND put in "asked" the exact word FROM THEIR INSTRUCTION that names it. Never file a',
  "place, a scene, a garment or a prop into any facet — those have no slot, and filing one is",
  "worse than refusing it.",
].join("\n");

/**
 * The echo pass's one extra line (D-172).
 *
 * Deliberately narrow: it constrains the VOCABULARY of the answer and changes
 * nothing about what may be filed or which walls apply. Specification is not
 * the model's job — that is `qualifierFor`, code-owned, which is where the
 * copper dye-job problem was solved and where a bare colour belongs.
 */
const ECHO_CONSTRAINT = [
  "",
  "",
  "THIS TIME, USE ONLY THEIR WORDS. Every word of every free-lane value must appear in the",
  "instruction itself, or be an item you were shown as already filed, restated character for",
  "character. Do not specify, do not elaborate, do not improve. If they wrote \"pink\", write",
  '"pink" — not "pastel pink". If they wrote "a scar", write "a scar" — never what kind, never',
  "how it got there. Saying less than they meant is correct here; saying more is not.",
].join("\n");

/**
 * THE RESTATEMENT PASS — what the code says when a reading kept only the past
 * (fable-460).
 *
 * # The founder's specimen
 *
 * His cast had *"left eye icey blue"* filed. He typed **"her eyes meadow
 * green"** and was told *"She already has left eye icey blue — this would have
 * changed nothing, so nothing was charged."* Meadow green is not icy blue: the
 * reading had returned the restatement and dropped the ask, and the already-
 * true door — which exists to catch exactly that — refused with a sentence
 * that reads as the product not understanding colours.
 *
 * Measured on that state before anything was changed
 * (`scripts/bench-noop-door-disposable.mts`, n=3): **1 of 3** readings came
 * back holding only the prior; the other two filed meadow green and went
 * through. A third of a legitimate paid edit lost to a sampling.
 *
 * # Why a constraint rather than a plain re-sample
 *
 * A plain retry would work — the failure is a sampling — but it would be
 * silent about WHY, and the same prompt has already lost her sentence once.
 * This names the thing that went wrong and nothing else. It does not say what
 * to file, it does not weaken a wall, and it does not tell the model the ask is
 * legitimate: a sentence that genuinely only restates what she already is must
 * still come back as that restatement, so the door can refuse it. The control
 * arm of the bench is exactly that case, and it must keep refusing free.
 *
 * Its cost is one text call, on a path that was about to refuse for free.
 */
const RESTATED_CONSTRAINT = [
  "",
  "",
  "YOUR LAST READING OF THIS SENTENCE FILED ONLY WHAT SHE ALREADY IS — every value it",
  "returned was already on her, so nothing would have changed. Read the instruction once",
  "more and file what it asks to CHANGE, in their words. Restate the other items of a",
  "plural subject exactly as before, but the thing they asked for must be in there too.",
  "If the sentence genuinely asks for nothing she does not already have, file that same",
  "restatement again — that answer is correct and the code handles it.",
].join("\n");

export type RefineInterpretInput = {
  instruction: string;
  /**
   * `"edit"` withholds the removal vocabulary — D-163's rule-3 second pass.
   *
   * A removal that matched no step is an ordinary content instruction, and the
   * only way to get one out of the same model is to ask it a prompt that has
   * never heard of removal. Otherwise it classifies the same sentence the same
   * way forever and rule 3 becomes "that didn't come through clearly".
   */
  mode?: "classify" | "edit";
  /** What each subject already held — containment's second source (D-171). */
  prior?: Partial<Record<string, string[]>>;
  /**
   * The facet the last colour-bearing edit touched (D-178).
   *
   * "Pinker" after a hair edit means the hair. History wins silently, so this
   * is context rather than a question — the question only exists for a session
   * with no colour edit at all.
   */
  lastColourFacet?: string | null;
  /**
   * This is the ECHO PASS — say it in their words only (D-172).
   *
   * Set by `interpretRefinement` after a containment failure, never by a
   * caller. It adds one constraint line and nothing else, so the second reading
   * faces every guard the first did.
   */
  echoed?: boolean;
  /** The hybrid-likeness pass — the comparison is already settled (D-181). */
  hybrid?: boolean;
  /**
   * THE STAGE RE-LOOK — the code found no stage word and is asking again
   * (fable-363). Set by `interpretRefinement` after an unbacked `wall_stage`,
   * never by a caller, and never twice: a re-look that claims the wall again
   * falls through to the ordinary refusal, so the worst case is exactly the
   * behaviour that shipped before this existed.
   */
  stageRelook?: boolean;
  /**
   * THE WORD THE MODEL CLAIMED AS SCENERY, carried into the re-look so the
   * constraint can answer it by name when the vocabulary owns it. Set here,
   * never by a caller, exactly like `stageRelook` beside it.
   */
  stageClaimed?: string;
  /**
   * THE RESTATEMENT PASS — the last reading kept only what she already is, and
   * the service is asking once more before it refuses (fable-460).
   *
   * Set by `refineService` at the already-true door, never by an ordinary
   * caller, and never twice: a second restatement falls through to the refusal
   * the door made before this existed.
   */
  restated?: boolean;
  /**
   * THE ONE VALUE THE INVENTION DOOR VOUCHED FOR (fable-494/495).
   *
   * Set by this module's own door after a containment failure it asked about,
   * never by a caller — like `echoed`. It reaches `readDelta` as the check's
   * `vouched` pair and widens containment for that value and no other.
   */
  vouched?: { subject: string; value: string };
  /**
   * THE COLOUR-CONTEXT PASS — the content wall is being asked again with
   * D-178's history line withheld (opus-477, fable-635).
   *
   * Set by this module's own door, never by a caller, exactly like `echoed` and
   * `stageRelook`. Its presence is what stops a second withholding: a re-read
   * that walls again falls through to the refusal that shipped before this
   * existed.
   */
  colourWithheld?: boolean;
  /** What the face is NOW — relative asks resolve against this. */
  currentEyeColour: string | null;
  currentEyeShape: string | null;
  currentHairStyle?: string | null;
  currentHairColour?: string | null;
  currentHairTexture?: string | null;
  currentMakeup?: string | null;
  engine?: TextEngine;
  signal?: AbortSignal;
};

export async function interpretRefinement(input: RefineInterpretInput): Promise<RefineParse> {
  const instruction = input.instruction.trim();
  if (!instruction) return { ok: false, refusal: { reason: "empty" } };

  const engine = input.engine ?? interpreterEngine();
  if (!engine) {
    // Fail CLOSED — see the header. Refusing costs nobody anything.
    log.warn({}, "[refineInterpreter] no text engine — refusing rather than guessing");
    return { ok: false, refusal: { reason: "unreadable" } };
  }

  /*
    ONE RE-SAMPLE on an unreadable reply, mirroring `interpretBrief`.

    Measured: "make her eyes seafoam" came back EMPTY from the provider on two
    of three runs — not a parse failure, an empty completion — and the user saw
    "that did not come through clearly" for an instruction that was perfectly
    clear. A transport hiccup was being reported as their mistake on a paid
    surface. The ceiling went up for D-83's reason at the same time: a truncated
    reply does not degrade gracefully, it parses to nothing.
  */
  /*
    THREE, not two — measured again on "softer colour" (2026-08-05).

    The paraphrase corpus failed it on roughly half its runs with two EMPTY
    completions in a row, so a single re-sample is not the ceiling the comment
    above assumed. Each retry is a free text call on a path that would otherwise
    tell someone their perfectly clear instruction did not come through.
  */
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const parsed = await runOnce(engine, input, instruction);
    if (parsed) {
      /*
        THE ECHO PASS (D-172) — only the user's words are ever filed.

        Four honest instructions have now been refused because the INTERPRETER
        did the specification: "pastel" for their "pink", "tied" for their
        "tie", a set restated from an earlier sentence. Each was patched at the
        comparison — strip apostrophes, stem, widen the source — and the fourth
        proved the comparison is the wrong place to work.

        So a containment failure is not a refusal yet. The model is re-asked
        ONCE with its vocabulary constrained to the sentence, and the reply goes
        through the FULL parse again — every wall, containment unchanged. "A
        long knife scar from a bar fight" comes back "a scar" and files as a
        scar: invention becomes unrepresentable rather than merely detected.

        A second failure falls through to the ordinary refusal, so the worst
        case is exactly what shipped before this existed.
      */
      if (!parsed.ok && parsed.refusal.reason === "wall_unfileable" && !input.echoed) {
        log.warn({ asked: parsed.refusal.asked }, "[refineInterpreter] echo pass — re-asking in their words");
        /*
          TWICE, because once is not reliable. Measured on "hair color pink":
          the model specifies to "pastel pink" often enough that a single
          re-ask still refused roughly one attempt in three — and a casual,
          correctly-typed instruction failing a third of the time is the defect
          this pass exists to end, not a smaller version of it.
        */
        for (let echo = 1; echo <= 2; echo += 1) {
          const echoed = await runOnce(engine, { ...input, echoed: true }, instruction);
          if (echoed?.ok) return echoed;
          if (echo === 2 && echoed) return throughTheDoors(engine, input, instruction, echoed);
        }
      }
      return throughTheDoors(engine, input, instruction, parsed);
    }
    if (attempt < 3) log.warn({ attempt }, "[refineInterpreter] empty reply — re-sampling");
  }
  return { ok: false, refusal: { reason: "unreadable" } };
}

/**
 * The doors a refusal meets before it becomes an answer, in order.
 *
 * Each is pointed at ONE wall and is inert at every other, so they compose by
 * passing the parse along rather than by knowing about each other.
 */
async function throughTheDoors(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
  parsed: RefineParse,
): Promise<RefineParse> {
  return colourContextDoor(engine, input, instruction, await inventionDoor(engine, input, instruction, parsed));
}

/**
 * THE COLOUR-CONTEXT DOOR — what a content wall meets (opus-477, fable-635).
 *
 * # The measurement this exists for
 *
 * "Give her vampire fangs" walled `wall_content` on ~7% of attempts through the
 * service and ~0% asked bare, and three shifts theorised about why. The whole
 * difference is ONE line of the thirteen the service adds — D-178's
 * *"the last colour they changed was the hair"* — measured five ways at n=120:
 *
 * ```
 * bare 0 · her facet values 0 · everything currently filed 1 · THAT LINE 8 ·
 * all thirteen lines together 8
 * ```
 *
 * One line carries the entire effect, and it is the only line in that message
 * that is not a fact about her face — it is an instruction about how to read an
 * ask that has nothing to do with colour.
 *
 * # Why a re-ask rather than a lexicon
 *
 * The cheaper fix is to send the line only when the sentence looks like a
 * colour ask. Its misses are silent and land on a paid path: *"make it darker"*
 * is a colour ask with no colour word in it. A re-ask fails toward the refusal
 * instead, which is the shape this file already uses three times (the echo
 * pass, the stage re-look, the restatement pass).
 *
 * # It cannot soften a wall that should hold, and that is measured too
 *
 * A genuinely refusable ask walled **60/60 with the line and 60/60 without it**
 * (`output/wall-strip-safety/`). Withholding a sentence about her hair does not
 * make gore acceptable.
 *
 * # And it cannot misfile a colour, because the code already catches that
 *
 * The line is the only thing that says what "it" is in *"make it warmer"*, so a
 * rescue could file the change against the wrong feature — and it does: the
 * interpreter targeted her EYES on 2 of 24 served reads with the line withheld.
 * Every one was corrected by D-178's own backstop (`redirectColourTo`,
 * `refineService.ts:1237`), which runs on the composed delta from the service's
 * OWN remembered facet and never from anything the interpreter was told. Driven
 * with both controls — it moves a misfiled colour, and it stays quiet on an ask
 * that names its own subject (`output/relative-colour-corner/`). The corner is
 * older than this door and was already guarded.
 *
 * Its cost is one text call on a path that was refusing for free.
 */
async function colourContextDoor(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
  refused: RefineParse,
): Promise<RefineParse> {
  if (refused.ok || refused.refusal.reason !== "wall_content") return refused;
  /* Never twice, and never when there is nothing to withhold — a face with no
     colour history sends no such line, so this door does not exist for it. */
  if (input.colourWithheld || !input.lastColourFacet) return refused;

  const upheld = { ...refused, door: "upheld" as const, doorAt: "wall_content" as const };
  const reread = await runOnce(engine, { ...input, lastColourFacet: null, colourWithheld: true }, instruction);
  if (!reread || !reread.ok) return upheld;
  /* Only an EDIT is rescued, for the invention door's reason beside it: the
     measured case is an edit, and the other ok shapes carry no place to record
     which door served them — an uncounted rescue is a rescue nobody can audit. */
  if (!("delta" in reread)) return upheld;
  log.info(
    { instruction, lastColourFacet: input.lastColourFacet },
    "[refineInterpreter] the content wall did not survive its own re-read without the colour history — serving",
  );
  return { ...reread, door: "rescued" as const, doorAt: "wall_content" as const };
}

/**
 * THE INVENTION DOOR — the last thing a containment failure meets (fable-495).
 *
 * # Why containment alone could not do this
 *
 * The guard polices WORDS and the harm it exists to stop is invented FACTS, and
 * five incidents have now come apart in that gap: an apostrophe, a morphology,
 * a prior-stated item, a plural restatement the product itself instructed, and
 * the founder's "a harry potter LIGHTING bolt scar" — where the model repaired
 * his typo to "lightning" and containment read the repair as a word he never
 * said.
 *
 * There is no lexical rule that separates a repair from a change of meaning:
 * `shave` and `shape` are one character apart and are different facts about her
 * face. So the question is asked of the model in the narrowest form it has, and
 * THE CODE DECIDES from the answer — the same split the removal lexicon uses,
 * at the guard the open lane will inherit.
 *
 * # It can only ever loosen ONE value, and it fails toward the refusal
 *
 * An unreadable answer, an answer that says the value invents, or a re-read
 * that fails any other wall all end at the refusal that was already going to be
 * returned. The vouching is exact on the subject AND the words, so nothing else
 * in the reply is widened, and the re-read goes through every wall again.
 *
 * Its cost is one text call on a path that was refusing for free.
 */
async function inventionDoor(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
  refused: RefineParse,
): Promise<RefineParse> {
  if (refused.ok || refused.refusal.reason !== "wall_unfileable") return refused;
  if (input.vouched) return refused;
  const asked = refused.refusal.asked;
  const value = "value" in refused.refusal ? refused.refusal.value : null;
  if (!asked || !value) return refused;

  const verdict = await asksNothingOfItsOwn(engine, {
    instruction,
    subject: asked,
    value,
    prior: input.prior?.[asked] ?? [],
    signal: input.signal,
  });
  if (verdict === null || verdict.invents) {
    log.warn(
      { asked, value, invents: verdict?.invents ?? null, fact: verdict?.fact ?? null },
      "[refineInterpreter] the filed value asserts something they did not ask for — refusing",
    );
    /* WHICH WAY THE DOOR WENT, carried out on the parse so the service can
       COUNT it (fable-498 §4). A log line is not an artifact — this shift
       proved that on this very guard — so the outcome travels to the one place
       that knows the user and the candidate. */
    return { ...refused, door: "upheld" as const, doorAt: "wall_unfileable" as const };
  }
  log.info(
    { asked, value },
    "[refineInterpreter] the filed value says only what they asked — re-reading with it vouched",
  );
  const vouchedRead = await runOnce(engine, { ...input, vouched: { subject: asked, value } }, instruction);
  /* Only an EDIT can be rescued: the door exists for a value containment
     refused, and a navigation carries none. */
  if (vouchedRead?.ok && "delta" in vouchedRead) {
    return { ...vouchedRead, door: "rescued" as const, doorAt: "wall_unfileable" as const };
  }
  return { ...refused, door: "upheld" as const, doorAt: "wall_unfileable" as const };
}

/**
 * THE NARROWEST QUESTION THERE IS: does this value assert a fact that is not
 * theirs? One structured answer, and the code reads it.
 *
 * EXPORTED for its own positive control (fable-498 §3a / fable-499 §1): the
 * scripted arms prove the code refuses when handed `true`, and prove nothing
 * about whether the reader ever SAYS true. A door that cannot say no is a
 * rubber stamp, so the bench asks this exact function — never a second copy of
 * its question — on values that plainly invent.
 */
const INVENTION_QUESTION = [
  "You are checking ONE thing about how a customer's instruction was read.",
  "",
  "They typed an instruction. A reading of it produced a value for one feature.",
  "Answer whether that value asserts any FACT that is not theirs.",
  "",
  "A fact is theirs when it is in their sentence, when it is one of the items",
  "already on record for that feature, or when it is part of a thing their",
  "sentence names — a film, a character, a house, a look. Unpacking a reference",
  "they named into plain description is THEIRS. Repairing a spelling of a word",
  "they typed is THEIRS. Saying the same thing in other words is THEIRS.",
  "",
  "Adding a detail they did not give is NOT theirs: a cause, a size, a colour,",
  "a place, a story about how it got there.",
  "",
  'Reply with JSON only: {"invents": true|false, "fact": "<the fact that is not',
  'theirs, or null>"}',
].join("\n");

export async function asksNothingOfItsOwn(
  engine: TextEngine,
  input: {
    instruction: string;
    subject: string;
    value: string;
    prior: readonly string[];
    signal?: AbortSignal;
  },
): Promise<{ invents: boolean; fact: string | null } | null> {
  try {
    const reply = await engine.complete({
      system: INVENTION_QUESTION,
      user: [
        `Their instruction: ${input.instruction}`,
        `The feature: ${input.subject}`,
        `Already on record for it: ${JSON.stringify(input.prior)}`,
        `The value the reading produced: ${input.value}`,
      ].join("\n"),
      json: true,
      temperature: 0,
      maxOutputTokens: 200,
      signal: input.signal,
    });
    const raw = JSON.parse(stripFence(reply.text)) as { invents?: unknown; fact?: unknown };
    if (typeof raw.invents !== "boolean") return null;
    return { invents: raw.invents, fact: typeof raw.fact === "string" ? raw.fact : null };
  } catch (error) {
    /* A door that cannot be asked refuses — the free refusal was already the
       answer, and an unreadable verdict may not become a licence. */
    log.warn({ err: String(error).slice(0, 160) }, "[refineInterpreter] the invention question could not be asked");
    return null;
  }
}

/** One sampling. Returns null when the reply was unusable, so the caller retries. */
async function runOnce(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
): Promise<RefineParse | null> {
  let raw: unknown;
  try {
    const reply = await engine.complete({
      system: (input.mode === "edit" ? BASE_PROMPT : SYSTEM_PROMPT)
        + (input.echoed ? ECHO_CONSTRAINT : "")
        + (input.hybrid ? HYBRID_CONSTRAINT : "")
        + (input.stageRelook ? STAGE_RELOOK_CONSTRAINT : "")
        + (input.stageRelook && input.stageClaimed ? ownedWordConstraint(input.stageClaimed) : "")
        + (input.restated ? RESTATED_CONSTRAINT : ""),
      user: [
        `Current eye colour: ${input.currentEyeColour ?? "unknown"}`,
        `Current eye shape: ${input.currentEyeShape ?? "unknown"}`,
        `Current hair cut: ${input.currentHairStyle ?? "unknown"}`,
        `Current hair colour: ${input.currentHairColour ?? "unknown"}`,
        `Current hair texture: ${input.currentHairTexture ?? "unknown"}`,
        `Current makeup: ${input.currentMakeup ?? "none — a bare face"}`,
        /*
          WHAT IS CURRENTLY FILED, verbatim (D-173).

          Referent resolution belongs here, not in a word matcher: "remove the
          earrings" has to find "small gold hoops", and no amount of string
          comparison knows that hoops ARE earrings. The model does. It is shown
          the stored text and asked to echo it back exactly; the code then
          verifies the echo IS a stored item, so understanding is the model's
          and authority stays with the code.
        */
        ...(Object.entries(input.prior ?? {})
          .filter(([, items]) => (items?.length ?? 0) > 0)
          .map(([subject, items]) => `Currently filed under ${subject}: ${JSON.stringify(items)}`)),
        ...(input.lastColourFacet
          ? [`The last colour they changed was ${input.lastColourFacet} — an unqualified or `
            + "relative colour ask means THAT, unless this sentence names something else."]
          : []),
        `Instruction: ${instruction}`,
      ].join("\n"),
      json: true,
      // Extraction, not creativity — the same reason the brief interpreter runs low.
      temperature: 0.1,
      maxOutputTokens: REFINE_PARSE_MAX_TOKENS,
      signal: input.signal,
    });
    /*
      Strip code fences before parsing.
      
      The model sometimes wraps its JSON in a markdown fence even under
      json mode, and a bare JSON.parse then throws — which surfaced to the user
      as "that did not come through clearly" for instructions it had in fact
      read perfectly. A presentation habit was being reported as their mistake.
    */
    raw = JSON.parse(firstObject(stripFence(reply.text)));
  } catch (error) {
    log.warn({ err: error }, "[refineInterpreter] unreadable reply");
    return null;
  }

  const reply = (raw ?? {}) as Record<string, unknown>;

  /*
    TAKING SOMETHING BACK, classified BEFORE the walls (D-163).

    Ahead of them deliberately: "get rid of the earrings" contains a garment-
    adjacent noun and a negation, and a model asked to police the stage wall
    first can read a removal as an attempt to change the wardrobe. The intent
    comes first, then the content is judged on its own terms.
  */
  if (reply.navigate === true) return { ok: true, intent: "navigate" };
  if (input.mode !== "edit" && reply.remove && typeof reply.remove === "object") {
    const target = reply.remove as Record<string, unknown>;
    const subject = readRemovalSubject(target.subject);
    const match = typeof target.match === "string" ? target.match.trim().slice(0, 80) : "";
    /*
      THE ECHOES ARE AUTHORIZED HERE, not trusted (D-173).

      The model is shown what is filed and asked to copy back the exact stored
      text it means — that is how "remove the earrings" finds "small gold
      hoops", which no word matcher can do because it requires knowing that
      hoops ARE earrings. What the model contributes is understanding; what the
      code contributes is authority, so an echo that is not verbatim a stored
      item is dropped rather than acted on.
    */
    const filed = new Set(
      Object.values(input.prior ?? {})
        .flat()
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toLowerCase()),
    );
    const echoed = Array.isArray(target.items)
      ? (target.items as unknown[])
        .filter((item): item is string => typeof item === "string")
        .filter((item) => filed.has(item.trim().toLowerCase()))
        .map((item) => item.trim())
      : [];
    /*
      A REMOVAL THAT POINTS AT NOTHING IS NAVIGATION, structurally.

      "Take those off" is anaphoric, and the interpreter is deliberately never
      shown the chain — the code owns matching, so the model genuinely cannot
      resolve "those". A target with neither a subject nor words identifies
      every step equally, and removing everything because someone said "those"
      would be the worst possible reading of an ordinary sentence.

      Going back a step is what they mean, and it is free. The prompt says this
      too; this is the backstop, because a rule enforced only by asking nicely
      is not a rule.
    */
    if (!subject && !match && echoed.length === 0) return { ok: true, intent: "navigate" };
    return {
      ok: true,
      intent: "remove",
      subject,
      match: match || null,
      /*
        WIDTH IS REPORTED, NEVER INFERRED. Inferring it from an empty `match`
        is what let a removal whose words went missing delete every step on the
        facet — the model has to say it meant all of it, and a model that says
        nothing has not said all.
      */
      whole: target.whole === true,
      items: echoed,
    };
  }

  if (typeof reply.wall === "string" && reply.wall.trim()) {
    /*
      The model believes it hit a wall. It is TOLD which walls exist, so this is
      a report rather than a judgement — and the code re-checks every wall it
      can check itself in `readDelta`, because a wall enforced only by asking
      nicely is not a wall.
    */
    const asked = typeof reply.asked === "string" ? reply.asked.trim().slice(0, 60) : "";
    if (reply.wall === "likeness") {
      /*
        SERVE THE HONEST HALF, DETERMINISTICALLY (D-181).

        A refusal here is right for a PURE likeness ask and wrong for
        "make her eyes green like <someone>", which carries a real value. The
        model answered that inconsistently, so the code asks once more with the
        comparison declared already-settled. A second refusal means there was no
        honest half to serve, and the wall stands.
      */
      if (!input.hybrid) {
        const served = await runOnce(engine, { ...input, hybrid: true }, instruction);
        if (served?.ok && "delta" in served) return { ...served, droppedReference: true };
      }
      return { ok: false, refusal: { reason: "wall_likeness" } };
    }
    if (reply.wall === "content") return { ok: false, refusal: { reason: "wall_content" } };
    /*
      THE CODE DECIDES, THE MODEL PROPOSES (fable-363 ruling 1, D-181's shape).

      This was the one wall the code took on trust. `readDelta` owns a real stage
      instrument and it never ran here, because a wall reply carries no delta to
      run it on — so the model's claim was the whole decision, and measured on
      "make her albino" it was a COIN FLIP: refused 4 times in 5, filed correctly
      the fifth, on an ask the founder named as genuine.

      So the claim is now checked against `stageWordIn`, the same lexicon
      `readDelta` uses. Their sentence names a stage word: the refusal is BACKED
      and stands, deterministically, before any second call. It names none: the
      refusal is UNBACKED — not disproven, because a lexicon without `beach` in
      it cannot disprove anything — and the model gets one re-look that must
      JUSTIFY a second claim by naming the word.

      A re-claim stands and is logged with the word, which is the evidence that
      would widen `STAGE_WORDS` from measurement rather than from taste. Anything
      else falls through to today's refusal, so the worst case is unchanged.
    */
    const backing = stageWordIn(instruction);
    if (backing === null && !input.stageRelook) {
      log.warn(
        { asked, instruction },
        "[refineInterpreter] the model claimed the stage wall and their sentence names no stage "
        + "word — overriding for one re-look",
      );
      const relooked = await runOnce(
        engine,
        { ...input, stageRelook: true, stageClaimed: asked },
        instruction,
      );
      if (relooked?.ok) return relooked;
      if (relooked && !relooked.ok && relooked.refusal.reason === "wall_stage") {
        log.warn(
          { claimed: relooked.refusal.asked, instruction },
          "[refineInterpreter] the stage wall was re-claimed with a word the lexicon lacks — "
          + "a STAGE_WORDS candidate",
        );
      }
      if (relooked) return relooked;
    }
    /*
      AND THE ANSWER THE LEXICON GAVE IS CARRIED, not just logged.

      `backing` is computed above and, until now, reached a warn line and
      nothing else — so a refusal the lexicon could NOT back was delivered in
      the backed refusal's words, which name a garment, a prop or the set. Said
      to somebody who asked for horns, that sentence is simply false, and it is
      the copy the founder's D-160 note already caught once wearing a different
      wall's clothes.
    */
    return {
      ok: false,
      refusal: { reason: "wall_stage", asked: asked || "that", backed: backing !== null },
    };
  }

  /*
    The instruction goes in so SOURCE CONTAINMENT can run: every content word of
    a free value must appear in the sentence the user typed. `check.wall` comes
    back set when a wall was hit, so the refusal can name it.
  */
  const check: FreeLaneCheck = {
    instruction,
    prior: input.prior as FreeLaneCheck["prior"],
    ...(input.vouched ? { vouched: input.vouched } : {}),
  };
  const delta = readDelta(reply, check);
  /* A WALL is an answer, not a hiccup — it must not be re-sampled. */
  if (!delta) return check.wall ? { ok: false, refusal: check.wall } : null;
  /*
    THE BACKSTOP FOR A HYBRID LIKENESS ASK (D-181).

    The probe measured 7-of-9 refuse and 2-of-9 silent file for the SAME input —
    a coin-flip wall, which the corpus calls blocking. The model deciding
    whether to serve or refuse is exactly the kind of judgement this program
    keeps taking back into code.

    So the CODE decides: the instruction names an unknown person AND a value
    came out of it, therefore the value files and the reference is confessed.
    The name itself was never in the parsed output in any of the nine runs —
    `readDelta`'s proper-noun guard is what makes that structural — so this
    changes only whether the honest half is served, never what is filed.
  */
  const droppedReference = namesUnknownProperNoun(instruction, { mode: "phrase" });
  return droppedReference ? { ok: true, delta, droppedReference } : { ok: true, delta };
}

/**
 * What the user is told, in their own terms.
 *
 * Refine is narrow by design and the copy says so plainly rather than
 * apologising or dressing a boundary up as a fault. It also names the thing
 * that DOES answer the ask — rolling again — because a refusal that leaves
 * someone with nowhere to go is a dead end wearing polite words.
 */
export function refusalMessage(refusal: RefineParse & { ok: false }): string {
  /*
    ONE REGISTRY, LOOKED UP (fable-486 §f).

    This was a `switch` whose cases carried the sentences while the charge
    behaviour lived in whichever caller returned the refusal and the report
    class lived nowhere. `refineRefusals.ts` holds the three together, so a new
    refusal cannot ship with a sentence and no answer to "does this cost her
    anything" — the question a customer asks first.

    The reasons the copy gives are unchanged, verbatim; the `refusalCopy` suite
    is the pin that proves it.
  */
  return REFINE_REFUSALS[refusal.refusal.reason].say(refusal.refusal);
}

