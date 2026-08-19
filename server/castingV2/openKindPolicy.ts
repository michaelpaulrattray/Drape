/**
 * WHAT AN UNPROMOTED OPEN KIND IS, IN EVERY TABLE THAT DECIDES ANYTHING —
 * the open-kind policy record (OPEN_LANE_DESIGN_NOTE §0 and §8 step 2, ordered
 * by fable-392 §5).
 *
 * # The one sentence this module exists for
 *
 * The note's §0 is not about vocabulary, it is about a KEY: every closed subject
 * is looked up in a stack of tables, most of them total over the closed set, and
 * *"a kind that is absent from all three is not undecided — it is decided,
 * invisibly, three times."* This campaign has a name for that shape and a price
 * on it: **an unowned axis falls silently to the loudest prior, identically on
 * every tile.** `subjectQualifiers.ts` is the same defect already paid for once —
 * three subjects of twenty-three armed, the rest falling through a default, and
 * the founder's own walk delivering 100% on the armed class and 33% on a bare
 * one.
 *
 * An open kind cannot be added to those tables: they are total over `FreeSubject`
 * and an open kind is by construction not one. So this is the one written place
 * that answers their questions for a kind nobody has catalogued — **derived
 * where the answer follows from what an open ask IS, stated with a reason where
 * it does not.** Not eighteen defaults in eighteen files.
 *
 * # THE NOTE SAID ELEVEN TABLES. THE CODE SAYS EIGHTEEN.
 *
 * The count was taken by hand on 2026-08-13 and was already stale when it was
 * written — `SUBJECT_NOUNS` landed the same day, and the note's list omits every
 * table that decides by OMISSION rather than by type. Counted by scanning the
 * source for declarations keyed on the closed vocabulary
 * (`openKindPolicy.test.ts` does it on every run, so this number cannot drift
 * the way that one did):
 *
 * ```
 * 8   total     Record<FreeSubject|Facet, …>   a new subject does not compile
 * 6   partial   Partial<Record<…>>             silence is the answer
 * 4   lists     readonly FreeSubject|Facet[]   membership is the answer
 * +1  FREE_SUBJECTS itself — the vocabulary, and the heading its prose is under
 * ```
 *
 * The hand count being wrong is exactly the argument for the scan: this file's
 * completeness is checked against the source, not against a list somebody kept.
 *
 * # NOTHING CALLS THESE ANSWERS YET, AND THAT IS DECLARED
 *
 * The acceptance path (§8 step 5) and the slotless `Ask` (step 4) are separate
 * builds. **The mint door's absence control (step 3) is BUILT** — an open kind
 * is cut, the same reader is asked its question of the frame the render was
 * painted from, and a crop mints only where that reader declined
 * (`referenceMint.ts`, `absenceRefusal`). So one of the answers below has moved
 * from `owed` to `policy` and the rest have not; the list is the record of
 * which.
 *
 * **And `FREE_SUBJECT_KIND` is now half-read, which is why it is still `owed`**
 * (2026-08-18, fable-911 §2): the verification net ASKS the presence question of
 * an open kind and records the answer, but `openKindPresenceBindsToday()` holds
 * the refusal back until the promotion condition beside it is met. A question
 * asked is not a policy honoured, and marking the entry `policy` on the strength
 * of the reader alone would say this lane refunds when it does not. This module is the DECISION, landed before the code that must honour
 * it, for the
 * same reason `openKind` landed in `mintedSlots` before anything could produce
 * it: the alternative is eighteen small choices made in a hurry inside a build
 * that is already large, each of them invisible.
 *
 * `standing: "owed"` marks every answer whose enforcement is one of those
 * builds; `owedByThePolicy()` returns them as a work list, and the step-4 build
 * is expected to shrink it rather than rediscover it.
 *
 * # The closed tables are NOT touched, and must not be
 *
 * `qualifierFor` THROWS for a kind with no entry — `"exempt" in undefined` — and
 * the note is explicit that this is the good version of the problem: an open kind
 * smuggled through without its answers crashes the render instead of degrading
 * quietly. Nothing here installs a default anywhere. An open kind's answers are
 * read from this module by code that knows it is holding an open kind, and every
 * closed table keeps failing loud for everyone else.
 */
import type { ChangeAmplitude } from "./changeAmplitude";
import type { UnfiledReason } from "./mintedSlots";
import { TEETH } from "./subjectQualifiers";
import type { ZoneScope } from "./zoneScope";

