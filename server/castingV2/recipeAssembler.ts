/**
 * THE RECIPE ASSEMBLER — where D-244, the Edit Law, lives in code.
 *
 * The founder's ruling (2026-08-10, *"this isn't Photoshop"*): **words change,
 * crops carry.** Every edit REGENERATES its feature from that feature's ANCHOR
 * plus its FULL word stack; a feature's own carry crop NEVER rides in its own
 * edit; a feature nobody touched rides its minted crop, pixel-frozen; removal
 * is striking the words and regenerating from the anchor with what survives.
 *
 * This module turns a cast's reference library plus a set of asks into the
 * exact list of references and word stacks one render sends. It is the single
 * place those decisions are made, so there is no second list to drift from it
 * (working law 4).
 *
 * # It REFUSES rather than repairs
 *
 * Every refusal is a `RecipeRefusal` the caller can act on rather than an
 * exception to be swallowed:
 *
 *  - **`carriesItsOwnEdit`** — D-244 line 2. A recipe that hands a feature its
 *    own crop while editing it is the contaminated mint, and the whole law
 *    exists to make it unreachable. Refused structurally, not avoided by
 *    convention.
 *  - **`slotTwiceReferenced`** — fable-174 (founder): one slot, one reference,
 *    per render. Two references claiming one feature are conflicting
 *    instructions, and the assembler makes them impossible to express.
 *  - **`emptyWordStack`** — the one thing D-244 leaves load-bearing. Line 2
 *    regenerates from the FULL stack, so a lost or empty delta is a silently
 *    forgotten edit; an ask that carries no words for a slot with no anchor
 *    would regenerate the feature from the master with nothing said about it,
 *    which is a quiet revert dressed as an edit.
 *  - **`surfaceCarriesCrop`** — the carry contract below. A surface that holds
 *    a minted crop is a slot built against the one tier that has no working
 *    instrument to catch it, so it is refused at construction instead.
 *  - **`nounNotBare`** and **`slotNotNamed`** — the prompt is built here, so
 *    the grammar it needs is checked here. A feature the render cannot name is
 *    a feature it cannot ask about, and a determiner that arrived with a noun
 *    queues behind the one the template supplies.
 *
 * # THE CARRY CONTRACT, PER TIER (fable-192, measured — not precautionary)
 *
 * The count bisect and the configuration diff measured what a reference crop can
 * do to a master that disagrees with it, and the answer is graded (§3.0a):
 *
 *   introduced ITEM     the crop is the carrier            proven outright
 *   ANATOMY             the crop rides AND the word stack rides in EVERY
 *                       recipe — words are the carrier of record, the crop is
 *                       an assist worth about a third of its own value
 *   SURFACE             words only, always. No crop ever rides for a surface,
 *                       and there is currently no instrument that can certify
 *                       one if it did.
 *
 * *"Measurable is not delivered."* A crop that wins a third of the distance is
 * not what a customer would call *"she has those lips"*, so crop strength alone
 * never backs a carry promise for anatomy. That is why anatomy's words ride even
 * on renders that do not touch it, and why this is behavior here rather than
 * advice in a document.
 *
 * # The reference ORDINALS and the prompt sentences are derived together
 *
 * "Reference 2 is her lips" is only true if the lips crop is the second element
 * of the array actually sent. Those two have to be built in one pass or they
 * drift — the class this codebase keeps meeting. So the assembler emits both,
 * from one loop, and nothing downstream is permitted to reorder the references
 * without rebuilding the sentences.
 *
 * # The degenerate case is not an edge case
 *
 * A cast with no library and a words-only ask assembles to **the master alone,
 * plus words**. That is the road every NEW cast travels first (fable-171's
 * condition 1), and it falls out of the same code path rather than being
 * special-cased — a second path for the common case is how a fork hides
 * defects.
 *
 * Nothing calls this yet. It lands dark by having no call site, which is the
 * only kind of dark a pure function needs.
 */

import type { CastPronouns } from "./castPronouns";
import { IMPERATIVE_OPENER } from "./declarativeState";

/** A library key is a PANEL SLOT — the stylist's ontology, never `facet@region`
 *  (fable-173). Bilateral features are stored per instance and spoken as pairs
 *  (fable-167): `eye@left`, `earring@right`. */
