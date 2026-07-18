/**
 * editAuthority — the ONE server-owned authorization boundary for free-text
 * and reference-assisted image-edit instructions (IDENTITY_EDIT_INTERIM_POLICY
 * §6, Batch C). Every applicable door consumes the same decision contract;
 * no door may grow its own weaker classifier (M15 literal guard).
 *
 * Pipeline (§6.2), in order:
 *   1. Deterministic high-confidence checks (shared marks vocabulary,
 *      presentation terms, eyelash boundary, vague/whole-reference patterns).
 *   2. Strict structured LLM classifier (never the only safety layer).
 *   3. Strict JSON parse against the closed unions — deviation ⇒ `malformed`;
 *      unrecognized category ⇒ `unknown`; UNSURE ⇒ `unknown`.
 *   4. Status / view / evidence / capability rules (§8, §9.3).
 *   5. Leaf normalization into concrete durable values (§8.6) — never
 *      relational prose.
 *   6. The server-owned GenerationAuthorization.
 *
 * FAIL-CLOSED (R2): `unavailable` / `malformed` / `unknown` — including
 * UNSURE, parent-only, vague reference, unsupported modality, unmapped leaf,
 * failed normalization — refuse safely, clearly, and FREE. Never fall back
 * to unchecked image-only generation. Refusals precede generation records,
 * deductions, and image-model calls.
 */
import { TEXT_ECONOMY } from "@shared/modelRegistry";
import { getAiClient, withTextQueue } from "../../wardrobe/utils";
import { createModuleLogger } from "../../logging/logger";
import {
  type AuthorizableIdentityField,
  type AuthorizedIdentityEdit,
  type AuthorizedIdentityPatch,
  type EditClassification,
  type EditDecision,
  type EditRefusal,
  type EnumWithOverrideValue,
  type GenerationAuthorization,
  type IdentityClassifierCategory,
  type IdentityLeaf,
  type ImageOnlyCategory,
  type MarkCategory,
  type PresentationCategory,
  type SupportedIdentityLeaf,
} from "./identityTypes";
import {
  BASE_OPTION_SETS,
  FIELD_AVAILABILITY,
  FIELD_LABELS,
  handlerFor,
  isValidOverridePairValue,
  type OverridePairField,
} from "./identityFieldHandlers";
import { detectMarkCategories, detectMarkOperation } from "./marksVocabulary";
import { REFUSAL_COPY } from "./refusalCopy";
import { dependentPromptDirectives } from "./identityDependencies";

const log = createModuleLogger("casting/identity/editAuthority");

// ── Closed vocabularies for strict parsing ───────────────────────────────────

const MARK_CATEGORY_SET = new Set<string>([
  "mark.ink", "mark.scar", "mark.pigmentation", "mark.piercing", "mark.structural",
]);
const PERSON_STRUCTURED_SET = new Set<string>([
  "person.build", "person.age", "person.gender", "person.skinTone", "person.ethnicity",
]);
const PARENT_SET = new Set<string>(["person.face", "person.hair", "person.skin"]);
const IDENTITY_LEAF_SET = new Set<string>([
  "person.face.faceShape", "person.face.jawline", "person.face.chin",
  "person.face.cheekbones", "person.face.cheeks", "person.face.eyeShape",
  "person.face.eyeColor", "person.face.noseShape", "person.face.lipShape",
  "person.face.browShape", "person.face.browColor", "person.face.facialHair",
  "person.hair.style", "person.hair.color", "person.hair.length",
  "person.hair.texture", "person.hair.fringe", "person.hair.parting",
  "person.hair.volume", "person.hair.fade", "person.hair.hairline",
  "person.hair.tuck", "person.hair.flyaways",
  "person.skin.texture", "person.skin.finish",
]);
const PRESENTATION_SET = new Set<string>([
  "presentation.clothing", "presentation.headwear", "presentation.eyewear",
  "presentation.jewelry", "presentation.footwear", "presentation.props",
  "presentation.makeup",
]);
const IMAGE_ONLY_SET = new Set<string>([
  "image.lighting", "image.background", "image.poseExpression",
  "image.framing", "image.quality", "image.retouch",
]);

/** Leaves the ledger REFUSES outright during R6 (R9) — recognized by the
 *  classifier, never authorizable. */
const UNMAPPED_LEAVES = new Set<string>(["person.face.chin", "person.face.browColor"]);

// ── Deterministic stage patterns ─────────────────────────────────────────────

/** §5.2 presentation fast path — word-boundary keywords. The closed taxonomy
 *  + fail-closed `unknown` remains the boundary; this list is speed, not law. */
