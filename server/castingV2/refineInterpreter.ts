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
import { readDelta, type RefineParse } from "./refineDelta";

const log = createModuleLogger("castingV2/refineInterpreter");

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
  "The ONLY things that can be changed are the eyes, the hair and the makeup:",
  `  eyeColour   — one of: ${EYE_COLOURS.join(", ")}`,
  `  eyeShape    — one of: ${EYE_SHAPES.join(", ")}`,
  `  hairColour  — one of: ${HAIR_COLOURS.join(", ")}`,
  `  hairTexture — one of: ${HAIR_TEXTURES.join(", ")}`,
  `  hairStyle   — one of: ${HAIR_STYLE_NAMES.join(", ")}`,
  "  makeup      — FREE TEXT, under 80 characters, in the user's own terms",
  "",
  "Reply with JSON and nothing else.",
  "",
  'Reply with any of {"eyeColour": "..."}, {"eyeShape": "..."}, {"hairColour": "..."},',
  '{"hairTexture": "..."}, {"hairStyle": "..."} — as many as the instruction actually asks for,',
  "using ONLY the exact words listed above. Pick the closest listed value; never invent one.",
  "Relative asks resolve against the CURRENT value you are given: 'greener' from hazel is green,",
  "'a bit lighter' from dark brown is brown, 'shorter' from a bob is a pixie.",
  "",
  'A cut name is hairStyle, not hairTexture: "give her a bob" is {"hairStyle": "bob"}. Use',
  "hairTexture only when the ask is about curl pattern rather than about the cut.",
  "",
  "makeup is the ONLY free-text field. Keep the user's own words — \"a red lip\" stays \"a red lip\"",
  '— and never name a brand or a product. "take her makeup off" is {"makeup": "none, a completely',
  'bare face"}, because removing makeup is still a makeup instruction.',
  "",
  'If the instruction asks for ANYTHING else — age, heritage, sex, build, expression,',
  'clothing, background, weight, beauty, "make her prettier", a different person — reply',
  '{"outOfTier": "<the thing they want changed, as a short NOUN PHRASE>"}.',
  '',
  'The noun phrase must fit the sentence "Refining can\'t change ___ yet." So:',
  '  "make her older"          → {"outOfTier": "her age"}',
  '  "put a scar on her cheek" → {"outOfTier": "her face structure"}',
  '  "make her prettier"       → {"outOfTier": "how attractive she looks"}',
  '  "put her in a red coat"   → {"outOfTier": "what she is wearing"}',
  'Never echo the instruction back as the noun phrase.',
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
      maxOutputTokens: 200,
      signal: input.signal,
    });
    raw = JSON.parse(reply.text);
  } catch (error) {
    log.warn({ err: error }, "[refineInterpreter] unreadable reply — refusing");
    return { ok: false, refusal: { reason: "unreadable" } };
  }

  const reply = (raw ?? {}) as Record<string, unknown>;
  if (typeof reply.outOfTier === "string" && reply.outOfTier.trim()) {
    return {
      ok: false,
      /* Capped: this string is echoed back to the user, and an unbounded model
         string on a user-facing surface is a rendering problem waiting. */
      refusal: { reason: "out_of_tier", asked: reply.outOfTier.trim().slice(0, 60) },
    };
  }

  const delta = readDelta(reply);
  if (!delta) return { ok: false, refusal: { reason: "unreadable" } };
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
    case "out_of_tier":
      /*
        Names what was asked, so the refusal demonstrates it understood — a
        refusal that does not reads as a bug rather than as a boundary. Then it
        names the thing that DOES answer the ask, because a dead end wearing
        polite words is still a dead end.
      */
      /*
        The copy names EXACTLY what is real, and it moves with the tier. A
        refusal that under-claims is as dishonest as one that over-claims —
        "only the eyes", the day hair shipped, would have sent people away from
        something the product could do.
      */
      return `Refining can't change ${refusal.refusal.asked} yet — only the eyes, hair and makeup. `
        + "Rolling again with that in the brief will get you closer. Nothing was charged.";
    case "empty":
      return "Say what you'd like changed about the eyes, the hair or the makeup.";
    case "unreadable":
      return "That one didn't come through clearly — try naming the eye colour or shape, the hair "
        + "colour, cut or texture, or the makeup you want. Nothing was charged.";
  }
}