export type FeatureSlot = string;

export type ReferenceImage = {
  /** Storage key or equivalent handle. The assembler never reads bytes. */
  key: string;
  /** For the record and for byte-identity proofs at the wire. */
  sha?: string;
};

export type ReferenceRole =
  | { kind: "master" }
  /** An introduced item's FROZEN INTRODUCTION REFERENCE (D-192/D-244 line 3):
   *  a tattoo's flash sheet, a makeup look's source image, a lip shape's source
   *  image. Pixel-stable forever; it is what the item's edits regenerate from. */
  | { kind: "anchor"; slot: FeatureSlot }
  /** The crop minted from the last delivery that touched this slot (line 4).
   *  Rides untouched renders byte-identical; never its own slot's edit. */
  | { kind: "carry"; slot: FeatureSlot };

/**
 * Which carrier the tier boundary gives this feature (§3.0a, fable-192).
 *
 * It is REQUIRED on every entry and has no default. A defaulted tier is the
 * unowned-axis class: every entry would silently fall to whichever value the
 * author happened to type first, identically, and nothing downstream would
 * show it.
 */
export type FeatureTier =
  /** Introduced and worn: an earring, a tattoo, her own glasses. Crop carries. */
  | "item"
  /** Geometry the master owns: lips, eyes, brows, hair, the shape of her face.
   *  Crop rides AND the words ride, every render. */
  | "anatomy"
  /** Worn state on a slot: gloss, a tan, a makeup look. Words only, always. */
  | "surface";

export type LibraryEntry = {
  slot: FeatureSlot;
  /** The carrier this feature gets. See {@link FeatureTier}. */
  tier: FeatureTier;
  /**
   * Present only for INTRODUCED features. Anatomy and surfaces have no anchor
   * entry: their anchor is the master, and the master is always reference 1.
   * Born-worn accessories (her own glasses) are in the master too, so they are
   * anatomy for this purpose (D-244 line 3).
   */
  anchor?: ReferenceImage;
  /** Minted from the frame that last delivered this slot. Absent until one has. */
  carry?: ReferenceImage;
  /** Every word ever accepted about this slot, oldest first. The full stack. */
  words: readonly string[];
  /**
   * How the slot is spoken about — the stylist's wording, not the engineer's key.
   *
   * **Always bare, and plain**: `"lips"`, `"hair"`, `"left eye"`, `"left
   * earring"`. The NOUN names the slot; the DESCRIPTION rider carries the
   * specifics, so "the exact left earring she has — a wide gold hoop, unchanged"
   * says each thing once. Every template below supplies its own determiner — "the exact
   * ${noun}", "keep ${possessive} ${noun}" — and a determiner that arrived with
   * the noun would queue behind them ("the exact the wide gold hoop"). A part of
   * her takes the possessive; a worn item takes an article. That is the
   * worn-versus-hers distinction `segmentsOnFace` already draws, one layer up.
   */
  noun: string;
  /**
   * THIS SLOT IS EMPTY — she took the thing off, and the anchor still wears it.
   *
   * The library's third role, read (migration 0030, fable-326/327). Its `words`
   * are the site's own vacant phrase, and they must be said on EVERY subsequent
   * render rather than once: the master is reference 1 of every render on this
   * road and it has her glasses on it forever, so a recipe that goes quiet about
   * them is a recipe that paints them back. Proved with pictures before this
   * field existed — remove, then ask for copper hair, and the glasses return.
   *
   * It travels as a flag rather than as "an entry with no images" because the
   * two are not the same thing: an anatomy slot nothing has delivered yet also
   * has no images, and it is not empty — it is undescribed.
   */
  vacant?: true;
};