export const PRESENTATION_PATTERN =
  /\b(hat|cap|beanie|headpiece|helmet|hood|glasses|sunglasses|eyewear|necklace|earring(?:s)?|jewellery|jewelry|bracelet|choker|pendant|jacket|coat|blazer|dress|gown|shirt|blouse|t-shirt|tee|tank\s+top|crop\s+top|hoodie|sweater|trousers|pants|jeans|skirt|shorts|shoes|boots|heels|sneakers|footwear|garment|outfit|wardrobe|clothing|clothes|wearing|dressed\s+in|scarf|gloves|handbag|purse|prop|makeup|make-up|lipstick|lip\s*gloss|eyeshadow|eyeliner|blush|bronzer|foundation|concealer|highlighter)\b/i;

/** "look" only as a styling NOUN — determiners that can't precede the verb
 *  form ("make her look older" must never match; "use this look" must). */
export const LOOK_NOUN_PATTERN = /\b(?:this|that|the|whole|entire|same)\s+look\b/i;

/** Cosmetic lash treatments — presentation.makeup (§5.2 founder clarification). */
export const COSMETIC_LASH_PATTERN =
  /\b(mascara|false\s+(?:eye)?lashes|falsies|(?:eye)?lash\s+extensions?|lash\s+lift|lash\s+tint|lash\s+curl(?:er)?)\b/i;

/** Any remaining eyelash language — post-creation eyelash edits (natural or
 *  cosmetic) refuse during R6 and never resolve through eyeShape/browShape/
 *  features or a parent (§5.2, M16). */
export const EYELASH_PATTERN = /\b(?:eye)?lash(?:es)?\b/i;

/** §9.1 rule 3 — vague whole-reference requests refuse as ambiguous, free. */
export const VAGUE_REFERENCE_PATTERN =
  /(?:^\s*(?:use|apply|copy|match|transfer)\s+(?:this|that|it|the\s+(?:reference|image|photo|picture))\s*[.!]?\s*$)|\b(?:use|copy|apply|steal|take)\s+(?:this|that|the|her|his|their)\s+(?:whole\s+)?(?:look|style|vibe|aesthetic|everything)\b|\bmake\s+(?:her|him|them)\s+like\s+the\s+(?:reference|image|photo)\b/i;

/** Whole-face / whole-person replacement — refuse (§6.2 corpus). */
export const WHOLE_IDENTITY_PATTERN =
  /\b(?:resemble|look\s+like)\s+(?:this|that|the)\s+(?:person|woman|man|girl|guy|model)\b|\bcopy\s+(?:everything|the\s+whole\s+face|her\s+face|his\s+face|their\s+face)\b|\breplace\s+(?:her|his|their|the)\s+(?:face|head|identity)\b|\bswap\s+(?:the\s+)?face(?:s)?\b/i;

/** Hair-length bands (founder final ruling 2026-07-16, final corrections):
 *  the durable hair-length vocabulary is the documented closed list —
 *  Very Short / Short / Medium / Long / Very Long (`shared/castingOptions`
 *  HAIR_LENGTHS, the same values the structured editor and brief parser use).
 *  A text or reference-assisted length edit commits the band the USER named,
 *  derived deterministically from their own words — the normalizer can never
 *  make the committed length more (or less) extreme than what was requested.
 *  Wording that names no band ("a bit longer", "match the photo") fails
 *  closed and free: no justified durable value exists. */
export type HairLengthBand = "Very Short" | "Short" | "Medium" | "Long" | "Very Long";

/** Idiom → band, most extreme checked first. "long layers" is a hairstyle
 *  characteristic, not a length (D-56.1), and is stripped before matching. */
const LONG_LAYERS_STYLE_PATTERN = /\blong[-\s]layer(?:s|ed)?\b/gi;
const HAIR_LENGTH_BAND_PATTERNS: ReadonlyArray<readonly [HairLengthBand, RegExp]> = [
  ["Very Long", /\bvery\s+long\b/i],
  ["Very Short", /\bvery\s+short\b/i],
  // Explicit waist/hip/tailbone territory = Very Long.
  ["Very Long", /\b(waist[-\s]?length|hip[-\s]?length|tailbone|rapunzel|floor[-\s]?length|knee[-\s]?length|lower[-\s]back(?:[-\s]length)?|down\s+to\s+(?:the\s+|her\s+|his\s+|their\s+)?(?:waist|hips?|tailbone|lower\s+back))\b/i],
  // Below-shoulder / chest / mid-back territory = the documented Long band.
  ["Long", /\b(long|chest[-\s]?length|bra[-\s]?length|mid[-\s]?back(?:[-\s]length)?|armpit[-\s]?length|shoulder[-\s]blade(?:s)?|(?:below|past)\s+(?:the\s+|her\s+|his\s+|their\s+)?shoulders?|down\s+to\s+(?:the\s+|her\s+|his\s+|their\s+)?(?:chest|mid[-\s]?back|shoulder\s+blades?))\b/i],
  ["Medium", /\b(medium|shoulder[-\s]?length|collarbone(?:[-\s]length)?)\b/i],
  ["Very Short", /\b(pixie|buzz(?:ed)?(?:[-\s]cut)?|shaved|crew[-\s]cut)\b/i],
  ["Short", /\b(short|bob|chin[-\s]?length|jaw[-\s]?length|ear[-\s]?length|cropped|crop|above\s+(?:the\s+|her\s+|his\s+|their\s+)?shoulders?)\b/i],
];

