/**
 * The photoreal-human cohort adapter (plan §I, cohort quality law).
 *
 * Two jobs, and the split between them is the whole architecture:
 *
 *   **The constant.** Framing, camera, light, grade, skin, negatives and
 *   neutral wardrobe are written here, in code, and are identical for all
 *   eight candidates and every roll. The founder ruling is that this layer is
 *   "a code-owned cohort constant that interpreter and treatment output can
 *   never touch — variety lives in *who* the character is, never in how they
 *   are photographed". That is why eight candidates are comparable at all: they
 *   are eight people photographed the same way, not eight art directions.
 *
 *   **The variation.** Everything the brief left open is resolved here too,
 *   deterministically, from weighted vocabularies. This is the other half of
 *   M3's finding: with only a temperature knob for difference, "the eight
 *   candidates read as one man photographed eight times". Difference has to be
 *   authored somewhere, and under Path A that somewhere is this file.
 *
 * The craft in the constant is ported from the legacy photoreal engine, which
 * the founder named as the thing that made the old output excellent.
 *
 * **Which items, and at what strength, is recorded in
 * `docs/specs/CASTING_V2_CRAFT_PORT_AUDIT.md` — not here.** This comment used
 * to carry the list, and the list was wrong: it named A5–A8 as adopted when
 * three of those four were compressed to their headlines, and elsewhere in this
 * file a comment claimed C5's priority hierarchy was ported "in four lines"
 * when nothing in the prompt stated it at all. A comment asserting a port is
 * not evidence of one, and a list maintained by hand next to the code it
 * describes will drift from it again. The audit is the record; it goes item by
 * item through catalog sections A, B, C and D, and every entry is ported,
 * consciously adapted with a reason, or explicitly dropped with a reason.
 *
 * Left behind, and worth knowing without opening that document: the
 * bare-face/undergarment rules, retired as presentation by the
 * wardrobe-baseline ruling — V2 presentation views are clothed.
 */
import {
  DEFAULT_HAIR_COLOURS,
  FINISH_RENDER,
  HAIR_COLOUR_WEIGHTS,
  resolveModifiers,
  describeModifiers,
  resolveTexture,
  resolveWornState,
  describeWornState,
  statedFinish,
  stylesFor,
  TEXTURE_BY_HERITAGE,
  TEXTURE_DEFAULT,
} from "./hairStyles";
import {
  AGE_PHASES,
  ARCHETYPES,
  LOOKS,
  LOOK_KEYS,
  ARCHETYPE_KEYS,
  AGE_BANDS,
  BUILDS,
  ENERGIES,
  ENERGY_KEYS,
  HAIR_FAMILIES,
  HERITAGES,
  type ArchetypeKey,
  type AgeBand,
  type AgePhase,
  type Build,
  type CastingIntent,
  type EnergyKey,
  type Hair,
  type HairColour,
  type HairFamily,
  type Heritage,
  type LookKey,
  type HeritageComponent,
  type RealizedAxes,
  type ResolvedIdentity,
  type Sex,
  EMPTY_STATED_HAIR,
  type StatedHair,
  type StatedSkin,
} from "./castingIntent";
import { describeRealizedAxes, realizeAxes } from "./realizedAxes";
import { resolveHairAxes, type HairTiers } from "./hairResolver";
import { coveringDirective, statedCovering } from "./statedCovering";
import {
  HERITAGE_DEFINE_FLOOR,
  HERITAGE_LEAN_FLOOR,
  HERITAGE_LEAN_SPREAD,
  leanAgeWeights,
  type LeanStrength,
} from "./poolTendencies";
import {
  COMPOSED_DIRECTION_ENABLED,
  HAIR_BIAS_PROSE,
  PARTIAL_DEFERENCE_ENABLED,
  stylingResolutionFor,
  type StylingResolution,
} from "./stylingResolution";
import {
  FACIAL_HAIR,
  type FacialHair,
  type HairModifiers,
  type HairStyle,
  type WornState,
  HAIR_PARTS,
  type HairPart,
} from "../../shared/castingRealization";

/* --------------------------------------------------------- the constant */

/**
 * The casting frame. Fixed for every candidate so that comparing two of them
 * compares two people (E1).
 *
 * Waist-up rather than legacy's headshot: V2's sheet sells a person, and a
 * comp-card crop cannot show bearing. Clothed rather than legacy's bare
 * shoulders, per the wardrobe-baseline ruling — the minimal-clothing plate is
 * an internal VTO slot now, not what the customer looks at.
 */
const FRAMING_FIXED = [
  /*
    CROP (founder gate, 2026-07-31): the first sheets cropped scalps and read
    as mugshots. A casting frame has air above the head — a tight crop reads as
    a booking photo no matter how good the light is.
  */
  "FRAMING: Single subject, waist-up, centred, square to camera, head straight with no tilt.",
  /*
    Hair, not just head. The first version said "the entire head" and crowns
    were still clipped — an afro, an updo or any volume sits well above the
    skull, and a model told to keep the head in frame will happily crop the
    hair off the top of it.
  */
  "CROP: The subject's ENTIRE HAIR SILHOUETTE is inside the frame with natural headroom above it — including afros, curls, volume, updos, buns and any height the hair carries. Clear space between the topmost hair and the top edge.",
  "Nothing on the head is clipped: not the crown, not the hairline, not a single strand at the outline. If the hair is tall, frame wider rather than cropping it.",
  /*
    The ratio has to match what is actually requested of the generator. This
    said 4:5 while every roll asks for 1024×1536, which is 2:3 — the prompt was
    describing a frame the image was never going to be. Legacy named its ratio
    (A2, "sensor ratio 3:4") precisely because a stated crop that fights the
    output crop is where clipped crowns come from.
  */
  "Frame from mid-torso up in a 2:3 portrait. Shoulders fully inside the frame with margin at both sides.",
  "Shoulders level, spine straight, neck relaxed. Arms relaxed at the sides. Mouth closed.",
  /*
    EXPRESSION — composed but ALIVE.

    Two corrections, in order. First: energy words like "fast talker" were
    being read as instructions to act, so candidates came back mid-laugh and
    mid-word, and you cannot read bone structure through a laugh. Then the fix
    overshot — the founder's second grade called the result vacant and grim,
    which is its own failure: a dead-eyed sheet is as uncastable as a
    performing one.

    Legacy solved this with a *whisper* (catalog C3) rather than a suppression
    — "Mouth closed, soft. Eyes direct into lens, quietly alert and
    observant." Present and engaged, holding still. That is the target, and
    the negative list below only forbids performance, never life.
  */
  "EXPRESSION: Eyes looking directly into the lens, engaged and unmistakably alive — someone present in the room, meeting the camera.",
  "Mouth closed, lips together and relaxed. A faint closed-mouth warmth is welcome where the subject's presence calls for it; a broad smile is not.",
  /*
    THE FLOOR YIELDS ITS CENTRE, and this one clause is the whole "everybody
    smiles" fix.

    This block is appended LAST with override authority, so nothing above it can
    outrank it — which meant "the default is interested, someone who wants the
    job" was the expression centre of every sheet the product has ever cast. A
    biker gang leader came back eager. The direction block was describing
    gravity into a prompt that had already decided the person was pleased to be
    there.

    So the MECHANICS stay absolute — mouth closed, no teeth, no acted moment —
    because those are the comparability law and a sheet whose subjects are
    photographed differently cannot be compared. What yields is the CENTRE: a
    named presence in the DIRECTION block may move it, within the same
    closed-mouth bounds. Gravity becomes expressible without a mouth ever
    opening, and the biker's one warm tile still survives, because per-tile
    disposition varies around whatever centre is set.
  */
  "Energy reads in the eyes and brow. Unless the DIRECTION block names a different presence centre, the default is interested rather than neutral — a casting polaroid of someone who wants the job, holding still. Where DIRECTION does name one, that centre governs: it may be cool, grave, flinty or unimpressed, and it is still rendered with the mouth closed and nothing acted.",
  "Never vacant, blank, sedated, grim, sullen or severe. Equally never performing — no mid-laugh, no mid-speech, no acted moment.",
  /*
    BACKDROP: the founder's note was "flat penal grey". Legacy's seamless is
    *bright* and has falloff — it is lit paper, not a painted wall, and that
    luminance is a large part of why legacy output reads as a studio rather
    than an intake room.
  */
  "BACKGROUND: Bright light-grey seamless paper, luminous rather than flat, filling the entire frame. No texture, no pattern, no corners, no floor line, no black borders.",
  "The flash falls off naturally across the paper — brighter immediately behind the subject, gently deeper toward the frame edges. Soft gradient, never a hard vignette.",
] as const;

/**
 * THE ONE SENTENCE THAT SAYS WHAT THIS PERSON IS WEARING — design
 * `CASTING_V2_TWO_PATHS_DESIGN.md` §3.3, item 5 of §10's build.
 *
 * ⚠ **`null` is the whole of today's product and must stay byte-identical.**
 * A roll outside `CASTING_TWO_PATHS_SCOPE`, and every one of the 206
 * production rolls cast before the paths existed, resolves to `unpathed` — and
 * the honest answer there is *paint what you always painted*. So the two
 * sentences below are the ones this file has always carried, character for
 * character, and an arm asserts that rather than trusting the diff.
 *
 * With a line, two things change and both are forced by the same fact:
 *
 *  1. **The latitude goes.** The old sentence says *neutral grey OR
 *     off-white*, and the signed-view spec deliberately names no colour
 *     BECAUSE of that `or` — so a Cast signed in off-white had a package whose
 *     contract it could not satisfy and **the customer paid for our
 *     inconsistency** (`castViewPackage.ts`, first real Sign, 2026-08-02). An
 *     exact stored line is what lets the generator and the judge agree.
 *  2. **"No jackets" has to go with it, and this is not tidying.** That clause
 *     sits four words from a WARDROBE line that may now say *dark canvas work
 *     jacket* — a block contradicting itself in the same breath, which an
 *     image model resolves by picking one, silently, per candidate. The rest
 *     of the negative stays exactly as it is, and it CAN stay because
 *     `wardrobeDoor.ts` refuses headwear and props in the line: the two can
 *     never disagree about those, so only the garment clause was ever in
 *     conflict.
 */
function wardrobeSentences(wardrobeLine: string | null): readonly string[] {
  if (wardrobeLine === null) {
    return [
      "WARDROBE: plain unbranded clothing in neutral grey or off-white — a simple crew-neck tee or plain shirt.",
      "No jackets, no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
    ];
  }
  return [
    /* One outfit for the whole sheet — §B2's comparability law, stated to the
       engine rather than assumed of it: a sheet compares people, not clothes. */
    `WARDROBE: ${wardrobeLine}. Exactly this and nothing else — no extra garments, no layers, and identical on every candidate.`,
    "Nothing beyond the wardrobe described: no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
    /*
      ⚠ THE SENTENCE THAT STOPS A COMPLETE LINE FROM WIDENING THE FRAME — the
      founder's FQ-a answer, 2026-08-23 (relayed fable-1460, shape ruled
      fable-1462).

      # What was measured, and it is not a suspicion

      The Two Paths court rolled both paths and both came back **markedly wider
      than an unpathed cast** — and the FRAMING instruction was byte-identical
      on all three, read off the rows. So nothing above this changed and the
      engine widened anyway. The only new variable is four lines up: a complete
      wardrobe line naming trousers and shoes, where an unpathed roll's sentence
      names a tee and stops.

      He was 50/50 at the strip and pulled it back in, on grounds worth keeping
      here: the master is the identity anchor and DETAIL is its job — every
      downstream instrument reads it — the signed package's full-length views
      already show the whole outfit, and the lighting drifted between the two
      wider shots, which is scene drift an identity product cannot afford.

      # Why it SAYS the whole outfit instead of naming less of it

      Because the alternative needs a rule for which pieces are below the crop,
      and that is a garment taxonomy. It is easy on the two lines we author and
      wrong on the ones this path exists for: is *"bare legs"* a garment, which
      half of *"surgical scrubs and clogs"* is below the waist, where does a
      dress sit. A taxonomy that has to answer those is the counts-as-a-garment
      rule this program refused to invent one slice earlier, and a wrong answer
      silently drops a real garment from the prompt.

      So the conflict is RESOLVED rather than removed: the line stays whole —
      §4's "written complete" rule is what lets the sheet, the hero and the
      three full-length signed views agree — and the frame is told, in the block
      that already carries override authority, that the part below the crop is
      not an instruction to widen.

      # Its stated risk, and what settles it

      This is a longer FRAMING block against an engine where **prompt context is
      not additive** in this product's own measurement, and it asks the model to
      hold two things at once. It is bought rather than assumed: one wardrobe
      roll is read AT THE PIXELS after this lands. If the frame is still wide,
      the pre-agreed fallback (fable-1462) is a decomposition scoped to the two
      lines WE author — where no taxonomy is needed because we wrote them — with
      a customer-named line left whole under this sentence.
    */
    "The frame stays waist-up whatever this WARDROBE line describes below it. The outfit is "
    + "stated in full so the record is complete; trousers, shorts, footwear and anything else "
    + "below the crop are simply out of shot. Never widen the frame, zoom out, or change the "
    + "crop to show them.",
  ];
}

function framingBlock(wardrobeLine: string | null): string {
  return [...FRAMING_FIXED, ...wardrobeSentences(wardrobeLine)].join(" ");
}

/**
 * A2 + A3 + A4, kept close to the legacy wording because the wording is the
 * craft — a named sensor class and aperture produce a lens signature that
 * "high quality photo" does not.
 */
const CAPTURE_SENTENCES: readonly string[] = [
  "CAMERA: Medium-format sensor, Hasselblad class. 85mm equivalent, f/5.6–f/8, sensor ratio 2:3. Subject sharp front to back.",
  "Fine luminance-dominant noise, barely visible, like fine sand. No colour noise.",
  "LIGHTING: Direct on-camera or slightly off-axis front flash. Sharp, honest, bright and even light with shadows falling directly behind the subject. No gels, no diffusion.",
  /*
    A3's deferral — but pointed at something that exists.

    Legacy deferred to "the casting spec's skin finish", a field the user
    picked from a matrix (A9). V2 has no such field, so the sentence was
    deferring to nothing: an instruction with a dangling referent, which the
    model resolves by ignoring it. The craft in A3 is that the light block must
    NOT decide the sheen — so the deferral is kept and given a real referent.
  */
  "How the skin RESPONDS to this light — specular, matte, dry or dewy — is decided by THIS person: their age, their condition, their work and anything the character description says about their skin. The lighting block never flattens that into one sheen.",
  "Eight candidates must not share one skin. A weathered outdoor face and a groomed indoor one respond to the same flash completely differently, and that difference must be visible.",
  "Specular highlights sit on the forehead, nose and cheekbones where the flash strikes.",
  "COLOUR: Neutral daylight, 5500–5800K. Skin tones warm and dimensional with visible subsurface scattering. No stylized grading, no teal-orange, no filter look, no cool clinical cast.",
];
const CAPTURE = CAPTURE_SENTENCES.join(" ");

/**
 * A5–A10. The macro protocols are the difference between a face and a render:
 * dead glassy eyes and drawn-on brows are the two tells a casting director
 * sees first, and each needs naming individually or the model averages them
 * away.
 */
/**
 * The three skin-REALISM sentences, named apart from the anatomy that follows
 * them because the author road's locked block (`houseBlock.ts`) takes exactly
 * these and none of the rest (ruling §5c). Joined below into the same string
 * as before — the house prompt's bytes do not move.
 */
