/**
 * ONE REGISTRATION CARD PER KIND (V1, `docs/specs/VOCABULARY_OVERHAUL_REVIEW.md`).
 *
 * The founder's own sentence started this: *"so when do we execute it instead
 * of this nine different files surgical edit rubbish."* Adding a subject cost
 * eight compile-closed tables plus four lists that decide by ABSENCE — and the
 * four were the dangerous half. A kind missing from all of them is not
 * undecided; it is decided invisibly four times, which is the unowned-axis
 * class at the vocabulary layer (F2, five confirmed instances in this program).
 *
 * # What a card is
 *
 * Everything the system needs to know about one subject, in one place, with
 * **silence made impossible**: `plural`, `departable` and `presentationNoun`
 * are REQUIRED fields, so a new kind cannot be quietly enrolled in — or quietly
 * left out of — a behaviour nobody chose. The tables that used to hold these
 * answers are now derived views over this registry; they keep their names,
 * their types and their docblocks, and every consumer is unchanged.
 *
 * # What this file is NOT
 *
 * It is not a second copy of anything. `FREE_SUBJECTS`, `FREE_SUBJECT_KIND`,
 * `SUBJECT_NOUNS`, `SUBJECT_QUALIFIER`, `CHANGE_AMPLITUDE`, `PLURAL_SUBJECTS`,
 * `DEPARTABLE_SUBJECTS` and `PRESENTATION_NOUNS` are all `Object.fromEntries`
 * over these cards — derive, never mirror (working law 4). If one of them is
 * ever spelled out by hand again, that is the defect this milestone exists to
 * remove, walking back in.
 *
 * # The proof that nothing changed
 *
 * `vocabularyPin.json` captured all twelve tables BEFORE the first card
 * existed, and `vocabularyPin.test.ts` compares the derived views against it.
 * The pin is not regenerated: a golden refreshed when it fails is a golden that
 * agrees with whatever it is shown. A move keeps it green; a change does not.
 *
 * # The type carve-out still holds
 *
 * `FreeSubject` is `keyof typeof SUBJECT_CARDS`, so the compile-time proof that
 * no guaranteed axis (eyeColour, eyeShape) leaks into the free lane is
 * unchanged — it now guards the cards instead of the heading table.
 */
import type { ChangeAmplitude } from "./changeAmplitude";
import type { SubjectQualifier } from "./subjectQualifiers";

/**
 * The three amplitude bands, named where the cards can read them.
 *
 *   REPLACEMENT (25)  the class puts different content where the old content
 *                     was — an accessory, a haircut, a removal.
 *   RESTRUCTURE (10)  the class moves an edge or a contour a little.
 *   SURFACE (4)       the class changes the skin's own tone or texture by a few
 *                     levels over a wide area. Measured on freckles.
 */
const REPLACEMENT = 25;
const RESTRUCTURE = 10;
const SURFACE = 4;

export type SubjectCard = {
  /** The heading its prose is composed under — the D-87 sweep looks for it. */
  readonly heading: string;
  /**
   * PRESENCE OR DEGREE — whether an ask on this subject may ever REFUSE.
   * Presence binds (the thing is in the picture or it is not); degree advises
   * (a matter of shade or amount nobody has defined). The essay is on
   * `FREE_SUBJECT_KIND`, which this feeds.
  */
  readonly kind: "presence" | "degree";
  /** What people CALL it — the open lane's collision check reads this. */
  readonly nouns: readonly string[];
  /** What its clause promises, in the clause's own voice. */
  readonly qualifier: SubjectQualifier;
  /** The per-channel delta above which a pixel counts as moved for this class. */
  readonly amplitude: ChangeAmplitude;
  /**
   * ONE SLOT HOLDING A WHOLE SET — a later instruction restates it absolutely
   * rather than adding to it, which is what keeps removal arithmetic.
  */
  readonly plural: boolean;
  /**
   * ITS THINGS SIT ON HER AND CAN THEREFORE LEAVE (law 8). A fringe cannot: it
   * is a haircut, not a face with a fringe-shaped hole in it.
  */
  readonly departable: boolean;
  /**
   * The recipe's word for it when it is PRESENTATION rather than identity, or
   * null. Non-null means a Follow must never inherit it (D-136).
  */
  readonly presentationNoun: string | null;
};

