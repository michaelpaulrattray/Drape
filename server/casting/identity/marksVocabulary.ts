/**
 * marksVocabulary — the ONE shared, categorized permanent-marks vocabulary
 * (IDENTITY_EDIT_INTERIM_POLICY §6.4, Batch C).
 *
 * Before Batch C two detectors disagreed: the classifier's broad MARK_PATTERN
 * (editClassifier) versus the ink-only `hasBodyArt` (geminiPrompts) that
 * selected the tattoo prompt rule — so a freckled document could receive the
 * CLEAN_SKIN rule and be erased. This module is now consumed by:
 *   - the deterministic classification stage (editAuthority),
 *   - three-state prompt-rule selection (§13.10 — geminiPrompts),
 *   - the compaction protected-language guard (§13.4),
 *   - creation-intake validation (§10 — creationIntake).
 *
 * Word-boundary matched so "scarf" / "molecular" / "branding iron" prose and
 * "inking a deal" don't false-positive.
 */
import type { MarkCategory, MarkOperation } from "./identityTypes";

/** Per-category detection patterns. `ink` intentionally matches the same
 *  family the legacy hasBodyArt matched (plus obvious spellings) so the
 *  persistence rule never regresses on existing documents. */
export const MARK_VOCABULARY: Record<MarkCategory, RegExp> = {
  "mark.ink":
    /\b(tattoo(?:s|ed)?|tatt|ink(?:ed)?|body\s*art|body\s*branding|brand\s*mark|wax\s*seal|calligraphy\s*tattoo)\b/i,
  "mark.scar":
    /\b(scar(?:s|red)?|scar\s*tissue|scarification)\b/i,
  "mark.pigmentation":
    /\b(birthmark(?:s)?|mole(?:s)?|freckle(?:s|d)?|beauty\s*(?:mark|spot)(?:s)?|age\s*spot(?:s)?|liver\s*spot(?:s)?|port[-\s]wine\s*stain(?:s)?|vitiligo|pigmentation\s*mark(?:s)?|hyperpigmentation)\b/i,
  "mark.piercing":
    /\b(piercing(?:s)?|pierced|ear\s*gauge(?:s)?|septum\s*ring|nose\s*ring|nose\s*stud)\b/i,
  "mark.structural":
    /\b(stretch\s*mark(?:s)?|gap\s*(?:tooth|teeth)|tooth\s*gap|missing\s*(?:tooth|teeth|finger)|cleft\s*lip)\b/i,
};

export const MARK_CATEGORIES = Object.keys(MARK_VOCABULARY) as MarkCategory[];

/** Every mark category the text names. */
export function detectMarkCategories(text: string): MarkCategory[] {
  return MARK_CATEGORIES.filter((c) => MARK_VOCABULARY[c].test(text));
}

export function namesAnyMark(text: string): boolean {
  return MARK_CATEGORIES.some((c) => MARK_VOCABULARY[c].test(text));
}

export function namesInk(text: string): boolean {
  return MARK_VOCABULARY["mark.ink"].test(text);
}

/** Coarse operation detection (refusal copy only — every operation refuses
 *  during R6, §8.1). */
export function detectMarkOperation(text: string): MarkOperation {
  if (/\b(remove|erase|delete|get\s+rid\s+of|clear|without|clean\s+off)\b/i.test(text)) return "remove";
  if (/\b(add|give|put|place|draw|new)\b/i.test(text)) return "add";
  return "modify";
}

/** Three-state prompt-rule selection (§13.10, R6-ratified):
 *  - ink        ⇒ the tattoo-persistence rule;
 *  - non-ink mark ⇒ NEITHER rule (no persistence promise, and never the
 *    clean-skin rule or the piercings NO-list that would erase the mark);
 *  - mark-free  ⇒ the clean-skin rule.
 */
export type MarkPromptState = "ink" | "nonInkMark" | "markFree";

export function markPromptStateFor(documentText: string): MarkPromptState {
  if (namesInk(documentText)) return "ink";
  if (namesAnyMark(documentText)) return "nonInkMark";
  return "markFree";
}

/** Compaction protected-language guard (§13.4): every mark category present
 *  in the original document must still be represented in the rewritten text —
 *  else the rewrite is rejected and the raw text kept. Category-level
 *  presence is the semantic protection; byte-identical text trivially passes. */
export function protectedMarkLanguageIntact(original: string, rewritten: string): boolean {
  return detectMarkCategories(original).every((c) => MARK_VOCABULARY[c].test(rewritten));
}