const REALISM_SENTENCES: readonly string[] = [
  "REALISM: RAW skin with high micro-contrast — visible pores, vellus fuzz, uneven tone, real blemishes and asymmetry.",
  /*
    A1's operative half, which this file had compressed away. "High
    micro-contrast" is a term; the sentence that makes it renderable is the one
    naming what it produces — tactile, three-dimensional local contrast that
    makes a surface feel physical. Without it the phrase reads as a quality
    adjective and the model treats it as one.
  */
  "Skin, vellus hair and fine texture carry tactile, three-dimensional local contrast that makes the surface feel physical — a face you could touch, not a surface that has been rendered.",
  "No beauty retouching, no surface smoothing, no CGI sheen, no painterly softness, no excessive symmetry.",
];
const SKIN_AND_FEATURES = [
  ...REALISM_SENTENCES,
  "EYES: the iris is not a flat disc — render radial striations and fibre-like collagen structure, lighter near the pupil and deepening to richer saturation toward the outer edge, closed by a distinct dark limbal ring where the iris meets the sclera.",
  "CATCHLIGHTS: one or two small, sharp specular reflections of the studio flash, high on the cornea. Without them the eyes read dead. Render the wet corneal gloss over the whole eye surface — visible, not glassy.",
  "SCLERA: never pure white — a faint warm undertone with subtle vascularity toward the corners. A perfectly white sclera looks synthetic.",
  /*
    OCULAR SYMMETRY — founder-reported, 2026-08-01, and a legacy artifact too.

    Mismatched pupils recur across sheets, and the realism block above is part
    of the cause: "real blemishes and asymmetry" plus "no excessive symmetry"
    is a licence the model applies to the whole face, eyes included. Facial
    asymmetry is what makes a face real; pupil asymmetry is what makes it look
    generated — a viewer reads it as a rendering fault or a head injury, never
    as character.

    So the exception has to be stated as loudly as the rule it carves out of.
    Same shape as the interpreter's restraint doctrine: a one-directional
    instruction gets over-applied until its other half is named.
  */
  "PUPILS: perfectly round, concentric within the iris, and IDENTICAL to each other in size and shape. Under studio flash both are moderately constricted, with a clean sharp edge where pupil meets iris. Never dilated, never oversized.",
  "Both catchlights match — same count, same relative position — because they come from one light. Both eyes are open to the same degree and converge on the lens together.",
  "The asymmetry licensed above is bone, soft tissue and skin. It is NEVER the eyes: mismatched pupils, a wandering eye or uneven catchlights read as a rendering fault, not as character, and fail the candidate.",
  /*
    A6/A7/A8 restored to full strength. Each had been compressed to its
    headline, and in every case what was cut was the anti-uniformity half —
    varying lash length, colour variation across the lip and through the brow.
    That half is the craft: a lash line of identical strands and a brow of one
    flat colour are the two tells that survive an otherwise convincing face.
  */
  "LASHES: individual strands clumping in irregular groups, with varying length and slight curl variation, each catching light on its own and casting micro-shadows on the skin below. Unless the description states otherwise, bare and natural — never a solid dark mass, never uniform.",
  "LIPS: vertical plicae and a natural moisture gradient, glossier at the centre and drier toward the edges, with natural colour variation from the vermillion border inward. Lips have topography, never a flat matte fill. The border is organic and slightly irregular, never a vector-sharp line.",
  "BROWS: individual hairs with visible growth direction — upward near the nose, arching laterally, tapering at the tail — with natural gaps, overlapping strands and subtle colour variation from root to tip. Never a solid drawn-on block.",
  "Vellus fuzz is translucent and near-invisible, catching light only at extreme angles — it is NOT terminal hair, NOT stubble, NOT dark and NOT pigmented.",
  /*
    STRUCTURAL FEATURES — licensed explicitly (founder ruling, 2026-08-01).

    Two seed tiles asked for a broken nose and neither rendered one: the face
    came back intact and handsome both times. The realism block was fighting
    the brief. "No excessive symmetry" nudges toward an *interesting* face, but
    nothing above licensed actual structural damage, and the model's prior for
    a studio portrait is an undamaged one — so a named permanent feature lost
    to the prior every time.

    This does not invent features. It permits the ones the brief names, which
    is the difference between a casting system that can cast a retired boxer
    and one that quietly recasts him as a model.

    The full marks vocabulary — the ink/scar/pigmentation/piercing detector and
    its persistence rules (catalog H2/H3) — is scheduled with M12. This clause
    is the narrow part that unblocks briefs today.
  */
  /*
    WIDENED to ordinary feature GEOMETRY (D-129, founder ruling 2026-08-03).

    The rider proved rather than presumed: "a model with a button nose" and "a
    model with a beauty mark above her lip" both reached 8 of 8 prompts — and
    NEITHER did so through this licence. They travelled as `characterNotes`,
    the free-text character-detail channel, which is exactly the accidental
    routing D-124 closed for faith coverings.

    The enumeration was marks and damage. Every example was a deviation from an
    unmarked face, so nothing told the model that "do not idealise it away, a
    named feature that fails to appear is a failed candidate" applied to the
    SHAPE of a nose. And shape is precisely where the beauty prior is
    strongest: a button nose is exactly the sort of thing it "corrects" toward
    a conventional one.

    So the list now names geometry alongside damage. The teeth were always the
    point of this clause; they now reach the features people actually describe.
  */
  "STRUCTURAL FEATURES: When the character description names a permanent physical feature — the shape of the nose, cheekbones, jaw, chin, lips or teeth, a broken or crooked nose, a scar, a cleft, cauliflower ear, a missing or chipped tooth, asymmetry, a birthmark, freckling, active acne or acne scarring, weathered or sun-damaged skin, a shaved head, a tattoo — render it plainly and accurately as a real, permanent part of this person.",
  "This covers ORDINARY feature shape as much as damage: a button nose, a strong jaw, high cheekbones, a receding chin, thin lips, gapped or crowded teeth. These are how a face is built, not flaws to be resolved toward a conventional one.",
  "These are casting facts, not blemishes to correct. Do not idealise them away, do not soften them, and do not substitute an unmarked face. A named feature that fails to appear is a failed candidate.",
  "Render only what the description names. Never invent damage, scars or ink that was not asked for.",
  /*
    STATED ACCESSORIES — the same licence, for the same reason, after the same
    kind of evidence (founder verification, 2026-08-02).

    "A model in her 20s wearing chunky glasses" rendered ZERO glasses. Two
    clauses in this very constant were overruling the user: the no-accessories
    line a few blocks up, and the AUTHORITY paragraph's instruction to ignore
    implied props. Both are correct about UNSTATED accessories — the frame is a
    plain grey tee on seamless paper and a prop nobody asked for is exactly what
    the framing law exists to keep out — and both were being applied to words
    the user actually typed.

    That is the drop-a-stated-fact class, arriving through the constant rather
    than through the interpreter, which is a place it had not been found before.
    It also quietly emptied a ratified product rule: eyewear and jewelry are
    "stated-only", and stated-only is worth nothing if stated does not work.

    Deliberately narrow. It licenses WORN accessories the description names, on
    the same footing as a named scar: rendered plainly, and a failure to appear
    is a failed candidate. It does not widen to props, to anything held, or to
    the scene — those stay banned, and the clause says so rather than leaving it
    to be inferred.

    The echo DOES speak these now, and that changed after this comment was
    written. An accessory is still not a lock — it neither varies across the
    eight nor pins an identity axis — but the echo claims to say what the brief
    said, and staying silent about a stated fact made it quietly incomplete. It
    reads them back as the user's own words, never as an adjustable chip.
  */
  "STATED ACCESSORIES: When the character description names something WORN on the face or body — glasses, a nose stud, a named earring, a chain, a wedding ring — render it plainly and accurately as this person's own, exactly as described. A named accessory that fails to appear is a failed candidate.",
  "This licenses only what the description names. It does NOT permit props, objects held in the hands, headwear, or anything in the scene: those remain forbidden, and an accessory the description did not name must never be invented.",
  /*
    STATED MAKEUP — the same licence again, and the third time this exact shape
    has been needed (D-116, founder ruling 2026-08-03).

    Makeup was unsayable at three layers at once: this constant's LASHES clause
    calling for bare, un-mascaraed strands; the interpreter told never to write
    makeup into a composed direction; and no carve-out anywhere. **None of that
    was decided.** Three independent restraints happened to agree, and the
    result quietly overruled anybody who asked for something.

    The dice stay bare, and that half is deliberate: eight bare faces are
    comparable AS PEOPLE, eight variously made-up ones are comparable as looks.
    What changes is that a stated fact now outranks the default, exactly as it
    does for a scar and for a pair of glasses.

    Narrow in the same way as its two siblings: it licenses what the description
    NAMES, on the face, and it does not become permission to glamorise. The
    failure clause is the one that gives the licence teeth — without it this is
    a sentence the prior can ignore, which is precisely what happened before.
  */
  "STATED MAKEUP: When the character description names makeup — mascara, a red lip, gloss, blush, liner, a smoky eye, bold brows — render it plainly and accurately as worn by this person, exactly as described. Named makeup that fails to appear is a failed candidate.",
  "This licenses only what the description names. Makeup is never added to a face the description left unmade: the default is a bare, unmade face, and it stays that way unless the words ask otherwise.",
  /*
    STATED COVERINGS — the fourth door, and the one that had been standing open
    by accident (D-124, founder ruling 2026-08-03).

    A faith covering DID render — eight of eight on a paid verification — but it
    rendered only because it rode the free-text character-detail channel. The
    accessories licence directly above **excludes headwear**, and the framing
    block forbids hats outright. Both are correct about UNSTATED headwear and
    neither was ever aimed at a person's own faith garment; the correct
    behaviour was correct by routing rather than by law, and a future tightening
    of the headwear exclusion would have taken faith presentation with it in
    silence.

    So the exception is named. What it does NOT do is infer: no covering ever
    follows from a heritage, a name, or a faith the user mentioned — that is
    stereotype authoring, and the unstated case verified at zero of eight and
    stays there. The code decides only WHETHER the user said it; the STATED
    COVERING block above says how it sits.
  */
  "STATED COVERINGS are the ONE exception to the headwear and hat exclusions above: where a STATED COVERING block appears, that garment is this person's own and is rendered exactly as that block describes. It overrules every no-hats and no-headwear line in these instructions.",
  "This exception is narrow and never inferred. No head covering is added to a person the description left uncovered — not from their heritage, their name, their occupation, or any faith the description mentions. Absent a STATED COVERING block, the head is bare and the exclusions above hold in full.",
].join(" ");

/**
 * B2 — the ethnicity phenotype lock, restored by the craft-port audit
 * (2026-08-01).
 *
 * This was the audit's most consequential absence. Legacy placed it FIRST in
 * every new-generation prompt; V2 had nothing at all, while making heritage its
 * PRIMARY diversity axis. Ethnicity washing — the model drifting toward a
 * Eurocentric face when handed pale skin or light hair, and mixed heritage
 * collapsing to one parent — is therefore the failure mode V2 was most exposed
 * to and least defended against.
 *
 * The craft is that heritage is defended as BONE, independent of styling. A
 * heritage that survives only until the brief mentions blonde hair is not a
 * lock.
 */
const IDENTITY_INTEGRITY = [
  "HERITAGE IS BONE: the subject's stated heritage determines eye shape and set, brow ridge, nose bridge and width, cheekbone height and projection, jaw and chin form, lip form, and hair growth pattern.",
  "These are determined by bone and genetics. They do NOT change with hair colour, skin tone, grooming or styling. A platinum-blonde East Asian person still has East Asian bone structure and eyes; a pale-skinned West African person still has West African bone structure.",
  "Where two heritages are named, BOTH must be legible in the face. Never collapse a mixed-heritage subject into one parent, and never resolve them into a generic ambiguous face that reads as neither.",
  /*
    D1/D4's half that survives without a colour picker. V2 has no eye-colour or
    skin-tone field, so the fifteen engineered iris descriptions have nothing to
    attach to — but the diversity risk they existed to solve is live: with no
    direction at all, every candidate defaults to mid-brown eyes and the sheet
    loses an axis of difference it should have had for free.
  */
  "When the description does not state them, eye colour, hair colour and skin tone belong to this specific person and follow plausibly from their heritage and age. Do not default every subject to the same mid-brown eyes, and do not push a heritage toward its lightest or darkest stereotype.",
  /*
    D2, which the audit had recorded as "folded in" and Fable's skim showed was
    not. The clause above resolves WHETHER an unusual colour is allowed; D2's
    craft is HOW it renders — as this person's own pigment, not as an applied
    product. Legacy learned this the hard way: without it, "mint eyes" comes
    back with a visible contact-lens ring and "platinum on dark skin" comes back
    looking like an obvious dye job.

    It also has to be stated separately because the sentence above leans the
    other way: "follow plausibly from their heritage" is prior-reinforcing
    language, and on its own it invites reconciling a stated mint eye back to
    brown.
  */
  "When the description DOES state a colour, render it as this person's natural born pigment — real iris tissue, real grown hair — never as contact lenses, a visible dye job, a wig, or anything applied.",
  /*
    A13, in the only form a per-candidate prompt can honestly carry it.

    Legacy told the spec-writing text model "each cast should feel like a
    DIFFERENT PERSON" and "two casts with the same brand and ethnicity should
    not produce similar feature sets". V2 has no spec-writing stage, and each
    candidate is generated without sight of the other seven, so a
    cross-candidate instruction would be a claim the prompt cannot keep. What
    ports is the per-face half: specificity over averageness.
  */
  "SPECIFICITY: this is one particular person, not a type. Two or three features should sit clearly beyond average — the nose, the jaw, the brow, the ears, the hairline — and read as inherited, not as damage.",
  "Those features must still belong to someone this casting category would book: memorable within the casting, never disqualified by it.",
  "Never render the smooth, symmetrical, conventionally attractive average face that every casting brief converges on. A face a casting director would remember is the requirement.",
].join(" ");

/**
 * C5 — the signal priority hierarchy, restored by the craft-port audit.
 *
 * The code has always resolved locks first (`resolveCandidateIdentity` fills
 * only the gaps), and a comment in this file claimed that was C5 "in four
 * lines". It is not: code precedence decides what goes INTO the prompt, and
 * says nothing about how the image model resolves a conflict between two things
 * that are both in it. DIRECTION could quietly pull a face away from a stated
 * heritage or build, and nothing said it must not.
 *
 * Legacy's worked example is the one V2 could not express: pale skin on a West
 * African subject means pale-skinned WITH West African bone structure — not a
 * different person.
 */
const PRIORITY = [
  "PRIORITY WHEN INSTRUCTIONS CONFLICT: the SUBJECT block is absolute. Every fact stated there — sex, age, heritage, build — outranks the DIRECTION block, the LOOK, the expression whisper and any aesthetic association they carry.",
  "Direction shapes HOW a subject is cast; it never changes WHO. If a direction's usual face disagrees with a stated fact, the stated fact wins and the direction bends around it.",
  "An unusual combination is a deliberate casting choice, never an error to reconcile: pale skin on a West African subject means a pale-skinned person with West African bone structure, not a different person.",
].join(" ");

/**
 * A12, plus the two additions this milestone's evidence demands: no text of
 * any kind, and no scene. The mug that started all of this said "World's
 * Okayest Handyman", so text is named in the negative list as well as being
 * structurally excluded upstream.
 */
const NEGATIVE_SENTENCES: readonly string[] = [
  "PHOTOREALISTIC ONLY — a real photograph from a real camera.",
  "NO text, letters, numbers, words, logos, captions, labels, watermarks or signage anywhere in the frame.",
  "NO props, furniture, environment, location or scene — the backdrop is empty studio paper.",
  "NO open mouth, no showing teeth, no laughing, no acted expression, no hand gestures near the face.",
  "NO CGI, cartoon, anime, 3D render, illustration, plastic skin, doll look, wax figure, perfect symmetry, or beauty-app smoothing.",
];
const NEGATIVES = NEGATIVE_SENTENCES.join(" ");

