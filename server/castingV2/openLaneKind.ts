/**
 * THE OPEN LANE'S KEY — naming a thing the catalogue has never heard of
 * (OPEN_LANE_DESIGN_NOTE §1 and §8 steps 0–1).
 *
 * # What this is, and the one empirical question it rests on
 *
 * The closed lane's whole architecture rests on a sentence in
 * `refineSubjects.ts`: *"the tempting shape is a model-authored `{ axis, text }`
 * and it is wrong — it hands the composition key to the model."* An open lane
 * hands the composition key to the model. That is not a side effect of it; it
 * IS it. So it rests on the question D-89 presupposed and nobody had measured:
 * **can a model produce the same noun twice for the same thing?**
 *
 * Driven before this module existed
 * (`scripts/probe-open-lane-normalization-disposable.mts` part B, 45 samples,
 * five concepts the catalogue has never heard of, each said three ways, bars
 * written down before the first call):
 *
 * ```
 * 1. WITHIN-SENTENCE   15/15 sentences gave one noun 3/3          PASS
 * 2. ACROSS-PARAPHRASE  4/5  concepts converged on ONE noun       PASS (bar ≥4)
 * 3. DISCRIMINATION     4 distinct keys, 5 concepts, 0 collisions PASS
 * ```
 *
 * **Bar 3 is the one to read first**, because without it bars 1 and 2 are the
 * signature of a normalizer answering one word to everything — perfectly stable
 * and perfectly useless. It held on the pair built to break it: `horns` and
 * `antlers` stayed distinct across nine samples each.
 *
 * # THE OPEN LANE IS A FALLBACK, NOT A PEER (§8 step 0)
 *
 * The one choice here that cannot be retrofitted. An open kind is reached only
 * when no closed subject claims the ask. Shipped as a peer, the lane silently
 * re-routes asks the product reads correctly today and *"give her wings"* stops
 * being eyeliner. This module is therefore only ever consulted AFTER the closed
 * interpreter has declined — it does not decide routing, it names what is left.
 *
 * # AND EVERY KEY IS CHECKED AGAINST THE CLOSED VOCABULARY (§1)
 *
 * The probe's one non-convergence was systematic rather than noisy: when the
 * sentence makes the SITE its grammatical subject, the normalizer keys the
 * site. *"Her cheeks should be covered in scales"* returned `cheeks` 3/3 — and
 * `cheeks` is a hair's breadth from `cheekbones`, which the closed lane owns.
 * A kind that collides with a closed subject is a ROUTING BUG, not a new kind.
 *
 * Two answers, both cheap, both here:
 *
 *   1. the prompt is asked in a form that cannot name a site — the probe's rule
 *      *"the THING, never the change"* gains its sibling, *"the thing, never
 *      the place it goes"*;
 *   2. and the answer is checked against `SUBJECT_NOUNS` before it counts as
 *      new, which is the guard that makes the open lane structurally unable to
 *      shadow the closed one.
 *
 * The second is load-bearing and the first is not: a prompt rule is a request,
 * and this program does not let a request stand in for a control.
 *
 * # WHAT THIS MODULE DOES NOT DO
 *
 * It does not accept an ask, spend anything, or write a demand row. It answers
 * one question — *what is this ask about, and is that name already ours?* The
 * acceptance path (§2), the assembler (§3) and the mint door (§4) are separate
 * builds and are deliberately not started here.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { FREE_SUBJECT_KEYS, SUBJECT_NOUNS, type FreeSubject } from "./refineSubjects";

const log = createModuleLogger("openLaneKind");

/**
 * The normalizer's instruction, carried from the probe that measured it.
 *
 * Two rules are the probe's verbatim, because changing the prompt changes the
 * thing the three bars were measured on; the SITE rule is the one addition, and
 * it is the probe's own finding rather than an improvement anybody imagined.
 */
export const OPEN_KIND_SYSTEM = [
  "You name the ONE THING a photo-editing instruction is about, as a key.",
  "",
  "Reply with JSON only: {\"kind\": \"<noun>\"}",
  "",
  "RULES:",
  "  - a single lowercase noun, singular or plural as the thing naturally is",
  "  - the THING, never the change: \"make the horns bigger\" is \"horns\", not \"bigger\"",
  /* §1's measured failure, addressed where it happens. Not relied on. */
  "  - the THING, never the place it goes: \"her cheeks should be covered in",
  "    scales\" is \"scales\", not \"cheeks\"",
  "  - never an adjective, never a verb, never a sentence",
  "  - two instructions about the same thing MUST give the same key, whatever",
  "    words they use for it",
  "  - two instructions about DIFFERENT things must give different keys; never",
  "    reach for a general word like \"feature\" or \"detail\" to cover both",
].join("\n");

/**
 * One spelling of a noun, for comparison only.
 *
 * Lowercased, whitespace-collapsed, and a trailing `s` dropped on anything long
 * enough for that to be a plural rather than the word. Applied to BOTH sides,
 * so it never matters whether the table happens to list the singular: `cheeks`
 * and `cheek` fold together, and `gills` folds the same way on either side.
 *
 * Deliberately not a stemmer. A rule broad enough to catch the synonyms this
 * table misses would also swallow legitimate new kinds — the same bug pointed
 * the other way — and an open lane that quietly refuses novel asks fails
 * silently, which is the one failure mode this design cannot afford.
 */