/**
 * Where an answer comes from.
 *
 * `derived` means the answer follows from what an open ask IS and there is no
 * judgement call to get wrong. `stated` means somebody decided, and the reason
 * is the entry — the distinction `changeAmplitude` draws between a measured and
 * a reasoned threshold, for the same reason: a decision wearing a derivation's
 * clothes survives being wrong.
 */
export type PolicyBasis =
  | { readonly derived: string }
  | { readonly stated: string };

/**
 * What is holding the answer up today.
 *
 * `policy`   this module returns the value and code may read it now.
 * `silence`  the table decides by omission and the omission IS the answer.
 * `owed`     the answer is decided; the code that must honour it is not built.
 */
export type PolicyStanding = "policy" | "silence" | "owed";

export type OpenKindAnswer = {
  /** The file the table lives in, so the reverse check can find the symbol. */
  readonly file: string;
  /** The question that table decides, in one line. */
  readonly asks: string;
  /** The open kind's answer, in the table's own vocabulary. */
  readonly answer: string;
  readonly basis: PolicyBasis;
  readonly standing: PolicyStanding;
};

/**
 * THE RECORD. Keyed by the table's own symbol, because that is what the source
 * scan finds and comparing anything else would be comparing nicknames.
 */
export const OPEN_KIND_POLICY: Record<string, OpenKindAnswer> = {
  /* ── the vocabulary itself ──────────────────────────────────────────────── */
  /* ── the free lane's per-subject caps (`refineDelta.ts`) ─────────────── */
  FREE_SUBJECT_MAX_LENGTH: {
    file: "refineDelta.ts",
    asks: "how long a value for this subject may be before the free lane refuses it",
    answer: "no entry — an open kind takes the default, which is what every subject took "
      + "until one earned otherwise",
    basis: {
      derived: "an entry in this table is only legitimate with the ARITHMETIC that produced "
        + "its number beside it — the cap is derived from what that subject's own composer "
        + "can produce, measured. An open kind has no composer and no measurement, so there "
        + "is nothing to derive a number from, and the default is not a fallback here but "
        + "the answer: `MAX_FREE_LENGTH` is what a subject is worth until somebody proves "
        + "it needs more. The silence is therefore safe rather than merely undecided, which "
        + "is the distinction this whole module exists to keep",
    },
    standing: "policy",
  },
  /* ── the hair reference take (`hairReferenceTake.ts`) ────────────────── */
  HAIR_FACETS: {
    file: "hairReferenceTake.ts",
    asks: "which subjects a hair take from a reference may speak for",
    answer: "no entry, ever — an open kind is not a facet of her hair",
    basis: {
      derived: "this list is DERIVED from the subject cards, and an open kind has no card "
        + "by definition, so the answer is structural rather than chosen. It is also the "
        + "right answer on its own terms: the three takes are his three answers about HAIR "
        + "(`colour? style? or full look?`), and a kind the catalogue has never heard of is "
        + "not one of the five things hair was split into. An open ask that happens to name "
        + "something hair-like — a mane, a crest — travels the open lane's own road and "
        + "never through a take that promises to scope her colour",
    },
    standing: "policy",
  },
  HAIR_COLOUR_FACETS: {
    file: "hairReferenceTake.ts",
    asks: "which hair facets count as THE COLOUR, and therefore what a style take disclaims",
    answer: "no entry, ever — for the same reason, one step in",
    basis: {
      stated: "the style take's claim is this list read backwards over HAIR_FACETS, so an "
        + "open kind entering here would enter the complement too and end up either claimed "
        + "or disclaimed by a sentence about her hair. Neither is honest about a kind nobody "
        + "has catalogued. The membership question this table answers is closed on purpose, "
        + "and the HEADING FENCE beside it is what keeps a future CLOSED facet from being "
        + "forgotten — that is a different failure and it has its own guard",
    },
    standing: "policy",
  },
  FACET_PHRASE: {
    file: "hairReferenceTake.ts",
    asks: "the ordinary words a person reads for one hair facet",
    answer: "no entry, and asking THROWS — never a default, never the key",
    basis: {
      stated: "the fallback a table like this usually grows is `?? facet`, and that would "
        + "put `hairWorn` into a sentence a customer reads. `hairFacetPhrase` raises "
        + "instead, so the gap is loud where an open kind could only arrive by a "
        + "programming error — nothing routes one here, because HAIR_FACETS above cannot "
        + "contain one",
    },
    standing: "policy",
  },

  FREE_SUBJECTS: {
    file: "refineSubjects.ts",
    asks: "the heading this subject's prose is composed under",
    answer: "the normalized key, upper-cased — HORNS: horns curving back from her temples",
    basis: {
      derived: "the D-87 footprint sweep looks for `SUBJECT: value`, so the heading must be "
        + "stable and derivable from the key alone. It is, provided the key is one dot-free "
        + "token — which `normalizeOpenKind` already guarantees (a single lowercase noun, "
        + "three words at most, `^[a-z][a-z '-]*$`). `openKindHeading` refuses anything else "
        + "rather than letting `facetHeading`'s `toUpperCase()` fallback put `HAIR.WORN:` "
        + "into a paid prompt under a heading the sweep cannot see",
    },
    standing: "policy",
  },

  /* ── the eight total tables ─────────────────────────────────────────────── */
  FREE_SUBJECT_KIND: {
    file: "refineSubjects.ts",
    asks: "presence or degree — whether an ask on this may ever REFUSE",
    answer: "presence",
    basis: {
      derived: "an open ask asks for a thing that is NOT in the picture to be in it "
        + "(§6). That is presence by construction, not by classification: a photograph "
        + "settles it and two honest people agree. D-246 class (c) therefore applies — "
        + "the asked thing completely absent refunds — and the absence gate protects it "
        + "from run-10's shape, since a reader quibbling that the horns are small and "
        + "understated is not an absence and cannot refuse",
    },
    standing: "owed",
  },
  SUBJECT_QUALIFIER: {
    file: "subjectQualifiers.ts",
    asks: "what the edit clause promises, floor included",
    answer: "the floor alone (TEETH), never an exemption",
    basis: {
      stated: "there is no per-class wording for a kind nobody has catalogued, and there "
        + "is no honest `exempt` either: an exemption must say WHY, and \"nobody has "
        + "written one yet\" is the absence this table exists to end rather than a reason. "
        + "So an open kind carries exactly the floor — this person's own face, present at "
        + "the strength their own words describe, and a change that does not appear at all "
        + "is a failed render. That is the promise the open lane's presence class is priced "
        + "on, so it is the one part that cannot be missing",
    },
    standing: "owed",
  },
  CHANGE_AMPLITUDE: {
    file: "changeAmplitude.ts",
    asks: "the per-pixel threshold an instrument counts this class of change at",
    answer: "REPLACEMENT (25 levels)",
    basis: {
      derived: "a presence ask puts content where other content was, which is the "
        + "REPLACEMENT band's own definition. **Its declared limit**: a DIFFUSE open kind "
        + "— scales across her cheeks — delivers at SURFACE amplitude and will be "
        + "under-read by an instrument counting at 25. That failure is loud (a band table "
        + "reporting that nothing moved about a picture that visibly changed, which is the "
        + "freckle case verbatim) and it is instrument-only: this table never reaches the "
        + "paid render path, by `MOVES_ITS_EDGE`'s own header. A kind whose reports read "
        + "that way is a kind asking to be promoted and measured",
    },
    standing: "policy",
  },
  SUBJECT_NOUNS: {
    file: "refineSubjects.ts",
    asks: "what a subject is CALLED — the collision check's vocabulary",
    answer: "no entry, ever; the key IS the noun",
    basis: {
      stated: "this table answers one question — *is this noun already ours?* — over the "
        + "CLOSED set, and `closedSubjectFor` is the guard that makes the open lane "
        + "structurally unable to shadow the closed one. Adding open kinds to it would "
        + "make the guard consult a list that grows itself, so a kind minted once would "
        + "route the next ask into the closed lane that never owned it. Open-versus-open "
        + "identity is exact equality after `foldNoun`, which is what the §1 discrimination "
        + "bar measured (horns and antlers, nine samples each, distinct)",
    },
    standing: "policy",
  },
  SHARED_HEADINGS: {
    file: "refineFacets.ts",
    asks: "the heading of a facet shared with a guaranteed axis",
    answer: "no entry — an open kind shares no facet with any axis",
    basis: {
      derived: "a kind that collided with a closed subject is a routing bug and never "
        + "reaches the open lane at all (`closedSubjectFor`). Every guaranteed axis is a "
        + "closed subject's neighbour, so a key that is genuinely new cannot be sharing "
        + "one of their facets. The guard that makes this true already exists and is the "
        + "same one §1 was written for",
    },
    standing: "silence",
  },
  ZONE_SCOPE: {
    file: "zoneScope.ts",
    asks: "how much of the frame this edit may touch",
    answer: "fullFrame",
    basis: {
      stated: "there is no honest zone for a kind nobody has catalogued. A region cut for "
        + "a noun the code has never seen is the wrong-boundary class — a mask wearing a "
        + "name it was not measured against, which is the fringe post-mortem and the body "
        + "row's own reasoning (*\"not a zone nobody has cut yet, a zone that cannot be cut "
        + "honestly\"*). `bilateralPair` is specifically forbidden until promotion: horns, "
        + "wings and antlers are all pairs (§5), and per-instance geometry is exactly what "
        + "promotion buys",
    },
    standing: "owed",
  },
  MOVES_ITS_EDGE: {
    file: "maskedRefine.ts",
    asks: "whether this facet may claim a reveal — what was behind something that left",
    answer: "false",
    basis: {
      stated: "a reveal is attributed to a REGION, and an open kind has no region anybody "
        + "has named. Claiming one would point `departed`'s 160px reach at a boundary "
        + "nobody measured, and run-6 has the specimen for what that delivers: 7,955 px "
        + "claimed on a band where a hank of hair arrived on her neck. Unreachable today "
        + "because the scope above is `fullFrame` — declared anyway, because a declaration "
        + "by silence is precisely what that table exists to prevent",
    },
    standing: "owed",
  },
  FACET_SLOTS: {
    file: "referenceSlotCatalogue.ts",
    asks: "where the library files this — and whether it files at all",
    answer: "unfiled, reason `openKind` — never `notASlot`",
    basis: {
      stated: "`notASlot` means *this rides somewhere else, and here is where* — three "
        + "decided absences with written reasons. An open kind means *nobody has "
        + "catalogued this yet*, and filed under the first it is invisible at exactly the "
        + "place it exists to be seen: the count of asks with nowhere to go IS the "
        + "promotion signal (§3). The label is already landed with its negative control. "
        + "A crop may only be minted for an open kind once §4's absence control has shown "
        + "the segmenter a frame WITHOUT the thing and been declined — a false crop of "
        + "nothing is a permanent instruction to paint nothing, in a place, forever. "
        + "**And a second condition since fable-872 §2: the kind must not be PAIRED.** A "
        + "whole-frame read of a pair returns one instance (measured on wings: the mask the "
        + "mint would have carried is the image-left wing to 13 pixels), so a paired kind's "
        + "crop is half a picture wearing the whole picture's name. Paired open kinds are "
        + "words-only until promoted; see `PLURAL_SUBJECTS`",
    },
    /* STILL OWED, and it is the FILING half that is owed rather than the crop
       half. The crop condition this basis names is discharged — step 3 built
       the absence control — but what this table decides is where a FACET goes,
       and nothing produces an `openKind` unfiled reason until the acceptance
       path (step 5) routes an ask into the lane. Pinned as owed by
       `openKindPolicy.test.ts`, so this cannot be tidied off the list. */
    standing: "owed",
  },

  /* ── the four lists, where membership is the answer ─────────────────────── */
  PLURAL_SUBJECTS: {
    file: "refineSubjects.ts",
    asks: "is this one slot holding a whole SET, restated absolutely each time",
    answer: "no — singular until promoted, and a PAIRED kind carries no crop at all",
    basis: {
      derived: "*give her horns* is one ask, one value, one carried crop of the whole "
        + "thing (§5), and the pair is the thing. It breaks only on *make the left one "
        + "longer*, and the ruling already answers that: the one-of-a-pair ask refuses "
        + "into the refund rather than guessing, which is the earring history not repeated",
      /*
        AND THE CROP DOES NOT FOLLOW FROM THE SLOT — measured 2026-08-17, and it
        is the half of §5 that was reasoned rather than read.

        "One carried crop of the whole thing" assumed a whole-frame read RETURNS
        the whole thing. For a pair it does not. On the specimen court's wings
        frame the reader answered 7.3277% of frame and it was ONE wing; the same
        reader, on the same frame cut at her face's centroid and asked one side
        to a picture, answered on BOTH halves — 115,268 px and 104,569 px. The
        whole-frame mask and the image-left half agree to **13 pixels**, so what
        the mint would have carried is one instance, exactly, under a noun that
        means two. The overlay is what says so; the number alone reads as a pass
        (`output/wings-per-side/PANEL-wings-per-side.png`).

        **FOUNDER-DELEGATED RULING, fable-872 §2: a paired open kind is
        WORDS-ONLY UNTIL PROMOTED.** No crop of one instance ever files under a
        name that means both — that is the earring history and it does not get a
        second run in a new lane. Per-instance geometry is what promotion buys,
        and the split-frame measure above is PROMOTION-DESIGN data proving the
        capability exists at that point; it is not a mint route, and `regionSides`
        answers `null` for an open kind by construction (`BILATERAL` derives from
        the catalogue's `frame: "ownSide"` column and an open kind has no card).

        What the code does NOT yet have is the property itself: *is this kind
        paired* is not something the lane can answer today, and it joins
        *does-it-extend* as a kind-property the interpreter answers in ONE design
        (fable-872 §2, fable-868 §4) — designed together, costed together. Until
        that lands, no open kind mints a crop, because a lane that cannot tell a
        pair from a single would file the pair's half under the pair's name.
      */
    },
    standing: "silence",
  },
  DEPARTABLE_SUBJECTS: {
    file: "refineSubjects.ts",
    asks: "can this thing LEAVE — is \"remove it\" a vacate or an ordinary edit",
    answer: "yes — by dropping the carry, not by a vacate phrase",
    basis: {
      stated: "**founder ruling, fable-393 §2: anything should be removable, and the "
        + "three-kind vacate list is a transitional state rather than an accepted one.** "
        + "An open kind is the easiest member of that ruling and it needs no new "
        + "machinery: it is never in the master (it arrived through an edit), so it is "
        + "present in a later frame ONLY because the recipe carries it. Removing it is "
        + "the recipe not carrying it — the master repaints without horns because it "
        + "never had any. No vacancy row, no absence phrase. **This is a claim about the "
        + "repaint road that the step-4 build must PROVE rather than assume** — the "
        + "one-frame-removal defect was exactly this kind of reasoning being right about "
        + "the architecture and wrong about the code",
    },
    standing: "owed",
  },
  REPAINT_ONLY_SUBJECTS: {
    file: "subjectCards.ts",
    asks: "may the OLD paste road serve this subject, or only the repaint road",
    answer: "the open lane is repaint-only in practice, and this table does not decide it",
    basis: {
      derived: "the table is derived from `admittedOn`, which is a fact about which road has "
        + "MEASURED a subject — and an open kind has no card, so it has no measurement on "
        + "either road. What keeps it honest is a different door: the open lane only exists "
        + "on the repaint road, because a declarative recipe is what makes an unlisted kind "
        + "sayable at all. So the answer here is a silence with a reason rather than an "
        + "entry: if an open kind ever reaches the paste road, the thing to fix is that "
        + "road's admission, not this list",
    },
    standing: "silence",
  },
  PRESENTATION_SUBJECTS: {
    file: "refineSubjects.ts",
    asks: "does this file as presentation instead of identity",
    answer: "no — an open kind files as identity, and every follow inherits it",
    basis: {
      derived: "the list has one member and its rule is that a MOMENTARY state must not "
        + "become permanent. Horns, wings, a tail are all facts about who she is, so "
        + "identity is right and the silence is correct. Stated rather than left silent "
        + "because the failure it guards is expensive and quiet — a momentary choice made "
        + "permanent for eight strangers — so a presentation-class open kind (if one is "
        + "ever normalized) must be declared before it ships, not discovered on a follow",
    },
    standing: "silence",
  },
  PRESENTATION_NOUNS: {
    file: "refineSubjects.ts",
    asks: "the same question as PRESENTATION_SUBJECTS — this is the table it derives from",
    answer: "no — an open kind files as identity, and every follow inherits it",
    basis: {
      derived: "V1 made the pair one fact on one card (`presentationNoun`, null for "
        + "identity), and the list above is now `Object.fromEntries` over the cards that "
        + "answer it. Answered separately rather than folded away because the SCAN sees "
        + "a table wherever one is keyed on the vocabulary, and a table the policy cannot "
        + "name is exactly the silence this file exists to end — the derivation made this "
        + "one visible, which is the guard working rather than a new decision",
    },
    standing: "silence",
  },
  PRESENTATION_FACETS: {
    file: "presentationState.ts",
    asks: "which facets the base read may PIN as a fact about her",
    answer: "none — an open kind is never pinned",
    basis: {
      derived: "a pin is a choice from a CLOSED list of allowed answers, and the reader "
        + "is told that anything outside it is `other` rather than a near miss. There is "
        + "no allowed-answer list for a kind nobody has catalogued, so there is nothing "
        + "to pin and no way to pin it wrong",
    },
    standing: "silence",
  },

  /* ── the six that decide by omission ────────────────────────────────────── */
  OUT_OF_FRAME: {
    file: "castingFrame.ts",
    asks: "does the photograph contain the thing this ask is about",
    answer: "no entry — an open kind is treated as IN frame",
    basis: {
      stated: "the table's own header sets the direction: a facet with no entry is in "
        + "frame, because a wrong `false` refuses an edit the customer could have had. "
        + "**The hazard is named rather than hidden**: *give her a tail* was one of §1's "
        + "five measured concepts and a tail is below the crop line of every frame this "
        + "product makes, so the fifth door cannot decline it and the render will be "
        + "bought. There is no honest fix at this layer — the table is keyed by facet and "
        + "an open kind has none — and the real one is the per-frame read that module "
        + "already declares it is not. §7's demand table is where a below-the-crop kind "
        + "shows up: a kind whose outcomes are refunds is one of the things the promotion "
        + "decision is reading for",
      /*
        AND THE FOUNDER HAS RULED WHAT HAPPENS TO SUCH AN ASK — twice, and the
        second ruling is the one that costs money.

        **fable-869 §2: NOTHING REFUSES ON VISIBILITY.** *"i think we stick to my
        original just sell and dont refuse anything unless the image is truely
        severely broken."* An ask whose region is not visible in the current
        frame is ACCEPTED and rides as words in the cast's record. Law 8's
        grounds: a cast is a CHARACTER, not a photograph — the vampire's hands
        exist off-frame.

        **fable-876 §1: AND IT IS ACCEPTED FREE, for now.** His words: *"we will
        need to test how it renders once you sign the cast so for now yes."* So
        an invisible-now ask is an accept-WITHOUT-dispatch: the words join the
        record, no render is bought, and the copy says honestly where it will
        show. The reason it is the only honest option today is measured rather
        than argued — a render of an invisible region returns a
        pixel-identical frame, so charging 25 credits for it would be charging
        for the picture she already had.

        **HIS CONDITION RIDES WITH IT, and it is an obligation on a later
        build**: when a cast carrying invisible-recorded facts is SIGNED, the
        render of the fuller views must be TESTED against those facts. The
        free-accept is *"for now"* until that test passes his eyes. It is not
        satisfied by this table and it is not satisfied by the acceptance path;
        it is the view-carry work's, and it is why that work is not optional.
      */
    },
    standing: "owed",
  },
  REGION_OF_FACET: {
    file: "maskedRefine.ts",
    asks: "what to ask a segmenter for when cutting this facet's region",
    answer: "no entry — the question is asked in OPEN vocabulary, in the kind's own noun",
    basis: {
      derived: "§4's default, and the only question there is: the segmenter is asked for "
        + "*horns* because `horns` is what the ask is about. The entire risk lives in the "
        + "ANSWER rather than the question — a segmenter asked where the horns are on a "
        + "face with none will return a small confident region of forehead — which is why "
        + "no crop mints until the absence control has been declined on a frame without "
        + "the thing",
    },
    /* BUILT (step 3). The mint asks the reader the kind's own noun and refuses
       the crop unless the same reader declined on the before-picture —
       `absenceRefusal` in `referenceMint.ts`, driven both ways with a control
       that no closed slot ever buys the read. */
    standing: "policy",
  },
  SHARED_FACETS: {
    file: "refineFacets.ts",
    asks: "does this subject share a facet with a guaranteed axis",
    answer: "no entry — an open kind is its own facet",
    basis: {
      derived: "the same guard as `SHARED_HEADINGS`, one line up: a key that collides "
        + "with the closed vocabulary never reaches the open lane. A subject nothing else "
        + "can contradict is already the unit it supersedes on",
    },
    standing: "silence",
  },
  INVALIDATED_BY: {
    file: "presentationState.ts",
    asks: "which pins a delta writing this facet has just made false",
    answer: "no entry — nothing to invalidate",
    basis: {
      derived: "falls out of `PRESENTATION_FACETS` above: an open kind is never pinned, "
        + "so no pin of it can be made false. Silence here is not a decision at all, it "
        + "is arithmetic on the previous one",
    },
    standing: "silence",
  },
  INSTRUCTION_MAY_OVERRIDE: {
    file: "zoneScope.ts",
    asks: "may the instruction narrow or widen this facet's scope",
    answer: "no entry — `fullFrame` holds whatever the sentence says",
    basis: {
      stated: "the two entries that exist are places where the CLASS is known and only "
        + "its extent is in question — one scar versus freckles across a nose. For an open "
        + "kind neither is known, so an override would be the model choosing its own mask "
        + "boundary from a sentence, which is the wrong-boundary class with an extra step. "
        + "It becomes a real question at promotion, when somebody has measured what the "
        + "kind's region is",
    },
    standing: "silence",
  },
  OPEN_QUESTIONS: {
    file: "zoneScope.ts",
    asks: "facets whose scope class the pixels do not settle, returned as questions",
    answer: "no entry — the scope above is decided, not ambiguous",
    basis: {
      stated: "the map is deliberately empty and kept so the next ambiguous facet has "
        + "somewhere to go. An open kind's `fullFrame` is a decision with a reason, not an "
        + "unanswered question, and filing it here would ask a human to classify a kind "
        + "nobody has seen — which is what promotion is for",
    },
    standing: "owed",
  },
};