export type Ask = {
  slot: FeatureSlot;
  /** Needed only for a slot the library has never held — a feature the render
   *  cannot name is a feature it cannot ask about. */
  noun?: string;
  /** The DELTA — what this render adds. Empty only when `remove` is set. */
  words?: string;
  /**
   * Removal is not a rollback: it strikes matching words from the stack and
   * regenerates from the anchor with what survives (D-244 line 5). Each entry
   * must match a word already in the slot's stack.
   */
  remove?: readonly string[];
  /**
   * THE SLOT GOES VACANT for this render (chunk 3,
   * `LIBRARY_REMOVAL_DESIGN.md` §3).
   *
   * Neither asked nor carried: an empty word stack, no crop (the carry loop
   * already skips edited slots), and no anchor — sending the frozen
   * introduction reference of the thing being taken off would hand the painter
   * a picture of it.
   *
   * **The sentence is required, and that is the whole point.** Dropping the
   * words and the crop leaves the recipe SILENT about the feature, and the
   * master is reference 1 — so a born-worn item (her own glasses, in the master
   * by definition) gets painted straight back on by the render that was meant
   * to remove it. Carrying the sentence in the type rather than checking for it
   * at runtime is deliberate: a vacate that cannot say the absence should not
   * be constructible, because the corner where one exists is a paid render that
   * quietly does nothing.
   *
   * `says` is DERIVED by the caller from the slot catalogue
   * (`vacantPhraseFor`), never authored per ask — fable-195's rule about
   * descriptions, and the same reason: a sentence generated from the record has
   * nowhere to diverge to. The assembler cannot reach the catalogue itself
   * (the catalogue imports this module's types), so the derivation belongs one
   * layer out, exactly as `accessoryKind` already does.
   */
  vacate?: { says: string };
};

export type AssembleInput = {
  master: ReferenceImage;
  /** The cast's own pronouns, never assumed. `segmentsOnFace` shipped "hers"
   *  onto a male candidate's face before this was passed rather than guessed. */
  pronouns: CastPronouns;
  /** The cast's reference library. An empty library is the degenerate case. */
  library: readonly LibraryEntry[];
  asks: readonly Ask[];
};

export type RecipeReference = {
  role: ReferenceRole;
  image: ReferenceImage;
  /** The sentence naming this reference by the ordinal it actually occupies.
   *  The master's is the identity clause, and it is reference 1. */
  sentence: string;
};

/**
 * A feature nobody touched this render, whose words ride anyway.
 *
 * Anatomy and surfaces both get one: for anatomy the sentence rides BESIDE the
 * carried crop (words are the carrier of record, the crop is the assist); for a
 * surface it is the only thing that rides at all.
 */
export type StandingWords = {
  slot: FeatureSlot;
  noun: string;
  words: readonly string[];
  sentence: string;
};

export type Recipe = {
  ok: true;
  /** In send order. Element 0 is always the master. */
  references: readonly RecipeReference[];
  /** The slots this render edits — the DELIVERED column of verification. */
  edited: readonly FeatureSlot[];
  /** Every slot this render promises to hold — the CARRIED column. An item or
   *  anatomy slot carries by crop, a surface by words alone; all three are
   *  promises, so all three are verified. */
  carried: readonly FeatureSlot[];
  /**
   * The slots this render declared VACANT — a subset of `edited`.
   *
   * The mint's only licence to retire a crop. A departure is carried by this
   * list and never by the reader's silence: `noCut` on an untouched slot has at
   * least three causes with no departure among them, and a library that retired
   * on that signal would delete her earrings because a render came out shadowy
   * (`LIBRARY_REMOVAL_DESIGN.md` §4).
   */
  vacated: readonly FeatureSlot[];
  /** Per edited slot, the full word stack that regenerates it. A vacated slot
   *  appears here holding nothing — present and empty, never absent. */
  wordStacks: ReadonlyMap<FeatureSlot, readonly string[]>;
  /** The reference sentences, in ordinal order, ready to join with the ask. */
  sentences: readonly string[];
  /** The carry contract's word half, in library order — anatomy and surfaces
   *  that this render does not touch but must still say out loud. */
  standing: readonly StandingWords[];
  /** The change instruction, in the proven small-ask frame. Empty when nothing
   *  is asked (a pure carry render). */
  ask: string;
  /**
   * THE WHOLE PROMPT, in send order, and the only text a caller sends.
   *
   * It is built here so that "reference 3 is her hair" is true of the array
   * that actually goes out. A caller that composed its own prose from the parts
   * would be the second list this codebase keeps meeting — right until someone
   * reorders the references and nobody notices, because the drift is invisible
   * in every output except the picture.
   */
  prompt: string;
};