export function foldNoun(word: string): string {
  const plain = word.trim().toLowerCase().replace(/\s+/g, " ");
  return plain.length > 3 && plain.endsWith("s") ? plain.slice(0, -1) : plain;
}

/** Every folded spelling the closed lane already owns, with its subject. */
const CLOSED_NOUNS: ReadonlyMap<string, FreeSubject> = (() => {
  const map = new Map<string, FreeSubject>();
  for (const subject of FREE_SUBJECT_KEYS) {
    for (const noun of SUBJECT_NOUNS[subject]) {
      const folded = foldNoun(noun);
      /* First writer wins, and a duplicate is a fault rather than a preference —
         `refineSubjects.test.ts` fails the build on one, so this branch is
         unreachable in a green tree and is here so it cannot become silent. */
      if (!map.has(folded)) map.set(folded, subject);
    }
  }
  return map;
})();

/**
 * The closed subject this noun already belongs to, or null if it is genuinely new.
 *
 * Exact after folding. Its limit is declared on `SUBJECT_NOUNS`: an unlisted
 * synonym reads as new, and §7's demand table is the instrument that surfaces
 * one rather than a cleverer matcher.
 */
export function closedSubjectFor(kind: string): FreeSubject | null {
  return CLOSED_NOUNS.get(foldNoun(kind)) ?? null;
}

/**
 * What reading an out-of-vocabulary sentence produced.
 *
 * `collides` is not a failure — it is the guard working, and the ask belongs in
 * the closed lane. `unreadable` is its own outcome rather than an exception
 * because §7 records it: how often the key cannot be made at all is a number
 * the promotion decision needs, and an exception is a number nobody counts.
 */
export type OpenKindReading =
  | { ok: true; kind: string }
  | { ok: false; reason: "collides"; kind: string; subject: FreeSubject }
  | { ok: false; reason: "unreadable" };

/** The reply shape, parsed defensively — a model's JSON is input, not a promise. */
function readKind(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const kind = (parsed as { kind?: unknown }).kind;
  if (typeof kind !== "string") return null;
  const plain = kind.trim().toLowerCase().replace(/\s+/g, " ");
  /*
    A KEY, NOT A SENTENCE. The bars were measured on single nouns; a reply that
    is a phrase has not obeyed the instruction the measurement was made under,
    and accepting it would key the lane on something nobody proved stable.
    Three words is generous for "the thing" and still refuses a description.
  */
  if (!plain || plain.length > 40 || plain.split(" ").length > 3) return null;
  if (!/^[a-z][a-z '-]*$/.test(plain)) return null;
  return plain;
}

/**
 * Name the thing an out-of-vocabulary ask is about.
 *
 * Consulted only after the closed lane has declined — see the header. It spends
 * one text call and never a credit, and it fails CLOSED: no engine, no key.
 */
export async function normalizeOpenKind(
  instruction: string,
  deps: { engine?: TextEngine | null; signal?: AbortSignal } = {},
): Promise<OpenKindReading> {
  const text = instruction.trim();
  if (!text) return { ok: false, reason: "unreadable" };
  if (!deps.engine) {
    /* Fail closed, exactly as the interpreter does: a lane that guessed its own
       key when the transport was down would file demand rows for a noun nobody
       produced. */
    log.warn({}, "[openLaneKind] no text engine — no key rather than a guess");
    return { ok: false, reason: "unreadable" };
  }

  let raw: string;
  try {
    const result = await deps.engine.complete({
      system: OPEN_KIND_SYSTEM,
      user: text,
      json: true,
      ...(deps.signal ? { signal: deps.signal } : {}),
    });
    /*
      A TRUNCATED REPLY IS NOT A NONSENSE REPLY, and the difference is worth a
      branch (the field's own header says so). A fragment of JSON fails the
      parse identically to gibberish, so without this the log for a ceiling we
      set reads as a model that cannot follow instructions — and the demand
      table would record it as `unreadable` demand rather than our own limit.
    */
    if (result.truncated) {
      log.warn({}, "[openLaneKind] the normalizer reply was truncated — our ceiling, not their sentence");
      return { ok: false, reason: "unreadable" };
    }
    raw = result.text ?? "";
  } catch (error) {
    log.warn({ err: error }, "[openLaneKind] the normalizer call failed — no key");
    return { ok: false, reason: "unreadable" };
  }

  const kind = readKind(raw);
  if (kind === null) return { ok: false, reason: "unreadable" };

  const subject = closedSubjectFor(kind);
  if (subject !== null) {
    /*
      NOT A NEW KIND — A ROUTING BUG, and it is logged as one. This is §1's
      measured `cheeks` arriving in production, and the reason it is worth a log
      line is that each occurrence names either a missing noun in `SUBJECT_NOUNS`
      or a real gap in the closed interpreter's routing.
    */
    log.info({ kind, subject }, "[openLaneKind] the open key names a subject the closed lane owns");
    return { ok: false, reason: "collides", kind, subject };
  }
  return { ok: true, kind };
}