/** Every table this record answers — the set the source scan is checked against. */
export function answeredTables(): string[] {
  return Object.keys(OPEN_KIND_POLICY).sort();
}

/**
 * The answers whose enforcement is not built — the step 3–5 work list.
 *
 * Returned rather than counted, so the build that closes one has to name it.
 */
export function owedByThePolicy(): Array<{ table: string; asks: string; answer: string }> {
  return answeredTables()
    .filter((table) => OPEN_KIND_POLICY[table].standing === "owed")
    .map((table) => ({
      table,
      asks: OPEN_KIND_POLICY[table].asks,
      answer: OPEN_KIND_POLICY[table].answer,
    }));
}

/*
  ─────────────────────────────────────────────────────────────────────────────
  THE ANSWERS AS VALUES.

  Typed against the real types, so a rename or a widening in any of those tables
  breaks this file rather than leaving it describing a world that has moved.
  Nothing calls them yet; see the header.
  ─────────────────────────────────────────────────────────────────────────────
*/

/**
 * IS THIS THE NORMALIZER'S KIND OF KEY — asked without throwing.
 *
 * The same grammar `openKindHeading` refuses on, in one place rather than two
 * (working law 4). The heading guard needs to fail LOUD because it stands
 * between an invented key and a paid prompt; the slot branch needs to answer
 * *no* quietly, because "not an open key" is an ordinary outcome there and a
 * `null` definition is what every other unknown key gets. One rule, two
 * manners.
 *
 * It is deliberately NOT the full `readKind` contract — that one also bounds
 * length and word count, and it is the normalizer's to enforce at the moment it
 * mints a key. This is the shape a key must still have by the time anything
 * downstream reads it.
 *
 * **NO SPACE, and that is the whole of what fable-775 §3 changed here.** The
 * key is a single token from the moment the normalizer mints it (`cat ears`
 * kebabs to `cat-ears`, and the spaced noun travels beside it), because
 * `parseSlot` refuses a space and the library door therefore refuses a spaced
 * key outright — `slotNotAFeatureSlot`, AFTER the render is paid for. A
 * resolver that answered for a key the library will refuse would leave exactly
 * the gap that finding closed, one door along: painted, charged, never filed,
 * re-rolled on every later render.
 *
 * So this grammar and the library's are the same grammar. Both halves are
 * driven — the kebab key resolves, the spaced one does not.
 */