/**
 * The override sentence.
 *
 * This paragraph, and the fact that it is appended LAST, is the actual
 * guarantee behind the precedence fix. Everything above it describes a person;
 * this says the photograph is not up for negotiation regardless of what the
 * description asked for. A capped free-text field can still mention a garage —
 * it cannot outrank a rule that is stated after it and claims authority over
 * it.
 */
/**
 * ⚠ AMENDED IN EXACTLY ONE PLACE WHEN A WARDROBE LINE EXISTS (§3.4).
 *
 * The middle sentence is what makes the Wardrobe path impossible today: it
 * tells the engine to ignore any implied COSTUME and render the plain studio
 * frame. Leave it standing beside a composed WARDROBE line and the engine has
 * two instructions about one thing — and the one it is likelier to obey is
 * the one claiming authority, so the outfit the customer chose would be
 * discarded by the very paragraph that guarantees the photograph.
 *
 * So it is AMENDED rather than deleted, and as narrowly as the sentence allows:
 *
 *   - the frame, the capture, the realism and the negatives keep ABSOLUTE
 *     authority — the first and third sentences do not move at all;
 *   - LOCATION, ACTIVITY, PROPS and TEXT are still ignored, by name;
 *   - only the word *costume* leaves the ignore-list, and a sentence naming the
 *     WARDROBE line as the sole clothing instruction takes its place.
 *
 * The distinction that licenses it: it is no longer the DESCRIPTION setting the
 * outfit. The line is a code-owned field the code composed, through
 * `wardrobeDoor.ts`, and it arrives inside the constant rather than inside the
 * free text — which is why a description implying a costume is still ignored
 * on this path exactly as it is on the other.
 */
function overrideBlock(wardrobeLine: string | null): string {
  return [
    "AUTHORITY: The FRAMING, CAPTURE, REALISM and NEGATIVE rules above override the character description entirely.",
    wardrobeLine === null
      ? "If the description implies a location, an activity, a costume, a prop, or any text, ignore that implication and render this person in the plain studio frame described here."
      : "If the description implies a location, an activity, a prop, or any text, ignore that implication and render this person in the plain studio frame described here. The WARDROBE line above is the only clothing instruction and it is absolute: render exactly that, whatever else the description suggests they might wear.",
    "The description says WHO to cast. This block says HOW to photograph them, and it always wins.",
  ].join(" ");
}

/**
 * Everything code owns, in order, as one block.
 *
 * PRIORITY sits last before the authority paragraph on purpose: it resolves
 * conflicts, so it has to be read after the things it arbitrates between.
 */
/**
 * The blocks, in order. ONE list — the constant and its guard both read it.
 *
 * There used to be a second, hand-maintained array for the guard, and it was
 * missing `SKIN_AND_FEATURES`: the most craft-dense block in the file was the
 * one block nothing checked, including in the version the craft-port audit
 * declared a working guard. Patching that omission left the shape that caused
 * it in place. A parallel list of the same thing will always drift; deriving
 * both from one array is what actually closes it.
 */
export function cohortConstantBlocks(wardrobeLine: string | null): readonly string[] {
  return [
    framingBlock(wardrobeLine),
    CAPTURE,
    SKIN_AND_FEATURES,
    IDENTITY_INTEGRITY,
    NEGATIVES,
    PRIORITY,
    overrideBlock(wardrobeLine),
  ];
}

/**
 * The code-owned constant for one roll.
 *
 * ⚠ **A FUNCTION NOW, AND THE GUARD READS THE SAME FUNCTION.** Two of these
 * blocks depend on what this person is wearing, so a constant that could not
 * take the line would have forced a second copy of the framing text somewhere
 * — the parallel-list shape this file's own list docblock was written about,
 * where `SKIN_AND_FEATURES` sat unguarded because a hand-kept second array had
 * forgotten it.
 */
export function photorealHumanConstant(wardrobeLine: string | null): string {
  return cohortConstantBlocks(wardrobeLine).join("\n");
}

/*
  ⚠ `PHOTOREAL_HUMAN_CONSTANT` WAS HERE AND IS GONE, and the deletion door is
  what asked the question.

  It was `CONSTANT_BLOCKS.join()` — the one code-owned constant, read by
  `composeCandidatePrompt`. Once composition takes a wardrobe line, that caller
  reads `photorealHumanConstant(line)` instead, and the constant was left with
  test callers only: the uncalled-export shape, in a file where a second name
  for the same sentence is exactly how the framing text once drifted. The
  sweep listed it as `unread` on the first `pnpm check` after the wiring, the
  door refused, and the honest disposition was to delete rather than to write a
  row keeping a name alive for its tests. Callers wanting today's constant ask
  for it by its meaning: `photorealHumanConstant(null)`.
*/

/**
 * The blocks the SIGNED PACKAGE composes from — one authority, two frames.
 *
 * A sheet candidate and a package view are different photographs: the sheet is
 * a waist-up casting polaroid, the package is a comp card that has to show a
 * whole body from four sides. So `FRAMING` above is deliberately NOT in here —
 * the package authors its own per-angle framing (`castViewPackage.ts`).
 *
 * Everything else must be identical, and is shared by reference rather than
 * re-typed: how the picture is captured, what a real face and real skin look
 * like, what must never appear in the frame, and the paragraph that says the
 * photograph is not up for negotiation. Two copies of the anti-CGI language
 * would drift, and the version that drifted would be the one nobody was
 * grading.
 */
export const PHOTOREAL_HUMAN_BLOCKS = {
  capture: CAPTURE,
  realism: SKIN_AND_FEATURES,
  identityIntegrity: IDENTITY_INTEGRITY,
  negatives: NEGATIVES,
  /*
    THE SENTENCES, for the author road's locked block (`houseBlock.ts`, ruling
    §5c): it derives from these rather than copying them, and names each
    sentence it leaves out. The joined strings above are what the house
    composer sends and they are unchanged.
  */
  framingSentences: FRAMING_FIXED as readonly string[],
  captureSentences: CAPTURE_SENTENCES,
  realismSentences: REALISM_SENTENCES,
  negativeSentences: NEGATIVE_SENTENCES,
  /*
    The signed package's authority paragraph, and it takes the UNPATHED form
    deliberately for now: the package composes its own wardrobe spec
    (`CAST_PACKAGE_WARDROBE_SPEC`), and moving it onto the line is item 6 of
    this build, where the five views and the judge start reading one answer.
    Handing it the amended sentence here — with no line beside it — would take
    the costume guard off the package and give it nothing in exchange.
  */
  authority: overrideBlock(null),
} as const;

/* --------------------------------------------------------- determinism */

/** FNV-1a. A stable number from a string — no randomness anywhere in a roll. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/**
 * Weighted pick, D14's lesson made general.
 *
 * The legacy randomizer moved off a uniform distribution because "the old
 * uniform pick over eight colors gave Silver+Platinum a combined 25% — every
 * fourth randomized cast read grey/white". A sheet is a casting pool, and a
 * casting pool that is uniform over rare options does not look like one.
 */
