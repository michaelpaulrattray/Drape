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
import { readDelta, type FreeLaneCheck, type RefineParse } from "./refineDelta";
import { freeSubjectGuidance } from "./refineSubjects";
import { INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";
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
  "  - One entry per subject, holding the WHOLE current answer for that subject.",
  "  - marks, ink and statedAccessories hold a SET. Give them as a JSON ARRAY of separate",
  '    items — ["small gold hoops", "thin wire glasses"] — never one run-on sentence, and',
  "    restate ALL of them including ones stated earlier, not only the new one. Each item is",
  "    one thing, in their words, so it can be taken back on its own later.",
  "  - Never name a brand, a product, or a real person.",
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
  "",
  "SUBJECTIVE asks are a wall too — prettier, hotter, better looking, more attractive. They name",
  'a judgement rather than a feature, so reply {"wall": "stage", "asked": "how attractive they look"}.',
  "",
  "Casting decisions are NOT refinements: age, heritage, sex and build are who was cast rather",
  'than how they look today. Reply {"wall": "stage", "asked": "her age"} and the like — rolling',
  "again is the honest answer to those.",
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
  '    {"remove": {"subject": "<the subject it belongs to>", "match": "<their own words for the',
  "    thing, or empty if they named the whole subject>\"}}",
  '  subject uses the SAME names as everything above: a free-lane subject, or one of',
  "    eyeColour, eyeShape, hairColour, hairTexture, hairStyle, makeup.",
  '  "remove the makeup" is the whole subject -> match empty. "remove the smokey eye" names one',
  '    thing -> match "smokey eye". Put THEIR words in match, never yours.',
  '  WHEN SOMETHING IS ALREADY FILED, name it by ECHOING the stored text EXACTLY, in an',
  '    "items" array: {"remove": {"subject": "statedAccessories", "items": ["small gold hoops"]}}.',
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
   * This is the ECHO PASS — say it in their words only (D-172).
   *
   * Set by `interpretRefinement` after a containment failure, never by a
   * caller. It adds one constraint line and nothing else, so the second reading
   * faces every guard the first did.
   */
  echoed?: boolean;
  /** The hybrid-likeness pass — the comparison is already settled (D-181). */
  hybrid?: boolean;
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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
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
          if (echo === 2 && echoed) return echoed;
        }
      }
      return parsed;
    }
    if (attempt === 1) log.warn({}, "[refineInterpreter] empty reply — re-sampling once");
  }
  return { ok: false, refusal: { reason: "unreadable" } };
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
        + (input.hybrid ? HYBRID_CONSTRAINT : ""),
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
        `Instruction: ${instruction}`,
      ].join("\n"),
      json: true,
      // Extraction, not creativity — the same reason the brief interpreter runs low.
      temperature: 0.1,
      maxOutputTokens: 600,
      signal: input.signal,
    });
    /*
      Strip code fences before parsing.
      
      The model sometimes wraps its JSON in a markdown fence even under
      json mode, and a bare JSON.parse then throws — which surfaced to the user
      as "that did not come through clearly" for instructions it had in fact
      read perfectly. A presentation habit was being reported as their mistake.
    */
    raw = JSON.parse(stripFence(reply.text));
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
    return { ok: true, intent: "remove", subject, match: match || null, items: echoed };
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
    return { ok: false, refusal: { reason: "wall_stage", asked: asked || "that" } };
  }

  /*
    The instruction goes in so SOURCE CONTAINMENT can run: every content word of
    a free value must appear in the sentence the user typed. `check.wall` comes
    back set when a wall was hit, so the refusal can name it.
  */
  const check: FreeLaneCheck = { instruction, prior: input.prior as FreeLaneCheck["prior"] };
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
  switch (refusal.refusal.reason) {
    /*
      Each wall says WHICH wall, because "that isn't supported" tells someone
      nothing about whether to rephrase, roll again, or stop. These four are
      absolute — they are not tiers waiting to open — so the copy does not
      promise a someday.
    */
    case "wall_likeness":
      return "Refining can't make someone look like a specific real person. "
        + "Nothing was charged.";
    case "wall_stage":
      /*
        It names what DOES work, because the wall narrowed and the old copy was
        the reason the founder believed it had not (D-160). "Wardrobe or set"
        was the whole sentence, so an earring refused under it read as a product
        that does not do jewellery — when jewellery is exactly what Refine is
        the stated channel for.
      */
      return `Refining changes the person, not the shoot — ${refusal.refusal.asked} is `
        + "a garment, a prop or the set, which comes after Sign. Jewellery, glasses and "
        + "piercings do work here. Nothing was charged.";
    case "wall_content":
      return "That one can't be rendered. Nothing was charged.";
    case "wall_unfileable":
      /*
        The honest version of wall (d): we will not render what we cannot write
        down, and the reason it could not be written down is that the words
        were not the user's own.
      */
      return "That came back with more detail than you asked for, so it wasn't recorded — "
        + "and nothing is rendered that isn't recorded. Try saying it in your own words. "
        + "Nothing was charged.";
    case "gate_ink_document":
      return INK_NEEDS_DOCUMENT_MESSAGE;
    case "empty":
      return "Say what you'd like changed — anything about the person themselves.";
    case "unreadable":
      return "That one didn't come through clearly. Try naming what you want changed about "
        + "them. Nothing was charged.";
  }
}