export const SUBJECT_CARDS = {
  /*
      HAIR IS FOUR FACETS, NOT ONE (D-142).

      It shipped as a single `hair` slot and the founder's first real stack broke
      on it: "change hair to mullet", then "copper hair", then "actually black
      hair" — every instruction kept in the record, and NO mullet in the picture,
      because last-writer-wins on one coarse slot let a colour edit annihilate a
      cut. The eyes were already right ("seafoam" and "hooded" coexist), and the
      difference was only that eyes had been split and hair had not.

      A subject is one FACET a person can change independently. Two things that
      can be true at once need two slots, or the second silently deletes the
      first.
  */
  /** A cut is a described SHAPE. The gap between "a bob" and "a long bob" is
    the seafoam problem wearing a haircut, and D-187's live trial refused two
    renders in this neighbourhood already. */
  hairCut: {
    heading: "HAIR CUT",
    kind: "degree",
    nouns: ["hair", "haircut", "cut", "fringe", "bangs", "layers"],
    qualifier: { describe: ", cut and dressed as a real haircut on this person's own hair density "
      + "and hairline" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "a cut replaces hair with background and background with hair" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  hairShade: {
    heading: "HAIR COLOUR",
    kind: "degree",
    nouns: ["hair colour", "hair color", "highlights", "roots"],
    qualifier: { describe: ", rendered as natural hair — dimensional rather than flat, with a "
      + "slightly deeper root shadow and the tone reading as grown rather than "
      + "dyed" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "a colour change moves every strand pixel at once" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  hairPattern: {
    heading: "HAIR TEXTURE",
    kind: "degree",
    nouns: ["hair texture", "curls", "waves", "coils"],
    qualifier: { describe: ", as the hair's own growth pattern through its whole length, not a "
      + "styling of the ends" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "curl pattern rearranges strands across the whole mass" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  hairFinish: {
    heading: "HAIR FINISH",
    kind: "degree",
    nouns: ["hair finish", "shine", "frizz"],
    qualifier: { describe: ", as the way this hair takes light, not a change of colour or cut" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "shine and matte change how light sits, not where the hair is" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /*
      HOW it is worn, which is not WHAT it is cut into. "Hair worn down" has
      nothing to do with the cut and everything to do with the styling, and with
      no slot for it the instruction had nowhere to land at all — the third time
      a real facet turned out to be nobody's.
  */
  /** THE SPECIMEN'D ONE. Hair is down or it is not; the vocabulary is closed
    (`presentationState`'s arrangement list) and the reader answers it from
    the photograph. Two production specimens plus a prior refund. */
  hairWorn: {
    heading: "HAIR WORN",
    kind: "presence",
    nouns: ["ponytail", "bun", "updo", "braid", "plait"],
    qualifier: { describe: ", as the same hair restyled, not cut and not a different head of hair" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { measured: "shrink-harvest.mts — shoulder bands 0.0% to 18.4% at 25 levels" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /*
      Eyes were ALREADY split, and that is why they worked: "seafoam" and
      "hooded" coexisted on the founder's stack while the mullet died. Kept split
      here, named apart from the guaranteed `eyeColour`/`eyeShape` so the
      type-level carve-out still holds.
  */
  /** The founding D-187 case, in both lanes. */
  eyeColourFree: {
    heading: "EYE COLOUR",
    kind: "degree",
    nouns: ["eye colour", "eye color", "iris", "irises"],
    qualifier: { describe: ", as the iris's own colour with its natural variation, never a flat "
      + "contact lens" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "the iris is small but the colour change across it is total" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  eyeShapeFree: {
    heading: "EYE SHAPE",
    kind: "degree",
    nouns: ["eye", "eyes", "eyelid", "eyelids", "eye shape"],
    qualifier: { describe: ", as the eye's own structure — the lid, the corners and the lash line "
      + "— and never drawn on with makeup or liner" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { measured: "eye-shape matrix — corner lift reads at the lid boundary, not across "
        + "the eye" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  brows: {
    heading: "BROWS",
    kind: "degree",
    nouns: ["brow", "brows", "eyebrow", "eyebrows"],
    qualifier: { describe: ", as brow hair growing from this person's own brow bone, not pencilled "
      + "on" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "brow hair over skin: a shape change moves the boundary, the interior "
        + "stays brow" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  lashes: {
    heading: "LASHES",
    kind: "degree",
    nouns: ["lash", "lashes", "eyelash", "eyelashes"],
    qualifier: { describe: ", as lashes on this person's own lash line" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "fine dark strands on a small boundary" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  nose: {
    heading: "NOSE",
    kind: "degree",
    nouns: ["nose", "nostril", "nostrils", "bridge", "septum"],
    qualifier: { describe: ", as the nose's own structure, with the rest of the face unchanged" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a contour edit moves edges; the centre of the nose stays the nose" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  lips: {
    heading: "LIPS",
    kind: "degree",
    nouns: ["lip", "lips", "mouth", "cupid's bow"],
    qualifier: { describe: ", as the lips' own shape and surface, distinct from any lip colour" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "fuller lips move the vermilion border, measured beyond the zone in "
        + "fuller-lips.mts" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  teeth: {
    heading: "TEETH",
    kind: "degree",
    nouns: ["tooth", "teeth", "smile line", "gums"],
    qualifier: { describe: ", visible in the mouth as it is already held, without changing the "
      + "expression" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a small bright region behind the lips" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /* THE MEASURED ONE. `cheeks` is what the normalizer returned; without it in
       this list the guard cannot see the collision it was written for. */
  cheekbones: {
    heading: "CHEEKBONES",
    kind: "degree",
    nouns: ["cheekbone", "cheekbones", "cheek", "cheeks"],
    qualifier: { describe: ", as the face's own bone structure under its own skin" },
    amplitude: {
      levels: SURFACE,
      basis: { reasoned: "bone structure reads as a few levels of shading over a wide area" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  jaw: {
    heading: "JAW",
    kind: "degree",
    nouns: ["jaw", "jawline", "mandible"],
    qualifier: { describe: ", as the jaw's own contour, with the neck and chin left alone" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a contour against the background, so the edge moves decisively" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  chin: {
    heading: "CHIN",
    kind: "degree",
    nouns: ["chin"],
    qualifier: { describe: ", as the chin's own contour, with the jaw left alone" },
    amplitude: { levels: RESTRUCTURE, basis: { reasoned: "as the jaw, over a smaller arc" } },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  ears: {
    heading: "EARS",
    kind: "degree",
    nouns: ["ear", "ears", "earlobe", "earlobes"],
    qualifier: { describe: ", on both sides and matching one another" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "an ear is present or it is not, against hair or background" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  skinTone: {
    heading: "SKIN TONE",
    kind: "degree",
    nouns: ["skin", "skin tone", "complexion", "tan"],
    qualifier: { describe: ", across all of this person's visible skin, evenly and consistently" },
    amplitude: {
      levels: SURFACE,
      basis: { reasoned: "a tan is a few levels across all visible skin — the freckle case, "
        + "spread wider" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /*
      A CONDITION OF THE SKIN, WHICH IS NOT A MARK ON IT (fable-363 ruling 2,
      executing the founder's taxonomy in fable-361 §3).

      The taxonomy is the founder's: only enumerable FEATURES ever get a picture,
      and everything diffuse carries as words. The interpreter did not know it —
      measured on the real transport, *"acne on her face"* filed under `marks`
      four times in five, and the fifth found this slot on its own. Acne is not a
      thing you can point to; it is what her skin is doing, so it belongs here
      beside weathering, ruddiness and being freckly in general.

      The split this pair now holds: **one thing you could point at is a MARK; a
      quality spread over her with no one place is a CHARACTER.**
  */
  skinCharacter: {
    heading: "SKIN CHARACTER",
    kind: "degree",
    nouns: ["acne", "pores", "texture", "ruddiness", "weathering", "blemishes"],
    qualifier: { describe: ", as the skin's own surface — texture that follows the form of the "
      + "face rather than sitting flat on it" },
    amplitude: {
      levels: SURFACE,
      basis: { reasoned: "texture is the freckle case by another name" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /** One sited thing on the skin: a mole, a scar, a birthmark, freckles across
    her nose. NOT ink, and NOT a diffuse condition — see `skinCharacter`. */
  /** Explicitly ruled advisory when accessories were bound: the marks reader
    sits at a measured floor and BYTE ADJUDICATION is its honest instrument.
    Presence-binding it would refund provably delivered freckles. */
  marks: {
    heading: "MARKS",
    kind: "degree",
    nouns: [
      "mark", "marks", "mole", "moles", "scar", "scars", "birthmark",
      "birthmarks", "freckles"
    ],
    qualifier: { describe: ", as real marks on this person's own skin, following the form of the "
      + "face rather than painted flat" },
    amplitude: {
      levels: SURFACE,
      basis: { measured: "freckles-layers.mts + marks-prose.mts — freckles read at >4 and vanish "
        + "at >25" },
    },
    plural: true,
    departable: true,
    presentationNoun: null,
  },
  /*
      ADORNMENT IS THE PERSON, NOT THE STAGE (D-160).

      "Small gold hoops" was refused as "wardrobe or set", which contradicts a
      standing founder ruling: earrings, glasses and piercings are legitimate
      refine instructions, because adornment never arrives unbidden and Refine is
      the stated channel for asking. The roll pipeline has honoured exactly this
      since the D-116 family — `statedAccessories` is already an intent axis and
      the cohort constant already gives it failure-to-appear teeth — so the wall
      was refusing on one surface what the other surface promised.

      The wall narrows rather than falls: garments, headwear, the backdrop, props
      and the scene are still the stage, and still refuse.
  */
  /** Already binding before this table existed — D-160's ruling that adornment
    is the person, and the fix that gave the free lane its first teeth. */
  statedAccessories: {
    heading: "ACCESSORIES",
    kind: "presence",
    nouns: [
      "earring", "earrings", "glasses", "spectacles", "sunglasses",
      "piercing", "piercings", "necklace", "stud", "studs", "hoop",
      "hoops"
    ],
    qualifier: { describe: ", worn by this person and rendered accurately as described and as "
      + "their own. Nothing else is added: no other jewellery, no headwear, no "
      + "props" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { measured: "the-walk.mts — 27,613 px of frames at mean 0.962" },
    },
    plural: true,
    departable: true,
    presentationNoun: null,
  },
  /*
      HER BUILD — ONE ROW, FIVE FACETS, AND THE SPLIT IS PLUMBING (fable-381 §A.3,
      narrowed by the founder in fable-382 §3).

      His ask: *"We need body shape/build — larger bust, smaller waist, bigger
      arms, bigger chest etc — this would need a row."* His correction a day
      later: *"their body should just be a single thing like body type or body
      shape it doesnt need individal pieces like hips chest etc thats too much and
      over complicated."*

      Both are honoured because a ROW is not a FACET. The panel draws ONE row and
      the ask box takes one holistic sentence; underneath, D-142 still applies —
   *"broader shoulders"* and *"a slimmer build"* can both be true at once, so
      filed to one slot the second would silently delete the first, which is the
      mullet-under-copper defect rebuilt in a new place. `skin` is the precedent
      that makes this ordinary rather than clever: three facets, one row, per-facet
      supersession, and nobody has ever seen the seam.

   **No `hips`, by founder ruling** — and `waist` is here not because it can be
      rendered but because it must be DECLINED BY NAME. It is below the crop line
      of every frame this product makes (`castingFrame.ts`), and a vocabulary that
      could not recognise the word would send the ask to the stage wall, where the
      honest answer is "the photograph does not contain her waist".
  */
  /*
      EVERY BODY FACET IS A DEGREE ASK, and that is the row's weakest column said
      out loud rather than discovered in a refund. Larger, smaller, bigger,
      broader — a photograph cannot settle any of them, and fable-349 proved the
      reader blind to subtle degree on a real paid render (delivered fuller lips
      read back as "naturally thin, not fuller"). So a body ask can never refuse
      on the reader's word, exactly as the lips row cannot.
  */
  bust: {
    heading: "BUST",
    kind: "degree",
    nouns: ["bust", "chest", "breasts"],
    qualifier: { describe: ", as this person's own chest under the same garment, with the neckline "
      + "and the fabric unchanged" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a chest edit moves the outline under the garment; the fabric between "
        + "the edges is unchanged" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  waist: {
    heading: "WAIST",
    kind: "degree",
    nouns: ["waist", "midriff", "stomach", "torso"],
    qualifier: { describe: ", as this person's own waist, with the same garment sitting on it" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a waist edit moves two side contours" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  shoulders: {
    heading: "SHOULDERS",
    kind: "degree",
    nouns: ["shoulder", "shoulders"],
    qualifier: { describe: ", as this person's own shoulder line and posture, not a different pose" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "a shoulder edit moves the line where she meets the backdrop" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  arms: {
    heading: "ARMS",
    kind: "degree",
    nouns: ["arm", "arms", "biceps", "forearm", "forearms"],
    qualifier: { describe: ", as this person's own arms at the same relaxed position, not a "
      + "different pose" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "an arm edit moves the arm's own edge against the backdrop" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  build: {
    heading: "BUILD",
    kind: "degree",
    nouns: [
      "build", "body", "body type", "body shape", "figure", "physique",
      "frame"
    ],
    qualifier: { describe: ", as the same person built differently — her face, her hair and her "
      + "clothes exactly as they are" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "the whole figure's outline moves; her face and her clothes do not" },
    },
    plural: false,
    departable: false,
    presentationNoun: null,
  },
  /** Ink is its own subject because D-133 gives it its own law. */
  /** D-133 gives ink its own law, and its own law is about WHERE a design sits.
    A tattoo asked for and not drawn is an absence, not a shade dispute. */
  ink: {
    heading: "INK",
    kind: "presence",
    nouns: ["ink", "tattoo", "tattoos"],
    qualifier: { exempt: "each item carries its own placement clause (D-171), built per item in "
      + "composeEditPrompt — a shared qualifier would address the first "
      + "design's placement to all of them" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "a design is opaque where it is drawn" },
    },
    plural: true,
    departable: true,
    presentationNoun: null,
  },
  /** A beard asked for and not grown is an absence. "Stubble rather than the
    full beard she asked for" is a quibble and the absence gate declines it. */
  facialHair: {
    heading: "FACIAL HAIR",
    kind: "presence",
    nouns: [
      "beard", "moustache", "mustache", "stubble", "sideburns", "goatee",
      "facial hair"
    ],
    qualifier: { describe: ", growing as this person's own hair, with the hairline and skin "
      + "beneath unchanged" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "hair over skin, opaque where it grows" },
    },
    plural: false,
    departable: true,
    presentationNoun: null,
  },
  /**
   * Presentation state, and the ONLY subject that does not file as identity
   * (D-136). Follow must never inherit a smile.
  */
  /** A continuum — "softer", "warmer", "more serious" — of which the one crisp
    case (smiling or not) is a subset. Classified honestly rather than
    optimistically; it can be promoted when it has a specimen of its own. */
  expression: {
    heading: "EXPRESSION",
    kind: "degree",
    nouns: ["expression", "smile", "frown", "smirk", "scowl"],
    qualifier: { describe: ", as this person's own face doing it, with their features unchanged" },
    amplitude: {
      levels: RESTRUCTURE,
      basis: { reasoned: "features move without being replaced" },
    },
    plural: false,
    departable: false,
    presentationNoun: "expression",
  },
} as const satisfies Record<string, SubjectCard>;

export type FreeSubject = keyof typeof SUBJECT_CARDS;

export const FREE_SUBJECT_KEYS = Object.keys(SUBJECT_CARDS) as FreeSubject[];

/** Every card, in registration order, for the derived views below. */
export const SUBJECT_CARD_ENTRIES = Object.entries(SUBJECT_CARDS) as ReadonlyArray<
  readonly [FreeSubject, SubjectCard]
>;

/** One field of every card, as the table it used to be typed out as. */
export function tableOf<T>(read: (card: SubjectCard) => T): Record<FreeSubject, T> {
  return Object.fromEntries(
    SUBJECT_CARD_ENTRIES.map(([subject, card]) => [subject, read(card)]),
  ) as Record<FreeSubject, T>;
}

/** Every subject whose card answers a yes/no field with yes. */
export function subjectsWhere(read: (card: SubjectCard) => boolean): readonly FreeSubject[] {
  return SUBJECT_CARD_ENTRIES.filter(([, card]) => read(card)).map(([subject]) => subject);
}
