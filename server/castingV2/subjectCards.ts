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
   * WHICH ROAD HAS MEASURED THIS SUBJECT, and therefore which road may serve it.
   *
   * `everyRoad` is what all twenty-eight shipped subjects say: they predate the
   * compositor swap and the old paste road serves them as it always has.
   *
   * `repaintOnly` is the promotion gate (fable-525 §3). A subject promoted off a
   * measurement court has been measured on ONE road — the repaint road, because
   * that is where the courts are run — and admitting it on the old road would be
   * charging somebody for a kind nobody has ever measured there. It is also what
   * keeps the standing autonomy law: a promoted subject IS live behaviour, and
   * `CASTING_REPAINT_SCOPE` is `users:1` today, so the deploy changes nothing for
   * anyone but the founder. When repaint widens, the promoted kinds widen with
   * it — one gate rather than two lists that drift apart (law 4).
   *
   * Required rather than optional, and that is the point of V1: an absent field
   * decides by absence, which is the silent-decider class this vocabulary was
   * rebuilt to remove. The compiler asks the question a reviewer would forget to.
   */
  readonly admittedOn: "everyRoad" | "repaintOnly";
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
  /**
   * WHICH BORN PATH MAY SERVE THIS SUBJECT — {@link admittedOn}'s argument on a
   * second axis (item 8, `CASTING_V2_TWO_PATHS_DESIGN.md` §7.1; shape ruled
   * fable-1455 Q1).
   *
   * `admittedOn` asks *which ROAD has measured this* — the paste road or the
   * repaint road. This asks *which PATH a cast can be born on and still be
   * asked this*, and the two are genuinely different questions: a road is how
   * we paint, a path is what she is wearing.
   *
   * `everyPath` is what all twenty-nine shipped subjects say. Her eyes, her
   * hair and her freckles are hers whichever way she was cast.
   *
   * `wardrobeOnly` is the Two Paths ruling's own consequence: a Basics cast IS
   * the plain black basics — that is the product she bought — so an outfit ask
   * on that path is refused honestly rather than served
   * (`wall_basics_wardrobe`, §7.2). The refusal is DERIVED from this field
   * wherever a branch's path is known, never hand-placed at a call site: a wall
   * that exists as one condition in one function is `STAGE_WORDS`'s own shape,
   * and this design's §1 convicts it.
   *
   * Required rather than optional, for {@link admittedOn}'s reason word for
   * word: an absent field decides by absence, and the compiler asks the path
   * question of every future card the way it already asks the road question.
   */
  readonly bornPathsServing: "everyPath" | "wardrobeOnly";
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  hairShade: {
    heading: "HAIR COLOUR",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  hairPattern: {
    heading: "HAIR TEXTURE",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  hairFinish: {
    heading: "HAIR FINISH",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  eyeShapeFree: {
    heading: "EYE SHAPE",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  brows: {
    heading: "BROWS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  lashes: {
    heading: "LASHES",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  nose: {
    heading: "NOSE",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  lips: {
    heading: "LIPS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  teeth: {
    heading: "TEETH",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  /* THE MEASURED ONE. `cheeks` is what the normalizer returned; without it in
       this list the guard cannot see the collision it was written for. */
  cheekbones: {
    heading: "CHEEKBONES",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  jaw: {
    heading: "JAW",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  chin: {
    heading: "CHIN",
    admittedOn: "everyRoad",
    kind: "degree",
    nouns: ["chin"],
    qualifier: { describe: ", as the chin's own contour, with the jaw left alone" },
    amplitude: { levels: RESTRUCTURE, basis: { reasoned: "as the jaw, over a smaller arc" } },
    plural: false,
    departable: false,
    presentationNoun: null,
    bornPathsServing: "everyPath",
  },
  ears: {
    heading: "EARS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  skinTone: {
    heading: "SKIN TONE",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  /** One sited thing on the skin: a mole, a scar, a birthmark, freckles across
    her nose. NOT ink, and NOT a diffuse condition — see `skinCharacter`. */
  /** Explicitly ruled advisory when accessories were bound: the marks reader
    sits at a measured floor and BYTE ADJUDICATION is its honest instrument.
    Presence-binding it would refund provably delivered freckles. */
  marks: {
    heading: "MARKS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  waist: {
    heading: "WAIST",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  shoulders: {
    heading: "SHOULDERS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  arms: {
    heading: "ARMS",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  build: {
    heading: "BUILD",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  /** Ink is its own subject because D-133 gives it its own law. */
  /** D-133 gives ink its own law, and its own law is about WHERE a design sits.
    A tattoo asked for and not drawn is an absence, not a shade dispute. */
  ink: {
    heading: "INK",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  /** A beard asked for and not grown is an absence. "Stubble rather than the
    full beard she asked for" is a quibble and the absence gate declines it. */
  facialHair: {
    heading: "FACIAL HAIR",
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
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
    admittedOn: "everyRoad",
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
    bornPathsServing: "everyPath",
  },
  /**
   * HORNS — the first kind promoted off a measurement court rather than off a
   * plan (fable-525 §3, `docs/specs/V2_HORNS_VERDICT.md`).
   *
   * Every number below is from a driven court on two of the founder's own
   * delivered faces, and the LIMITS are filed beside them because a card's
   * evidence carries its own error bars:
   *
   *   delivery   6/6 on face 1 (high bun, blunt fringe) and 6/6 on face 2
   *              (short crop), each affirmative agreed by two differently
   *              shaped readers — the narrow D-235 question and a non-leading
   *              "describe what is on and around this person's head" whose
   *              answer the CODE searches. Negative control 0/3 on both faces
   *              and both readers.
   *   detection  bare 0.0000% ×3 · worn 0.61–0.83% (face 1), 0.39–0.87%
   *              (face 2). Found 6/6, silent 3/3, per face and never pooled.
   *   survival   3/3 through an unrelated edit ("her t-shirt is black"), with
   *              identity held 3/3 — by words, and the crop arm also held 3/3.
   *              **SUPERSEDED as a carrier verdict** (founder, 2026-08-15):
   *              both arms were scored on PRESENCE and IDENTITY and neither was
   *              asked whether they are the SAME horns, so the tie decided
   *              nothing. *"It's a feature, otherwise they would change on
   *              every refinement"* — and the ruling generalises to every
   *              promoted kind. Horns carry by crop, per side.
   *   removal    3/3 gone and 3/3 clean on BOTH roads (dropping the carry, and
   *              an absence sentence). No stump, no ghost rim.
   *
   *   THE LIMITS, unedited: survival and removal are n=3 on ONE face; delivery
   *   and detection are 6 per face on two faces. Horns on a shaved head, a
   *   turned head or under a hat are not measured, and the "not visible"
   *   detection class was never bought. `admittedOn: "repaintOnly"` is the
   *   other half of that sentence — the old paste road has measured none of it.
   *
   * `plural: true` because a pair is one ask: "give her horns" is answered
   * absolutely by the next instruction about them rather than added to, which
   * is what keeps removal arithmetic. `departable: true` is measured, not
   * declared — that is what the removal court bought.
   */
  horns: {
    heading: "HORNS",
    admittedOn: "repaintOnly",
    kind: "presence",
    nouns: ["horns", "horn", "antlers"],
    qualifier: { describe: ", growing from this person's own head through the hairline, with the "
      + "hair and skin around the base unbroken" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "horns put opaque material where hair or background was" },
    },
    plural: true,
    departable: true,
    presentationNoun: null,
    bornPathsServing: "everyPath",
  },
  /**
   * WHAT SHE IS WEARING — the first subject with a path condition (item 8,
   * `CASTING_V2_TWO_PATHS_DESIGN.md` §7.1, countersigned fable-1334).
   *
   * # Why the wall it replaces was never the lexicon's
   *
   * *"Put him in a plain black tee"* refuses today, and the census measured WHY:
   * it comes back `wall_unbacked`, the model's *out of scope* with nothing in
   * `STAGE_WORDS` to name — because `tee` was never in that list. **The wall
   * between a customer and a wardrobe edit has always been the MISSING SLOT**
   * (`refineSubjects.ts`: *"This list IS wall (b)"*), so a slot is what opens it,
   * and `STAGE_WORDS` keeps every garment noun it has. The backdrop, the set,
   * the props and the scene are untouched: **this opens the wardrobe and not the
   * shoot.**
   *
   * # `plural: false` IS the rewrite rule
   *
   * §7.1: *an edit REWRITES the stored line rather than appending to it.* One
   * slot holding a whole outfit, restated absolutely — which is what
   * `plural: false` already means everywhere else in this table, and it is why
   * the branch's own `deltas.free.wardrobe` can BE the edited line with no
   * column and no migration (fable-1455 Q2).
   *
   * # `presentationNoun` is non-null, so a Follow never inherits it
   *
   * D-136. A Follow narrows an existing FACE; carrying a jacket into a new
   * person's sheet would be inheriting a costume as though it were an identity.
   *
   * # ⚠ `admittedOn: "repaintOnly"` — and here the field is doing real work
   *
   * A garment is a large, low-frequency region and nobody has measured what the
   * paste road does with one. Admitting it there would charge somebody for a
   * kind that road has never been measured on, which is exactly the sentence
   * that field exists to make somebody write down.
   */
  wardrobe: {
    heading: "WARDROBE",
    admittedOn: "repaintOnly",
    /* Presence: she is wearing this outfit or she is not. The reader answers it
       from the photograph, and there is nothing here about degree. */
    kind: "presence",
    /* The words people actually use, and deliberately WIDER than `STAGE_WORDS`,
       which never held `tee`, `top`, `jeans` or `hoodie` — the census's own
       finding about why a tee met an unbacked wall rather than a named one. */
    nouns: [
      "wardrobe", "outfit", "clothes", "clothing",
      "tee", "t-shirt", "shirt", "top", "jumper", "sweater", "hoodie",
      "jacket", "coat", "blazer", "dress", "suit",
      "jeans", "trousers", "pants", "shorts", "skirt",
    ],
    qualifier: { describe: ", as clothing this person is wearing in the same studio frame — the "
      + "same person, the same pose, the same light, with nothing about the set, the backdrop or "
      + "the props changed" },
    amplitude: {
      levels: REPLACEMENT,
      basis: { reasoned: "an outfit puts different fabric where the old fabric was, over a wide area" },
    },
    plural: false,
    /* A garment CAN leave — but taking it off is not what this subject is for,
       and the honest reason is that the product has no undressed state to leave
       her in. A removal here is an outfit ask like any other. */
    departable: false,
    presentationNoun: "wardrobe",
    /* ⚠ THE FIRST ONE. A Basics cast IS her basics; §7.2's refusal is derived
       from this value rather than written at a call site. */
    bornPathsServing: "wardrobeOnly",
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

/**
 * The subjects only the repaint road may serve — derived, never listed twice.
 *
 * The admission door reads this. A second hand-written list beside it is the
 * mirror law 4 forbids, and the drift would be a customer charged on a road
 * where the kind they asked for has never been measured.
 */
export const REPAINT_ONLY_SUBJECTS: readonly FreeSubject[] =
  subjectsWhere((card) => card.admittedOn === "repaintOnly");