/** The band the text explicitly names, or null when it names none — or names
 *  more than one (conflicting wording can justify no single durable value).
 *  Deterministic and pure: this is the ONLY source of a committed hair-length
 *  value on the text/reference path. */
export function requestedHairLengthBand(text: string): HairLengthBand | null {
  let t = text.replace(LONG_LAYERS_STYLE_PATTERN, " ");
  const found = new Set<HairLengthBand>();
  for (const [band, pattern] of HAIR_LENGTH_BAND_PATTERNS) {
    if (pattern.test(t)) {
      found.add(band);
      // Consume the matched idioms so "very long" never re-triggers "long"
      // and "very short" never re-triggers "short".
      t = t.replace(new RegExp(pattern.source, "gi"), " ");
    }
  }
  return found.size === 1 ? Array.from(found)[0] : null;
}

/** Relational language that must never be stored as an identity value (§8.6). */
export const RELATIONAL_VALUE_PATTERN =
  /\b(reference|the\s+image|the\s+photo|like\s+(?:this|that|hers|his|theirs)|same\s+as|from\s+the\s+picture|attached)\b/i;

// ── LLM seam (injectable — unit tests never touch the network) ──────────────

export interface AuthorityLlm {
  /** Returns the classifier's raw text (strict JSON expected). */
  classify(input: { feedback: string; referenceAttached: boolean }): Promise<string>;
  /** Returns the normalizer's raw text (strict JSON expected). Reference
   *  scoped analysis happens here when a reference is attached. */
  normalize(input: {
    feedback: string;
    leaves: SupportedIdentityLeaf[];
    referenceImageBase64?: string;
  }): Promise<string>;
}

/** Exported for tests — the classifier's single tuning point. */
export const CLASSIFIER_PROMPT_HEADER = `You classify one edit instruction typed against a generated fashion-model photo.
Output STRICT JSON only, no prose, with EXACTLY these three keys and nothing else:
{"kind":"identity"|"presentation"|"imageOnly"|"unknown","categories":[string],"operations":{}}

MIXED REQUESTS: when one instruction asks for several different things, list EVERY applicable category (they may span identity, presentation, and imageOnly vocabularies). "kind" is then the most severe bucket present: "identity" if ANY identity category applies; else "presentation" if any presentation category applies; else "imageOnly".

Categories (closed — use EXACTLY these strings):
- identity marks: mark.ink, mark.scar, mark.pigmentation, mark.piercing, mark.structural
- identity person-level: person.build, person.age, person.gender, person.skinTone, person.ethnicity
- identity face leaves: person.face.faceShape, person.face.jawline, person.face.chin, person.face.cheekbones, person.face.cheeks, person.face.eyeShape, person.face.eyeColor, person.face.noseShape, person.face.lipShape, person.face.browShape, person.face.browColor, person.face.facialHair
- identity hair leaves: person.hair.style, person.hair.color, person.hair.length, person.hair.texture, person.hair.fringe, person.hair.parting, person.hair.volume, person.hair.fade, person.hair.hairline, person.hair.tuck, person.hair.flyaways
- identity skin leaves: person.skin.texture, person.skin.finish
- identity parents (ONLY when the request is too broad to name a leaf): person.face, person.hair, person.skin
- presentation: presentation.clothing, presentation.headwear, presentation.eyewear, presentation.jewelry, presentation.footwear, presentation.props, presentation.makeup
- imageOnly (this one photograph only): image.lighting, image.background, image.poseExpression, image.framing, image.quality, image.retouch

Rules:
- Resolve identity requests to EXACT leaves when the wording names one ("sharper jawline" -> person.face.jawline; "the soft arch of the brows" -> person.face.browShape; "sharp lower-face structure" -> person.face.jawline).
- A request naming several distinct things lists EVERY category; when identity and non-identity mix, kind is "identity".
- Clothing/hats/accessories/jewelry/makeup are presentation even with a reference attached.
- Temporary blemish cleanup / photo retouching is image.retouch; permanent natural skin texture is person.skin.texture.
- If you cannot place the request confidently, output {"kind":"unknown","categories":[],"operations":{}}. Never guess.

INSTRUCTION: `;