export type RecipeRefusal = {
  ok: false;
  reason:
    | "carriesItsOwnEdit"
    | "slotTwiceReferenced"
    | "emptyWordStack"
    | "removeNotInStack"
    | "surfaceCarriesCrop"
    | "nounNotBare"
    | "slotNotNamed"
    | "wordsNotDeclarative"
    /** A vacate carrying words as well — see `Ask.vacate`. */
    | "vacateAlsoAsks"
    /** A vacate whose sentence is empty; the recipe would go silent. */
    | "vacateSaysNothing";
  slot: FeatureSlot;
  detail: string;
};

export type AssembleResult = Recipe | RecipeRefusal;

/** A possessive replaces an article; it never queues behind one. */
const LEADING_DETERMINER = /^(?:a|an|the|her|his|their|its)\s+/i;

/**
 * THE DECLARATIVE-STATE CONTRACT (fable-195), and it is a contract with our own
 * interpreter rather than a detector judging a picture.
 *
 * The marker and its reasoning now live in `declarativeState`, imported rather
 * than restated: the interpreter's prompt names the same openers to the model
 * that this refuses on the way in, and two copies of that list would drift the
 * day one of them grew a word (working law 4). This module keeps the REFUSAL;
 * that one keeps the rule.
 */

/**
 * THE ASK, kept small on purpose.
 *
 * The bisect stripped the carrying recipe to two references and it still
 * carried, so what survived of the bundle is the naming form and **the size of
 * the ask** — name each reference for what it is, and do not ask for a region
 * redraw in the same breath (§3.0a, fable-192). Building the sentence here is
 * what makes that behavior rather than advice: a caller cannot paste a
 * paragraph into a frame it does not own.
 *
 * The clause states the feature's WHOLE target state — the full word stack, not
 * the delta alone — because that is what D-244 line 2 regenerates from.
 */
function askSentence(
  asks: readonly Ask[],
  bySlot: ReadonlyMap<FeatureSlot, LibraryEntry>,
  wordStacks: ReadonlyMap<FeatureSlot, readonly string[]>,
  possessive: string,
): string | { unnamed: FeatureSlot } {
  const clauses: string[] = [];
  for (const ask of asks) {
    if (ask.vacate) {
      /*
        THE ABSENCE IS SAID IN THE SAME BREATH AS EVERY OTHER CHANGE.

        It rides the "Change only …" sentence rather than getting a sentence of
        its own, because a removal IS one of this render's changes and a second
        sentence about it would be a second instruction about one feature — the
        thing this assembler refuses everywhere else. The phrase names the SITE
        as well as the absence ("bare earlobes", "her face uncovered"), which is
        the same lesson `HAIR_ARRANGEMENTS` paid for: a wording that tells the
        reader WHERE beats one that tells it what to conclude.
      */
      clauses.push(ask.vacate.says);
      continue;
    }
    const entry = bySlot.get(ask.slot);
    const noun = entry?.noun ?? ask.noun;
    if (noun === undefined || noun.trim() === "") return { unnamed: ask.slot };
    /* A worn item takes an article; a part of her takes the possessive
       (`segmentsOnFace`'s worn-vs-hers distinction, one layer up, and the same
       reason: a stylist speaks about a thing, and about her). */
    const named = entry?.tier === "item" ? `the ${noun}` : `${possessive} ${noun}`;
    clauses.push(`${named}: ${(wordStacks.get(ask.slot) ?? []).join(", ")}`);
  }
  if (clauses.length === 0) return "";
  return `Change only ${clauses.join("; ")}.`;
}

/**
 * THE DESCRIPTION RIDER (fable-194, founder-confirmed): every reference is NAMED
 * for what it is, optionally followed by a SHORT DESCRIPTION that strengthens it.
 *
 * **Derived from the slot's own record at emission, never authored beside it**
 * (fable-195). That is what keeps it from becoming the thing this assembler
 * refuses elsewhere — two instructions about one feature. A description
 * generated from the entry's own accepted words cannot diverge from them,
 * because there is nowhere for it to diverge to.
 *
 * It also settles where anatomy's word half rides. fable-192 requires the word
 * stack in EVERY recipe; a slot with a reference now carries its words on that
 * reference's own sentence, and a slot without one gets a standing sentence.
 * Said once, attached to the thing it is about.
 */