export function isOpenKindKey(kind: string): boolean {
  return /^[a-z][a-z'-]*$/.test(kind);
}

/** The heading an open kind's prose is composed under. */
export function openKindHeading(kind: string): string {
  const plain = kind.trim();
  /*
    FAIL LOUD, for `facetHeading`'s own declared trap: a dotted or empty id
    falls through to `toUpperCase()` and reaches a paid prompt under a heading
    the D-87 sweep does not recognise, which is invisible in the output and
    invisible in the sweep. `normalizeOpenKind` cannot produce one of these, so
    this throw is unreachable from the lane and reachable from a caller that
    invented a key.
  */
  if (!isOpenKindKey(plain)) {
    throw new Error(
      `"${kind}" is not an open-lane key, so it has no heading — keys are the normalizer's `
      + `single lowercase noun (openKindPolicy, FREE_SUBJECTS)`,
    );
  }
  return plain.toUpperCase();
}

/**
 * WHY AN OPEN KIND HAS NO COMPLETENESS SPECIMEN — recorded, not left null.
 *
 * The catalogue's invariant is that `guardKind` is null exactly when `question`
 * is. An open kind has a question — its own noun — and no specimen family,
 * because a specimen family is a measurement and nobody has measured a kind
 * nobody has catalogued. That breaks the biconditional, and fable-766 §2
 * ratified the honest way out: state the invariant as closed-catalogue-only and
 * have the open branch carry an explicit reason.
 *
 * **The bound that came with the ratification**: the mint door must
 * demonstrably READ this. A recorded fact nobody consults is indistinguishable
 * from the silent null it replaced — the gate-not-reader class, which this
 * campaign has already paid for once.
 */
export function openKindNoSpecimenReason(kind: string): string {
  return `no completeness specimen exists for "${kind}" — a specimen family is a measurement, and `
    + `nobody has measured a kind nobody has catalogued. A crop may only be minted once the `
    + `absence control has shown a segmenter a frame WITHOUT the thing and been declined`;
}

/** Whether an open ask may refuse — presence, by derivation (§6). */
export function openKindBinds(): "presence" | "degree" {
  return "presence";
}

/**
 * AND WHETHER IT REFUSES **TODAY** — no, deliberately, and this is where the
 * deviation is declared (fable-911 §2 (1)).
 *
 * `openKindBinds()` above is the settled POLICY and it is not wrong: an open ask
 * asks for a thing that is not in the picture to be in it, which is presence by
 * construction. What is missing is not the classification, it is the
 * MEASUREMENT. The thing being asked about is a kind nobody has catalogued — no
 * specimen family, no court, no audited reliability, which is the same fact
 * `openKindNoSpecimenReason` states one function up. A binding refusal on an
 * unmeasured reader spends the customer's money to be wrong, and law 9 says a
 * reader's output is a pointer to look, never a fact to file.
 *
 * So the net ASKS and RECORDS, and nothing refunds on the answer. `binding:
 * false` exists in `renderVerification` for exactly this (D-187): checked and
 * recorded, never refunded.
 *
 * # THE PROMOTION CONDITION, named rather than left to a later mood
 *
 * This returns true only when both are in hand, as its own ruling:
 *
 *   1. accumulated stored verdicts — the miss counts per kind that
 *      `reliabilityReport` now surfaces, so the argument is a reading rather
 *      than an anecdote;
 *   2. a court with the FOUNDER'S EYE on the misses (law 9), because the class
 *      where a reader has been overturned by his eye is precisely the class
 *      where a reader must not be given teeth on prose alone.
 *
 * Measure, then enforce — the delivery-rate bar's own discipline, and the
 * reverse of moving a bar to fit a result.
 */
export function openKindPresenceBindsToday(): boolean {
  return false;
}

/** The clause an open ask carries: the floor, and only the floor. */
export function openKindQualifier(): string {
  return TEETH;
}

/** The amplitude an instrument counts an open kind's change at. */
export function openKindAmplitude(): ChangeAmplitude {
  return {
    levels: 25,
    basis: {
      reasoned: "a presence ask puts content where other content was — the REPLACEMENT "
        + "band's own definition. A diffuse open kind will be under-read; see the policy "
        + "record's declared limit",
    },
  };
}

/** How much of the frame an open kind's edit may touch. */
export function openKindZoneScope(): ZoneScope {
  return "fullFrame";
}

/** Whether an open kind may claim a reveal. */
export function openKindMovesItsEdge(): boolean {
  return false;
}

/** Why an open kind files nothing in the library. */
export function openKindUnfiledReason(): UnfiledReason {
  return "openKind";
}

/** One slot holding a set, or one thing? */
export function openKindIsPlural(): boolean {
  return false;
}

/** Identity, or presentation that a follow must not inherit? */
export function openKindFilesAsIdentity(): boolean {
  return true;
}

/**
 * How an open kind LEAVES.
 *
 * `dropTheCarry` is the whole answer and it is deliberately not `vacatePhrase`:
 * an open kind is absent from the master, so ceasing to carry it is ceasing to
 * paint it. Named as a value rather than a boolean so the step-4 build cannot
 * satisfy it by reaching for the closed lane's vacate machinery, which would
 * write an absence phrase about a thing her master never had.
 */
export function openKindDeparture(): "dropTheCarry" {
  return "dropTheCarry";
}

/** What a segmenter is asked, when an open kind's crop is being considered. */
export function openKindSegmenterQuestion(kind: string): string {
  /* The question IS the noun (§4) — there is nothing else to ask. Routed through
     the heading guard so an invented key is refused here too, rather than
     reaching a segmenter as a sentence. */
  openKindHeading(kind);
  return kind.trim();
}