function weightedPick<T extends string>(entries: readonly (readonly [T, number])[], seed: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Roughly a real casting call, not a uniform sample of decades. */
const AGE_WEIGHTS: readonly (readonly [AgeBand, number])[] = [
  ["teens", 6],
  ["20s", 30],
  ["30s", 26],
  ["40s", 17],
  ["50s", 11],
  ["60s", 7],
  ["70s+", 3],
];

const BUILD_WEIGHTS: readonly (readonly [Build, number])[] = [
  ["slight", 10],
  ["slim", 22],
  ["average", 32],
  ["athletic", 20],
  ["broad", 11],
  ["heavy", 5],
];

/**
 * Heritage variation when the brief did not say.
 *
 * Flat across the ten, because weighting this list would be encoding a claim
 * about who "should" show up in an unspecified casting call — and the founder
 * ruling calls unstated heritage "a prime treatment-variation axis" for
 * exactly the reason that real casting diversity is the desirable outcome.
 * D15's 30% blend chance carries over.
 */
function varyHeritage(
  position: number,
  rollSeed: string,
  lean: Heritage | null = null,
  strength: LeanStrength | null = null,
): HeritageComponent[] {
  /*
    THE CATEGORY'S POOL, with a real tail — the heritage lean.

    Applied HERE rather than by re-weighting the cycle below, because the cycle
    is not a sample: it walks the vocabulary to guarantee eight distinct
    heritages, and weighting a walk is meaningless. So a majority of positions
    take the leaned heritage and the REST STILL CYCLE — which is what keeps the
    tail genuinely varied rather than a second copy of the majority.

    Five or six of eight, chosen per roll so two rolls of the same brief do not
    lean on the same tiles. The remaining two or three are the ruling made
    mechanical: a k-pop sheet with no room for a Thai or Chinese idol is a
    stereotype rather than a casting.
  */
  if (lean) {
    const spread =
      strength === "defines"
        ? HERITAGE_DEFINE_FLOOR
        : HERITAGE_LEAN_FLOOR + (hash(`${rollSeed}:heritageLean`) % HERITAGE_LEAN_SPREAD);
    const offset = hash(`${rollSeed}:heritageLeanOffset`) % 8;
    if ((position + offset) % 8 < spread) return [{ heritage: lean, pct: 100 }];
  }
  return varyHeritageEvenly(position, rollSeed);
}

function varyHeritageEvenly(position: number, rollSeed: string): HeritageComponent[] {
  /*
    Cycle, do not sample.

    Heritage is the PRIMARY diversity axis when the brief leaves it open, and a
    hash-sample over ten values collides constantly — a graded sheet came back
    Polynesian, Polynesian, Middle Eastern, Middle Eastern, Latino, and read as
    four people rather than eight. Cycling with a per-roll offset guarantees
    eight distinct heritages out of ten while keeping two rolls of the same
    brief from opening identically. Same reasoning as the energy axis, which
    was cycled from the start for exactly this reason.
  */
  const offset = hash(`${rollSeed}:heritage`) % HERITAGES.length;
  const primary = HERITAGES[(position + offset) % HERITAGES.length] as Heritage;

  // D15's 30% blend chance, kept.
  const blendRoll = hash(`${rollSeed}:blend:${position}`) % 10;
  if (blendRoll >= 3) return [{ heritage: primary, pct: 100 }];

  const step = 1 + (hash(`${rollSeed}:blend2:${position}`) % (HERITAGES.length - 1));
  const secondary = HERITAGES[
    (position + offset + step) % HERITAGES.length
  ] as Heritage;
  return [
    { heritage: primary, pct: 60 },
    { heritage: secondary, pct: 40 },
  ];
}

/**
 * Sex, when unstated.
 *
 * Alternating rather than weighted: over eight candidates a coin flip lands
 * 8–0 often enough to matter, and a sheet that is accidentally all-male for an
 * open brief is a worse outcome than a slightly artificial balance.
 *
 * Non-binary is never inferred (H11) — it appears only when the brief says so,
 * which means it arrives as a lock and never reaches this function.
 */
function varySex(position: number, rollSeed: string): Sex {
  // Strict alternation off a per-roll offset, not a per-candidate sample. A
  // coin flip lands 8–0 often enough to matter, and an accidentally all-male
  // sheet for an open brief is a worse outcome than an even split. The offset
  // is what stops every sheet starting with the same one.
  return (position + (hash(`${rollSeed}:sex`) % 2)) % 2 === 0 ? "female" : "male";
}


/* ------------------------------------------------------------------ hair */

/*
  The heritage palettes moved to `hairStyles.ts` (2026-08-01) so the sheet-level
  taste pass can reach them without importing this file — that direction is a
  cycle, since this file already imports the pass. Hair vocabulary now lives in
  one place, which is where it should have been.
*/

/** Greying is a function of age, so it is applied after colour, not instead. */
const GREY_CHANCE: Record<AgeBand, number> = {
  teens: 0,
  "20s": 0,
  "30s": 4,
  "40s": 14,
  "50s": 38,
  "60s": 58,
  "70s+": 74,
};

/**
 * The COLOUR only — and the silhouette that used to be drawn here is D-87.
 *
 * `Hair` carried a `family` alongside its colour, drawn from its own weighted
 * list, before named cuts existed. When `hairStyle` landed it brought its own
 * family, coherent with the cut by construction, and that is the one the
 * composer reads. The old draw was never removed, so every candidate persisted
 * a SECOND silhouette that nothing composed and that routinely contradicted the
 * first: real sheets carried `hairStyle: buzz cut / shaved` beside
 * `hair: { family: "long" }`, a record claiming a person has long hair and a
 * buzz cut at once. A follow then inherited the inert one.
 *
 * Found by the M7 axis sweep's own reasoning — persisted, never composed —
 * before the sweep existed, and logged as D-87 rather than folded in silently.
 *
 * So the family is no longer drawn. It is DERIVED from the cut at assembly, and
 * the two can no longer disagree because there is only one of them.
 */
function varyHairColour(
  heritage: HeritageComponent[],
  ageBand: AgeBand,
  position: number,
  rollSeed: string,
): HairColour {
  const primary = heritage[0]?.heritage ?? "";
  const palette = HAIR_COLOUR_WEIGHTS[primary] ?? DEFAULT_HAIR_COLOURS;
  let colour = weightedPick(palette, hash(`${rollSeed}:hairColour:${position}`));

  const greyRoll = hash(`${rollSeed}:grey:${position}`) % 100;
  if (greyRoll < GREY_CHANCE[ageBand]) {
    // Salt-and-pepper reads as grey; a full head of white belongs to the
    // oldest bands, where it is common rather than remarkable.
    colour = ageBand === "70s+" && greyRoll < GREY_CHANCE[ageBand] / 2 ? "white" : "grey";
  }
  return colour;
}

/**
 * Assemble the hair record from the colour and the cut that actually composed.
 *
 * One place, so the family cannot be sourced from anywhere but the cut.
 *
 * **No cut means no hair record.** The first version fell back to "mid-length",
 * and the comment justifying it — "the record is about to be blanked anyway" —
 * was wrong on the one path that reaches it. Follow a candidate whose brief had
 * stated its hair: the parent's style was blanked by deference, so the anchor
 * carries no cut, and the follow resolves at PRESCRIBE tier because anchored
 * styling renders at full fidelity. `withHonestRecord` only blanks at the
 * stated tier, so nothing downstream would have cleaned it up. The candidate
 * would have persisted a mid-length silhouette and a freshly drawn colour
 * beside a null cut and a prompt with no hair line in it — inventing exactly
 * the kind of fact D-87 was written to stop inventing.
 *
 * The old anchor-family arm was dead code as well: whenever `anchor.hair`
 * exists, `anchoredRealized` holds the parent's cut, so `style` is non-null.
 */
function hairRecord(colour: HairColour, style: HairStyle | null): Hair | null {
  return style ? { family: style.family, colour } : null;
}

/**
 * What a follow inherits from the candidate it follows.
 *
 * Deliberately NOT merged into `CastingIntent`, and that distinction is the
 * whole design. A non-null intent field means *the brief said it* — that
 * convention feeds `lockFactsOf`, `validateLocks` and the brief echo. An
 * anchored trait smuggled in there would become a lock the user never wrote, a
 * validator violation the moment a cousin legitimately varies, and a fact in
 * the echo's sentence claiming the brief pinned something it never mentioned.
 *
 * The previous `followFrom` did exactly that, copying the parent's heritage
 * into the intent — which under the founder's ruling is doubly wrong, because
 * an inherited *lock* produces eight clones with identical heritage rather
 * than eight cousins.
 */
/**
 * What a follow inherits — and the unpinnable axes are NULLABLE, because a user
 * can unpin one.
 *
 * Unpinning used to be silently inert on a follow. `applyUnlocks` cleared the
 * field from the intent, and then the resolver read the anchor instead —
 * `intent.sex ?? anchor?.sex` — so the chip vanished from the sheet and nothing
 * about the casting changed. An unlock has to clear the anchor's supply of that
 * axis too, or it is a control that does nothing.
 */
export type FollowAnchor = {
  /** Locked unless unpinned. "Sex holds absolutely" — the adapter never varies it. */
  sex: Sex | null;
  /** The primary component holds; the secondary varies per candidate. */
  heritage: HeritageComponent[];
  ageBand: AgeBand | null;
  hair: Hair | null;
  look: LookKey | null;
  /**
   * The realized axes carry on a follow too, for the same reason hair does: a
   * trait you never authored is a trait you cannot inherit, and the founder
   * followed a face expecting its eyes. Anchors, never locks — they bias the
   * neighbourhood and stay out of the lock contract entirely.
   */
  realized: RealizedAxes | null;
};

/**
 * Heritage in a follow: cousins, not clones and never unrelated.
 *
 * The parent's PRIMARY heritage is kept on every candidate — that is the
 * "never unrelated" half, and it also keeps `IDENTITY_INTEGRITY` honest, since
 * a mixed-heritage parent never collapses to one parent. What varies is the
 * second component: some candidates carry the parent's blend, some are
 * single-heritage, some pick up a different second heritage. Eight relatives
 * rather than eight copies.
 */
function anchoredHeritage(
  anchor: FollowAnchor,
  position: number,
  rollSeed: string,
): HeritageComponent[] {
  const primary = anchor.heritage[0];
  if (!primary) return varyHeritage(position, rollSeed);

  const roll = hash(`${rollSeed}:followHeritage:${position}`) % 10;
  if (roll < 4) return [{ heritage: primary.heritage, pct: 100 }];
  if (roll < 7 && anchor.heritage[1]) return anchor.heritage;

  const step = 1 + (hash(`${rollSeed}:followBlend:${position}`) % (HERITAGES.length - 1));
  const secondary = HERITAGES[
    (HERITAGES.indexOf(primary.heritage as Heritage) + step) % HERITAGES.length
  ] as Heritage;
  return [
    { heritage: primary.heritage, pct: 60 },
    { heritage: secondary, pct: 40 },
  ];
}

/**
 * Look in a follow: an anchor, not a lock (founder ruling, round 5).
 *
 * The first version carried the parent's look flat across all eight, and the
 * graded run showed exactly what that costs: every candidate inherited "angular
 * and unslept" and the sheet read gaunt as a group — coherent, and same-y. So
 * the look behaves like heritage now. Most candidates hold the followed look;
 * two or three take an adjacent one, which keeps the sheet recognisably one
 * casting while giving the eye somewhere to go.
 *
 * "Adjacent" is positional, not semantic, and that is worth stating plainly:
 * LOOKS has no natural ordering, so a neighbour in the array is simply *a
 * different look from the same shelf* rather than a measured near-relative.
 * Inventing a semantic adjacency would be guesswork dressed as a model.
 */
function anchoredLook(anchor: FollowAnchor, position: number, rollSeed: string): LookKey | null {
  if (!anchor.look) return null;
  const index = LOOK_KEYS.indexOf(anchor.look);
  if (index < 0) return anchor.look;

  // Two or three of the eight drift, chosen per roll so two follows of the
  // same candidate do not drift on the same tiles.
  const drifting = 2 + (hash(`${rollSeed}:lookSpread`) % 2);
  const offset = hash(`${rollSeed}:lookOffset`) % LOOK_KEYS.length;
  if ((position + offset) % LOOK_KEYS.length >= drifting) return anchor.look;

  const step = hash(`${rollSeed}:lookStep:${position}`) % 2 === 0 ? 1 : LOOK_KEYS.length - 1;
  return LOOK_KEYS[(index + step) % LOOK_KEYS.length] as LookKey;
}

/** Hair colour in a follow: it holds on all eight — colour is the family signal. */
function anchoredHairColour(
  anchor: FollowAnchor,
  heritage: HeritageComponent[],
  ageBand: AgeBand,
  position: number,
  rollSeed: string,
): HairColour {
  return anchor.hair?.colour ?? varyHairColour(heritage, ageBand, position, rollSeed);
}

/**
 * The realized axes in a follow: one family, not one barber.
 *
 * Founder taste ruling. The anchor's realized axes carried FLAT to all eight —
 * the same named cut, the same beard, on every tile — and hair is the loudest
 * signal a tile has, so the sheet read as a clone stamp rather than as eight
 * people who could plausibly be cast for the same part.
 *
 * So it takes `anchoredLook`'s shape: most tiles hold, two or three drift.
 * What drifts and what holds is the ruling, and each half has a reason:
 *
 *   - **The CUT drifts**, within the anchor's own family. Two people with the
 *     same crop are not the same person; two people with the same haircut and
 *     the same beard are a photocopy.
 *   - **The COLOUR holds on all eight.** Colour is the family signal — it is
 *     what makes the sheet legible as one casting at a glance — and cuts are
 *     not. This is why the drift lives here rather than in `anchoredHair`.
 *   - **The FAMILY holds.** "Adjacent within the family" is the ruling's own
 *     wording, and it is also the only reading that survives contact with the
 *     vocabulary: shaved and long are both on the shelf, and drifting between
 *     them would not be a variation, it would be a different casting.
 *   - **Facial hair drifts on its own tiles.** Independent seeds, deliberately
 *     — sharing `anchoredLook`'s would stack every axis's variance onto the
 *     same two or three faces and leave the rest identical, which is the
 *     clone stamp again with extra steps.
 *
 * Two exclusions, both learned elsewhere:
 *
 *   - **Statement cuts are out of the drift pool.** The sheet-taste pass, which
 *     caps a sheet at one statement, is skipped entirely on follows — so
 *     drifting into three statement cuts would be uncapped by construction.
 *   - **A thin shelf holds rather than reaching.** `shaved` and `coiled` have
 *     one or two members for some faces; with nothing genuinely adjacent to
 *     move to, holding is the honest outcome. Never cross-list (ratified taste
 *     law): a candidate only ever draws from the styles their own sex,
 *     heritage and age can wear.
 */
function anchoredRealized(
  anchor: FollowAnchor,
  sex: Sex,
  heritage: HeritageComponent[],
  ageBand: AgeBand,
  position: number,
  rollSeed: string,
  boost = 0,
): RealizedAxes | null {
  const held = anchor.realized;
  if (!held) return null;

  const cut = driftsAt(position, rollSeed, "hairDrift", boost)
    ? adjacentStyle(held.hairStyle, sex, heritage, ageBand, position, rollSeed)
    : held.hairStyle;

  /*
    TEXTURE MOVES WITH THE CUT, and this is the founder's own note: "a drifted
    cut in the same colour at the same length reads as the same haircut at tile
    scale". A different name in the record that looks identical on the tile is
    not a variation, it is a record.

    Three cases, in order:
      - the new cut DICTATES a texture (a buzz has no wave to speak of) — defer
        to it, which is the same rule `realizeAxes` follows when it picks;
      - the cut drifted and is texture-agnostic — re-pick from this candidate's
        own heritage shelf, so the drift is visible rather than notional;
      - the cut held — so does its texture. This is a follow.
  */
  const drifted = cut !== held.hairStyle;
  /*
    A drift re-resolves through the owning helper rather than re-picking here,
    so the shaved-has-no-grain rule holds on a follow too. Holding still keeps
    the parent's texture, which is the point of a follow.
  */
  const texture = drifted
    ? resolveTexture(cut, heritage[0]?.heritage ?? "", hash(`${rollSeed}:hairTextureDrift:${position}`))
    : cut?.texture ?? held.hairTexture;

  const facialHair =
    sex === "male" && driftsAt(position, rollSeed, "beardDrift", boost)
      ? adjacentFacialHair(held.facialHair, position, rollSeed)
      : held.facialHair;

  /*
    Re-resolved on a drift, never spread through.

    `{ ...held }` would carry the parent's authored components onto a cut that
    cannot physically wear them — a curtain fringe surviving onto a french crop
    — and it would do it silently, because a spread looks like it is copying
    something safe. The components belong to the cut, so they move with it.
  */
  const hairModifiers = drifted
    ? cut
      ? resolveModifiers(cut, (axis) => hash(`${rollSeed}:${axis}:drift:${position}`))
      : null
    : held.hairModifiers;

  /*
    Worn state drifts on its OWN tiles, not the cut's.

    It is the axis that saved the Versace sheet: when the follow anchored sex,
    heritage and colour, the direction locked the look and the category put
    hair at silhouette tier, worn-state was the only thing left that could tell
    two tiles apart at arm's length. Giving it the cut's drift seed would have
    hidden it on exactly the sheets that need it.
  */
  const wornState = driftsAt(position, rollSeed, "wornDrift", boost)
    ? resolveWornState(
        cut?.family ?? held.hairStyle?.family ?? "long",
        cut?.worn ? cut : null,
        hash(`${rollSeed}:wornDrift:${position}`),
      )
    : drifted && cut
      ? resolveWornState(cut.family, cut, hash(`${rollSeed}:wornState:drift:${position}`))
      : held.wornState;


  return { ...held, hairStyle: cut, hairTexture: texture, hairModifiers, wornState, facialHair };
}

/**
 * Does this tile drift on this axis?
 *
 * `anchoredLook`'s spread and offset, taken per axis so hair, beard and look
 * move on different faces. Two or three of the eight, chosen per roll, so two
 * follows of the same candidate do not drift the same tiles.
 */
function driftsAt(position: number, rollSeed: string, axis: string, boost = 0): boolean {
  /*
    `boost` is the variance budget's release, and it is the ONLY thing that
    widens this. Two or three of eight is the taste ruling; more than that is a
    deliberate response to a sheet that would otherwise be an eight-way tie,
    and it is spent on the anchor tier only — never on a stated lock.
  */
  const drifting = Math.min(6, 2 + (hash(`${rollSeed}:${axis}:spread`) % 2) + boost);
  const offset = hash(`${rollSeed}:${axis}:offset`) % 8;
  return (position + offset) % 8 < drifting;
}

/** A different cut the same person could plausibly walk in with. */
function adjacentStyle(
  held: HairStyle | null,
  sex: Sex,
  heritage: HeritageComponent[],
  ageBand: AgeBand,
  position: number,
  rollSeed: string,
): HairStyle | null {
  if (!held) return held;
  const primary = heritage[0]?.heritage ?? "";
  const pool = stylesFor(sex, primary, ageBand)
    .map(([style]) => style)
    .filter((style) => style.family === held.family && style.name !== held.name && !style.statement);
  // A shelf with nothing else on it holds. Reaching outside the family — or
  // outside this candidate's own list — would be a different casting.
  if (pool.length === 0) return held;
  return pool[hash(`${rollSeed}:hairDrift:${position}`) % pool.length];
}

/** The beard moves a step, or arrives, or goes. Never onto a face that has none. */
function adjacentFacialHair(
  held: FacialHair | null,
  position: number,
  rollSeed: string,
): FacialHair | null {
  if (!held) return held;
  const pool = FACIAL_HAIR.filter((value) => value !== held);
  if (pool.length === 0) return held;
  return pool[hash(`${rollSeed}:beardDrift:${position}`) % pool.length];
}

/**
 * Resolve one candidate.
 *
 * Locks first, always: anything the brief stated is copied straight through,
 * and only the gaps are filled. That ordering is C5's signal hierarchy and
 * H15's precedence chain in four lines — a user's explicit choice can never be
 * overwritten by a variation axis, because the variation axis is only
 * consulted where the user was silent.
 */
export function resolveCandidateIdentity(
  intent: CastingIntent,
  position: number,
  rollSeed: string,
  anchor: FollowAnchor | null = null,
  /** The variance budget's release. 0 on every ordinary sheet. */
  driftBoost = 0,
  /** What the brief settled about hair. Derived once, by the compiler. */
  deference: HairDeference = hairDeferenceFor({ intent }),
): ResolvedIdentity {
  /*
    One hash per axis, never one hash shifted per axis.

    The first version derived every axis from `hash(rollSeed:position)` with a
    different bit shift, and the shifts interact with the weight totals: FNV-1a
    advances by its prime per position, so `(seed >>> 5) % 100` lands on the
    SAME bucket for consecutive candidates. Measured, not theorised — hair
    family came back 1–2 distinct values across eight candidates, and `ageBand`
    was quietly doing the same thing (2 of 7) before hair existed at all.

    A sheet whose whole job is eight different people cannot derive its
    difference from a generator that repeats. Named strings per axis, which is
    what `varyHeritage` and the energy cycle already did correctly.
  */
  const seedFor = (axis: string) => hash(`${rollSeed}:${axis}:${position}`);

  /*
    Precedence inside a follow, and it matches the ratified chain everywhere
    else: the brief still outranks the anchor. Follow a woman, then type "man"
    into the box, and the brief wins — the anchor supplies what the brief left
    unsaid, exactly as the variation vocabularies do.
  */
  /*
    A stated band wins, then the anchor, then the draw — and only the DRAW is
    re-weighted. A tendency that could beat either would be a lock wearing a
    softer name, which is the one thing the ruling forbids.
  */
  const ageBand =
    intent.ageBand
    ?? anchor?.ageBand
    ?? weightedPick(
      leanAgeWeights(
        AGE_WEIGHTS,
        intent.poolTendencies?.ageLean ?? null,
        intent.poolTendencies?.leanStrength ?? null,
      ),
      seedFor("ageBand"),
    );
  /*
    A STATED SKIN TONE PINS THE EIGHT — the heritage spread stands down.

    Founder ruling, verbatim (2026-08-25): *"a typed skin tone should pin all 8
    otherwise you have a caucasian african man or a african trying to be white
    skin. but if you asked for a african albino you would still get it."*

    ⚠ WHY THIS IS A REMOVAL AND NOT A NEW INSTRUCTION. Both facts were already
    in every one of his eight prompts and they were FIGHTING: the shared block
    said `SKIN: pale porcelain, heavily weathered — exactly as described.` while
    each slice's SUBJECT line said East Asian / Afro-Caribbean / West African
    heritage — and `PRIORITY WHEN INSTRUCTIONS CONFLICT` declares the SUBJECT
    block absolute. That rule was written for facts the USER stated. The
    heritage in that line was invented here, by the spread below. **So an
    invented fact was riding in the absolute block and outranking a stated
    one.** Measured on his roll 214: one of eight frames read as the porcelain
    he asked for, four plainly did not.

    Each stated fact is obeyed independently and nothing is inferred from
    anything: a stated tone never narrows heritage to a "matching" one — that
    map is a stereotype table and is refused on the record (fable-1646) — and a
    stated heritage is never overridden by a stated tone. His "african albino"
    needs no special case at all: both are stated, so both are emitted, which is
    what the first branch below already does.

    ⚠ THE FOLLOW BRANCH IS DELIBERATELY UNTOUCHED. A follow's heritage comes
    from the candidate it is anchored on — a fact about a face that exists, not
    an invention of this function — and a follow's whole promise is "more like
    this person". Stripping it would break that promise to fix a defect it does
    not have. Stated here rather than left to be inferred from the placement of
    one line.
  */
  /*
    Read DEFENSIVELY even though the type says it cannot be absent: `statedSkin`
    is non-optional on `CastingIntent`, and several fixtures in this suite build
    an intent without it — `resolveCandidateIdentity` is reached from more than
    one place and an unguarded `.tone` turned four unrelated follow-anchor arms
    into TypeErrors the moment this line landed. A crash here is a failed roll
    on a paid path, which is a steep price for a dot.
  */
  const pinnedBySkinTone = intent.heritage.length === 0 && (intent.statedSkin?.tone ?? null) !== null;
  const heritage =
    intent.heritage.length > 0
      ? intent.heritage
      : anchor
        ? anchoredHeritage(anchor, position, rollSeed)
        : pinnedBySkinTone
          ? []
          : varyHeritage(
              position,
              rollSeed,
              intent.poolTendencies?.heritageLean ?? null,
              intent.poolTendencies?.leanStrength ?? null,
            );

  /*
    A SEX-CODED STATED FACT RESOLVES AN UNSTATED SEX.

    The first cross-axis implication in the resolver: a fact on one axis
    constraining another. "A 25 year old heavy metal bogan with a beard" left
    sex open, so it alternated, and four candidates resolved female while
    carrying the stated beard — androgynous faces nobody asked for. Two axes
    each behaving correctly in isolation produced a sheet that was wrong.

    Order matters and is the whole safety of it: a STATED sex is read first, so
    "a bearded woman" is untouched. This only ever fills a null.
  */
  const sexCoded = !intent.sex && !anchor?.sex && briefStatesSexCodedFacialHair(intent.role, intent.characterNotes);
  const sex = intent.sex ?? anchor?.sex ?? (sexCoded ? "male" : varySex(position, rollSeed));

  /*
    HAIR RESOLVES THROUGH ONE FUNCTION, with its precedence written down —
    M7's resolver unification, first axis group (founder condition on the slice
    zero deferral).

    Everything hair used to be decided by two `??` chains here plus a blanking
    pass in the compiler, with the order implied rather than stated. It now
    states it: stated → (no hand tier for hair) → follow-anchored → realized,
    with sheet-adjusted running later over the whole set where it belongs, and
    each axis carrying the tier it came from.

    The cut still resolves BEFORE the hair record, which is the D-87 fix: the
    realized cut used to draw its own family while `varyHair` drew another, so a
    candidate could persist "buzz cut" beside "long".
  */
  const hair = resolveHairAxes({
    spoken: deference.spoken,
    coverage: deference.coverage,
    anchored: anchor
      ? () => anchoredRealized(anchor, sex, heritage, ageBand, position, rollSeed, driftBoost)
      : null,
    anchoredColour: anchor
      ? () => anchoredHairColour(anchor, heritage, ageBand, position, rollSeed)
      : null,
    realize: () =>
      realizeAxes({
        heritage,
        ageBand,
        sex,
        position,
        rollSeed,
        facialHairLean: intent.poolTendencies?.facialHairLean ?? null,
        /*
          Only when the brief left the cut open. Deference outranks every
          tendency, so a stated shaved head renders as written and the pool's
          opinion about shaved heads is never consulted.
        */
        avoidFamilies: deference.spoken.has("cutLength") || deference.coverage
          ? []
          : intent.poolTendencies?.avoidFamilies ?? [],
      }),
    realizeColour: () => varyHairColour(heritage, ageBand, position, rollSeed),
  });
  const realized = hair.realized;
  const hairColour = hair.colour;

  return {
    sex,
    ageBand,
    /*
      A stated phase is a lock. Only an unstated one varies — otherwise
      "early 20s" gets re-rolled into mid and late across the sheet, which is
      exactly how the founder's brief came back reading 28-35.
    */
    agePhase: intent.agePhase ?? AGE_PHASES[seedFor("agePhase") % AGE_PHASES.length],
    heritage,
    /*
      Stated build wins. Otherwise: if the brief named a casting category, the
      category owns physique and this stays null — varying it would cast
      outside the category the user asked for (founder gate B5). With no
      category, street-real variety across builds is exactly right.
    */
    build: intent.build ?? (intent.role ? null : weightedPick(BUILD_WEIGHTS, seedFor("build"))),
    /*
      Hair carries on a follow and varies otherwise. Conditioned on the
      resolved heritage rather than the brief's, so a candidate who varied into
      a different heritage gets hair that belongs to the face they actually
      have — and its silhouette comes from the cut, never from a second draw.
    */
    hair: hairColour === null ? null : hairRecord(hairColour, realized.hairStyle),
    realized,
    /*
      The tiers travel with the identity so no later reader has to infer where a
      value came from — inferring is how a follow of a bias-tier parent came to
      inherit specificity its lineage never had.
    */
    hairTiers: hair.tiers,
    /*
      Energy is the one axis that cycles rather than samples: eight candidates
      against eight energies gives one of each, which is the most legible
      difference a sheet can carry. Stated energy locks it flat across all
      eight (plan line 205).

      The cycle needs a per-roll OFFSET, though, or it always starts in the same
      place — every disposition sheet ever cast opened on "warm", so tile 1 was
      the same persona every time and re-rolling never moved it. Offset like
      every other varied axis; the cycle's one-of-each property is unaffected
      because a rotation is still a permutation.
    */
    energy:
      intent.energy ??
      ENERGY_KEYS[(position + (hash(`${rollSeed}:energyOffset`) % ENERGY_KEYS.length)) % ENERGY_KEYS.length],
    /*
      The look axis. A stated look locks flat across the sheet (archetype law);
      otherwise, when the brief named a casting category whose job IS a kind of
      face, each candidate takes a different look — eight houses' casting, not
      eight moods. Offset by the roll so two rolls of the same brief do not
      open with the same look.
    */
    look:
      intent.look
      ?? (anchor ? anchoredLook(anchor, position, rollSeed) : null)
      ?? (varyByLook(intent)
        ? LOOK_KEYS[(position + (hash(`${rollSeed}:look`) % LOOK_KEYS.length)) % LOOK_KEYS.length]
        : null),
  };
}

/**
 * Does this sheet vary by look rather than disposition?
 *
 * The interpreter decides, full stop — it read the brief and knows whether the
 * job is a kind of face or a kind of person. When it declines to say, the
 * sheet varies by disposition, which is the safer default: a character sheet
 * that varies looks is stranger than a model sheet that varies mood.
 *
 * An earlier version of this comment described a keyword fallback on the role
 * text. That was never implemented, and the mismatch is worth naming rather
 * than quietly deleting: a comment claiming behaviour the code does not have
 * is how a reviewer signs off on something that is not there.
 */
function varyByLook(intent: CastingIntent): boolean {
  if (intent.variationAxis) return intent.variationAxis === "look";
  return false;
}

/**
 * The sheet's direction, chosen once per roll rather than per candidate.
 *
 * Per-candidate archetypes would vary the art direction, which the framing law
 * forbids — the sheet must read as one casting call. H15's rule that an absent
 * brand resolves to a recorded pick on the paid path is what makes this
 * honest: the choice is written into `compiledBrief`, so a roll can always say
 * what direction it was cast under.
 */
export function resolveArchetype(intent: CastingIntent, rollSeed: string): ArchetypeKey {
  if (intent.archetype) return intent.archetype;
  return ARCHETYPE_KEYS[hash(`${rollSeed}:archetype`) % ARCHETYPE_KEYS.length];
}

/* ---------------------------------------------------------- composition */

/**
 * Years per band phase.
 *
 * "Early 20s" came back reading 28–35 (founder gate). Prose alone does not
 * hold an age: the image model has a strong prior toward a generically adult
 * face, and a phrase like "early twenties" loses to it. Naming the years, and
 * then naming the physiology that must NOT be present, is what legacy's age
 * handling did (catalog H12 mapped idioms to exact ages; A11 reconciled age
 * against skin texture so a 23-year-old never came back with crow's feet).
 */
const AGE_YEARS: Record<AgeBand, [string, string, string]> = {
  teens: ["16–17", "17–18", "18–19"],
  "20s": ["20–23", "24–26", "27–29"],
  "30s": ["30–33", "34–36", "37–39"],
  "40s": ["40–43", "44–46", "47–49"],
  "50s": ["50–53", "54–56", "57–59"],
  "60s": ["60–63", "64–66", "67–69"],
  "70s+": ["70–74", "75–79", "80+"],
};

function describeAge(band: AgeBand, phase: AgePhase): string {
  const phaseIndex = AGE_PHASES.indexOf(phase);
  const years = AGE_YEARS[band][phaseIndex];
  const spoken =
    band === "70s+"
      ? "in their seventies or older"
      : band === "teens"
        ? `in their ${phase} teens`
        : `in their ${phase} ${band.replace("s", "")}s`;

  /*
    Stated as an absolute with a corroborating negative. The negative is the
    half that works: telling the model what a 22-year-old does NOT have
    (nasolabial depth, eye-area lines, jowl softening) is far more effective
    than asking again for "early twenties".
  */
  const guard =
    band === "teens" || band === "20s"
      ? " Skin, bone maturity and the eye area must corroborate this age — taut jawline, no nasolabial depth, no crow's feet, no under-eye hollowing, no adult heaviness through the jaw."
      : band === "70s+" || band === "60s" || band === "50s"
        ? " Age must be genuinely present in the skin and structure — do not render a younger face with grey hair."
        : "";

  return `${spoken}, apparent age ${years} years — this is an absolute casting requirement, not an approximation.${guard}`;
}

/**
 * C8 + C9 — build, translated into what the frame can actually show.
 *
 * The audit found build reaching the prompt as a bare adjective ("a slim
 * woman"), which the model is free to read as a styling note and ignore.
 * Legacy translated it into named, renderable anatomy — the neck, the
 * collarbones, the traps — precisely because a bare adjective got ignored, and
 * added an explicit "this is a deliberate casting choice" so it would not be
 * regressed to the default runway physique.
 *
 * V2's frame is waist-up rather than legacy's headshot, so more of the body is
 * visible and the translation matters more, not less.
 */
const BUILD_ANATOMY: Record<Build, string> = {
  slight: "a narrow neck, visible collarbones and tendons, slender shoulders, a leaner face",
  slim: "a slim neck, clearly visible collarbones, narrow shoulders, little soft tissue at the jaw",
  average: "an ordinary neck and shoulder line, collarbones softly visible, nothing exaggerated in either direction",
  athletic: "a thicker neck, defined trapezius and shoulders filling the frame, a firmer jawline",
  broad: "a wide, solid neck and shoulder frame, heavy trapezius, substantial bone width through the shoulders",
  heavy: "a fuller neck and jawline, soft tissue at the chin and under the chin, rounded shoulders and a broader torso",
};

function describeBuild(build: Build | null, role: string | null): string {
  if (build) {
    return ` PHYSIQUE: ${build} build — this is a deliberate casting choice and must be visible in the frame: ${BUILD_ANATOMY[build]}. Do not default to a slim runway physique.`;
  }
  /*
    Build is null on purpose when a casting category was named: gate B5 gives
    the category ownership of physique, so varying it would cast outside the
    category the user asked for.

    But "the category owns it" was being implemented as saying nothing at all,
    which is not the same thing — and saying nothing is precisely the condition
    C9 exists for. With no physique line, the model falls back to its prior for
    a studio portrait, which is a slim runway body. A blacksmith with a runway
    physique is C9's failure case exactly, arriving through the gate that was
    supposed to protect the category.

    So the category is told to own it out loud.
  */
  if (role) {
    return " PHYSIQUE: whatever this casting category genuinely requires — the build, weight and musculature a real person doing this work or holding this position would have. Do not default to a slim runway physique unless the category itself calls for one.";
  }
  return "";
}

/**
 * Hair, said plainly.
 *
 * A realized trait that never reaches the prompt would be a record that lies:
 * the follow would claim to carry hair while the image model kept picking its
 * own. Family and colour only — length, parting and fringe stay latitude, so
 * eight cousins still look like eight people.
 */
/**
 * Words that mean the brief has already decided the hair.
 *
 * Caught by the seed-verification clause, which is the only reason it was
 * caught at all: "Runway model, early 20s, shaved head" came back with a full
 * head of curls. The hair axis added for follow-inheritance was assigning a
 * family at random and writing it into the SUBJECT block, directly
 * contradicting the user's own sentence a few lines above it.
 *
 * The drop-a-stated-fact family again, and this time authored by the fix for a
 * different one. A stated fact outranks a varied one everywhere else in this
 * file; hair had simply never been asked the question, because until the follow
 * work it was not a field.
 */
/**
 * Deference, per axis. A stated fact outranks a realized one, always.
 *
 * The "shaved head" lesson generalised: the brief said shaved and the hair axis
 * assigned curls anyway, because nothing asked whether the user had already
 * decided. Five more axes now realize values, so five more could contradict the
 * sentence in exactly the same way. Each checks first.
 *
 * Word lists rather than regexes — this session produced three separate
 * escaping accidents that turned a pattern into something matching nothing
 * while reading correctly.
 */
const AXIS_WORDS: Record<"eyes" | "facialHair" | "brows" | "skin", string[]> = {
  eyes: [
    "eye", "eyes", "eyed", "iris", "irises", "blue", "green", "hazel", "amber",
    "grey", "gray", "brown", "heterochromia",
  ],
  /*
    "shaven" and "cleanshaven" belong HERE and only here. They used to sit in
    `HAIR_WORDS` as well, so "a clean-shaven man in his 40s" — a statement about
    a jaw — stood the hair axis down too, and with it the twin rule's fallback
    axis. That is the one brief shape where both separators disappear at once.
  */
  facialHair: [
    "beard", "bearded", "moustache", "mustache", "stubble", "goatee", "shaven",
    "cleanshaven", "unshaven", "beardless", "whiskers", "sideburns", "scruff",
  ],
  brows: ["brow", "brows", "eyebrow", "eyebrows", "unibrow", "monobrow"],
  /*
    ⚠ THE TONE VOCABULARY, ADDED WITH THE LANE AND NOT BEFORE IT
    (`CASTING_V2_BRIEF_FIDELITY_BUILD.md` section 3c).

    This list decides whether the engine STANDS DOWN from authoring a skin
    character, and until now it held **not one colour or tone word**. Driven at
    this function on twelve ordinary ways a brief states skin, SIX left the
    engine authoring — including *"a ruddy man in his fifties"*, *"she is very
    fair"* and *"a sallow office worker"* — so a brief naming her tone could be
    handed `SKIN CHARACTER: freckled skin` on top of her own word, and
    `resolvedIdentity` kept the fabricated character.

    ⚠ **It is widened WITH the speaking half and never before it.** Widening
    deference alone makes the engine quieter about a fact still not being said,
    which is `statedHair`'s original defect and strictly worse than today.
  */
  skin: [
    "freckle", "freckles", "freckled", "acne", "scar", "scarred", "birthmark",
    "mole", "beauty", "pockmarked", "weathered", "complexion", "skin",
    "blemish", "blemishes",
    /* Tone and colour — her word for the surface itself. */
    "porcelain", "olive", "sallow", "ruddy", "tan", "tanned", "fair", "pale",
    "pallid", "ashen", "bronzed", "golden", "ebony", "dark", "swarthy",
    "sunburnt", "sunburned", "sundarkened", "windburned",
  ],
};

/**
 * ⚠ THE INFLECTION HOLE, and it is the whole of one measured failure.
 *
 * `statedAxis` splits on non-letters, so `"olive-skinned"` becomes
 * `{olive, skinned}` — and `skinned` is not `skin`. Measured at the wire:
 * *"Olive-skinned woman"* came back 0 of 3 with `heritage: [Mediterranean]`
 * while *"a woman with olive skin"* came back 3 of 3 with `heritage: []`. The
 * hyphenated form is read as an ETHNICITY, filed into a neighbouring lane, and
 * the notes then decline to repeat it.
 *
 * The same class `validInContext` solved one file over with an inflection walk,
 * and the typo gate's own docblock warns about it: *a second list that is
 * supposed to mirror a vocabulary will drift from it.* So the membership test
 * walks a small, CLOSED set of suffixes rather than growing the list by hand —
 * `tan` covers `tanned`, `skin` covers `skinned`, `sun` covers `sunned`.
 *
 * ⚠ It is a SUFFIX strip and never a prefix match: `scar` must not be found
 * inside `scarce`, and `tan` must not be found inside `tantrum`.
 */
const AXIS_SUFFIXES = ["ed", "ned", "med", "ish", "y", "s"];

function axisStem(word: string): string[] {
  const stems = [word];
  for (const suffix of AXIS_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      stems.push(word.slice(0, word.length - suffix.length));
    }
  }
  return stems;
}