/** Exported for tests — the normalizer's single tuning point. */
export const NORMALIZER_PROMPT_HEADER = `You convert an authorized identity-edit instruction into concrete, durable attribute values for a character sheet.
Output STRICT JSON only: {"edits":[...]} with EXACTLY one entry per requested field, in any order.

Entry shapes:
- descriptor fields: {"leaf":"<field>","value":"<concrete physical description, 3-120 chars>"}
- base/override fields (person.hair.style, person.hair.color, person.face.eyeColor, person.face.facialHair, person.skin.texture): {"leaf":"<field>","base":"<nearest option from the provided list, or empty string>","override":"<detailed prose when the value exceeds the option, else empty string>"}

Rules:
- Values are CONCRETE and durable ("chin-length layered wolf cut with wispy curtain fringe"), NEVER relational ("like the reference", "same as the image").
- If a reference image is attached, describe the requested attribute AS SEEN in the reference, in durable physical terms.
- Never add fields that were not requested. Never include preference keys, schema paths, or destinations.
`;

function defaultLlm(): AuthorityLlm {
  return {
    async classify({ feedback, referenceAttached }) {
      const ai = getAiClient();
      const response = await withTextQueue(() =>
        ai.models.generateContent({
          model: TEXT_ECONOMY,
          contents: [{
            parts: [{
              text:
                CLASSIFIER_PROMPT_HEADER +
                feedback +
                (referenceAttached ? "\n(NOTE: a reference image is attached — this never changes the category rules.)" : ""),
            }],
          }],
        }),
      );
      return response.text ?? "";
    },
    async normalize({ feedback, leaves, referenceImageBase64 }) {
      const ai = getAiClient();
      const optionLists = leaves
        .filter((l): l is OverridePairField & SupportedIdentityLeaf => l in BASE_OPTION_SETS)
        .map((l) => `${l}: [${(BASE_OPTION_SETS[l as OverridePairField] as readonly string[]).join(", ")}]`)
        .join("\n");
      const parts: Array<Record<string, unknown>> = [];
      if (referenceImageBase64) {
        const mime = referenceImageBase64.match(/^data:(.*?);base64,/)?.[1] ?? "image/png";
        parts.push({ inlineData: { data: referenceImageBase64.replace(/^data:.*?;base64,/, ""), mimeType: mime } });
      }
      parts.push({
        text:
          NORMALIZER_PROMPT_HEADER +
          `\nRequested fields: ${leaves.join(", ")}` +
          (optionLists ? `\nBase option lists:\n${optionLists}` : "") +
          `\nINSTRUCTION: ${feedback}`,
      });
      const response = await withTextQueue(() =>
        ai.models.generateContent({ model: TEXT_ECONOMY, contents: [{ parts }] }),
      );
      return response.text ?? "";
    },
  };
}

// ── Strict parsers (pure — exported for tests) ──────────────────────────────

