/**
 * One refinement instruction → one absolute delta, or an honest refusal (§10).
 *
 * # It runs at ENTRY, and that is where the money argument lives
 *
 * This is a free text call, and it happens before anything is claimed or
 * charged. So "make her older" costs the user nothing and tells them the truth
 * immediately, instead of taking 500 credits to produce a picture that was never
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
import { providerAccountRefused, type ReadPurpose, type TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { declarativeStateRule } from "./declarativeState";
import {
  readDelta, stageWordIn,
  type FreeLaneCheck, type RefineDelta, type RefineParse,
} from "./refineDelta";
import type { WardrobeResolution } from "./wardrobeLine";
import {
  SERVED_SUBJECTS, SERVED_SUBJECTS_WITH_WARDROBE, freeSubjectGuidance, servedSubjectsFor,
} from "./refineSubjects";
import type { FreeSubject } from "./subjectCards";
import { closedSubjectFor } from "./openLaneKind";
import { acceptOpenKind } from "./openLaneAccept";
import { ensureKindProperties } from "./openKindProperties";
import { recordOpenLaneDemand } from "../db/castingV2OpenLaneDemand";
import { REFINE_REFUSALS, UNKNOWN_PRONOUNS } from "./refineRefusals";
import type { CastPronouns } from "./castPronouns";
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
 * `unbacked` carries the user's own subject back, so the refusal can name what
 * was asked rather than saying "unsupported" — a refusal that does not
 * demonstrate it understood reads as a bug rather than as a boundary.
 */
/**
 * THE PROMPT. ONE OF IT — `CASTING_OPEN_LANE_SCOPE` IS RETIRED (#1577 slice D1).
 *
 * It was a function of that flag until 2026-10-16: `openLane` false produced the
 * prompt that shipped before the open lane's last-resort clause existed, held
 * byte-identical to a checked-in fixture. The flag stood at `all` on production
 * from 2026-09-24 (his Crew reply #205, *"Turn it on for everyone"*) and every
 * flag in the chain above it was `all` too — the ghost audit's row D1, retired on
 * his word of 2026-10-15, verbatim: *"yes approve the plan and switch off the six
 * settings"*.
 *
 * ⚠ **ONE ROAD STILL ASKED THE OFF PROMPT, AND THIS DOCBLOCK SAID IT WAS *"asked
 * of nobody"*.** `openLane` was read off the CALLER, and the removal path's RULE 3
 * re-read (`refineService.ts`, the `mode: "edit"` call on the non-departable branch)
 * is the only production caller that never passed it — and absent meant off. So that
 * road got the closed prompt and skipped the acceptance door on a product whose flag
 * was `all`, and this collapse moved it onto the prompt everybody else was already
 * being read with. Found by the relay on PR #2556 and declared on the D1 row, which
 * carries the measurement; the call site says what it costs.
 *
 * **The lesson for the next option removed from this type: the compiler names every
 * caller that PASSES one, and says nothing at all about the caller that never did.**
 *
 * ⚠ **THE SURVIVING PROMPT DID NOT CHANGE BY A CHARACTER, and that is the bar
 * this collapse was held to rather than a hope** — #1495's rule, in the shape
 * #203 slice 2 used on the four-prompt collapse: hashed before and after, and
 * the two sha256s are asserted on every run by `refineOpenLaneClause.test.ts`
 * and recorded in `docs/specs/GHOST_AUDIT_2026-09-23.md`.
 *
 * The clause was never additive, and its second half is why the walls block
 * below reads as it does: fantastical anatomy routes to the LAST RESORT and not
 * to the stage wall, because the wall check sits ABOVE the acceptance door, so
 * stage routing would return before the lane was ever consulted.
 */
/**
 * ⚠ IT TAKES THE SERVED LIST NOW — #2544 slice 1, and the default is what
 * ships today.
 *
 * Four sites in these lines tell the model that garments are the stage wall,
 * and opening the wardrobe subject without changing all four would route every
 * outfit ask to `wall_stage` regardless — the relay's binding addition to the
 * design, verified at `origin/main` before his GO. Each one is written as a
 * conditional whose UNSERVED branch is today's string character for character,
 * rather than as a second copy of the prompt: two prompt bodies maintained side
 * by side is the drift this file's own pins exist to catch.
 *
 * The bar is `refineOpenLaneClause.test.ts`, which hashes all FOUR prompts —
 * the two that ship today unmoved, and the served pair pinned the day they were
 * written (the design's §6).
 */
const basePromptLines = (served: readonly FreeSubject[] = SERVED_SUBJECTS) => [
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
  `  free: { "<subject>": "<their words>" }, subject one of: ${freeSubjectGuidance(served)}`,
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
  /*
    THE LAST RESORT — the open lane's opening sentence (OPEN_LANE_DESIGN_NOTE
    §8, countersigned fable-878 §2). Three of its lines are load-bearing and
    each answers something this programme measured:

     - *"a listed subject that is genuinely about it ALWAYS wins"* — §2's
       finding that the lane is a FALLBACK, never a peer. Without it,
       *"give her wings"* stops being winged eyeliner for the user who meant
       eyeliner, and the closed lane's best readings are re-routed by a change
       that was only supposed to widen what may be named.
     - *"the key is THE THING, never where it goes"* — §1's one
       non-convergence, which was not drift but 3/3 the other way: *"her cheeks
       should be covered in scales"* keyed `cheeks`, a hair's breadth from
       `cheekbones`, a subject the closed lane owns. An open key shadowing a
       closed subject is a routing bug wearing a new kind's clothes.
     - *"widens what may be NAMED and nothing else"* — §2 property 3, the
       sentence wall (b) nearly fell through on the step-5a build.
  */
  "  - WHEN NO SUBJECT ABOVE IS ABOUT IT — and only then — key the free lane with your own",
  '    noun for the thing:  free: { "fangs": "vampire fangs" }',
  "    Work the list first. A listed subject that is genuinely about what they named ALWAYS",
  "    wins and stays the answer. This is the last resort, never a shortcut past a near fit.",
  '    THE KEY IS THE THING — never where it goes, never the change. "Scales across her',
  '    cheeks" keys scales, not cheeks. "Longer horns" keys horns, not length. One plain',
  "    lowercase noun, no adjectives: their describing words go in the value, in their own",
  "    words, under every rule above.",
  "    It must be part of the PERSON. This widens what may be NAMED and nothing else —",
  /* SITE 1 of the four. Served, the last resort must not still call a garment
     the wall — the free lane would be told to refuse the very subject the
     guidance line above now offers it. */
  ...(served.includes("wardrobe")
    ? [
      "    the backdrop, props and the scene are the stage wall exactly as",
      "    they were, and so are a judgement, an age, a heritage and a sex.",
    ]
    : [
      "    garments, headwear, the backdrop, props and the scene are the stage wall exactly as",
      "    they were, and so are a judgement, an age, a heritage and a sex.",
    ]),
  "",
  "ADORNMENT IS THE PERSON, NOT THE STAGE. Earrings, hoops, studs, a nose ring, a septum ring,",
  "glasses, a chain, a wedding ring, any piercing — things worn ON them — are ordinary refinements",
  /* SITE 2. The adornment block's whole job is to say what is the person and
     what is the stage, so served it gains the sentence clothing needs — and it
     names what is STILL the stage in the same breath, because this is the line
     a model reads to decide, and a half-corrected one invites it to assume the
     set moved too. */
  ...(served.includes("wardrobe")
    ? [
      "and file under statedAccessories in their own words. Only the backdrop, props and the",
      "scene are the stage.",
      "",
      "AND CLOTHING IS THE PERSON TOO. A coat, a jacket, a shirt, a dress, a suit, a hat, a scarf",
      "— anything they are WEARING — files under wardrobe in their own words. ONE entry holding",
      "the whole outfit as they have just asked for it: swapping a piece, adding a layer, taking a",
      "layer off, and changing a colour or a fabric are all that same one edit. The backdrop, the",
      "set, the scene, the location and anything they are HOLDING are still the stage and still",
      "the wall — a garment against a red backdrop is still refused, on the backdrop.",
    ]
    : [
      "and file under statedAccessories in their own words. Only GARMENTS, HEADWEAR, the backdrop,",
      "props and the scene are the stage.",
    ]),
  "",
  "WALLS — four things that are never possible. Reply with the wall, not an attempt:",
  '  likeness: making them look like a specific real person -> {"wall": "likeness"}',
  "    BUT A HYBRID ASK SERVES ITS HONEST HALF. Make her eyes green LIKE a named person",
  "    carries a real value — green — riding a comparison. File the VALUE and set",
  '    "droppedReference": true beside it; never put the name anywhere. Only a PURE',
  "    likeness ask with no extractable value (more Rihanna, give her that actress's face)",
  "    is the wall. Serve what they asked for; refuse only what cannot be served.",
  /* SITE 3. The walls list itself — the one a model is most likely to act on. */
  ...(served.includes("wardrobe")
    ? ['  stage: the backdrop, props, the scene -> {"wall": "stage", "asked": "<what, briefly>"}']
    : ['  stage: garments, headwear, the backdrop, props, the scene -> {"wall": "stage", "asked": "<what, briefly>"}']),
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
  /*
    AND THIS IS THE SWAP THE CLAUSE MADE, which was the half that was not
    additive — kept as the reason these four lines read as they do.

    With the lane shut this block routed fantastical anatomy to the STAGE wall,
    where the code turns it into the honest "cannot name this yet" sentence —
    a repair measured 3/3 on the real transport, replacing a CONTENT wall that
    told the user the thing could never be rendered.

    With the lane open that destination is wrong in a new way: the product CAN
    name it, through the last resort above. And the swap was never optional —
    the wall check at `runOnce` sits ABOVE the acceptance door, so a reply
    claiming the stage wall returns before the open lane is ever consulted.
    ⚠ **So the stage-wall version of these lines is not an alternative that was
    dropped for tidiness: restoring it would make the last resort inert for
    exactly the population the lane exists for**, which is why it went with the
    flag (#1577 slice D1) rather than being left as a branch nothing takes.
  */
  "    NOR IS FANTASTICAL ANATOMY. Horns, antlers, wings, a tail, scales, pointed ears —",
  "    those are things on the PERSON, not unsafe ones, and they have no subject of their",
  "    own. They take the LAST RESORT at the end of the free-lane rules: key the free lane",
  "    with the plain noun. Sending them here tells the user it can never be rendered.",
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
];