/**
 * HER OWN WORDS FOR HER OWN SKIN, or nothing at all.
 *
 * The frame is ours and the VALUE is hers (D-172, source containment) — the
 * parser has already dropped any phrase carrying a word she did not type, so
 * everything between the colon and the full stop came out of her sentence.
 *
 * Two sub-fields, one sentence, and the join is deliberate: a brief that says
 * *"pale porcelain skin, heavily weathered"* should not arrive as two competing
 * instructions about one surface. Either half alone is a complete sentence.
 *
 * Empty on every unflagged roll, because the lane is never filled there — so
 * this contributes nothing to a prompt outside `CASTING_BRIEF_FIDELITY_SCOPE`.
 */
export function statedSkinSentence(stated: StatedSkin | null | undefined): string {
  const tone = stated?.tone ?? null;
  const character = stated?.character ?? null;
  if (!tone && !character) return "";
  const said = tone && character ? `${tone}, ${character}` : (tone ?? character);
  return `SKIN: ${said} — exactly as described.`;
}

/** True when the brief's own words already decided this axis. */
/** Exported so the sheet taste pass defers on the same words the prompt does. */
export function statedAxis(axis: "eyes" | "facialHair" | "brows" | "skin", stated: string): boolean {
  const words = new Set<string>();
  for (const raw of stated.toLowerCase().split(/[^a-z]+/)) {
    if (!raw) continue;
    for (const stem of axisStem(raw)) words.add(stem);
  }
  return AXIS_WORDS[axis].some((word) => words.has(word));
}

