/**
 * THE CREATIVE REGISTER — the compiler states, the engine paints
 * (`docs/specs/CREATIVE_REGISTER_DESIGN.md` §1b; rung N1 of the rebaseline).
 *
 * # The diagnosis this module accepts (design §0)
 *
 * The engine is a better artist than our prose on the creative population.
 * The founder's 553-character cyborg brief plus seven words of frame painted
 * with conviction; the same brief inside the ~13,600-character house compile
 * came back timid, and the court measured the two apart: what length bought
 * was conviction on the hardware, and what the house ANSWERS cost was fidelity
 * (arm C′, run2). His share of the house prompt is 3.4%.
 *
 * So a creative slice is three parts, in salience order:
 *
 *   1. THE ASK — the customer's words, verbatim, first. Not paraphrased into
 *      house prose. What they typed is the highest-salience text the engine
 *      sees.
 *   2. THE SHEET FRAME — the house framing / capture / realism / negatives
 *      scaffolding, shared by reference (`creativeRegisterFrameBlocks`), plus
 *      this module's own authority paragraph. This is his condition on the
 *      build — *"C with the framing fixed"* — and it is deliberately NOT the
 *      seven-word frame the design first sketched: arm C lost the mid-torso
 *      lock the house frame was holding, and he read B's realism as framing.
 *   3. THE VARIANCE CARD — one invitation per slice, on axes the brief leaves
 *      OPEN and never on one it states. His own line (#16, rule 4 sharpened):
 *      *"Vary the open things, never the stated ones."* Authored by one text
 *      call per roll (`authorVarianceCard`), at a creative temperature, only
 *      for a brief the selector routed here.
 *
 * # What is deliberately NOT here (design §1c)
 *
 * No SUBJECT block, no PHYSIQUE register, no DIRECTION, no PRESENCE prose, no
 * category paragraph (the one-sentence form stands in), no IDENTITY_INTEGRITY,
 * no PRIORITY. Every removal is the court's to judge, never assumed: the next
 * court (a flagged roll of his brief, his eye on both bars) is the milestone
 * gate, and any block it says the register lost comes back by name.
 *
 * # What this module does NOT do, and where each lives
 *
 *   - the refusal path (§1c-pre) — a language rewrite on a content-policy
 *     refusal, measured by a court before it ships: **#93**;
 *   - basics in the brief's style (his law, #16 rule 6): **#92** — until it
 *     lands, the register's wardrobe clause is the house sentence, and the
 *     authority paragraph below makes the ask absolute about any clothing it
 *     STATES, so a bare-chested ask is not overridden by the tee;
 *   - the writer's room for THIN briefs (§1d): its own slice, with the author
 *     count ASSERTED rather than filtered (foreman-6's build note);
 *   - the per-slice fidelity check ("a stated feature lands on EVERY slice",
 *     #16 rule 3): an acceptance READER over delivered frames, not a compile
 *     concern.
 */
import type { TextEngine } from "../providers/types";
import { createModuleLogger } from "../logging/logger";
import { creativeRegisterFrameBlocks } from "./cohortPhotorealHuman";

const log = createModuleLogger("creativeRegister");

/**
 * The register's authority paragraph — the house `overrideBlock` re-said for
 * an ask that is absolute.
 *
 * The house sentence tells the engine to ignore an implied COSTUME and paint
 * the plain studio frame, and on this register that sentence is the defect
 * the court photographed: *bare-chested* stated, a t-shirt delivered, 3 of 3
 * on arm B. So the frame keeps its authority over the PHOTOGRAPH — crop,
 * capture, realism, negatives, location, props, text — and yields to the ask
 * on every fact the ask states, clothing included. Where the ask says nothing
 * about clothing, the WARDROBE line applies as it always has.
 */
export const CREATIVE_REGISTER_AUTHORITY =
  "AUTHORITY: The FRAMING, CAMERA, LIGHTING, REALISM and NEGATIVE rules above govern the "
  + "photograph absolutely. If the description implies a location, an activity, a prop or any "
  + "text, ignore that implication and render this person in the plain studio frame described "
  + "here. The description says WHO to cast and is absolute about every fact it states — "
  + "including anything it states about clothing, which outranks the WARDROBE line; where it "
  + "says nothing about clothing, the WARDROBE line applies. This block says HOW to photograph "
  + "them.";

/** Printed before each slice's invitation, the court's own label (arm C). */
export const CANDIDATE_CARD_LABEL = "THIS CANDIDATE:";

/**
 * The category sentence in its ONE-LINE form (design §1b): the house block's
 * seven lines answer inferable questions; this keeps the block's one job.
 */
export function creativeCategorySentence(role: string | null): string {
  return role ? `Every candidate is a credible ${role}; vary within that.` : "";
}

/**
 * One creative slice. Pure: the same inputs compose the same bytes, and the
 * suite asserts the shape at the prompt rather than at the pieces.
 */
