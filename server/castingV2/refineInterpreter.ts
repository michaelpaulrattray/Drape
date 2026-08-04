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
import { HAIR_STYLE_NAMES } from "./hairStyles";
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { readDelta, type FreeLaneCheck, type RefineParse } from "./refineDelta";
import { freeSubjectGuidance } from "./refineSubjects";
import { INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";

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
const SYSTEM_PROMPT = [
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
  `  hairStyle   — one of: ${HAIR_STYLE_NAMES.join(", ")}`,
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
  "FREE-LANE RULES, and they are strict:",
  "  - Use the user's OWN WORDS. Never elaborate, never add detail they did not give.",
  '    "a scar on her cheek" stays that. It does NOT become "a long knife scar".',
  "  - One entry per subject, holding the WHOLE current answer for that subject.",
  "  - marks and ink hold a set: restate all of them, not just the new one.",
  "  - Never name a brand, a product, or a real person.",
  "",
  "WALLS — four things that are never possible. Reply with the wall, not an attempt:",
  '  likeness: making them look like a specific real person -> {"wall": "likeness"}',
  '  stage: clothing, backdrop, props, the shoot -> {"wall": "stage", "asked": "<what, briefly>"}',
  '  content: anything unsafe or explicit -> {"wall": "content"}',
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

export type RefineInterpretInput = {
  instruction: string;
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
    if (parsed) return parsed;
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
      system: SYSTEM_PROMPT,
      user: [
        `Current eye colour: ${input.currentEyeColour ?? "unknown"}`,
        `Current eye shape: ${input.currentEyeShape ?? "unknown"}`,
        `Current hair cut: ${input.currentHairStyle ?? "unknown"}`,
        `Current hair colour: ${input.currentHairColour ?? "unknown"}`,
        `Current hair texture: ${input.currentHairTexture ?? "unknown"}`,
        `Current makeup: ${input.currentMakeup ?? "none — a bare face"}`,
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
  if (typeof reply.wall === "string" && reply.wall.trim()) {
    /*
      The model believes it hit a wall. It is TOLD which walls exist, so this is
      a report rather than a judgement — and the code re-checks every wall it
      can check itself in `readDelta`, because a wall enforced only by asking
      nicely is not a wall.
    */
    const asked = typeof reply.asked === "string" ? reply.asked.trim().slice(0, 60) : "";
    if (reply.wall === "likeness") return { ok: false, refusal: { reason: "wall_likeness" } };
    if (reply.wall === "content") return { ok: false, refusal: { reason: "wall_content" } };
    return { ok: false, refusal: { reason: "wall_stage", asked: asked || "that" } };
  }

  /*
    The instruction goes in so SOURCE CONTAINMENT can run: every content word of
    a free value must appear in the sentence the user typed. `check.wall` comes
    back set when a wall was hit, so the refusal can name it.
  */
  const check: FreeLaneCheck = { instruction };
  const delta = readDelta(reply, check);
  /* A WALL is an answer, not a hiccup — it must not be re-sampled. */
  if (!delta) return check.wall ? { ok: false, refusal: check.wall } : null;
  return { ok: true, delta };
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
      return `Refining changes the person, not the shoot — ${refusal.refusal.asked} is `
        + "wardrobe or set, which comes after Sign. Nothing was charged.";
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