/*
  Two removals here are corrections, not tidying.

  Bare "cut" is gone: "a clean-cut banker" is not a hair statement, and it was
  standing the whole hair axis down on any brief using the word figuratively.
  Every compound that IS about hair — buzzcut, crewcut, undercut — is listed in
  its own right.

  "shaven" and "cleanshaven" are gone too, and moved to facial-hair deference
  where they belong. A clean-shaven brief is a statement about a JAW; treating
  it as hair cost the sheet its authored cuts AND, because the twin rule falls
  back to facial hair, all twin protection at the same time — the one brief
  shape where both separators vanish at once.
*/
/**
 * The hair vocabulary, split by WHICH PART of hair each word speaks to.
 *
 * D-79's ruling is that the unit of "said" is the fact, not the axis — so the
 * gate has to know which fact a word names. `HAIR_WORDS` below is derived from
 * these, never listed separately, so the whole-axis question and the per-part
 * question can never disagree about what counts as a hair statement. That
 * disagreement is precisely what `briefStatesHair`'s own doc comment warns
 * about, and a second copy of the list is how it would happen.
 *
 * A word may sit in two groups honestly: an afro is a length and a texture at
 * once, and "curls" names both what the hair does and roughly how long it is.
 */
const COVERAGE_WORDS = [
  "bald", "balding", "shaved", "buzz", "buzzed", "buzzcut", "receding",
];

const LENGTH_WORDS = [
  "crewcut", "undercut", "fade", "afro", "braid", "braids", "braided",
  "cornrows", "dreads", "dreadlocks", "locs", "ponytail", "ponytails",
  "topknot", "pigtail", "pigtails", "bun", "mohawk", "bob", "pixie",
  "fringe", "bangs", "mullet", "quiff",
];

const COLOUR_WORDS = [
  "blonde", "blond", "brunette", "redhead", "ginger", "auburn", "greying",
  "graying", "grey", "gray", "silver", "platinum", "bleached", "highlights",
  "roots",
];

const TEXTURE_WORDS = ["curls", "curly", "wavy", "coiled", "afro", "frizzy", "kinky"];

/**
 * Words that say "this brief is about hair" without naming a part.
 *
 * "Hair" and "haired" carry no sub-axis of their own, so they can only ever
 * mean the whole axis is spoken — which is the safe reading and today's.
 */
const BARE_HAIR_WORDS = ["hair", "haired"];

const HAIR_WORDS = Array.from(
  new Set([
    ...BARE_HAIR_WORDS,
    ...COVERAGE_WORDS,
    ...LENGTH_WORDS,
    ...COLOUR_WORDS,
    ...TEXTURE_WORDS,
  ]),
);

/**
 * Hair statements the tokenizer cannot see, because they contain punctuation.
 *
 * "Salt-and-pepper" splits into salt / and / pepper, none of which is a hair
 * word and none of which safely could be — "salt" appears in plenty of briefs
 * that have nothing to do with hair. Matched as a phrase against the raw text
 * instead, which is the only form that is both safe and complete.
 */
const HAIR_PHRASES = ["salt and pepper", "salt-and-pepper", "pepper and salt"];

/**
 * Multi-word hair statements, and the part each one names.
 *
 * The tokenizer splits on non-letters, so "crew cut" is `crew` + `cut` and
 * neither is a hair word — `crew` belongs to a boat and bare `cut` was
 * deliberately removed from the vocabulary because "a clean-cut banker" is not
 * a hair statement. So a brief saying "silver crew cut" registered its COLOUR
 * and not its LENGTH, and partial deference would then have authored a cut
 * directly over the one the user asked for. That is the D-79 contradiction
 * exactly, reintroduced through a gap in the gate rather than through the
 * interpreter.
 *
 * Matched as phrases against the raw text, which is the only form that is both
 * safe and complete — the same reasoning `HAIR_PHRASES` already carries for
 * "salt and pepper".
 */
const HAIR_PART_PHRASES: readonly (readonly [string, HairPart])[] = [
  ["crew cut", "cutLength"],
  ["buzz cut", "cutLength"],
  ["pixie cut", "cutLength"],
  ["bowl cut", "cutLength"],
  ["short back and sides", "cutLength"],
  ["shoulder length", "cutLength"],
  ["shoulder-length", "cutLength"],
  ["chin length", "cutLength"],
  ["chin-length", "cutLength"],
  ["waist length", "cutLength"],
  ["waist-length", "cutLength"],
];

/**
 * Words that describe hair ONLY when nothing else on the face owns them.
 *
 * "A beauty creator in her late 20s, bleached brows" tripped the gate on
 * "bleached" and stood the hair rules down across an entire sheet — for a
 * statement about eyebrows. The founder found the consequence: roll 2 tiles
 * 06/07 came back twins, because the twin rule's fallback axis is facial hair
 * and a sheet of women has none, so nothing was left to separate them with.
 *
 * A brow is not hair. Each of these is a colour or treatment that applies as
 * readily to brows and lashes, and none of them names hair by itself.
 */
const AMBIGUOUS_HAIR_WORDS = new Set(["bleached", "highlights", "silver", "platinum", "grey", "gray"]);

/**
 * The features that can claim an ambiguous word away from the hair axis.
 *
 * Eyes are here because "grey eyes" was deferring the entire hair axis — an eye
 * colour standing hair down is the same class of mistake as a brow doing it.
 */
const OTHER_FEATURE_WORDS = new Set([
  "brow", "brows", "eyebrow", "eyebrows", "unibrow", "monobrow",
  "lash", "lashes", "eyelash", "eyelashes", "beard", "bearded", "moustache", "mustache",
  "eye", "eyes", "eyed", "iris", "irises",
]);

/**
 * How close a feature word must sit to claim an ambiguous one.
 *
 * **Adjacency, not sentence-global — and this was the gravest finding of the
 * review.** The first version asked "does any feature word appear anywhere in
 * the brief", which is a question about the sentence rather than about the
 * phrase. So "a silver fox in his 50s with a trimmed beard" surrendered
 * "silver" to a beard eight words away, decided hair had never been mentioned,
 * and authored a dark colour directly contradicting the silver fox the user
 * asked for. The gate meant to prevent over-deference was causing the exact
 * contradiction deference exists to prevent.
 *
 * Two tokens either side covers the real phrasings — "bleached brows", "brows
 * bleached", "grey eyes", "eyes of pale grey" — without reaching across a
 * clause boundary. Wider is not safer here: every extra token is another way to
 * surrender a word the user meant as hair.
 */
const CLAIM_WINDOW = 2;

/** Style names that are already plural and must not take an article. */
const PLURAL_STYLES = new Set(["locs", "braids", "soft layers"]);

/**
 * Did the brief already decide the hair?
 *
 * Exported so the compiler's sheet-taste pass asks the same question with the
 * same word list. A second copy of `HAIR_WORDS` next to a second reader is
 * exactly how the two would drift out of agreement about what "stated" means.
 */
export function briefStatesHair(...sources: (string | null | undefined)[]): boolean {
  return spokenHairParts(...sources).size > 0 || mentionsHairAtAll(...sources);
}

/**
 * A bare "hair" or "haired", naming no part of it.
 *
 * Kept separate from the parts because it is a different fact: the brief is
 * ABOUT hair, and the gate cannot say which part. `hairDeferenceFor` resolves
 * it with the interpreter's answer, and falls back to whole-axis deference when
 * the interpreter had nothing — which is exactly today's behaviour.
 */
export function mentionsHairAtAll(...sources: (string | null | undefined)[]): boolean {
  const words = new Set(sources.filter(Boolean).join(" ").toLowerCase().split(/[^a-z]+/));
  return BARE_HAIR_WORDS.some((word) => words.has(word));
}

/**
 * WHICH PARTS of hair the brief spoke to — the code-owned half of D-79.
 *
 * **This function is the authority on WHETHER a part was spoken; the
 * interpreter is only ever the authority on WHAT was said** (D-89). It reads
 * the user's own sentence, which no model can corrupt, and that asymmetry is
 * what makes partial deference survivable: the composer never authors a part
 * this returns, so the worst possible interpreter output degrades to today's
 * suppression rather than to the D-79 contradiction.
 *
 * `briefStatesHair` is now derived from it rather than duplicating the walk, so
 * the whole-axis question and the per-part question cannot drift apart about
 * what counts as a hair statement.
 *
 * **Coverage suppresses everything.** There is no cut on a bald man, and
 * authoring one is the founding bug of the entire deference doctrine, so a
 * coverage word returns every part rather than just its own.
 */
export function spokenHairParts(
  ...sources: (string | null | undefined)[]
): ReadonlySet<HairPart> {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  const parts = new Set<HairPart>();

  // A phrase the tokenizer cannot see. Always a colour statement, and always
  // the greying kind — "salt and pepper" is not a shade, it is a process.
  if (HAIR_PHRASES.some((phrase) => text.includes(phrase))) parts.add("colour");
  for (const [phrase, part] of HAIR_PART_PHRASES) {
    if (text.includes(phrase)) parts.add(part);
  }

  /*
    An ambiguous word claimed by a feature word NEXT TO IT is not a hair
    statement. Claiming is per-occurrence, not per-sentence: "bleached brows"
    surrenders that "bleached", while "a silver fox with a trimmed beard" keeps
    its "silver", because the beard is nowhere near it.

    An unambiguous hair word anywhere still decides it, so "bleached brows and a
    blonde bob" is a hair statement on the strength of "blonde" alone.
  */
  const tokens = text.split(/[^a-z]+/);
  tokens.forEach((token, index) => {
    if (!HAIR_WORDS.includes(token)) return;
    if (AMBIGUOUS_HAIR_WORDS.has(token)) {
      const from = Math.max(0, index - CLAIM_WINDOW);
      const to = Math.min(tokens.length, index + CLAIM_WINDOW + 1);
      const claimed = tokens.slice(from, to).some((near, offset) => {
        if (from + offset === index) return false;
        return OTHER_FEATURE_WORDS.has(near);
      });
      if (claimed) return;
    }

    // Coverage is total: there is no cut on a bald man.
    if (COVERAGE_WORDS.includes(token)) {
      HAIR_PARTS.forEach((part) => parts.add(part));
      return;
    }
    /*
      A bare "hair" names NO part, so it cannot be attributed to one. It is
      recorded as the axis being unspecified rather than as every part being
      spoken — see `hairDeferenceFor`, where the interpreter's own answer
      resolves it. Treating it as all-parts is what made the feature inert on
      the founder's actual phrasings: "pastel pink hair" and "long hair" both
      carry it, so every brief anyone writes would have deferred whole.
    */
    if (BARE_HAIR_WORDS.includes(token)) return;
    if (LENGTH_WORDS.includes(token)) parts.add("cutLength");
    if (COLOUR_WORDS.includes(token)) parts.add("colour");
    if (TEXTURE_WORDS.includes(token)) parts.add("texture");
  });

  return parts;
}

/** True when the brief named coverage — shaved, bald, buzzed. Suppresses all. */
export function briefStatesCoverage(...sources: (string | null | undefined)[]): boolean {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  const words = new Set(text.split(/[^a-z]+/));
  return COVERAGE_WORDS.some((word) => words.has(word));
}

/**
 * Facial-hair words that CODE FOR SEX, as opposed to merely mentioning it.
 *
 * Founder ruling, 2026-08-01, extending H11 and seed-law clause 6 to runtime
 * resolution. "A 25 year old heavy metal bogan with a beard" alternated sex
 * across the sheet, so four candidates resolved female carrying a stated beard
 * and rendered androgynous. Presentation must be intent, never a collision
 * artefact between two axes that never consulted each other.
 *
 * **Presence only, ratified as the ruling. The principle behind it is the part
 * to keep: RESOLVE ONLY WHAT WOULD OTHERWISE CONTRADICT, NEVER INFER BEYOND.**
 *
 * A stated beard on an alternated sheet forces a contradiction — four
 * candidates resolve female and carry a beard they were told to have — so sex
 * gets resolved to remove it. "Clean-shaven" forces no contradiction on anyone,
 * because every woman is clean-shaven, so there is nothing to resolve and
 * inferring male from it would invent a lock out of a fact that carries none.
 *
 * The rule exists to prevent manufactured contradictions, never to guess
 * intent. Any future cross-axis implication has to pass the same test.
 *
 * This never overrides an explicit statement: a stated sex is checked first and
 * wins outright, so "a bearded woman" renders exactly as written.
 */
const SEX_CODING_FACIAL_HAIR = [
  "beard", "bearded", "moustache", "mustache", "stubble", "goatee",
  "whiskers", "sideburns", "muttonchops",
];

export function briefStatesSexCodedFacialHair(...sources: (string | null | undefined)[]): boolean {
  const words = new Set(sources.filter(Boolean).join(" ").toLowerCase().split(/[^a-z]+/));
  return SEX_CODING_FACIAL_HAIR.some((word) => words.has(word));
}

/**
 * What the brief settled about hair, and what it left open — D-79 / D-89.
 *
 * `spoken` comes from the code-owned gate over the user's own sentence and is
 * the authority on WHETHER. `stated` comes from the interpreter and is only
 * ever the authority on WHAT. The composer authors nothing in `spoken`, so the
 * worst the interpreter can do is leave a part unsaid — which costs a detail,
 * never a contradiction.
 */