function describe(entry: LibraryEntry): string {
  return entry.words.length === 0
    ? `the same ${entry.noun}, unchanged`
    : `${entry.words.join(", ")}, unchanged`;
}

/**
 * The word stack a slot regenerates from on THIS render.
 *
 * Removal strikes; a delta appends. Both leave one ordered list, and that list
 * is the whole instruction for the feature — the anchor supplies the pixels it
 * started from and nothing else does.
 */
function stackFor(entry: LibraryEntry | undefined, ask: Ask): readonly string[] | { missing: string } {
  const existing = entry?.words ?? [];
  let survived = [...existing];
  for (const strike of ask.remove ?? []) {
    const at = survived.indexOf(strike);
    if (at === -1) return { missing: strike };
    survived.splice(at, 1);
  }
  if (ask.words !== undefined && ask.words.trim() !== "") survived.push(ask.words.trim());
  return survived;
}

/**
 * THE IDENTITY CLAUSE — reference 1, named the way the carrying recipe named it.
 *
 * The pronoun tracks the cast rather than the specimen the form was measured on
 * (`segmentsOnFace` paid for that lesson: a male candidate's eyes called "hers"
 * in front of his own face). The FORM is what carried; the pronoun never was
 * part of it.
 */
function identityClause(pronouns: CastPronouns): string {
  return [
    `Reference 1 is the photograph of this person — reproduce ${pronouns.object} exactly:`,
    "same face, same pose, same lighting, same framing, same background.",
  ].join(" ");
}