function extractJson(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

const CLASSIFIER_TOP_LEVEL_KEYS = ["kind", "categories", "operations"];

/** Strict classifier parse (review finding 6): unexpected top-level keys ⇒
 *  malformed; unrecognized category ⇒ unknown; UNSURE ⇒ unknown; a MIXED
 *  response retains every recognized category, bucketed per vocabulary, and
 *  the declared kind must match the derived most-severe bucket (identity >
 *  presentation > imageOnly). Model confidence prose is never authority. */
export function parseClassifierResponse(raw: string): EditClassification {
  if (/\bUNSURE\b/i.test(raw) && extractJson(raw) === null) return { kind: "unknown" };
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "malformed" };
  const obj = parsed as Record<string, unknown>;
  // STRICT JSON is real: no channel exists beyond the three declared keys
  if (Object.keys(obj).some((k) => !CLASSIFIER_TOP_LEVEL_KEYS.includes(k))) return { kind: "malformed" };
  const kind = obj.kind;
  if (kind === "unknown") return { kind: "unknown" };
  if (kind !== "identity" && kind !== "presentation" && kind !== "imageOnly") return { kind: "malformed" };
  const rawCategories = obj.categories;
  if (!Array.isArray(rawCategories) || rawCategories.some((c) => typeof c !== "string")) {
    return { kind: "malformed" };
  }
  const categories = rawCategories as string[];
  if (categories.length === 0) return { kind: "unknown" };

  // Bucket every category; ANY unrecognized string fails closed as unknown
  const identityCats: IdentityClassifierCategory[] = [];
  const presentationCats: PresentationCategory[] = [];
  const imageOnlyCats: ImageOnlyCategory[] = [];
  for (const c of categories) {
    if (MARK_CATEGORY_SET.has(c) || PERSON_STRUCTURED_SET.has(c) || PARENT_SET.has(c) || IDENTITY_LEAF_SET.has(c)) {
      identityCats.push(c as IdentityClassifierCategory);
    } else if (PRESENTATION_SET.has(c)) {
      presentationCats.push(c as PresentationCategory);
    } else if (IMAGE_ONLY_SET.has(c)) {
      imageOnlyCats.push(c as ImageOnlyCategory);
    } else {
      return { kind: "unknown" };
    }
  }

  // The declared kind must agree with the derived most-severe bucket — a
  // self-contradicting response is malformed (free, retryable), never guessed
  const derivedKind = identityCats.length > 0 ? "identity" : presentationCats.length > 0 ? "presentation" : "imageOnly";
  if (kind !== derivedKind) return { kind: "malformed" };

  if (derivedKind === "imageOnly") {
    return { kind: "imageOnly", categories: imageOnlyCats };
  }
  if (derivedKind === "presentation") {
    // presentation + imageOnly mixes resolve to presentation (ratified
    // precedence: presentation refuses-and-routes before image-only runs)
    return { kind: "presentation", categories: presentationCats };
  }
  const operations: Partial<Record<MarkCategory, "add" | "remove" | "modify">> = {};
  if (obj.operations && typeof obj.operations === "object" && !Array.isArray(obj.operations)) {
    for (const [k, v] of Object.entries(obj.operations as Record<string, unknown>)) {
      if (MARK_CATEGORY_SET.has(k) && (v === "add" || v === "remove" || v === "modify")) {
        operations[k as MarkCategory] = v;
      }
    }
  }
  return {
    kind: "identity",
    categories: identityCats,
    presentationAlso: presentationCats,
    imageOnlyAlso: imageOnlyCats,
    operations,
    source: "model",
  };
}

export type NormalizerParseResult =
  | { ok: true; edits: AuthorizedIdentityEdit[] }
  | { ok: false; reason: "malformed" | "wrong_fields" | "invalid_value" | "relational_value" | "forbidden_content" };

/** Review correction 2: the LLM's OWN output takes the same deterministic
 *  policy boundary as user text — a normalized value that introduces marks,
 *  presentation, eyelash content, whole-identity language, or vague/
 *  relational reference wording fails closed and free, no matter how benign
 *  the original request was. */
function normalizedValueForbidden(text: string): boolean {
  if (deterministicStage(text, true) !== null) return true;
  if (RELATIONAL_VALUE_PATTERN.test(text)) return true;
  return false;
}

/** Strict normalizer parse (§8.6 steps 2–4): only the authorized leaves, one
 *  entry each, field-specific value types, concrete non-relational values.
 *  The contract has no channel for preference keys, schema paths, or write
 *  maps — any extra property fails. */
