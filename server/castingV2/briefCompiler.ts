/**
 * The brief seam (plan §E "Brief compiler").
 *
 * WHAT THIS IS AND IS NOT. §E's compiler is an LLM stage: a sentence becomes a
 * **CastingIntent** through Claude, optionally elaborated into eight authored
 * treatments by the Kimi stage, and only then handed to a deterministic
 * adapter. None of that ships here — M4's deliverable is the roll domain, and
 * M3's own report pinned a sequencing condition that forbids the treatment
 * stage from defaulting on before its lock validator exists (a "her" brief
 * came back male in 7 of 8 treatments).
 *
 * So M4 ships the **seam and its contract**, with a deterministic Path-A
 * compiler behind it. The contract is the part that matters, because it is
 * what stops `rollService` being rewritten when the interpreter lands:
 *
 *   1. Compilation is **async** and happens **before the claim**, so a refusal
 *      costs nothing and leaves no operation behind.
 *   2. Refusal is a typed outcome, never a guess. An interpreter that cannot
 *      read a brief must say so — "the interpreter proposes, code disposes".
 *   3. The result is **opaque to rollService**, which persists it and never
 *      inspects it. Everything the sheet needs to render arrives as chips and
 *      per-candidate specs; everything else is internal (§J).
 *
 * The framing law is already enforced here: the adapter owns camera, crop,
 * lighting and neutral wardrobe/scene, and only character-side dimensions
 * vary between candidates. When the treatment stage lands it varies those
 * dimensions and nothing else — the M3 report's third recommendation, made
 * structural rather than trusted.
 *
 * NOT DONE HERE, deliberately: the craft-catalog consultation the plan
 * requires of compiler-touching milestones (§I craft-reference law) attaches
 * to the real compiler. This stub does not discharge it.
 */

/** A removable interpretation chip, the sheet's only view of the brief (§J). */
export type CastingChip = {
  label: string;
  kind: "subject" | "style" | "direction" | "lineage";
  removable: boolean;
};

/** One of the eight. `prompt` is internal and never projected. */
export type CandidateSpec = {
  position: number;
  prompt: string;
  personaLine: string | null;
};

export type CompiledRollBrief = {
  /** Persisted to `casting_rolls.compiledBrief`. Internal (§G). */
  compiledBrief: Record<string, unknown>;
  /** The facts the brief pinned. Internal; the validator's future input. */
  lockContract: Record<string, unknown>;
  cohortKey: string;
  styleKey: string | null;
  styleProfile: Record<string, unknown> | null;
  chips: CastingChip[];
  candidates: CandidateSpec[];
  /** Sheet candidates render at 1K, medium quality (§H.10). */
  size: `${number}x${number}`;
  quality: "low" | "medium" | "high";
};

export type BriefRefusalCode =
  /** The brief carries no subject the compiler can work with. */
  | "uninterpretable"
  /** A cohort exists in the sentence that no adapter is certified for (§I). */
  | "unsupported_cohort";

/**
 * A refusal, raised before anything is claimed or charged.
 *
 * Free by construction: `rollService` compiles first, so there is no operation
 * and no ledger entry to unwind. That ordering is the reason a refusal can be
 * honest instead of apologetic.
 */
export class BriefRefusal extends Error {
  readonly code: BriefRefusalCode;
  constructor(code: BriefRefusalCode, message: string) {
    super(message);
    this.name = "BriefRefusal";
    this.code = code;
  }
}

export type BriefCompilerInput = {
  briefText: string;
  candidateCount: number;
  /** Set on a follow roll; the treatment axes narrow around this candidate. */
  followPersonaLine?: string | null;
};

export type BriefCompiler = (input: BriefCompilerInput) => Promise<CompiledRollBrief>;

/**
 * The normalized block. Framing, camera, crop, lighting, wardrobe and scene
 * are code — never LLM output, never varied between candidates (§I, §E.1).
 *
 * This is what makes eight candidates comparable: they differ in who the
 * person is, not in how the photograph was taken.
 */
const FRAMING_BLOCK = [
  "Photographic casting frame: single subject, waist-up, centred, facing camera.",
  "Neutral seamless mid-grey backdrop, soft even key light, no props.",
  "Plain unbranded neutral clothing. No text, no logos, no borders.",
].join(" ");

/**
 * Character-side variation axes.
 *
 * Eight identical prompts rely on sampling temperature for difference, and M3
 * measured what that produces: "the eight candidates read as one man
 * photographed eight times". These axes are the deterministic stand-in for
 * authored treatments — narrower than what the Kimi stage will produce, but
 * varying the same dimension: who this person is, not how they were shot.
 */
const VARIATION_AXES = [
  { label: "Warm, unhurried", direction: "warm and relaxed presence, unhurried" },
  { label: "Dry and flat", direction: "dry, deadpan presence, minimal expression" },
  { label: "Bright, quick", direction: "bright alert energy, quick engaged expression" },
  { label: "Still and grave", direction: "still, serious, composed presence" },
  { label: "Open, easy", direction: "open easy warmth, faint natural smile" },
  { label: "Guarded", direction: "guarded, reserved, watchful presence" },
  { label: "Wry", direction: "wry, faintly amused presence" },
  { label: "Plain and direct", direction: "plain, direct, unstyled presence" },
] as const;

function normalizeBrief(briefText: string): string {
  return briefText.replace(/\s+/g, " ").trim();
}

/**
 * Path A, deterministically: the brief plus the framing block plus one
 * character-side variation per candidate.
 *
 * Everything it returns is shaped exactly as the interpreter's output will be,
 * so swapping the implementation is a change of this function alone.
 */
export const deterministicBriefCompiler: BriefCompiler = async (input) => {
  const briefText = normalizeBrief(input.briefText);
  if (briefText.length < 3) {
    throw new BriefRefusal(
      "uninterpretable",
      "That brief is too short to cast from. Describe the person in a sentence.",
    );
  }
  if (input.candidateCount < 1 || input.candidateCount > VARIATION_AXES.length) {
    throw new TypeError("Unsupported candidate count for the deterministic compiler");
  }

  const candidates: CandidateSpec[] = Array.from({ length: input.candidateCount }, (_, index) => {
    const axis = VARIATION_AXES[index];
    const follow = input.followPersonaLine
      ? ` Keep the character close to the reference direction: ${input.followPersonaLine}.`
      : "";
    return {
      position: index,
      prompt: `${briefText}. ${axis.direction}.${follow} ${FRAMING_BLOCK}`,
      personaLine: axis.label,
    };
  });

  const chips: CastingChip[] = [
    { label: briefText.slice(0, 60), kind: "subject", removable: false },
    ...(input.followPersonaLine
      ? [{ label: `Following ${input.followPersonaLine}`, kind: "lineage" as const, removable: true }]
      : []),
  ];

  return {
    compiledBrief: {
      // Recorded so a roll can always say how it was compiled. When the
      // interpreter lands, its pinned model id is recorded here too.
      compiler: "deterministic-v1",
      briefText,
      framingBlock: FRAMING_BLOCK,
      axes: candidates.map((candidate) => candidate.personaLine),
    },
    // Empty rather than guessed: this compiler does no lock extraction, and
    // an invented lock contract would be worse than an absent one — the
    // validator would then "pass" facts nobody established.
    lockContract: {},
    cohortKey: "photoreal_human",
    styleKey: null,
    styleProfile: null,
    chips,
    candidates,
    size: "1024x1536",
    quality: "medium",
  };
};