export function assembleRecipe(input: AssembleInput): AssembleResult {
  const bySlot = new Map(input.library.map((entry) => [entry.slot, entry]));
  const edited = input.asks.map((ask) => ask.slot);
  const editedSet = new Set(edited);
  const pronouns = input.pronouns;
  const possessive = pronouns.possessive;
  const has = pronouns.plural ? "have" : "has";

  const identity = identityClause(pronouns);
  const references: RecipeReference[] = [
    { role: { kind: "master" }, image: input.master, sentence: identity },
  ];
  const wordStacks = new Map<FeatureSlot, readonly string[]>();
  const claimed = new Set<FeatureSlot>();
  const sentences: string[] = [identity];
  /** Which reference each carried slot ended up at, so a standing sentence can
   *  point at it by the ordinal it actually occupies. */
  const ordinalOf = new Map<FeatureSlot, number>();
  /** The slots this render declared vacant, in ask order. The mint reads this
   *  to decide what may be retired, and NOTHING else may originate a departure
   *  (`LIBRARY_REMOVAL_DESIGN.md` §4). */
  const vacated: FeatureSlot[] = [];

  /** Ordinal in the sent array: the master is 1, so the next is length + 1. */
  const nextOrdinal = () => references.length + 1;

  for (const entry of input.library) {
    const imperative = entry.words.find((word) => IMPERATIVE_OPENER.test(word.trim()));
    if (imperative !== undefined) {
      return {
        ok: false, reason: "wordsNotDeclarative", slot: entry.slot,
        detail: `${entry.slot} holds "${imperative}", which is an instruction rather than a state; the stack is re-said in full on every edit and imperatives do not accumulate`,
      };
    }
    if (LEADING_DETERMINER.test(entry.noun)) {
      /*
        The templates below supply the possessive, and a possessive REPLACES an
        article rather than queueing behind it — "her a mullet" and "her the
        lips" were both live in real data before `segmentsOnFace` fixed the same
        grammar one layer up. A worn ITEM names itself and keeps its article.
      */
      return {
        ok: false, reason: "nounNotBare", slot: entry.slot,
        detail: `${entry.slot}'s noun "${entry.noun}" starts with a determiner; recipe nouns are bare and every template supplies its own`,
      };
    }
  }

  /* ---- the EDITED slots: anchor + full word stack, never their own crop ---- */

  for (const ask of input.asks) {
    const entry = bySlot.get(ask.slot);
    if (ask.vacate) {
      /*
        A VACATE IS THE WHOLE ASK FOR ITS SLOT, and the two refusals below say
        so rather than letting a half-formed one through.

        Words beside a vacate would be a render told to remove the earrings and
        describe them in the same clause; an empty sentence would leave the slot
        silent, which is the exact failure the sentence exists to prevent — the
        master is reference 1 and silence is an instruction to keep what is in
        it.
      */
      if (ask.words !== undefined && ask.words.trim() !== "") {
        return {
          ok: false, reason: "vacateAlsoAsks", slot: ask.slot,
          detail: `${ask.slot} is being vacated and also given words ("${ask.words}"); a slot cannot be taken off and described in one render`,
        };
      }
      if (ask.vacate.says.trim() === "") {
        return {
          ok: false, reason: "vacateSaysNothing", slot: ask.slot,
          detail: `${ask.slot} is being vacated with no sentence, so the recipe would go silent about it and the master would paint it back on`,
        };
      }
      /* Empty by construction, and RECORDED: `wordStacks` is what the record
         and the panel read, so a vacated slot must appear there holding
         nothing rather than be absent from it. */
      wordStacks.set(ask.slot, []);
      vacated.push(ask.slot);
      /* No anchor, deliberately — see `Ask.vacate`. The carry loop below skips
         it too, because a vacate puts the slot in `editedSet`. */
      continue;
    }
    if (ask.words !== undefined && IMPERATIVE_OPENER.test(ask.words.trim())) {
      /* The interpreter's own output, checked at the boundary it crosses. */
      return {
        ok: false, reason: "wordsNotDeclarative", slot: ask.slot,
        detail: `the ask for ${ask.slot} reads "${ask.words}", which is an instruction; the interpreter owes a state phrase`,
      };
    }
    const stack = stackFor(entry, ask);
    if ("missing" in stack) {
      return {
        ok: false, reason: "removeNotInStack", slot: ask.slot,
        detail: `"${stack.missing}" is not in ${ask.slot}'s word stack, so striking it would change nothing`,
      };
    }
    if (stack.length === 0 && !entry?.anchor) {
      /*
        Nothing to say and nothing introduced: regenerating from the master with
        an empty stack repaints the feature as she was born, which is a revert
        wearing an edit's clothes. The caller must mean a removal of the whole
        introduced thing, and that is a different ask.
      */
      return {
        ok: false, reason: "emptyWordStack", slot: ask.slot,
        detail: `${ask.slot} would regenerate from the master with nothing said about it`,
      };
    }
    wordStacks.set(ask.slot, stack);

    if (!entry?.anchor) continue; /* anatomy — the master is already reference 1 */
    if (claimed.has(ask.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: ask.slot,
        detail: `${ask.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(ask.slot);
    ordinalOf.set(ask.slot, nextOrdinal());
    sentences.push(
      `Reference ${nextOrdinal()} is the exact ${entry.noun} as it was introduced — the same ${entry.noun}.`,
    );
    references.push({
      role: { kind: "anchor", slot: ask.slot },
      image: entry.anchor,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the CARRIED slots: the minted crop, pixel-frozen ---- */

  for (const entry of input.library) {
    if (entry.carry && entry.tier === "surface") {
      /*
        A surface's carrier is words, always — that tier's crop was never proven
        to carry and there is currently no instrument that could certify one if
        it were. A minted surface crop means something upstream built a slot
        against the tier boundary, and it is refused here rather than sent.
        Checked before the edited/untouched split, because the defect is that the
        crop EXISTS, not that this particular render would have sent it.
      */
      return {
        ok: false, reason: "surfaceCarriesCrop", slot: entry.slot,
        detail: `${entry.slot} is a surface and is carried by words only; a minted crop must not ride for it`,
      };
    }

    if (!entry.carry) continue;
    if (editedSet.has(entry.slot)) {
      /*
        D-244 line 2, refused structurally. Reaching this branch means a caller
        built an edit that would hand a feature its own crop — the defect the
        law makes unreachable — so nothing is assembled and nothing is painted.
      */
      return {
        ok: false, reason: "carriesItsOwnEdit", slot: entry.slot,
        detail: `${entry.slot} is edited by this render and cannot also carry its own minted crop`,
      };
    }
    if (claimed.has(entry.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: entry.slot,
        detail: `${entry.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(entry.slot);
    ordinalOf.set(entry.slot, nextOrdinal());
    /*
      THE PROVEN NAMING FORM. "Reference N is the exact X ${subject} ${has}" is
      the wording the carrying recipe used, and the bisect held it fixed while
      it stripped everything else away — count and position fell, naming and ask
      size are what survived (§3.0a). So it is emitted here rather than left to
      each caller's prose.
    */
    sentences.push(
      `Reference ${nextOrdinal()} is the exact ${entry.noun} ${pronouns.subject} ${has} — ${describe(entry)}.`,
    );
    references.push({
      role: { kind: "carry", slot: entry.slot },
      image: entry.carry,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the carry contract's WORD half: what rides without being edited ---- */

  const standing: StandingWords[] = [];
  for (const entry of input.library) {
    if (editedSet.has(entry.slot)) continue;
    /*
      AN EMPTY SLOT SAYS SO, WHATEVER TIER IT IS.

      Before the two `continue`s below rather than after them, because both would
      throw a vacancy away: an ITEM is skipped here (its crop carries it) and a
      vacancy is precisely an item with no crop to carry it. Skipping it leaves
      the recipe silent about a thing the master is still wearing, which is the
      one-frame removal in one line.

      The phrase is the same `vacantPhrase` the vacate ask says at edit time —
      one sentence, one source, said in the change clause on the render that
      removes it and standing on every render after. It is already a complete
      state sentence naming the site ("no glasses — her face uncovered …"), so it
      is emitted as itself rather than poured into the "Keep her X exactly"
      template, which would produce *"Keep her glasses exactly: no glasses"*.
    */
    if (entry.vacant === true) {
      if (entry.words.length === 0) continue;
      standing.push({
        slot: entry.slot,
        noun: entry.noun,
        words: entry.words,
        sentence: `${entry.words.join(", ")}.`,
      });
      continue;
    }
    /*
      fable-192, measured rather than precautionary. A surface has no other
      carrier at all; anatomy's crop wins about a third of the distance against
      a master that disagrees with it, so the words ride BESIDE the crop rather
      than being replaced by it. An ITEM's crop carried outright, and describing
      it again would put a word stack and a reference in competition over one
      feature.
    */
    if (entry.words.length === 0) continue;
    /*
      A slot that sent a reference has already said its words, on that
      reference's own sentence. This list is what must stand ALONE: a surface,
      which never sends a crop at all, and an anatomy slot nothing has delivered
      yet. Saying it twice in one prompt is not emphasis, it is two instructions.
    */
    if (ordinalOf.has(entry.slot)) continue;
    if (entry.tier === "item") continue;
    standing.push({
      slot: entry.slot,
      noun: entry.noun,
      words: entry.words,
      /* Imperative, so one form serves a plural noun and a singular one alike —
         "her lips remains" and "her hair remain" are both wrong, and a template
         that can produce either is a template that will. */
      sentence: `Keep ${possessive} ${entry.noun} exactly: ${entry.words.join(", ")}.`,
    });
  }

  /*
    CARRIED is derived from the library in one filter rather than accumulated in
    the two loops above — a second list built alongside a source of truth drifts
    from it (working law 4), and this one would have had to agree with both.
  */
  const carried = input.library
    .filter((entry) => !editedSet.has(entry.slot))
    .filter((entry) => entry.carry !== undefined || (entry.tier !== "item" && entry.words.length > 0))
    .map((entry) => entry.slot);

  const ask = askSentence(input.asks, bySlot, wordStacks, possessive);
  if (typeof ask !== "string") {
    return {
      ok: false, reason: "slotNotNamed", slot: ask.unnamed,
      detail: `${ask.unnamed} has no library entry and the ask carries no noun, so the render cannot say what it is changing`,
    };
  }

  return {
    ok: true, references, edited, carried, vacated, wordStacks, sentences, standing, ask,
    prompt: [...sentences, ...standing.map((entry) => entry.sentence), ask]
      .filter((line) => line !== "")
      .join(" "),
  };
}