export type HairDeference = {
  spoken: ReadonlySet<HairPart>;
  stated: StatedHair;
  /** Shaved, bald, buzzed — no remainder to author, so the axis goes silent. */
  coverage: boolean;
  /**
   * The brief spoke about hair AT ALL, whichever part.
   *
   * Carried separately from `spoken` because the two answer different
   * questions, and conflating them broke both directions at once. With the flag
   * OFF this is what must silence the axis — today's behaviour is keyed on the
   * mention, not on the attribution. And with it ON, greying mentions hair
   * while deliberately leaving every part open, so `spoken` is empty and the
   * sentence still has something to say.
   */
  mentioned: boolean;
};

/**
 * Build the deference view for one roll.
 *
 * The mask is derived ONCE, here, so the composer, the sheet taste pass and the
 * signature cap cannot disagree about what "stated" means — three readers
 * disagreeing about one field is the shape that produced gate 21 and the
 * role-guard rework, and a boolean per rule is how it starts.
 */
export function hairDeferenceFor(input: {
  briefText?: string;
  intent: CastingIntent;
}): HairDeference {
  const sources = [input.briefText ?? "", input.intent.role ?? "", input.intent.characterNotes ?? ""];
  const stated = input.intent.statedHair ?? EMPTY_STATED_HAIR;
  const coverage = briefStatesCoverage(...sources);
  const spoken = new Set<HairPart>(spokenHairParts(...sources));

  /*
    THE ENGAGEMENT RULE, and it is where the gate hands the unspecified case to
    the interpreter without giving up its authority.

    A bare "hair" names no part — "pastel pink hair", "long hair" — so the gate
    genuinely cannot attribute it. Two readings, and the choice between them is
    decided by whether the interpreter engaged at all:

      - it named at least one part → it read the sentence, so its answer
        attributes the mention. Named parts are honoured; the rest are authored,
        which is the feature working.
      - it named nothing → we are back to not knowing, so the whole axis defers.
        That is today's shipped behaviour, and it is the safe degrade the D-89
        theorem promises: the interpreter failing costs a detail, never a
        contradiction.

    Coverage still outranks both.
  */
  const named = HAIR_PARTS.filter((part) => stated[part] != null);
  if (!coverage && mentionsHairAtAll(...sources)) {
    if (named.length > 0 || stated.greying) named.forEach((part) => spoken.add(part));
    else HAIR_PARTS.forEach((part) => spoken.add(part));
  }

  /*
    GREYING LEAVES THE BASE OPEN — the greyOverlay rule, and the reason that path
    survived the D-79 rollback while everything around it failed.

    "Salt and pepper" and "silver at the temples" say something is happening TO
    the hair; they do not name the colour underneath. So the colour axis stays
    AUTHORED and the greying is rendered on top of it. Suppressing colour here
    would produce the exact sheet the founder's bar forbids — eight uniformly
    grey heads — by treating a process as a shade.

    Only when the brief also names an actual colour does colour become spoken,
    which the check below preserves.
  */
  if (stated.greying && stated.colour == null) spoken.delete("colour");

  return {
    spoken,
    stated,
    coverage,
    mentioned: coverage || spoken.size > 0 || stated.greying || mentionsHairAtAll(...sources),
  };
}