export function parseNormalizerResponse(
  raw: string,
  requestedLeaves: SupportedIdentityLeaf[],
): NormalizerParseResult {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "malformed" };
  // STRICT JSON is real (review finding 6): the ONLY top-level key is
  // `edits` — no channel exists for destinations or anything else
  if (Object.keys(parsed as Record<string, unknown>).some((k) => k !== "edits")) {
    return { ok: false, reason: "malformed" };
  }
  const editsRaw = (parsed as Record<string, unknown>).edits;
  if (!Array.isArray(editsRaw)) return { ok: false, reason: "malformed" };

  const seen = new Set<string>();
  const edits: AuthorizedIdentityEdit[] = [];
  for (const entry of editsRaw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { ok: false, reason: "malformed" };
    const e = entry as Record<string, unknown>;
    const leaf = e.leaf;
    if (typeof leaf !== "string" || !requestedLeaves.includes(leaf as SupportedIdentityLeaf)) {
      return { ok: false, reason: "wrong_fields" };
    }
    if (seen.has(leaf)) return { ok: false, reason: "wrong_fields" };
    seen.add(leaf);

    const isPair = leaf in BASE_OPTION_SETS;
    const allowedKeys = isPair ? ["leaf", "base", "override"] : ["leaf", "value"];
    if (Object.keys(e).some((k) => !allowedKeys.includes(k))) return { ok: false, reason: "malformed" };

    if (isPair) {
      const base = e.base;
      const override = e.override;
      if (typeof base !== "string" || typeof override !== "string") return { ok: false, reason: "invalid_value" };
      const value: EnumWithOverrideValue = { base: base.trim(), override: override.trim() };
      if (!isValidOverridePairValue(leaf as OverridePairField, value)) return { ok: false, reason: "invalid_value" };
      if (RELATIONAL_VALUE_PATTERN.test(value.override) || RELATIONAL_VALUE_PATTERN.test(value.base)) {
        return { ok: false, reason: "relational_value" };
      }
      if (value.override.length > 240) return { ok: false, reason: "invalid_value" };
      // Review correction 2: the LLM's own prose takes the full policy boundary
      if (value.override !== "" && normalizedValueForbidden(value.override)) {
        return { ok: false, reason: "forbidden_content" };
      }
      edits.push({ kind: "leaf", leaf, operation: "modify", value } as AuthorizedIdentityEdit);
    } else {
      const value = e.value;
      if (typeof value !== "string") return { ok: false, reason: "invalid_value" };
      const v = value.trim();
      if (v.length < 3 || v.length > 240) return { ok: false, reason: "invalid_value" };
      if (RELATIONAL_VALUE_PATTERN.test(v)) return { ok: false, reason: "relational_value" };
      // Review correction 2: a hallucinated mark/presentation/eyelash/whole-
      // identity descriptor fails closed even when the request was benign
      if (normalizedValueForbidden(v)) return { ok: false, reason: "forbidden_content" };
      edits.push({ kind: "leaf", leaf, operation: "modify", value: v } as AuthorizedIdentityEdit);
    }
  }
  if (edits.length !== requestedLeaves.length) return { ok: false, reason: "wrong_fields" };
  return { ok: true, edits };
}

// ── Refusal helpers ──────────────────────────────────────────────────────────

function refuse(code: EditRefusal["code"], message: string, retryable = false): EditRefusal {
  return { refused: true, code, message, retryable };
}

// ── Deterministic stage (pure — exported for tests; runs with the LLM dead) ──

export function deterministicStage(feedback: string, referenceAttached: boolean): EditRefusal | null {
  // Marks — every family, every operation, text or reference (§8.1)
  const markCategories = detectMarkCategories(feedback);
  if (markCategories.length > 0) {
    void detectMarkOperation(feedback); // operation recorded for logs; every operation refuses
    return refuse("mark_edit", REFUSAL_COPY.markEdit);
  }
  // Cosmetic lash treatments — presentation.makeup with the lash copy (§5.2)
  if (COSMETIC_LASH_PATTERN.test(feedback)) {
    return refuse("presentation", REFUSAL_COPY.cosmeticLash);
  }
  // Any other eyelash language — post-creation eyelash edits refuse (§5.2)
  if (EYELASH_PATTERN.test(feedback)) {
    return refuse("eyelash_post_creation", REFUSAL_COPY.eyelashPostCreation);
  }
  // Whole-identity replacement — with or without a reference
  if (WHOLE_IDENTITY_PATTERN.test(feedback)) {
    return refuse("whole_identity_reference", REFUSAL_COPY.wholeIdentityReference);
  }
  // Vague reference requests (§9.1 rule 3) — BEFORE the presentation fast
  // path so "use this whole look" with a reference refuses as ambiguous
  // (§6.2 corpus: unknown), not as routable styling.
  if (referenceAttached && VAGUE_REFERENCE_PATTERN.test(feedback)) {
    return refuse("vague_reference", REFUSAL_COPY.vagueReference);
  }
  // Presentation styling terms — refuse-and-route (§5.2)
  if (PRESENTATION_PATTERN.test(feedback) || LOOK_NOUN_PATTERN.test(feedback)) {
    return refuse("presentation", REFUSAL_COPY.presentationRouting);
  }
  return null;
}

// ── The boundary ─────────────────────────────────────────────────────────────

export interface EditAuthorityModel {
  id: number;
  status: string | null;
  name?: string | null;
  identityRevisionId?: string | null;
}

export interface EditAuthorityInput {
  model: EditAuthorityModel;
  /** The asset the instruction targets. */
  targetAsset: { id: number; viewType: string };
  /** The authoritative anchor's asset id (shared §7 selector) — null when the
   *  model has no anchor yet. */
  anchorAssetId: number | null;
  /** The newest filled headshot shown to the user. A verified image-only edit
   * is deliberately a display row, not an anchor, but remains a valid base
   * for a later identity edit when it still belongs to the current identity
   * revision. Both facts are derived server-side; clients cannot assert
   * either one. */
  displayedHeadshotAssetId?: number | null;
  targetBelongsToCurrentIdentity?: boolean;
  feedback: string;
  referenceAttached: boolean;
  referenceImageBase64?: string;
}