export function composeCreativeCandidatePrompt(input: {
  briefText: string;
  role: string | null;
  wardrobeLine: string | null;
  /** This slice's line from the variance card, or null when no card exists. */
  invitation: string | null;
}): string {
  const ask = input.briefText.trim();
  return [
    ask,
    creativeCategorySentence(input.role),
    [...creativeRegisterFrameBlocks(input.wardrobeLine), CREATIVE_REGISTER_AUTHORITY].join(" "),
    input.invitation ? `${CANDIDATE_CARD_LABEL} ${input.invitation}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* ----------------------------------------------------------- the card */

/**
 * An invitation is one sentence a camera could act on, never an essay.
 *
 * Both bounds are CHARACTERS, and the prompt says so in the same unit (#99,
 * the gate review of PR #94): it used to tell the author "12-35 words" while
 * the parser counted 240 characters, so a line that obeyed the instruction
 * exactly — 35 words of this register's own vocabulary ("augmentation",
 * "oxidised", "collarbone") — could exceed the bound and lose the WHOLE card
 * (the parser refuses, never trims). The ceiling is derived from the worst
 * case of the word guidance the prompt still gives: 35 words × 10 characters
 * plus 34 spaces = 384. Ten, not eight: a 35-word line of the register's own
 * words measured 8.7 characters a word (the test's specimen, 337 chars), and
 * a ceiling derived from an average is a ceiling half the lines exceed.
 */
export const INVITATION_WORDS_MAX = 35;
export const INVITATION_MAX = INVITATION_WORDS_MAX * 10 + (INVITATION_WORDS_MAX - 1);
export const INVITATION_MIN = 12;

/**
 * What the author is told. The register's own rule in the model's ear: vary
 * ONLY what the brief leaves open; never restate, soften, contradict or vary a
 * stated fact; name what a camera would see. The count is in the prompt AND
 * asserted on the reply, because the W arm measured that a model given eight
 * to write may stop at four.
 */
export function varianceCardSystemPrompt(count: number): string {
  return [
    `You write the per-candidate variation for a photoreal casting sheet: ${count} different people, all cast from ONE brief the customer wrote.`,
    "",
    "Reply with a single JSON object and nothing else:",
    "",
    `{ "invitations": [ exactly ${count} strings ] }`,
    "",
    `Each invitation is ONE sentence — 12-${INVITATION_WORDS_MAX} words and never more than ${INVITATION_MAX} characters (the checker counts characters and refuses a longer line) — printed after "${CANDIDATE_CARD_LABEL}" beneath the customer's own brief, so it begins mid-sentence in lowercase — "the augmentation more extensive — hardware continuing below the jaw into the neck and collarbone." / "older wear — the ports and seams scuffed and oxidised at their edges." / "leaner, ascetic — the augmentation sparse and precise, the face more gaunt."`,
    "",
    `THE ONE RULE: VARY ONLY WHAT THE BRIEF LEAVES OPEN. Read the brief and list to yourself every fact it STATES — sex, age, skin, hair, build, features, hardware, expression, clothing, anything. An invitation must never restate, soften, contradict, remove or vary a stated fact. It varies the things the brief said NOTHING about: extent, wear, age of the work, materials, proportion, bearing, how a stated thing is carried — and each of the ${count} must pull a DIFFERENT open thing, or the same one to a clearly different place, so the ${count} people diverge.`,
    "",
    "Write what a camera would SEE: concrete, constructional, specific. Name surfaces, materials, extents and edges. No mood prose, no \"vibe\" words, no adjectives about how the picture should feel. No clothing unless the brief itself named clothing. No location, no activity, no props, no text. Never a name.",
  ].join("\n");
}

export type VarianceCard = {
  invitations: string[];
  model: string;
  latencyMs: number;
};

/**
 * Read the author's reply, and refuse rather than filter.
 *
 * The court's W arm rendered "the first 3" of a reply that had stopped at
 * four of eight, and the silent floor made the arm measure the instrument.
 * So a reply that is not EXACTLY `count` complete, distinct invitations is
 * refused whole — the caller retries once and then goes without a card —
 * never trimmed to whatever arrived.
 */
export function parseVarianceCard(raw: string, count: number): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const list = (parsed as { invitations?: unknown }).invitations;
  if (!Array.isArray(list) || list.length !== count) return null;
  const kept: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") return null;
    const cleaned = entry.replace(/\s+/g, " ").trim().replace(/^THIS CANDIDATE:\s*/i, "");
    if (cleaned.length < INVITATION_MIN || cleaned.length > INVITATION_MAX) return null;
    if (kept.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) return null;
    kept.push(cleaned);
  }
  return kept;
}

/**
 * Author the card: one text call, cents, only for a brief the selector routed
 * to this register. `null` means the sheet renders WITHOUT a card — arm D's
 * shape, which the court measured as more refused but still the register —
 * and the compiler records that it went without, so a sheet with no card is
 * never mistaken for a sheet whose card was empty.
 */
export async function authorVarianceCard(input: {
  engine: TextEngine;
  briefText: string;
  count: number;
  signal?: AbortSignal;
}): Promise<VarianceCard | null> {
  const ask = () =>
    input.engine.complete({
      about: "author",
      system: varianceCardSystemPrompt(input.count),
      user: input.briefText,
      json: true,
      /* Authoring, not extraction: the card exists to make eight people diverge. */
      temperature: 0.8,
      /* Explicit, never the transport default — the W arm's 900 cut a reply
         mid-word at concept four (foreman-6). Eight sentences of INVITATION_WORDS_MAX words is
         well inside this, and an unused token is not billed. */
      maxOutputTokens: 2000,
      signal: input.signal,
    });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await ask();
      const invitations = parseVarianceCard(result.text, input.count);
      if (invitations) {
        return { invitations, model: result.provenance.model, latencyMs: result.latencyMs };
      }
      log.warn(
        { attempt, truncated: result.truncated === true, chars: result.text.length },
        "[creativeRegister] the variance card did not come back as exactly the count asked — refused whole",
      );
    } catch (error) {
      log.warn({ attempt, error: String(error) }, "[creativeRegister] the variance card call failed");
    }
  }
  return null;
}