/* The one separator every prompt in this file is joined on, named so the
   precomputed constants and the composed one cannot differ by a character.
   ⚠ It said FOUR constants until #1577 slice D1; the open lane's pair went with
   its flag, so there are TWO. */
const NEWLINE = "\n";

const BASE_PROMPT = basePromptLines().join(NEWLINE);

/**
 * THE SERVED BASE — the same lines with the wardrobe subject on offer (#2544
 * slice 1).
 *
 * Precomputed beside its sibling rather than built per request, for the reason
 * the four precomputed prompts were: a prompt composed at the call site is a
 * prompt no pin can hash. Nothing can ask for this one unless the flag says so.
 */
const BASE_PROMPT_SERVED = basePromptLines(SERVED_SUBJECTS_WITH_WARDROBE).join(NEWLINE);

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
const SYSTEM_PROMPT_SERVED = BASE_PROMPT_SERVED + REMOVAL_PROMPT;

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
export function refineParseSystemPrompt(
  mode?: "classify" | "edit",
  options: { outfitEdit?: boolean } = {},
): string {
  /*
    ⚠ **FOUR AGAIN, AND THE SECOND PAIR IS THE FLAG'S — #2544 slice 1.** The
    block below is the record of how it got to two and is unaltered; what it
    says about the surviving pair still holds exactly, which is the point. The
    served pair is reachable only where `CASTING_OUTFIT_EDIT_SCOPE` admits the
    account, so an unserved request cannot be handed one — and
    `refineOpenLaneClause.test.ts` hashes all four, the shipped two against the
    sha256s recorded before any of this, the served two against sha256s taken
    the day they were written.
  */
  if (options.outfitEdit === true) {
    return mode === "edit" ? BASE_PROMPT_SERVED : SYSTEM_PROMPT_SERVED;
  }
  /*
    ⚠ TWO PROMPTS, AND THERE IS NO THIRD. This said FOUR until #1577 slice D1
    took `CASTING_OPEN_LANE_SCOPE`'s pair with the flag, and FIVE before #203
    slice 2 retired the composed one.

    It existed for a branch born on the Wardrobe path, which was the only branch
    served the whole vocabulary; everything else — a Basics branch and an
    unpathed one alike — took one of the four precomputed constants. Slice 1
    made `casting_rolls.path` a constant `null`, so that branch cannot be bought;
    the thirteen pathed rolls in production hold no candidate, so it was never
    reachable on an old roll either. A prompt nothing can ask for is not a
    prompt, and leaving the join standing would say the subject list still moves.

    ⚠ **Neither collapse changed a surviving prompt by a character**, which is
    the bar each was held to rather than a hope. #203 slice 2 hashed its four and
    recorded them in `docs/specs/TWO_PATHS_PREDICATES_2026-09-24.md`; D1 hashed
    these two, and `refineOpenLaneClause.test.ts` re-asserts them every run.
  */
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
 * THE ENTRANCE TO THE REFERENCE ROAD — the one clause that says a picture is
 * here (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §10; ruled fable-1104 §2).
 *
 * # The road was built end to end except for this
 *
 * The cutter, the class door, the carrier mint, the fourth reference role and
 * five commits of court all sit behind `refineService.ts:3290`. The parse
 * refuses at `:1431`. So every sentence the road was built for — *"copy this
 * hair"*, *"give her the hairstyle from this picture"*, *"give her hair like
 * this"* — refused FREE, 1,860 lines early, and the reason is this prompt had
 * never been told a photograph might be attached: *"this photo"* reads as a
 * real person, and the likeness wall did exactly its job. Measured, four
 * canonical sentences, four refusals (`probe-words-lane-deltas-disposable`).
 *
 * # Reachable ONLY when a picture actually rides the ask
 *
 * Appended like every other constraint in this file rather than folded into the
 * base prompt, so the blast radius on an ask with no reference is structurally
 * zero rather than argued: `context-is-not-additive` — a sentence added to this
 * prompt moves routing for asks that have nothing to do with it, and the only
 * safe version of that is a sentence that cannot arrive.
 *
 * # It opens the wall by exactly nothing
 *
 * A likeness ask can travel through a picture (fable-1104 §3), and this must
 * not admit one by a millimetre: pointing at the picture for a FEATURE is not
 * a likeness ask, and asking for the PERSON in it — their face, their features,
 * to look like them — is the wall exactly as before. Both are stated, and both
 * are court arms.
 *
 * # And it never guesses a value out of a picture it cannot see
 *
 * The model reading this has no image. So the feature files in the FREE lane
 * with words that name where it comes from, never an exact vocabulary word — a
 * guessed `hairColour` here would be a value nobody read off anything, filed
 * under a customer's ask, which is the invention D-172 exists to refuse.
 */
const REFERENCE_CONSTRAINT = [
  "",
  "",
  "A PICTURE IS ATTACHED TO THIS INSTRUCTION. \"this\", \"this picture\", \"the photo\", \"the",
  "reference\", \"like this\" and \"from this\" mean THAT PICTURE — not a real person — so",
  "pointing at it for a feature is NOT the likeness wall.",
  "SO DO \"her\", \"his\", \"their\", \"the woman's\" and \"the man's\": with a picture attached,",
  "the person in it is THE PICTURE'S SUBJECT and not a real person being named. \"give him her",
  "hairstyle\", \"his beard\", \"the woman's freckles\" point at the picture for a FEATURE and file",
  "exactly the way \"copy this hairstyle\" does.",
  "When they point at it, set \"fromReference\": true beside the delta and file the feature",
  "they named in the FREE lane, in their own words, saying where it comes from:",
  '  "copy this hair" -> {"free": {"hairCut": "the hair in the attached picture"}, "fromReference": true}',
  "You cannot see the picture. NEVER guess a value out of it and never use an exact",
  "vocabulary word for something only the picture could say.",
  "IF THEY DO NOT POINT AT IT, answer exactly as you would with no picture at all and leave",
  '"fromReference" out — "make her hair copper" is their own complete ask.',
  "STILL THE LIKENESS WALL: asking for the PERSON in the picture — their face, their",
  'features, to look like them — is {"wall": "likeness"} exactly as before.',
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
/**
 * ⚠ SITE 5 OF THE FOUR-PLUS-ONE — #2544 slice 1, and it was unreachable for a
 * garment until this slice, which is why it is corrected here rather than left.
 *
 * Flag off, a sentence naming `coat` BACKS the stage refusal, so the unbacked
 * re-look never fires and this function has never been asked about a garment
 * word. Served, that same sentence no longer backs anything (the garment half
 * is licensed), the re-look fires, and `closedSubjectFor("coat")` answers
 * `wardrobe` — which would have produced *"it belongs to `wardrobe`, which is a
 * fact about the PERSON … it is not a prop, a GARMENT or a piece of set
 * dressing"*, a sentence arguing with itself inside one clause.
 *
 * So the wardrobe branch says the true thing, and only where the subject is
 * actually served: an unserved request reaches the original words byte for
 * byte, which is what keeps this an addition rather than an edit.
 */
function ownedWordConstraint(claimed: string, outfitEditServed = false): string {
  const subject = closedSubjectFor(claimed);
  if (subject === null) return "";
  if (subject === "wardrobe" && outfitEditServed) {
    return [
      "",
      `THEIR WORD "${claimed}" IS ONE OF THE SUBJECTS YOU MAY FILE — it belongs to \`wardrobe\`, which`,
      "is clothing this person is WEARING and is theirs to change, whatever the sentence around it",
      "looks like. File it under wardrobe in their own words. The backdrop, the set, the scene and",
      "anything they are holding are still the stage.",
    ].join("\n");
  }
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
 * ⚠ SITE 4. THE RE-LOOK'S FIRST SENTENCE IS A STATEMENT OF FACT, AND SERVED IT
 * WOULD BE A FALSE ONE — #2544 slice 1.
 *
 * It says the code checked for *scenery, WARDROBE and props* and found none.
 * For a served account whose sentence names a coat, the code checked for
 * scenery and props and deliberately did not check for wardrobe — so the
 * original words would tell the model something untrue about its own input,
 * which is the failure this file's own docblock names two constants up (*"a
 * prompt that lies about the history is how a model learns to distrust the rest
 * of it"*).
 *
 * It is also the one place the re-look can be told what to do INSTEAD of
 * refusing, which is the whole point of a re-look: the measured case that
 * taught this file so was *"add horns to her head"*, refused 3/3 through a
 * re-look that had only told it what was NOT found.
 */
function stageRelookConstraint(outfitEditServed: boolean): string {
  if (!outfitEditServed) return STAGE_RELOOK_CONSTRAINT;
  return [
    "",
    "",
    "THE CODE HAS CHECKED THEIR SENTENCE FOR SCENERY AND PROPS AND FOUND NONE, so a refusal on",
    "those grounds is not yet earned. Read the instruction once more. If it is about the PERSON —",
    "their face, hair, skin, body, colouring, adornment or what they are WEARING — file it",
    "normally; clothing files under wardrobe, holding the whole outfit in their own words.",
    'If it genuinely is about the scene, the setting or a prop, reply {"wall": "stage"} again AND',
    'put in "asked" the exact word FROM THEIR INSTRUCTION that names it. Never file a place, a',
    "scene or a prop into any facet — those have no slot, and filing one is worse than refusing",
    "it.",
  ].join("\n");
}

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
   * THIS ACCOUNT IS SERVED THE WARDROBE SUBJECT — `CASTING_OUTFIT_EDIT_SCOPE`
   * (#2544 slice 1).
   *
   * Set by the service from the account, the way `inkReferenceEnabled` is, and
   * for the same stated reason: read from the ACCOUNT rather than from anything
   * about the sentence, because what a customer may ask for is a property of
   * their account and not of their words.
   *
   * It does four things, all of them named at their sites: it selects the served
   * prompt pair (so the model is told the subject exists, and the four lines
   * that call a garment the stage wall say the true thing instead); it licenses
   * the garment half of the stage lexicon for the BACKING check below; it rides
   * into `readDelta` as `outfitEditServed`, which licenses the same half for a
   * value filed under `wardrobe`; and it rides onto a `wall_stage` refusal so
   * the sentence is true of the account reading it.
   *
   * ⚠ **It never touches the scenery half**, at any site, under any subject.
   *
   * Absent means today — every test, every bench, and every account until the
   * flag moves.
   */
  outfitEditServed?: boolean;
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
   * THE PART SHE POINTED AT, when it can hold a colour — census card C2.
   *
   * A SEPARATE FIELD FROM `lastColourFacet` ON PURPOSE, and the reason is that
   * the other one's prompt line is a statement of fact: *"the last colour they
   * changed was X"*. On a scoped ask nothing has been changed at all, so
   * borrowing that field would put a false sentence in front of the model — and
   * a prompt that lies about the history is how a model learns to distrust the
   * rest of it.
   *
   * Set by the service from the ask's own scope, which is the customer tapping
   * her picture. It OUTRANKS the remembered facet where both exist: a tap now
   * beats a memory (`inkSlotSheAsksAbout`, fable-1291/1293, one lane over).
   */
  scopedColourFacet?: string | null;
  /**
   * This is the ECHO PASS — say it in their words only (D-172).
   *
   * Set by `interpretRefinement` after a containment failure, never by a
   * caller. It adds one constraint line and nothing else, so the second reading
   * faces every guard the first did.
   */
  echoed?: boolean;
  /**
   * A PICTURE RIDES THIS ASK — the entrance (see {@link REFERENCE_CONSTRAINT}).
   *
   * Set by the service from `reference !== null`, which is a resolved row: her
   * account, her Cast, THIS Cast, all proved before this is true. Absent means
   * no picture, and a caller that has never heard of this field — every test,
   * every bench, every road with no attachment — gets exactly today's prompt.
   */
  referenceAttached?: boolean;
  /**
   * WHETHER THIS ACCOUNT'S TATTOO ASK MAY BE DOCUMENTED BY THAT PICTURE —
   * `CASTING_INK_REFERENCE_SCOPE`, resolved by the service and never read here.
   *
   * Separate from {@link referenceAttached} because they are different facts: a
   * picture can ride an ask on the hair road while this arm stays shut. The ink
   * document gate fires on a live road (`CASTING_V2_SCOPE` is `all`), so this
   * bit is the only thing between his ruling and a behaviour change nobody
   * flipped a switch for.
   */
  inkReferenceEnabled?: boolean;
  /**
   * WHETHER THIS ASK IS ABOUT A TATTOO THIS PRODUCT ALREADY DELIVERED — the ink
   * gate's third document, resolved by the service and never decided here.
   *
   * Passed as one derived bit for the reason its sibling above is: this reader
   * has no business knowing what a delivered crop is, and the gate has no
   * business re-deciding what *"about a tattoo she already has"* means. The
   * service owns that reading (`inkPriorAsk`) and owns the branch state it is
   * checked against.
   */
  inkDocumentedByDelivery?: boolean;
  /**
   * WHAT THIS CAST IS WEARING — the branch's resolution, from the one owner,
   * resolved by the service (item 7a). Absent is silence, which is `unpathed`:
   * every roll cast before the paths, answering the house crew tee — today's
   * product, byte for byte.
   */
  wardrobe?: WardrobeResolution;
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
  /**
   * THE PRIOR-CONTEXT PASS — an UNBACKED stage wall is being asked again with
   * everything currently filed about her withheld (opus-481, fable-639).
   *
   * Set by this module's own door, never by a caller, exactly like
   * `colourWithheld` beside it. Its presence is what stops a second
   * withholding.
   */
  priorWithheld?: boolean;
  /** What the face is NOW — relative asks resolve against this. */
  currentEyeColour: string | null;
  currentEyeShape: string | null;
  currentHairStyle?: string | null;
  currentHairColour?: string | null;
  currentHairTexture?: string | null;
  currentMakeup?: string | null;
  /**
   * Test seam and dependency injection; `undefined` takes the shipped engine.
   *
   * ⚠ `null` means NO ENGINE, DELIBERATELY, and it has to be spelled that way
   * rather than left to `??`. The unconfigured branch below is only reachable
   * when `OPENROUTER_API_KEY` is absent, so an arm driving it through
   * `undefined` is not driving anything — it passes because the test
   * environment happens to have no key, and would make a REAL call the day one
   * appeared. `hairColourFromReference` and `makeupFromReference` already
   * declare this seam exactly this way; this is that pattern, not a new one.
   */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

export async function interpretRefinement(input: RefineInterpretInput): Promise<RefineParse> {
  const instruction = input.instruction.trim();
  if (!instruction) return { ok: false, refusal: { reason: "empty" } };

  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) {
    /*
      Fail CLOSED — see the header. Refusing costs nobody anything.

      `reader_down` rather than `unreadable`: no engine configured is a
      DEPLOYMENT state and there is nothing wrong with their sentence, so
      telling them to rephrase it is false. The roll road folds the same state
      into the same door (`interpretBrief`'s `cause: "unconfigured"` →
      `reader_down`), and this is that road's rule applied here rather than a
      second opinion.

      ⚠ IT WAS `reader_outage` UNTIL #2688, and the move is the whole point of
      that card on this road: a deployment with no reader cannot be fixed by
      trying again in a moment, which is what that door says. Nothing about
      the money moves — both are free, and this exit has always refused before
      anything was claimed.
    */
    log.warn({}, "[refineInterpreter] no text engine — refusing rather than guessing");
    return { ok: false, refusal: { reason: "reader_down" } };
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
  /*
    WHY THE LAST SAMPLING FAILED, so the refusal can be honest about whose
    fault it is (#126's class, driven `_shift111-dry-account-drive-disposable`).

    An overdrawn text account throws on every call, and all three samplings
    below then fall through to a sentence telling the customer *"try naming what
    you want changed"* — advice she cannot follow, on a failure that is ours.
    The roll road has drawn this exact line since #126 (`cause: "thrown"` versus
    `cause: "unparsed"`); this is that line on the sibling road. Money does not
    move: both answers were free before the claim and both still are.

    THE LAST attempt decides, not the first, and not "any". The three samplings
    are one reading — what is true at the end of it is what the customer is
    told — and a mixed run is a coin either way.
  */
  const trace: { last?: ReadFailure } = {};

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const parsed = await runOnce(engine, input, instruction, "interpret", trace);
    if (parsed) {
      /*
        AN OVER-LONG VALUE IS A FAILED SAMPLING UNTIL THE LAST ONE — the
        relay's finding on PR #2732, and it is this loop's OWN rule rather
        than an exception to it.

        # The case this exists to keep serving

        `wall_too_long` fires when ONE value in the reply is longer than the
        drawer it files into. ⚠ **That length is a property of OUR reply, not
        of the sentence they typed** — the same ask, sampled again at the same
        temperature, can come back shorter and file perfectly. The card's own
        corpus entry says so in as many words: *"a long ask reaches this door
        only if the model happens to render it long, and the same ask on the
        next sampling may file perfectly."*

        So before this branch existed, the first sampling's wall ENDED the read
        (`containReply` returns a set wall ahead of everything, because *a wall
        is an answer, not a hiccup*) — and every ask whose first sampling ran
        long and whose second would have fitted was **refused where `main`
        serves it**. That is the trade PR #2732 made without measuring it, and
        it is the one this branch is not willing to make.

        # Why THIS wall and no other

        Every other member of the union is a fact about what they ASKED for —
        words that were not theirs, a stage with nothing behind it, a colour
        with no feature. Those are identical on the next sampling, so
        re-sampling them is pure spend for a certain answer. This one is a fact
        about how verbosely we rendered their ask, which is the only cause in
        the set that a re-sample can change. A later member of this union is
        NOT covered by this branch and should not be added to it without the
        same argument.

        ⚠ **AND TWO LATER MEMBERS WERE, WITH THE ARGUMENT — #2730 and #2731 —
        so the branch no longer names an id.** `wall_too_many` (how many items
        WE split and restated a set into) and `wall_brand_only` (a value WE
        filed as nothing but a brand name, which the prompt tells the model to
        drop) are the same kind of fact as a length, and each argues it at its
        own union member with the measurement beside it. A second `=== "…"`
        here would have been a list of re-sampled ids living in the loop and
        shadowing the registry that holds every other fact about a refusal, so
        the loop reads `REFINE_REFUSALS[reason].resampled` instead — and every
        refusal now has to say, in the one place it is declared, which kind of
        fact it is. "Why THIS wall and no other" above is kept as the argument
        that field encodes; read "this wall" as "these".

        # THE LAST attempt decides, which is already written above

        On attempts 1 and 2 the wall is discarded exactly as an unusable reply
        is, and the loop re-samples. On attempt 3 it falls through and becomes
        the answer. Nothing is held across samplings, and that is deliberate:
        if the last sampling fails some OTHER way — a throw, our token ceiling
        — the post-loop doors below decide, and the customer hears about that
        failure instead. A wall remembered from attempt 1 would outrank a live
        outage at attempt 3, which is the mixed-run coin this loop's own
        paragraph refuses to flip.

        # What it costs, said out loud (the disappearing-technology law, 3)

        Up to two extra text samplings — a few cents of house money, no
        customer credit either way, since this road refuses free. What they buy
        is a chance of serving an ordinary paid edit that would otherwise be
        refused. A refused edit the product could have done is the costlier
        side of that trade, and the persistent case now costs exactly what it
        costs on `main` (three samplings) with a TRUE sentence at the end of it
        instead of *"didn't come through clearly"*.

        # Not recorded on `trace`, and the reason is the three doors below

        `trace.last` is a `ReadFailure` and is read by exact comparison at
        three post-loop doors (`account` → `reader_down`, `threw`/`truncated` →
        `reader_outage`, anything else → `unreadable`). A fourth member would
        need a deliberate answer at each of them, and it could never be the
        value there anyway — a wall on the last attempt returns from inside the
        loop. So the fact goes in the operator log, where the diagnosis
        actually reads it, and the type keeps meaning what it says.
      */
      if (!parsed.ok && REFINE_REFUSALS[parsed.refusal.reason].resampled && attempt < 3) {
        /* The refusal's own fields — the subject, and the length, count or
           value it carries for exactly this log. None of them is ever a
           customer sentence; the copy states each fact without its number. */
        log.warn(
          { attempt, ...parsed.refusal },
          "[refineInterpreter] the reply hit a wall OUR rendering caused — re-sampling",
        );
        continue;
      }
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
          const echoed = await runOnce(engine, { ...input, echoed: true }, instruction, "reask.echo");
          if (echoed?.ok) return echoed;
          if (echo === 2 && echoed) return throughTheDoors(engine, input, instruction, echoed);
        }
      }
      return throughTheDoors(engine, input, instruction, parsed);
    }
    if (attempt < 3) log.warn({ attempt, why: trace.last }, "[refineInterpreter] no usable reply — re-sampling");
  }
  /*
    An EMPTY completion on a 200 arrives here as `threw`, because
    `openrouterText` raises `ProviderError("unknown")` for it — and that is the
    right side of the line. Three empty completions in a row is our transport
    failing, not her sentence, and "try again in a moment" is the true advice.
  */
  /*
    ⚠ AND `truncated` STANDS BESIDE `threw` HERE (#1275) — that is what "joins
    the ours side" means in practice. Three samplings all cut off at
    `REFINE_PARSE_MAX_TOKENS` is our ceiling failing her, not her sentence
    failing to be clear, so "try again in a moment" is the true advice and "try
    naming what you want changed" is advice she cannot act on.
  */
  /*
    ⚠ AND `account` TAKES THE OTHER DOOR (#2688, the sweep of #2686).

    `threw` and `truncated` are both OURS and both reach for the same advice,
    because a deadline, a dead transport and our own token ceiling all read
    differently on the next sampling — *"try again in a moment"* is true of
    them. A provider that refused our KEY is the one failure here that no
    retry reaches, so it gets the door that does not ask for one. Three
    samplings all failing that way is the only road to this state, which is
    why it is read off `trace.last` rather than counted.

    Money is identical on both: this road refuses free.
  */
  if (trace.last === "account") {
    log.warn(
      { why: trace.last },
      "[refineInterpreter] the reader is down at OUR end — refusing without asking for a retry that cannot work",
    );
    return { ok: false, refusal: { reason: "reader_down" } };
  }
  if (trace.last === "threw" || trace.last === "truncated") {
    log.warn(
      { why: trace.last },
      "[refineInterpreter] reader outage — three samplings, nothing usable came back",
    );
    return { ok: false, refusal: { reason: "reader_outage" } };
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
  const invention = await inventionDoor(engine, input, instruction, parsed);
  return priorContextDoor(engine, input, instruction, await colourContextDoor(engine, input, instruction, invention));
}

/**
 * THE PRIOR-CONTEXT DOOR — what an UNBACKED stage wall meets (fable-639).
 *
 * # The measurement this exists for
 *
 * The same night's bisect that convicted one line of the content wall showed a
 * second and separate pressure on the STAGE wall, and it is not one line. Stage
 * claimed on the first read, same face, same sentence, n=120 and n=90
 * interleaved:
 *
 * ```
 * nothing at all                     0%
 * + her five filed properties       39%     <- a SUBSET
 * + the accessories line            17%     <- its SUPERSET
 * + facets and the colour line      11%
 * the live service input             7.5%
 * ```
 *
 * It rises and then FALLS as context is added, so no per-line cause can explain
 * it and no per-line cure can fix it — the clock rival was checked and killed by
 * running the arms interleaved. What survives to the customer is
 * *"Refining can't do vampire fangs yet — it isn't one of the things this can
 * name"*, about a capability the product has, on 2–3% of asks to a face with
 * history.
 *
 * # Why withholding all of it is safe here, when it would not be elsewhere
 *
 * Those lines are D-173's referent resolution: *"remove the earrings"* finds
 * *"small gold hoops"* only because they are shown. So this door is EDIT-ONLY
 * (fable-639) — **a removal is never rescued by it** and falls to the refusal
 * that ships today. Three more properties make its worst case exactly today's
 * behaviour:
 *
 *   - it only ever sees UNBACKED claims. A genuine stage ask names a stage word
 *     and `stageWordIn` settles it deterministically in one call, never reaching
 *     a re-look and never reaching here.
 *   - withholding the prior makes containment STRICTER, not looser, because
 *     `FreeLaneCheck.prior` is what ALLOWS a restatement to carry earlier words.
 *     A rescue cannot smuggle an uncontained value through.
 *   - any failure of the re-read — a wall, an unreadable reply, a removal, a
 *     navigation — returns the refusal that was already going to be returned.
 *
 * Its cost is one text call, or two if that read claims the stage wall on its
 * own account, on a path that was refusing for free.
 */
async function priorContextDoor(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
  refused: RefineParse,
): Promise<RefineParse> {
  /*
    UNBACKED ONLY — and since census card C1 the unbacked wall HAS ITS OWN NAME,
    so the id is the whole condition. The `backed !== false` line that used to
    stand here is gone rather than kept as a belt: `wall_unbacked` cannot be
    reached with a matched stage word, so the extra check would have been a
    branch no arm could ever exercise.
  */
  if (refused.ok || refused.refusal.reason !== "wall_unbacked") return refused;
  if (input.priorWithheld) return refused;
  const filed = Object.values(input.prior ?? {}).some((items) => (items?.length ?? 0) > 0);
  if (!filed) return refused;

  const upheld = { ...refused, door: "upheld" as const, doorAt: "wall_unbacked" as const };
  const reread = await runOnce(engine, { ...input, prior: {}, priorWithheld: true }, instruction, "reask.prior");
  if (!reread || !reread.ok) return upheld;
  /* EDIT ONLY (fable-639 §2). A removal read without the prior can resolve no
     referent, so rescuing one would trade a false refusal for a wrong edit. */
  if (!("delta" in reread)) return upheld;
  log.info(
    { instruction, claimed: refused.refusal.asked },
    "[refineInterpreter] the unbacked stage wall did not survive its own re-read without her filed items — serving",
  );
  return { ...reread, door: "rescued" as const, doorAt: "wall_unbacked" as const };
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
  const reread = await runOnce(engine, { ...input, lastColourFacet: null, colourWithheld: true }, instruction, "reask.colour");
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
    /* The same bit the reading itself was given, carried one door along. The
       door was adjudicating a value the reading had been INSTRUCTED to produce
       while blind to the reason it says what it says. */
    referenceAttached: input.referenceAttached === true,
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
    "[refineInterpreter] the filed value says only what they asked — containing it again, vouched",
  );
  /*
    THE SAME PARSE, CONTAINED AGAIN — never a second reading (ruled fable-1141
    §2, from the founder's own refused ask).

    This used to be `runOnce(..., "reask.vouched")`, and that second sampling
    was free to re-word the value the door had just adjudicated: vouched on
    *"her hairstyle IN the attached picture"*, the re-read produced *"her
    hairstyle FROM the attached picture"*, the vouch missed, and a decision
    already made correctly was thrown away. Measured at 4 of 11 on a legitimate
    reference ask, with every refusal arriving AFTER this log line.

    The closure carries no argument on purpose. It re-enters containment on the
    reply this refusal came from, with the pair that run refused — so there is
    no second reading for a re-wording to happen in, and no string comparison
    for a synonym to defeat. **A door whose verdict can be undone by a
    re-sample is not a door**, and normalising the string would have been a rule
    on the wrong layer: `IN` versus `FROM` today, a synonym tomorrow.

    Its absence is not a silent pass. A refusal with no re-check is one this
    door cannot rescue — a wall other than `wall_unfileable`, or a value the
    refusal did not carry — and it falls through to `upheld` below, which is
    exactly what the old path did when its re-read came back unusable.
  */
  const contained = await refused.recheckVouched?.();
  /* Only an EDIT can be rescued: the door exists for a value containment
     refused, and a navigation carries none. */
  if (contained?.ok && "delta" in contained) {
    return { ...contained, door: "rescued" as const, doorAt: "wall_unfileable" as const };
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

/**
 * THE ONE LINE THE DOOR NEEDS WHEN A PICTURE RIDES THE ASK (found 2026-08-20,
 * courted from the founder's refused first touch — fable-1139).
 *
 * # The door was refusing the house's own instruction
 *
 * {@link REFERENCE_CONSTRAINT} TELLS the reading what to file for a feature
 * taken from an attachment, in as many words:
 *
 *     "copy this hair" -> {"free": {"hairCut": "the hair in the attached picture"}}
 *
 * Containment then refuses that value, correctly — "attached picture" is not in
 * her sentence — and the invention door is asked to adjudicate. But that door's
 * question is put to a judge which has never been told a picture exists, so it
 * reads *"in the attached picture"* as an asserted fact of its own and upholds
 * the refusal. Measured on his own production Cast and on a foil: `invents:
 * true`, with the fact quoted back as **"the hairstyle is shown in an attached
 * picture"**, *"reference to an attached picture"*, *"attached picture"* — the
 * judge naming as an invention the exact thing the customer did by hand
 * thirty-nine seconds earlier.
 *
 * It is a COIN FLIP rather than a hard wall, which is worse than either: the
 * same phrase was rescued on other samples of the same cell, so the feature
 * worked sometimes.
 *
 * # Why a line here rather than a carve-out in containment
 *
 * Containment is D-172 and it is right: the value is not in her sentence. The
 * defect is that the door adjudicating it was reasoning without a fact the
 * caller already holds. This supplies that fact and nothing else — the
 * attachment is HERS, so a value naming it is not an invention — and it does
 * not tell the door which way to answer. A value that adds a colour, a length
 * or a cause the picture was never asked to supply is still an invention, with
 * a picture or without one, and that is the arm that keeps this honest.
 *
 * Absent an attachment the prompt is byte-identical, exactly like
 * {@link REFERENCE_CONSTRAINT} above it.
 */
const INVENTION_REFERENCE_NOTE = [
  "",
  "",
  "THEY ATTACHED A PICTURE TO THIS INSTRUCTION. That the picture exists, and that a",
  'feature comes FROM it, are THEIR facts — they attached it. So a value like "the hair',
  'in the attached picture" or "her hairstyle from the reference" invents nothing: it',
  "names where they pointed. Judge only what the value adds BEYOND that — a colour, a",
  "length, a texture, a cause or a story the picture was never asked to supply is still",
  "not theirs.",
].join("\n");

export async function asksNothingOfItsOwn(
  engine: TextEngine,
  input: {
    instruction: string;
    subject: string;
    value: string;
    prior: readonly string[];
    /** A picture rides this ask — see {@link INVENTION_REFERENCE_NOTE}. */
    referenceAttached?: boolean;
    signal?: AbortSignal;
  },
): Promise<{ invents: boolean; fact: string | null } | null> {
  try {
    const reply = await engine.complete({
      about: "gate",
      system: INVENTION_QUESTION
        + (input.referenceAttached ? INVENTION_REFERENCE_NOTE : ""),
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

/**
 * WHY THE LAST SAMPLING FAILED — `threw` (nothing came back), `truncated` (a
 * reply came back cut off at OUR token ceiling) or `unparsed` (a whole reply
 * came back and could not be read).
 *
 * Optional and written only by the top-level loop, so the six other `runOnce`
 * call sites are untouched. The distinction exists because these states
 * deserve different sentences and had one: see `RefineRefusal.reader_outage`.
 *
 * ⚠ `truncated` IS THE THIRD STATE, AND IT TAKES THE OURS ROAD (#1275, the
 * named remainder of #1272). A reply cut off at `REFINE_PARSE_MAX_TOKENS`
 * fails the parse — `firstObject` never closes an unterminated outer object —
 * and until this state existed it landed in `unparsed`, which is the one side
 * of the line allowed to point at HER sentence. A token ceiling is ours by
 * definition, so it cannot be: she was told to try naming what she wanted
 * changed, about a sentence that was never the problem, on a road she has paid
 * for. This is the same reading #1272 applied to `hairColourFromReference` and
 * `makeupFromReference`, and it needs no new customer copy — it moves this road
 * between two sentences that already exist.
 *
 * ⚠ `account` IS THE FOURTH STATE AND IT SPLITS `threw` (#2688, the sweep of
 * #2686). A call that threw because the deadline fired or the transport died
 * is weather — the same instruction a minute later is a different reading, and
 * *"try again in a moment"* is true of it. A call that threw because the
 * provider refused OUR key is not weather, and every retry fails identically.
 * This catch's own comment already named that cause — *"or the account is
 * overdrawn"* — so the module knew and the sentence did not, which is exactly
 * the shape #2700 found in the two reference readers. Measured on production,
 * 2026-10-27 from 03:09Z: the key was off, every call answered 401, and this
 * road said "in a moment" throughout. Money is untouched on every one of
 * these states and always was — this road refuses free.
 */
type ReadFailure = "threw" | "account" | "truncated" | "unparsed";

/**
 * One sampling. Returns null when the reply was unusable, so the caller retries.
 *
 * # `purpose` — WHY this sampling is happening, and the caller is the only one
 * # who knows
 *
 * This function is the single door every refine text call goes through, and it
 * is invoked from seven places: the first ask, the echo pass, and five re-ask
 * doors. They are the same code and the same model and they are not the same
 * spend — the colour door alone fires on 21 of 360 attempts, and until this
 * parameter existed all seven were filed at the census as one undifferentiated
 * word.
 *
 * So the purpose is a property of WHY the call was made rather than of which
 * function made it, and no inspection down at the transport can recover it. It
 * is not defaulted: a new caller must say which door it is, or say `interpret`
 * deliberately.
 */
async function runOnce(
  engine: TextEngine,
  input: RefineInterpretInput,
  instruction: string,
  purpose: ReadPurpose,
  trace?: { last?: ReadFailure },
): Promise<RefineParse | null> {
  let raw: unknown;
  let text: string;
  /*
    THE CEILING WAS HIT — carried out of the `try` so the parse failure below
    can say WHOSE fault it was (#1275).

    Declared here rather than read inside the parse branch because `reply` is
    scoped to the try: this is the transport's own `finish_reason === "length"`,
    and a fragment of JSON does not degrade to a missing field, it fails the
    whole parse.
  */
  let ceilingHit = false;
  try {
    const reply = await engine.complete({
      about: purpose,
      system: refineParseSystemPrompt(input.mode, { outfitEdit: input.outfitEditServed === true })
        + (input.referenceAttached ? REFERENCE_CONSTRAINT : "")
        + (input.echoed ? ECHO_CONSTRAINT : "")
        + (input.hybrid ? HYBRID_CONSTRAINT : "")
        + (input.stageRelook ? stageRelookConstraint(input.outfitEditServed === true) : "")
        + (input.stageRelook && input.stageClaimed
          ? ownedWordConstraint(input.stageClaimed, input.outfitEditServed === true)
          : "")
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
        ...(input.scopedColourFacet
          ? [`They TAPPED ${input.scopedColourFacet} in the picture, so this instruction is `
            + `about ${input.scopedColourFacet} and about nothing else. A colour with no `
            + `feature named belongs to ${input.scopedColourFacet}, whatever that colour is `
            + "usually associated with."]
          : []),
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
    text = reply.text;
    ceilingHit = reply.truncated === true;
  } catch (error) {
    /*
      NOTHING CAME BACK — the transport threw, the deadline passed, or the
      account is overdrawn (`classifyOpenRouterTextHttp` maps 402/401/403 to
      `provider_account`). Recorded so the top-level loop can say OUR sentence
      instead of hers; the return value is unchanged, so every other caller
      behaves exactly as before.
    */
    const ours = providerAccountRefused(error);
    if (trace) trace.last = ours ? "account" : "threw";
    log.warn(
      { err: error, cause: ours ? "account" : "threw" },
      ours
        ? "[refineInterpreter] the provider refused OUR account — no retry reaches it"
        : "[refineInterpreter] the reader did not answer",
    );
    return null;
  }

  try {
    raw = JSON.parse(firstObject(stripFence(text)));
  } catch (error) {
    /*
      A REPLY CUT OFF AT OUR CEILING IS OURS, AND IT HAD TAKEN HER SENTENCE
      (#1275, the named remainder of #1272).

      ⚠ THE SHAPE HERE DELIBERATELY DIFFERS FROM THE EIGHT #1272 FIXED, and the
      difference is the whole decision this card was filed to make. Those eight
      refuse the moment `truncated` is set, BEFORE parsing; this one lets the
      parse run and only reclassifies the FAILURE. The reason is that a reply
      can be flagged `truncated` and still parse — the provider may complete the
      object and then hit the ceiling on trailing text, and `firstObject`
      returns the first BALANCED `{…}` — and on a paid road that is a reading
      that works today. Refusing before the parse would turn a working edit into
      a refusal to buy a tidier branch, so nothing that succeeds now stops
      succeeding: the only thing that changes is which sentence she is shown
      when it fails.

      The eight had no retry and nothing to lose by refusing early; this road
      re-samples three times, which is also why its harm was the weaker of the
      class and why it was left out of that sweep rather than swept badly.
    */
    if (trace) trace.last = ceilingHit ? "truncated" : "unparsed";
    log.warn(
      { err: error, ceiling: ceilingHit ? REFINE_PARSE_MAX_TOKENS : undefined },
      ceilingHit
        ? "[refineInterpreter] the reader was cut off at the token ceiling — ours, not her sentence"
        : "[refineInterpreter] unreadable reply",
    );
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
        const served = await runOnce(engine, { ...input, hybrid: true }, instruction, "reask.hybrid");
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
    /*
      ⚠ SITE 3 OF THE DESIGN'S FIVE — THE BACKING CHECK, LICENSED (#2544 slice
      1). Served, a claim backed ONLY by a garment word is a MISFILE rather than
      a wall: the model was told the subject exists and refused it anyway. The
      answer is the one the design names — nothing new, the existing single
      re-look fires exactly as it does for an unbacked claim, and a claim the
      lexicon still cannot back after it falls through to today's refusal.

      ⚠ **The licence is on the GARMENT half only**, so a sentence naming a
      backdrop still backs the refusal on the first pass for a served account —
      which is the one thing at this site that must not move.
    */
    const backing = stageWordIn(instruction, {
      garmentLicensed: input.outfitEditServed === true,
    });
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
        "reask.relook",
      );
      if (relooked?.ok) return relooked;
      /*
        ⚠ THIS CONDITION MOVED WITH THE SPLIT, AND IT IS THE ONE THING HERE THAT
        WOULD HAVE DIED SILENTLY. This log line is the ONLY evidence that would
        ever widen `STAGE_WORDS` from measurement rather than taste, and what it
        watches for is a re-claim the lexicon still cannot back — which now
        arrives as `wall_unbacked`. Left spelled `wall_stage` it would have
        stopped firing with nothing red anywhere: a live control orphaned by a
        change aimed at something else (law 7's second half), inside the change
        itself.
      */
      if (relooked && !relooked.ok && relooked.refusal.reason === "wall_unbacked") {
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
    /*
      AND THE ANSWER THE LEXICON GAVE DECIDES WHICH WALL THIS IS, rather than
      riding as a bit on one of them (census card C1, ruled fable-1335 §1). The
      sentences are unchanged; the NAME the record files them under is not.
    */
    /*
      §7.2'S DOOR STOOD HERE AND IS RETIRED — #203 slice 2, 2026-09-24.

      It named a garment back to a customer and told her the path she bought
      was the reason. Slice 1 closed the entrance, so nobody can buy a path any
      more, and the door was reachable only from a roll carrying one: thirteen
      of those exist on production, every one of them holding zero candidates
      and zero signed casts, so no branch that can arrive here has ever been
      pathed. It answered `null` every time it was asked.

      An outfit ask therefore lands where it has always landed for every
      customer — `wall_stage` when the lexicon backs the word, `wall_unbacked`
      when it cannot — and `wall_unbacked`'s sentence is true again once the
      wardrobe subject is not on offer.
      `docs/specs/TWO_PATHS_PREDICATES_2026-09-24.md` is the reading.
    */
    return backing !== null
      ? {
        ok: false,
        refusal: {
          reason: "wall_stage",
          asked: asked || "that",
          backed: true,
          /* The sentence has to be true of the account reading it (#2544). */
          ...(input.outfitEditServed === true ? { clothingServed: true } : {}),
        },
      }
      : { ok: false, refusal: { reason: "wall_unbacked", asked: asked || "that" } };
  }
  return containReply({ engine, input, instruction, reply });
}

/**
 * CONTAINMENT AND EVERYTHING AFTER IT, ON ONE REPLY — extracted so the vouched
 * re-check can re-enter it WITHOUT ASKING THE MODEL AGAIN (ruled fable-1141 §2).
 *
 * # The defect this shape exists to kill
 *
 * The invention door's rescue used to call `runOnce` a second time with the
 * value vouched. That is a fresh sampling, and the sampling is free to re-word
 * the very value the door has just adjudicated:
 *
 *     vouched on   "her hairstyle in the attached picture"
 *     re-read got  "her hairstyle FROM the attached picture"   -> vouch misses
 *
 * Measured on the founder's own road: a legitimate reference ask landed 4 of 11
 * on a Cast whose hair was already filed, and EVERY refusal arrived after the
 * door had said the value says only what she asked. The door was right and the
 * re-sample threw the answer away.
 *
 * **The model's read is the unstable thing** — deterministic code after a flaky
 * parse only moves the coin flip. So the re-check re-runs containment on the
 * SAME parsed reply, and the vouched pair is the one THAT run produced.
 * Same-parse by construction: there is no second reading for a re-wording to
 * happen in, and no string comparison that a synonym could defeat.
 *
 * A fresh `check` per entry is not optional — `readDelta` writes its wall onto
 * the object it is handed, so a reused one would carry the first run's verdict
 * into the second.
 */
async function containReply(call: {
  engine: TextEngine;
  input: RefineInterpretInput;
  instruction: string;
  reply: Record<string, unknown>;
  /** Set only by the re-check below, never by an ordinary caller. */
  vouchedNow?: { subject: string; value: string };
}): Promise<RefineParse | null> {
  const { engine, input, instruction, reply } = call;
  /*
    The instruction goes in so SOURCE CONTAINMENT can run: every content word of
    a free value must appear in the sentence the user typed. `check.wall` comes
    back set when a wall was hit, so the refusal can name it.
  */
  /*
    POINTED AT THE PICTURE — hoisted, because TWO readers need the same fact and
    a second computation of it is the mirror law 4 forbids. The ink gate needs it
    BEFORE `readDelta` runs; the return below needs it after. One `const`, one
    definition of what pointing means.
  */
  const fromReference = input.referenceAttached === true
    && (reply as { fromReference?: unknown }).fromReference === true;

  const check: FreeLaneCheck = {
    instruction,
    prior: input.prior as FreeLaneCheck["prior"],
    /* THE RE-CHECK'S PAIR WINS when it is set — it is the pair the invention
       door judged, on this very reply. `input.vouched` is the ordinary
       caller's, and the two can never both be live: the door only re-checks a
       parse that had none. */
    ...(call.vouchedNow ?? input.vouched
      ? { vouched: (call.vouchedNow ?? input.vouched)! }
      : {}),
    /*
      THE INK GATE'S SECOND DOCUMENT, and the AND is the whole guard: her
      sentence must have pointed at the picture, and her account must be on the
      road. Either alone opens a live wall — the flag alone for an ask that never
      mentioned a photograph, the pointing alone for everybody on
      `CASTING_V2_SCOPE=all`.
    */
    ...(fromReference && input.inkReferenceEnabled === true
      ? { inkDocumentedByReference: true }
      : {}),
    /*
      AND THE THIRD DOCUMENT — a picture THIS PRODUCT painted and kept, which is
      the one document that needs no flag and no pointing: it exists because she
      already paid for the tattoo it shows. The service proved both halves before
      setting it.
    */
    ...(input.inkDocumentedByDelivery === true ? { inkDocumentedByDelivery: true } : {}),
    /* AND WHAT SHE IS WEARING. Unlike its siblings this is not a flag bit, so
       it rides whenever the service resolved one — and an absent resolution is
       the same answer as `unpathed`, which is what keeps the paths dark. */
    ...(input.wardrobe ? { wardrobe: input.wardrobe } : {}),
    /*
      AND WHETHER CLOTHING IS THIS ACCOUNT'S TO CHANGE — #2544 slice 1, site 2
      of the design's five. One flag bit, no second question: the reader decides
      what it licenses from the subject the value was filed under, which is the
      only fact it has any business knowing.
    */
    ...(input.outfitEditServed === true ? { outfitEditServed: true } : {}),
  };
  const delta = readDelta(reply, check);
  /* A WALL is an answer, not a hiccup — it must not be re-sampled. */
  if (check.wall) {
    const wall = check.wall;
    /*
      THE ONE WALL THAT CAN BE RE-CHECKED, and the closure is what makes the
      re-check SAME-PARSE BY CONSTRUCTION. It captures this reply and the pair
      this run refused; nothing is re-read and nothing is compared as a string.
      Attached only on the first entry, so a re-check that fails again is
      upheld rather than looping.
    */
    if (
      call.vouchedNow === undefined
      && wall.reason === "wall_unfileable"
      && typeof wall.value === "string"
    ) {
      const vouchedNow = { subject: wall.asked, value: wall.value };
      return {
        ok: false,
        refusal: wall,
        recheckVouched: () => containReply({ ...call, vouchedNow }),
      };
    }
    return { ok: false, refusal: wall };
  }
  /*
    THE OPEN LANE'S DOOR, AND IT IS HERE RATHER THAN IN THE READER
    (OPEN_LANE_DESIGN_NOTE §8 step 5; the shape ordered in fable-874 §3a).

    `readDelta` recorded the subjects it does not own and filed nothing for
    them. This is where the closed lane has finished declining, so it is the
    only place an open kind may be named — and it is named by CODE, from the
    customer's sentence, with the answer checked against the closed vocabulary
    before it counts as new. A reader that did this itself would let the model
    choose its own composition key with nothing in front of it.

    The wall check moved ABOVE this deliberately: a wall is an answer about
    something the customer said, and it outranks a fallback.

    ⚠ **IT WAS BEHIND `CASTING_OPEN_LANE_SCOPE` UNTIL #1577 SLICE D1, AND SO
    WAS THE CLAUSE THAT FEEDS IT — BOTH GATES ARE GONE AND THE REASON THERE WERE
    TWO IS WORTH KEEPING.** Gating the prompt alone would have left this door
    reachable, rarely, by a reply that named an unknown key of its own accord,
    for every user of a product whose casting scope is `all`. So the flag was
    read twice on purpose, and a later gate added here must be added at the
    prompt as well or it is not a gate.

    With the flag off the interpreter was not told it may name a kind outside
    the vocabulary, so its replies keyed onto the nearest closed subject — which
    is what §2 measured, and why the whole-delta null was latent rather than
    live.

    ⚠ **THIS PARAGRAPH SAID THAT OFF ROAD *"ran for nobody"* FROM 2026-09-24,
    AND IT WAS FALSE OF EXACTLY ONE ROAD — AND OF THIS DOOR ABOVE ALL OTHERS**
    (the relay's finding on PR #2556, read at the bytes; corrected here on its
    finding on PR #2569). The removal path's RULE 3 re-read was the only
    production caller of `interpretRefinement` that never passed `openLane`, and
    absent meant off — so on a product whose flag stood at `all` for everybody,
    that one re-read was asked the CLOSED prompt **and skipped the very door this
    comment sits above.** The flag was read twice on purpose, as the paragraph
    above explains; a caller that passed NEITHER gate is therefore the one caller
    both sweeps could miss, and both did.

    So the honest sentence is the other way round: the off road ran for one road
    and this door is where it ran. It is retired on his word of 2026-10-15, which
    put that re-read on the same prompt as the main read of the same words. The
    measurement is the ghost audit's D1 row (two independent readings, agreeing);
    the live road is commented at its call site in `refineService.ts` (RULE 3);
    the guard is `refineService.test.ts` › *"the RULE 3 re-read takes the open
    lane"*. **What it costs is stated rather than glossed**: an uncatalogued
    creature feature asked to come off used to refuse FREE there — `wall_unbacked`,
    nothing charged — and now files the absence in the customer's own words and
    renders it, at Refine's own price.

    ⚠ **AND THIS COPY IS WHY A CORRECTION IS SWEPT BY READING AND NOT BY ITS OWN
    WORDING.** PR #2569 corrected five copies of this claim and missed this one,
    because the five said *"asked of nobody"* and this said *"ran for nobody"* —
    a text search for the sentence being corrected could never reach it. A
    correction tracks READERSHIP, so the sweep's population is every place that
    states the fact, in whatever words.
  */
  const opened = await acceptOpenKind({
    instruction,
    unowned: check.unowned ?? [],
    ...(engine ? { engine } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    /* The same bit `readDelta` was given, from the same place (#2544 slice 1) —
       the lane asks the same lexicon the reader does, so it has to be asking it
       the same question. */
    ...(input.outfitEditServed === true ? { outfitEditServed: true } : {}),
  });
  if (opened) {
    /*
      DEMAND IS RECORDED FOR THE REFUSALS TOO — they are the more useful half. A
      kind that collided with a closed subject is a promotion signal (and a
      routing bug), and a table holding only successes would report the lane
      working perfectly on exactly the asks it happened to manage.
      Fire-and-forget: the writer cannot reject, and a promotion signal may
      never cost somebody their picture (§7).

      **NO KIND, NO ROW.** When the normalizer could not name the thing at all
      there is nothing honest to put in the one column that is not a timestamp,
      and a placeholder noun would be a word nobody asked for sitting in the
      table built to hold only words people did ask for. It is a log line
      instead. `unreadable` stays for the case that column CAN hold — a kind
      that was named and that the reader cannot see on a frame that holds it
      (the scales-and-gills class, §7).
    */
    /*
      AND AN ACCEPTED ASK'S ROW IS WRITTEN WHERE THE ASK ENDS, not here (5b
      Stage D, ruled fable-896 §4).

      Until the mint could file a crop for an open kind, `words_only` at this
      door was true by construction. It is now a PREDICTION — the column means
      *served without a reference crop*, which is a fact about a render that has
      not happened yet. A refusal is different and stays here: for a refusal this
      door IS terminal, and nothing later will ever have anything to add.

      One ask, one row. Writing here as well would give every accepted ask two
      rows and leave the promotion decision dividing by a denominator holding
      both halves of the same ask.
    */
    if (opened.kind === undefined) {
      log.info({}, "[refineInterpreter] an out-of-vocabulary ask could not be named at all — no demand row");
    } else if (!opened.ok) {
      void recordOpenLaneDemand(opened.kind, opened.outcome);
    }
    if (opened.ok) {
      /*
        AND WHAT THIS KIND *IS* IS BOUGHT HERE, ONCE PER NOUN EVER (5b Stage B,
        `OPEN_KIND_PROPERTIES_DESIGN.md` §2).

        Here rather than at the mint, for a reason that is about the OTHER
        property: `paired` is wanted after the render, but `anchorRegion` is
        wanted before it — it is what the out-of-frame build will decide
        accept-free against — and one call answers both. Every ask after the
        first for a given noun is a table read.

        Awaited, and that is deliberate: the mint gate needs the row on disk by
        the time this render lands, and a text read is seconds against a render's
        minutes. It cannot fail the ask — `null` means nobody answered, the mint
        reads that as *do not mint a crop*, and the kind carries words exactly as
        it does today.
      */
      await ensureKindProperties({
        kind: opened.kind,
        /* The NOUN, not the key: `cat-ears` is an identifier and `cat ears` is
           the word English has an answer about. */
        noun: opened.ask.noun,
        ...(engine ? { engine } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      const filed: RefineDelta = delta ?? {};
      filed.open = { ...(filed.open ?? {}), [opened.kind]: opened.ask };
      return withUnserved({ ok: true, delta: filed }, check, true);
    }
  }
  if (!delta) return null;
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
  /*
    AND WHETHER SHE POINTED AT THE PICTURE SHE ATTACHED (the entrance,
    fable-1104 §2).

    Read ONLY when a picture rides the ask, so a reply that names the field
    without being asked — a model's flourish on an ask with no attachment —
    cannot turn a plain sentence into a reference one. `=== true` rather than
    truthiness: the field is a claim, and a string or a number in it is a reply
    this contract does not recognise rather than a yes.

    It rides beside `droppedReference` above because they are siblings — both
    are one bit about how the sentence USED a reference, neither is part of the
    delta, and the service reads each where it can act on it.
  */
  if (fromReference) {
    return withUnserved(droppedReference
      ? { ok: true, delta, droppedReference, fromReference }
      : { ok: true, delta, fromReference }, check, false);
  }
  return withUnserved(
    droppedReference ? { ok: true, delta, droppedReference } : { ok: true, delta },
    check,
    false,
  );
}

/**
 * WHAT SHE NAMED THAT NOTHING FILED, onto the parse (ruled fable-1374 §2).
 *
 * `readDelta` records a subject it does not own and skips it. The open lane
 * then serves ONE of them at most — `acceptOpenKind` reads `unowned[0]` and logs
 * the rest — so everything else was named by the customer and reached no lane
 * at all. If the rest of her ask survived, the render happens and is charged,
 * and she is owed a sentence about the half that did not arrive.
 *
 * ⚠ **IT IS UNCONDITIONAL, AND THAT WAS THE POINT WHILE THERE WAS A FLAG TO BE
 * UNCONDITIONAL OF.** `CASTING_OPEN_LANE_SCOPE` is retired (#1577 slice D1);
 * while it stood, the disclosure deliberately did not read it — with the lane
 * off every unowned subject was recorded and skipped and the closed half
 * rendered exactly as before, which is the SAME harm, on every account rather
 * than on one, so a disclosure gated to the flag would have been honest only
 * for the founder. The sentence is kept because it is the standing argument
 * against gating a disclosure to whatever flag comes next.
 *
 * Keys only. The values are model-authored text and this list is read to write
 * a sentence a customer sees.
 */
function withUnserved<T extends { ok: true; delta: RefineDelta }>(
  parse: T,
  check: FreeLaneCheck,
  openLaneTookTheFirst: boolean,
): T & { unserved?: readonly string[] } {
  const named = (check.unowned ?? []).map((entry) => entry.subject);
  const unserved = openLaneTookTheFirst ? named.slice(1) : named;
  return unserved.length > 0 ? { ...parse, unserved } : parse;
}

/**
 * What the user is told, in their own terms.
 *
 * Refine is narrow by design and the copy says so plainly rather than
 * apologising or dressing a boundary up as a fault. It also names the thing
 * that DOES answer the ask — rolling again — because a refusal that leaves
 * someone with nowhere to go is a dead end wearing polite words.
 */
export function refusalMessage(
  refusal: RefineParse & { ok: false },
  /*
    ⚠ THE CAST'S OWN PRONOUNS, and the default is `they` rather than `she`
    (fable-1244 §1a). Two of these sentences name the person; both said "she"
    until the founder read one about his own male cast. Optional so a caller
    with no identity in hand is correct English rather than a guess — never so
    that forgetting is free.
  */
  of: CastPronouns = UNKNOWN_PRONOUNS,
): string {
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
  return REFINE_REFUSALS[refusal.refusal.reason].say(refusal.refusal, of);
}