/**
 * The shared decision. Pure policy — no money, no rows, no image calls.
 * Callers act on the decision AFTER it returns; every refusal is free.
 */
export async function authorizeEditRequest(
  input: EditAuthorityInput,
  llm: AuthorityLlm = defaultLlm(),
): Promise<EditDecision> {
  const { model, targetAsset, feedback, referenceAttached } = input;

  // Founder force hook (retained, §6.3): force an identity classification to
  // watch the refusal live. Parent-only ⇒ ambiguous ⇒ free refusal.
  if (process.env.ITERATE_CLASSIFY_FORCE_IDENTITY === "1") {
    log.warn("[editAuthority] FORCE IDENTITY active — remove after testing");
    return refuse("ambiguous_identity", REFUSAL_COPY.ambiguousIdentity);
  }

  // 1. Deterministic checks hold even during an LLM outage (R2)
  const deterministic = deterministicStage(feedback, referenceAttached);
  if (deterministic) return deterministic;

  // 2–3. Strict LLM classification
  let classification: EditClassification;
  try {
    classification = parseClassifierResponse(await llm.classify({ feedback, referenceAttached }));
  } catch (error) {
    log.warn({ err: error }, "[editAuthority] classifier unavailable — failing closed (R2)");
    classification = { kind: "unavailable" };
  }

  switch (classification.kind) {
    case "unavailable":
      return refuse("classifier_unavailable", REFUSAL_COPY.classifierUnavailable, true);
    case "malformed":
      return refuse("malformed_classification", REFUSAL_COPY.classifierUnavailable, true);
    case "unknown":
      return refuse("unknown", REFUSAL_COPY.unknown);
    case "presentation":
      return refuse("presentation", REFUSAL_COPY.presentationRouting);
    case "imageOnly": {
      // Allowed on the selected view, drafts and minted alike — asset-only.
      const authorization: GenerationAuthorization = {
        modelId: model.id,
        viewType: targetAsset.viewType as GenerationAuthorization["viewType"],
        class: "imageOnly",
        imageOnlyCategories: classification.categories,
        referenceAssisted: referenceAttached,
        anchorEligible: false,
        stalesSiblings: false,
        promptDirectives: [],
      };
      return { refused: false, authorization };
    }
    case "identity":
      break;
  }

  // ── Identity — most-restrictive-wins over the category set (§6.2) ─────────
  const categories = classification.categories;

  const markCats = categories.filter((c): c is MarkCategory => MARK_CATEGORY_SET.has(c));
  if (markCats.length > 0) return refuse("mark_edit", REFUSAL_COPY.markEdit);

  const structuredCats = categories.filter((c) => PERSON_STRUCTURED_SET.has(c));
  if (structuredCats.length > 0) return refuse("person_structured", REFUSAL_COPY.personStructured);

  const unmapped = categories.filter((c) => UNMAPPED_LEAVES.has(c));
  if (unmapped.length > 0) return refuse("unmapped_leaf", REFUSAL_COPY.unmappedLeaf);

  const parents = categories.filter((c) => PARENT_SET.has(c));
  const leaves = categories.filter(
    (c): c is IdentityLeaf => IDENTITY_LEAF_SET.has(c) && !UNMAPPED_LEAVES.has(c),
  );
  // Parent-only (or parent + nothing resolvable) ⇒ ambiguous ⇒ refine or refuse
  if (leaves.length === 0 || parents.length > 0) {
    return refuse("ambiguous_identity", REFUSAL_COPY.ambiguousIdentity);
  }

  // Every remaining leaf must be a SUPPORTED ledger leaf
  const supported = leaves.filter((l): l is SupportedIdentityLeaf & IdentityLeaf =>
    (l as string) in FIELD_AVAILABILITY,
  );
  if (supported.length !== leaves.length) {
    return refuse("unmapped_leaf", REFUSAL_COPY.unmappedLeaf);
  }

  // (R1b's below-shoulder refusal was REVERSED by the founder's final ruling
  // 2026-07-16: Long/Very Long hair are durable identity edits through this
  // same door — normalized, committed, new anchor/revision, stale-all.)

  // Modality / registry gates — a multi-leaf request proceeds only when EVERY
  // leaf passes (most-restrictive-wins)
  const modality: "text" | "reference" = referenceAttached ? "reference" : "text";
  for (const leaf of supported) {
    const availability = FIELD_AVAILABILITY[leaf];
    if (modality === "reference" && !availability.reference) {
      return refuse(
        "unsupported_reference",
        REFUSAL_COPY.unsupportedReference(FIELD_LABELS[leaf]),
      );
    }
    if (modality === "text" && !availability.text) {
      return refuse("registry_disabled", REFUSAL_COPY.registryDisabled(FIELD_LABELS[leaf]));
    }
  }

  // ── Status / view / evidence gates (§8.3) ─────────────────────────────────
  if (model.status !== "draft") {
    return refuse("not_draft", REFUSAL_COPY.mintedIdentity(model.name ?? null));
  }
  if (targetAsset.viewType !== "frontClose") {
    return refuse("non_anchor_view", REFUSAL_COPY.nonAnchorView);
  }
  const targetsAnchor = input.anchorAssetId !== null && targetAsset.id === input.anchorAssetId;
  const targetsCurrentDisplay =
    input.displayedHeadshotAssetId != null
    && targetAsset.id === input.displayedHeadshotAssetId
    && input.targetBelongsToCurrentIdentity === true;
  if (!targetsAnchor && !targetsCurrentDisplay) {
    return refuse("non_anchor_view", REFUSAL_COPY.nonAuthoritativeHeadshot);
  }

  // ── Mixed requests, ratified precedence (§6.2 / review finding 6): every
  // REFUSED-identity outcome was handled above; a surviving presentation
  // component now refuses-and-routes the WHOLE request before any allowed
  // identity work runs. An image-only component rides along with an allowed
  // identity edit (allowed identity outranks image-only).
  if (classification.presentationAlso.length > 0) {
    return refuse("presentation", REFUSAL_COPY.presentationRouting);
  }

  // ── Normalization (§8.6 steps 2–4) ────────────────────────────────────────
  let normalized: NormalizerParseResult;
  try {
    normalized = parseNormalizerResponse(
      await llm.normalize({
        feedback,
        leaves: supported,
        referenceImageBase64: input.referenceImageBase64,
      }),
      supported,
    );
  } catch (error) {
    log.warn({ err: error }, "[editAuthority] normalizer unavailable — failing closed (R2)");
    return refuse("classifier_unavailable", REFUSAL_COPY.classifierUnavailable, true);
  }
  if (!normalized.ok) {
    return refuse("normalization_failed", REFUSAL_COPY.normalizationFailed, true);
  }

  // Founder final hair ruling (final corrections): the committed hair-length
  // value is the band the USER named, derived deterministically from their
  // own words — never the normalizer's invention. Explicit Long stays Long,
  // explicit Very Long stays Very Long, below-shoulder/chest/mid-back wording
  // maps to Long, waist/hip/tailbone wording maps to Very Long. Wording that
  // names no single band (vague comparatives, conflicting terms) fails closed
  // and free — no justified durable value exists.
  const committedEdits = normalized.edits.map((edit) => {
    if (edit.kind !== "leaf" || edit.leaf !== "person.hair.length") return edit;
    const band = requestedHairLengthBand(feedback);
    if (band === null) return null;
    return { ...edit, value: band } as AuthorizedIdentityEdit;
  });
  if (committedEdits.some((e) => e === null)) {
    return refuse("hair_length_vague", REFUSAL_COPY.hairLengthVague);
  }

  const patch: AuthorizedIdentityPatch = {
    edits: committedEdits as AuthorizedIdentityEdit[],
    source: referenceAttached ? "reference" : "text",
  };

  // §8.4 — prompt directives come from each field's handler, never the raw sentence
  const promptDirectives = patch.edits.flatMap((edit) => {
    if (edit.kind !== "leaf") return [];
    return leafDirectives(edit);
  }).concat(dependentPromptDirectives(patch));

  const authorization: GenerationAuthorization = {
    modelId: model.id,
    viewType: "frontClose",
    class: "identity",
    identityPatch: patch,
    referenceAssisted: referenceAttached,
    anchorEligible: true,
    stalesSiblings: true,
    promptDirectives,
  };
  return { refused: false, authorization };
}

function leafDirectives(edit: Extract<AuthorizedIdentityEdit, { kind: "leaf" }>): string[] {
  // The switch preserves the exact leaf↔value pairing for the generic handler
  const field = edit.leaf as AuthorizableIdentityField;
  const handler = handlerFor(field);
  return (handler.promptDirectives as (v: unknown) => string[])(edit.value);
}