/** Stated values arrive as bare noun phrases; an article would double up. */
function bareTerm(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/^(?:a|an|the)\s+/i, "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The partial-deference sentence: the user's own words for what they said,
 * authored craft for everything they left open.
 *
 * Kept as its own branch rather than folded into the full-authoring path below,
 * deliberately. A brief that says nothing about hair must compose byte-for-byte
 * what it composed before this feature existed, and the cheapest way to
 * guarantee that is for its code path not to change at all.
 */
function describePartialHair(input: {
  hair: Hair | null;
  deference: HairDeference;
  style: HairStyle;
  texture: string | null;
  modifiers: HairModifiers | null;
  wornState: WornState | null;
}): string {
  const { deference, style, hair } = input;
  const { spoken, stated } = deference;

  /*
    A part the brief spoke to is NEVER authored. If the interpreter also failed
    to say what it was, the part is simply omitted — the fact still reaches the
    image through the user's own words in the role and character fields, and an
    omission costs a detail where authoring would cost a contradiction.

    Note this suppresses per PART rather than the whole axis. A brief naming a
    colour leaves length and texture genuinely unsaid, so authoring them is the
    feature working; it is only the spoken part that must stay silent.
  */
  const colour = spoken.has("colour") ? bareTerm(stated.colour) : hair?.colour ?? null;
  const grain = style.texture ?? input.texture;
  const texture = spoken.has("texture") ? bareTerm(stated.texture) : grain;
  const length = spoken.has("cutLength") ? bareTerm(stated.cutLength) : style.name;

  const greying = stated.greying
    ? " Visible steel-grey strands threaded evenly through the base, concentrated at the temples and crown — unmistakable at arm's length, the base colour still clearly present underneath."
    : "";

  /*
    THE CUT IS THE SENTENCE'S SUBJECT.

    Colour and texture are adjectives hanging off a noun, so when the brief
    named the cut and the interpreter did not say what it was, there is nothing
    to hang them on — "a silver crew cut" would compose as "HAIR: a straight",
    which is not a sentence and is not a fact either. The honest degrade is
    whole-axis silence: the user's own words still reach the picture through the
    role and character fields, exactly as they did before this feature existed.

    Greying survives it, because it describes the hair rather than the cut.
  */
  if (spoken.has("cutLength") && length === null) {
    /*
      ⚠ AND THIS GUARD IS NOT THE BALD DEFECT, WHICH I HAD TO PROVE TO MYSELF
      RATHER THAN ASSUME (2026-08-23).

      I "fixed" it here too, on the reading that it held the same false premise
      as the coverage guard. It does not, and the line four above says why:
      `length` is `bareTerm(stated.cutLength)` whenever the cut is SPOKEN, so a
      stated cut already reaches the prompt through the ordinary composition —
      driven, a stated *"a shaggy mullet"* composes as `HAIR: a grey straight
      shaggy mullet`. This branch is reached only when her stated cut is
      unusable, and then there is no word to say.

      So the edit I made here was a no-op wearing a fix's clothes, and it is
      reverted. **The COVERAGE guard is the defect** — that one returns outright
      and her word never reaches anything.
    */
    return greying ? ` HAIR:${greying}` : "";
  }

  const words = [colour, texture, length].filter((word): word is string => Boolean(word));
  /*
    Greying can be the ONLY thing left. "Salt and pepper" states a process and
    no shade, so if every other part was suppressed the sentence is just the
    greying — and dropping it here is how the one fact the brief actually
    carried would go missing.
  */
  if (words.length === 0) return greying ? ` HAIR:${greying}` : "";

  const description = words.join(" ");
  const plural = length != null && PLURAL_STYLES.has(length);
  const article = plural ? "" : /^[aeiou]/i.test(description) ? "an " : "a ";

  /*
    Components and worn state belong to the CUT, so they only speak when the cut
    is ours to describe. Hanging a curtain fringe off a length the user named is
    authoring inside a fact they stated.
  */
  const authoredCut = !spoken.has("cutLength");
  const components = authoredCut ? describeModifiers(input.modifiers) : "";
  const worn = authoredCut && !style.worn ? describeWornState(input.wornState) : "";

  /*
    Greying is a constraint on the base, never a colour of its own — the one
    path that survived the D-79 rollback. "Silver at the temples" says something
    is happening TO the hair while what is underneath is still open, so the
    palette is already pulled dark and this says the rest out loud.
  */
  return ` HAIR: ${article}${description}${worn}${components}.${greying} Cut and worn as that style is genuinely worn, not a salon-neutral version of it.`;
}

/**
 * ⚠ WHAT SHE SAID ABOUT THE CUT, SAID TO THE ENGINE — and it is new on
 * 2026-08-23 because the premise it replaces was measured false.
 *
 * # The premise, quoted from the two places that held it
 *
 * This file said it twice, in as many words. At the coverage guard: *"the
 * user's own words carry it through the role and character fields — the path
 * that has always worked."* At the stated-cut guard: *"the honest degrade is
 * whole-axis silence: the user's own words still reach the picture through the
 * role and character fields, exactly as they did before this feature existed."*
 *
 * **Both sentences rest on `characterNotes` carrying her word, and it does not.**
 * Driven through the real entrance, three briefs, survival counted as *present
 * in all eight compiled prompts*:
 *
 * ```
 * "bald"    1 of 3      "buzzed"  1 of 4      "shaved"  4 of 4
 * ```
 *
 * `characterNotes` is written by a model asked to summarise a brief, so every
 * specific word is at the mercy of a paraphrase. The founder's own roll came
 * back **eight of eight with hair** on a brief whose first word is *Bald* —
 * because the summary dropped it and nothing else in the prompt said it, while
 * several lines presuppose hair (*"clear space between the topmost hair and the
 * top edge"*).
 *
 * # What this does, and the line it does not cross
 *
 * `statedHair` was a SUPPRESSION SIGNAL: it stopped the engine authoring a cut
 * and never said what the cut was. That is right about authoring and wrong
 * about silence — **a lane that silences is not a lane that speaks.** So the
 * suppressed axis now carries HER OWN WORD.
 *
 * ⚠ **The VALUE is hers and only the frame is ours** (D-172, source
 * containment). `statedHair.cutLength` is filled from her sentence and checked
 * against it by the interpreter, so what is emitted here is a word she typed —
 * never a paraphrase of it, never a synonym, and never a word inferred from the
 * brief by this file.
 *
 * ⚠ **And it is strictly additive.** With no stated cut it returns nothing and
 * every caller behaves exactly as it did — which is every roll cast before
 * today, because the interpreter was told not to fill this field for precisely
 * the briefs that needed it most.
 */
function statedCutSentence(stated: StatedHair): string {
  const word = typeof stated.cutLength === "string" ? stated.cutLength.trim() : "";
  if (word.length === 0) return "";
  return ` HAIR: ${word} — exactly as described, and nothing added to the scalp that `
    + "this description does not describe.";
}

function describeHair(
  hair: Hair | null,
  deference: HairDeference,
  texture: string | null,
  style: HairStyle | null,
  resolution: StylingResolution,
  modifiers: HairModifiers | null = null,
  wornState: WornState | null = null,
): string {
  /*
    Nothing authored survives suppression; the record says so too.

    The test is the CUT, not the texture. Those used to be one condition, and
    separating them is what lets a shaved head stop claiming a grain: its
    texture is legitimately null now (`resolveTexture`), and the old guard would
    have read that as deference and deleted the whole hair line — turning a
    record fix into a silent loss of the one sentence that says the head is
    shaved at all.
  */
  if (!style) return "";

  /*
    A NULL HAIR RECORD IS NOT AN ABSENT CUT.

    Under partial deference the colour can be suppressed on its own — the brief
    named it, so nothing is authored — while the cut is still ours to describe.
    Bailing on `!hair` here would let a stated COLOUR silence the LENGTH, which
    is the whole-axis behaviour this feature exists to end, reintroduced one
    layer down.
  */
  if (!hair && !PARTIAL_DEFERENCE_ENABLED) return "";

  /*
    COVERAGE IS TOTAL, and it is checked before anything else.

    There is no cut on a bald man. Authoring one is the founding bug of the
    whole deference doctrine, so a coverage word silences the axis outright.

    ⚠ **AND SILENCE IS NOT WHAT IT USED TO BE.** This comment used to end *"the
    user's own words carry it through the role and character fields — the path
    that has always worked"*, and that path was measured at 1 in 3 for "bald".
    Nothing authored still survives suppression; what changes is that her own
    word is now SAID rather than assumed to arrive by another road. See
    `statedCutSentence`.
  */
  if (deference.coverage) return statedCutSentence(deference.stated);

  const spoken = deference.spoken;

  /*
    The brief owns hair the moment it mentions it — the pre-D-79 rule, and what
    the kill switch returns to. Saying nothing here is the whole of it: the
    user's words are already in the prompt, and adding a second, randomly-chosen
    hair sentence beside them is how "shaved head" became curls.

    Under partial deference this narrows from the AXIS to the PART, which is the
    ruling: "silver at the temples" states a colour and leaves the cut, the
    length and the texture genuinely unsaid, so silencing all four to honour one
    is what collapsed a sheet to a single repeated look.
  */
  if (deference.mentioned) {
    /*
      OFF is exactly today: the brief owns hair the moment it mentions it, and
      the whole axis goes quiet. Keyed on the MENTION rather than on the parts,
      because a greying brief attributes no part and must still defer here.
    */
    if (!PARTIAL_DEFERENCE_ENABLED) return "";
    /*
      Bias tier keeps the old whole-axis behaviour for now. Its line is a
      silhouette handed to the casting rather than a described cut, so splicing
      a stated colour into it would need its own prose and its own founder
      grading — Path B territory, not this slice's.
    */
    if (resolution === "bias") return "";
    return describePartialHair({
      hair,
      deference,
      style,
      texture,
      modifiers,
      wornState,
    });
  }

  if (!hair) return "";

  /*
    BIAS MODE. The brief carried creative context, so a named cut would compete
    with the category the user actually asked for — and win, being the more
    specific instruction. Silhouette and length instead, handed back to the
    casting.

    Its own sentence, deliberately, rather than the prescription template with
    the name removed: that template closes on "cut and worn as that style is
    genuinely worn", which dangles when no style is named, and a dangling
    referent is an instruction the model discards.

    Colour still travels — it is not a styling axis, and it is the only
    separator a sheet of women has.
  */
  if (resolution === "bias") {
    /*
      WORN STATE IS SAID EVEN HERE, and this is the fix rather than a detail.

      The bias prose used to end "how it is worn off the face, as this casting
      wears it" — which hands the axis to the category prior, and a prior has
      exactly one favourite answer. A Versace follow came back with eight
      identical pulled-back heads the parent did not even have. Nobody owned
      the axis, so the loudest voice in the room decided it, once, for
      everyone.

      Worn state is silhouette-level, so naming it does not compete with the
      casting the way a named cut would. It is the one styling component that
      belongs at this tier, and on a heavily-locked sheet it is often the only
      thing left that separates two tiles at arm's length.
    */
    const line = HAIR_BIAS_PROSE[style.family] ?? HAIR_BIAS_PROSE["mid-length"];
    const worn = wornState && wornState !== "loose" ? ` Worn ${wornState.replace(/^worn /, "")}.` : "";
    /*
      TEXTURE TOO, and it convicts itself the same way.

      Texture was resolved and PERSISTED at this tier and then never rendered —
      the bias line carried family and colour only. So on category briefs, which
      is most real briefs, texture fell to the editorial prior, which leans wavy
      and curly: the founder has never seen a straight-haired model on a
      category sheet, while straight carries the largest weight in most heritage
      palettes.

      It also closes a record-vs-prompt gap rather than only a taste one. A row
      saying "straight" beside a prompt that never asked for it is a record that
      lies, and M7's registry reads these rows as sole truth. Saying it makes it
      true.

      Silhouette-level like worn state, so it is bias-legal for the same reason:
      how the hair GROWS is not a styling instruction that competes with the
      casting the user asked for.
    */
    /*
      A shaved silhouette has no grain to name, and now says so by omission
      rather than by rendering the word "null" into a paid prompt. Every other
      family always resolves one.
    */
    const grain = style.texture ?? texture;
    const naturally = grain ? ` Naturally ${grain}.` : "";
    return ` ${line}${worn}${naturally} Natural colour: ${hair.colour}.`;
  }
  /*
    The named cut, not the silhouette.

    "Mid-length brown hair, the exact cut open" was an invitation the model
    answered the same way eight times — its own salon-neutral default at that
    length. D9's craft is that a cut has a NAME, and the name is what carries a
    person's taste. The closing sentence is the other half: a named cut rendered
    generically is the same collapse wearing a label, so the prompt asks for the
    cut as it is actually worn.
  */
  /*
    Grammar, because the prompt is prose the model reads. "a ash blonde straight
    bob" and "a black coiled locs" both came out of the first draft — a wrong
    article is noise in a sentence whose every other word is doing work.
  */
  /*
    A style whose name already carries its texture does not get it twice.
    "a black curly curly crop" came out of the first live sheet — the kind of
    thing that reads as a typo to a model and gets weighted like an emphasis.
  */
  /*
    A shaved cut names no grain (its own branch below says colour alone), so the
    description falls back to colour + name rather than splicing a null into the
    middle of the sentence.
  */
  const grain = style.texture ?? texture;
  const description =
    grain === null || style.name.includes(grain)
      ? `${hair.colour} ${style.name}`
      : `${hair.colour} ${grain} ${style.name}`;
  const plural = PLURAL_STYLES.has(style.name);
  const article = plural ? "" : /^[aeiou]/.test(description) ? "an " : "a ";
  /*
    D10's components, composed into the same sentence as the cut.

    Their own clause rather than their own line: they are how this person wears
    THIS cut, and splitting them off would read as a second instruction the
    model can weigh against the first. "a brown wavy long, curtain fringe,
    centre-parted" is one description of one head of hair.
  */
  const components = describeModifiers(modifiers);
  /*
    Only when the cut's own name does not already say it — "a ponytail, in a
    ponytail" is the kind of doubling a model reads as emphasis.
  */
  const worn = style.worn ? "" : describeWornState(wornState);
  const cut =
    style.family === "shaved"
      ? ` HAIR: a ${style.name}, ${hair.colour} where it is grown out.`
      : ` HAIR: ${article}${description}${worn}${components}.`;
  return `${cut} Cut and worn as that style is genuinely worn, not a salon-neutral version of it.`;
}

/**
 * The heritage clause AND its separator, or neither.
 *
 * ⚠ THE SEPARATOR HAS TO TRAVEL WITH THE CLAUSE. `describeHeritage` has always
 * returned "" for an empty list, but the SUBJECT template held the comma —
 * `…${describeAge(…)}, ${describeHeritage(…)}.` — so the first brief to resolve
 * with no heritage would have shipped `apparent age 44-46 years, .` into a paid
 * prompt. Nothing did that before a stated skin tone could suppress the spread,
 * which is exactly why it is worth a named function rather than a template
 * tweak: it fails as a typo in a customer's prompt, not as an exception, and it
 * has an arm asserting on the composed STRING.
 */
function heritageClause(components: HeritageComponent[]): string {
  const described = describeHeritage(components);
  return described === "" ? "" : `, ${described}`;
}

export function describeHeritage(components: HeritageComponent[]): string {
  if (components.length === 0) return "";
  if (components.length === 1) return `${components[0].heritage} heritage`;
  // A15: no raw numbers in the prompt. Percentages are control signal, and
  // image models render digits as artefacts or mis-weight them, so the blend
  // is expressed as dominance language instead — the legacy dominance-band
  // craft the heritage ruling names for porting.
  const [dominant, secondary] = components;
  const band = dominant.pct >= 70 ? "predominantly" : "mostly";
  return `${band} ${dominant.heritage} heritage with ${secondary.heritage} features`;
}

/**
 * The covering directive, or nothing.
 *
 * Reads `statedText` — the user's own words — which is the code-owned gate
 * D-89 established: the code owns WHETHER a thing was said, and the interpreter
 * only ever owns what. It reads the same union every other deference check
 * reads, so a covering cannot fall off a follow, which inherits the notes
 * without the original sentence.
 */
function coveringFor(statedText: string): string {
  const covering = statedCovering(statedText);
  return covering ? coveringDirective(covering) : "";
}

/**
 * The final per-candidate prompt.
 *
 * Order is the contract. Character first, direction second, the code-owned
 * constant last with its authority paragraph — so that on the one axis where a
 * language model's output could still misbehave (two capped free-text fields),
 * the rules it might contradict are stated after it and claim precedence over
 * it explicitly.
 */
export function composeCandidatePrompt(input: {
  /** The user's own sentence — the reliable place to ask "did they say hair?". */
  briefText?: string;
  intent: CastingIntent;
  resolved: ResolvedIdentity;
  archetype: ArchetypeKey;
  seed: number;
  /** True on a follow — anchored styling renders at full fidelity. */
  anchored?: boolean;
  /**
   * WHAT THIS SHEET IS WEARING — the roll's born line (design §3.3).
   *
   * `null` or absent is every roll the product has cast so far and every roll
   * outside `CASTING_TWO_PATHS_SCOPE`: the constant composes exactly as it
   * always has, character for character.
   *
   * It is the ROLL's line rather than a branch's, and that is not a shortcut —
   * no branch exists when a sheet is cast, so `currentWardrobeLine`'s edited
   * arm has nothing to read here. The refine recipe is where that function
   * earns its name.
   */
  wardrobeLine?: string | null;
}): string {
  const { intent, resolved, archetype } = input;
  /* The user's own words, in one string — every deference check reads this. */
  const statedText = [input.briefText ?? "", intent.role ?? "", intent.characterNotes ?? ""].join(" ");
  const direction = ARCHETYPES[archetype];
  /*
    At what resolution the styling axes speak, decided once per candidate from
    the STATED intent. Precedence: stated > category > styling-bias > prior.
  */
  const resolution: StylingResolution = stylingResolutionFor({
    intent,
    briefStatesHair: briefStatesHair(statedText),
    anchored: input.anchored === true,
  });

  /*
    CASTING CATEGORY — a stated role is a LOCK, not a flavour (founder gate,
    2026-07-31, B5).

    The brief "female model early 20s editorial fashion model" returned people
    who were not plausibly editorial models. The old line — "They read as: X"
    — invited the model to treat the role as an energy to suggest rather than
    a category to cast within, so diversity wandered straight out of the
    category it was supposed to vary inside.

    Legacy enforced this implicitly: every prompt was written from a casting
    director's chair, and a casting director does not put forward someone who
    would be rejected at the door. Made explicit here. Variation still runs
    across heritage, features and energy — but *within* the category, never
    out of it.
  */
  const category = intent.role
    ? [
        `CASTING CATEGORY (ABSOLUTE): This person is cast as — ${intent.role}.`,
        "Every candidate must be a genuinely plausible, castable member of that category: the bone structure, proportions, grooming and bearing a professional casting director would require before putting them forward for it.",
        "Vary heritage, features, colouring and energy WITHIN this category. Never cast outside it. A candidate who would not be credible in this role is a failed candidate, however interesting the face.",
        "Keep the user's own words for the category — do not substitute a generic type for the specific one they named.",
        /*
          THE GROOMING REGISTER — founder finding, and the third confirmed face
          of the same wall.

          A skincare-founder sheet split cleanly on POLISH: the groomed tiles
          were kept and the off-register ones (half-up locs, a man-bun with a
          goatee) were rejected. Heritage variety was never the issue. Ordinary
          occupations correctly earn no composed direction, so their only
          styling authority was the bias line's soft "as this casting wears it",
          and that sheet proves it too weak to govern.

          The category already owns physique and bearing here; it now owns the
          register the styling has to clear. Note it governs ACCEPTABILITY, not
          a particular cut — the cuts must still differ across the eight, which
          is what stops this becoming the prescription D-80 removed.

          INTERIM, and honestly so: full category-coherent styling is the
          treatment stage's job. This is the third face of the D-80 wall after
          subcultural legibility and designed faces, and Path B is the answer to
          all three.
        */
        "The grooming and styling must be in register for this category: the cut, and the way it is worn, has to be something a professional casting director would accept when putting this person forward for it. Within that register the eight must still differ — this governs what is acceptable, never which cut.",
        /*
          THE AGE OUTLIER BELONGS TO THE SAME WORLD — founder finding.

          A young-leaning casting still draws the occasional older candidate,
          and that is the tendencies working: an unusual casting is surprising
          rather than wrong. But the older tile was arriving styled as an older
          person IN GENERAL rather than as an older person in THIS world, so the
          twitch grandpa read as though he had wandered in from another decade.

          The lean decides who is in the room; this decides that everyone in the
          room shares a present tense. It is deliberately about currency rather
          than about youth — the point is not to make the sixty-year-old look
          young, it is to stop him looking like a photograph from 1974.
        */
        "Candidates who sit outside this casting's usual age still belong to its world: their grooming, styling and self-presentation are contemporary to this casting, not to a different generation. Age them honestly in the face and the skin — never in the era they appear to be styled from.",
      ].join(" ")
    : "";

  const subject = [
    `SUBJECT: A ${resolved.build ? `${resolved.build} ` : ""}${resolved.sex === "nonbinary" ? "androgynous person" : resolved.sex}, ${describeAge(resolved.ageBand, resolved.agePhase)}${heritageClause(resolved.heritage)}.${describeBuild(resolved.build, intent.role)}${describeHair(resolved.hair, hairDeferenceFor({ briefText: input.briefText, intent }), resolved.realized.hairTexture, resolved.realized.hairStyle, resolution, resolved.realized.hairModifiers, resolved.realized.wornState)}${describeRealizedAxes(resolved.realized, (axis) => statedAxis(axis, statedText), resolution)}`,
    intent.characterNotes ? `Character detail: ${intent.characterNotes}.` : "",
    /*
      ⚠ THE STATED SKIN LANE SPEAKS — her own word, said plainly
      (`CASTING_V2_BRIEF_FIDELITY_BUILD.md` section 3c; the shape is the stopped
      design's section 5).

      **A lane that silences is not a lane that speaks.** `statedHair` failed
      for a year in exactly that way — it stood the engine down from authoring a
      cut and never said what the cut was, and his bald cast came back with
      hair. So this half is not optional and does not ship without the deference
      half beside it: filling `statedSkin` and saying nothing would buy a
      quieter engine on a fact nobody states, which is strictly worse than
      today.

      Placed AFTER character detail for `coveringFor`'s reason — it qualifies
      the user's own words rather than competing with them — and it renders
      NOTHING at all unless the brief itself named skin. Every value in it is
      hers: `parseStatedSkin` drops any phrase carrying a word she did not type,
      so this frame is the only thing the product contributes.

      Outside `CASTING_BRIEF_FIDELITY_SCOPE` the lane is empty on every roll,
      because the interpreter was never asked — so this line does not exist for
      an unflagged account and the prompt is byte-identical to today's.
    */
    statedSkinSentence(intent.statedSkin),
    /*
      A STATED FAITH COVERING, as the garment rather than as a noun (D-124).

      It already rendered — 8 of 8 on a paid verification — but it rendered as a
      draped scarf with hair showing at the front, which is a different garment
      from the one that was asked for. A loose noun in character detail gets
      whatever the model's prior does with the word; the A9 / broken-nose
      pattern says describe it plainly instead.

      Placed AFTER character detail so it qualifies the user's own words rather
      than competing with them, and it renders nothing at all unless the brief
      itself names a covering — nothing is ever inferred from a faith, a name or
      a heritage.
    */
    coveringFor(statedText),
    /*
      A LOCKED look still needs presence to vary. This is the sameness bug.

      The rule used to be "one axis or the other, never both shouting" — a look
      carries its own expression whisper (C3), so stacking a disposition line on
      top would give the image model two instructions for one face. That is
      right when the look is what VARIES across the eight: each candidate gets a
      different house's casting, and the whisper is the difference.

      It is wrong when the brief LOCKS a look. Then all eight get an identical
      look block, presence is computed and silently never reaches the prompt,
      and the only things left differing are heritage and hair — inside a locked
      heritage, that is almost nothing. The founder's sheet came back eight men
      with the same hair, the same eyes and no personality, and this is why.

      So: a varying look suppresses presence, a locked look does not. When the
      look is fixed, the whisper is the same for everyone and cannot be the
      difference, so disposition has to be.
    */
    resolved.look && !intent.look
      ? `LOOK: ${LOOKS[resolved.look].thesis} ${LOOKS[resolved.look].avoid} EXPRESSION WHISPER: ${LOOKS[resolved.look].whisper}`
      : resolved.look
        ? `LOOK: ${LOOKS[resolved.look].thesis} ${LOOKS[resolved.look].avoid} PRESENCE: ${ENERGIES[resolved.energy]}. Hold the look; let this presence differentiate this particular person from the others cast alongside them.`
        : `PRESENCE: ${ENERGIES[resolved.energy]}.`,
  ]
    .filter(Boolean)
    .join(" ");

  /*
    SKIN FINISH — A9's engineered prose, re-homed (item 7).

    Precedence: what the brief said beats what the archetype chose. A user who
    types "dewy" has decided; the archetype only decides when nobody has.

    Once per ROLL, not per candidate: a sheet is one casting call under one
    lighting setup, so eight candidates must be comparable. The CAPTURE block's
    person-level clause still modulates on top of this — a weathered outdoor
    face and a groomed indoor one respond to the same flash differently — which
    is why this names the room's finish rather than each person's skin.
  */
  const finish = statedFinish(statedText) ?? direction.finish;
  const finishBlock = `SKIN FINISH: ${FINISH_RENDER[finish]}`;

  /*
    The composed direction, beside the shelf entry rather than instead of it.

    Precedence: stated facts > category > shelf archetype > composed direction >
    styling-bias > prior. Below the shelf because a reviewed constant outranks
    generated prose; above styling-bias for the same reason bias exists at all.

    Never in CASTING CATEGORY — that block is the user's own words and is
    absolute. An aesthetic reference is a direction, not a category.
  */
  const composed =
    COMPOSED_DIRECTION_ENABLED && intent.composedDirection
      ? ` REFERENCE DIRECTION: ${intent.composedDirection.thesis} ${intent.composedDirection.avoid}`
      : "";
  const directionBlock = `DIRECTION: ${direction.thesis} ${direction.avoid}${composed} ${finishBlock}`;

  // Category first: it decides who is eligible at all, before direction shapes
  // how they are cast and before the constant fixes how they are photographed.
  return [category, subject, directionBlock, photorealHumanConstant(input.wardrobeLine ?? null)]
    .filter(Boolean)
    .join("\n");
}

/**
 * The label under a tile.
 *
 * Names whichever axis this sheet actually varies along, so the caption
 * explains the difference the user is looking at: the look for a modelling
 * brief, the disposition for a character one.
 */
export function personaLineFor(resolved: ResolvedIdentity, read?: string | null): string {
  // A read written for THIS brief beats a label recycled across every sheet.
  if (read) return read;
  if (resolved.look) {
    // Sentence case: these sit under a tile, not in a mono status pill.
    return resolved.look.charAt(0).toUpperCase() + resolved.look.slice(1);
  }
  const labels: Record<EnergyKey, string> = {
    warm: "Warm, unhurried",
    dry: "Dry and flat",
    bright: "Bright, quick",
    grave: "Still and grave",
    open: "Open, easy",
    guarded: "Guarded",
    wry: "Wry",
    plain: "Plain and direct",
  };
  return labels[resolved.energy];
}

/** Exported for the contract test: the constant must survive composition. */
/**
 * Derived, never re-listed. See `cohortConstantBlocks` for why.
 *
 * The UNPATHED markers, kept as a constant because that is what every caller
 * asserting today's prompt wants. A guard checking a PATHED prompt calls
 * `cohortConstantBlocks(line)` with the line the prompt was composed from —
 * asking these markers about a pathed prompt is asking whether it contains a
 * wardrobe sentence it was deliberately built not to contain.
 */
export const COHORT_CONSTANT_MARKERS = cohortConstantBlocks(null);

export { AGE_BANDS, BUILDS };
