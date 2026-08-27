/**
 * Client projections for the roll domain (plan §J).
 *
 * These are explicit allowlist DTOs. Nothing here spreads a database row, and
 * that is the rule rather than a preference: a spread row is how `passwordHash`
 * once reached `auth.me` and how image URLs reached the moderator surface
 * (access-control invariant 8).
 *
 * What may never appear in anything this module returns:
 * `compiledBrief`, `internalPrompt`, provider names, provider models, provider
 * request ids, storage keys, queue internals, or any row belonging to another
 * user. The types below are constructed field by field so adding one of those
 * is a deliberate edit, not an accident of shape.
 *
 * **Amendment, 2026-08-01 (brief echo).** `lockContract` was on that list and
 * is now partly off it, which is the kind of change that has to be stated
 * rather than made quietly. The *raw column* still never crosses — it is
 * compiler-written JSON, and forwarding it would be the injection path this
 * module exists to close. What crosses is `readBriefFacts`: a validated
 * projection of the pinned facts, every value checked against a closed
 * vocabulary, no free text, no percentages, no prompts.
 *
 * The reason it is safe is not that it is small. It is that these are the
 * user's own stated facts, returned to the user who stated them, on a
 * projection that is already owner-scoped. Nothing here is a recipe: the
 * cast's creative content — the composed prompt, the archetype thesis, the
 * character notes — stays inside `compiledBrief` and stays here.
 */
import { IMAGINATIONS, type Imagination } from "../../shared/imagination";
import { CAST_STYLES, type CastStyle } from "../../shared/castStyles";
import { candidateFailureKind, type CandidateFailureKind } from "../../shared/candidateFailure";
import type { CastingCandidate, CastingRoll, CastingSession } from "../../drizzle/schema";
import { storagePublicUrl } from "../storage";
import { UNLOCKABLE_FIELDS, type CastingChip, type UnlockableField } from "./briefCompiler";
import { statesWardrobe } from "./statedWardrobe";
import type { CastingPath } from "../../shared/castingPaths";
import { HOUSE_WARDROBE_LINE, currentWardrobeLine } from "./wardrobeLine";
import { tokensComeFromBrief } from "./castingIntent";
import {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "./castingIntent";

/**
 * §J's enum, plus `signed` — a deliberate addition, not a drift.
 *
 * `signed` used to collapse into `ready`, and the consequence was the founder
 * losing a Cast he had just paid 500 credits for: the tile looked exactly like
 * every other candidate, offered to sign her again, and led nowhere. A
 * permanent purchase has to be reachable from the place it was made.
 */
export type CandidateProjectionStatus = "casting" | "ready" | "failed-refunded" | "signed";

export type CandidateProjection = {
  candidateId: string;
  position: number;
  indexLabel: string;
  status: CandidateProjectionStatus;
  imageUrl: string | null;
  thumbUrl: string | null;
  personaLine: string | null;
  kept: boolean;
  /**
   * The Cast this candidate became, when it became one.
   *
   * The public KI id — the only Cast identifier that leaves the server (§J) —
   * so the tile can link to her room rather than merely showing a badge that
   * goes nowhere.
   */
  castId: string | null;
  /**
   * WHY THIS ONE DIDN'T ARRIVE — the customer-facing kind of a `failed` row's
   * `failureClass` (#122; the founder: *"these cards need chips on them"*).
   * Null on every status but `failed`: a cancelled or expired slice is the
   * customer's own decision and the sheet says so from the roll's status, not
   * from a class. The CLASS itself (a provider word) never crosses — the kind
   * is derived through `shared/candidateFailure.ts`, the one vocabulary the
   * tile speaks.
   */
  failure: { kind: CandidateFailureKind } | null;
};

export type RollProjection = {
  rollId: string;
  rollIndex: number;
  status: CastingRoll["status"];
  briefText: string;
  chips: CastingChip[];
  /** The brief echo's facts — see `readBriefFacts`. */
  facts: BriefFacts;
  /**
   * Which FACE this roll followed, not merely which roll.
   *
   * `fromRollId` alone made the sheet say "the eight follow roll 01", which is
   * true and useless — a roll has eight faces and the user pointed at one.
   */
  lineage: { fromCandidateId?: string; fromCandidateLabel?: string; fromRollId?: string };
  /**
   * The sheet could not be varied, and the user is entitled to know.
   *
   * A boolean, not the count: the count is a taste instrument and belongs
   * inside `compiledBrief` with the rest of the internals. What crosses the
   * boundary is the one thing the user can act on.
   */
  varianceHeld: boolean;
  /**
   * The interpreter could not be read and this roll was compiled from the raw
   * sentence — so nothing the brief stated was pinned. See `readFellBack`.
   */
  fellBack: boolean;
  /**
   * The brief said what they were wearing, and the sheet kept the studio tee.
   *
   * The override is law; the silence about it was not. See `statedWardrobe.ts`
   * for why this is a narrower question than the composed-direction guard asks.
   */
  statedWardrobe: boolean;
  /**
   * THE PROMPT THIS SHEET WAS PAINTED FROM — the author road only (#131 slice
   * D; ruling rule 5, verbatim: *"The expanded prompt is shown on the cast,
   * editable. No hidden prompt, ever."*).
   *
   * ⚠ AND THE LOCKED HOUSE BLOCK IS NOT IN IT — #168, his ruling refining
   * rule 5 (verbatim: *"the framing hair camera language realism is all our
   * personal prompting styles that i dont want competitors to be able to
   * steal … just not our locked settings prompting"*). Rule 5's purpose was
   * honesty about what the AUTHOR did with the customer's words, never
   * disclosure of the studio's craft. So this is REBUILT FROM THE CUSTOMER'S
   * OWN PARTS — the brief as sent (`register.briefSent` when a chip edit
   * rewrote it, else the row's `briefText`), the family clause where one was
   * carried, and the author's content — and the block's text never crosses
   * the wire at all (invariant-8 shape: out by construction, not omitted by
   * the renderer). The sheet's footer line still says a locked block exists.
   * The house-composed prompt of every other roll stays inside
   * `compiledBrief`, and this is `null` there — an unflagged sheet is
   * byte-identical to today's. Owner-scoped like the rest of the roll.
   * "Editable" lands as *use as brief*: the sheet offers it back as the next
   * roll's sentence, which is why the entrance admits
   * `BRIEF_TEXT_MAX_AUTHOR_ROAD`.
   */
  authoredPrompt: string | null;
  /**
   * WHAT *USE AS BRIEF* PUTS IN THE BOX — the customer's words plus the
   * author's CONTENT, and never the locked house block (review of #141,
   * finding 1): the block is appended by code on every roll, so a draft that
   * carried it would send the block twice and hand the reader studio
   * sentences as customer-stated facts. Null unless the author wrote content
   * (a LOW or static sheet has nothing to offer back — its brief is already
   * in the box). `authoredPrompt` above stays the WHOLE prompt, for showing.
   */
  authoredText: string | null;
  /**
   * HOW FAR THE AUTHOR WENT on this sheet (#131 slice E) — `low` | `max` on an
   * author register, null everywhere else. The dock preselects the NEXT roll's
   * meter from it, the way the path switch preselects from the sheet's path:
   * a MAX sheet whose "Roll again" silently went out at LOW would be a wrong
   * default on a paid action. Read through a validator like everything lifted
   * out of `compiledBrief`.
   */
  imagination: Imagination | null;
  /**
   * WHICH STYLE's bundle closed the prompt (#142) — `photoreal` on an author
   * register that recorded one, null everywhere else INCLUDING author rows
   * written before the style was recorded: the sheet says what the row says
   * and never back-fills a fact. Read through a validator like `imagination`.
   */
  style: CastStyle | null;
  /**
   * WHY THE AUTHOR SAT THIS SHEET OUT — rows written before #154.
   *
   * Until the family clause landed, a roll the author road could not carry
   * under `CASTING_CREATIVE_REGISTER_SCOPE` — a FOLLOW (`anchored`) or a roll
   * carrying a chip unlock or override (`edited`) — composed HOUSE, and
   * `briefCompiler` recorded the reason on the row (`register: { kind:
   * "house", because }`). No new row records one; the rows already written
   * still project here. Until this field the reason
   * reached the ROW and never the SHEET: the customer saw an authored sheet,
   * tapped Follow or removed a chip, and got a sheet with no prompt record, no
   * settings line and no word about why — the author simply vanished. Null on
   * every author register and on every unflagged roll (which has no register
   * at all), so an unflagged sheet is byte-identical to today's. Read through a
   * validator like `imagination`: an unknown reason is null, never forwarded.
   */
  authorSatOut: AuthorSatOutReason | null;
  /**
   * WHAT THIS SHEET IS WEARING — the two paths (design §3.3, item 6).
   *
   * ⚠ **An EXPLICIT projection off the roll's own columns, and it is explicit
   * for the reason §3.2 refuses the cheaper design.** The same sentence lives
   * in the Cast's `technicalSchema`, which is INTERNAL and never crosses a
   * projection boundary, and in `compiledBrief`, whose docblock says the same.
   * Lifting a display string out of either is how a sensitive blob starts being
   * read for a caption — so the sheet reads the column, through the one owner.
   *
   * `null` is every roll cast before the paths existed and every roll outside
   * the flag: the sheet says what it says today and nothing appears.
   *
   * `enginePicked` is DERIVED, never stored — see the projection site. It is
   * §4.1's label obligation: *she is never told she asked for it*.
   *
   * ⚠ **`path` rides INSIDE this object rather than beside it as its own
   * field, and that is the dark-ship discipline rather than tidiness** (§6).
   * Every surface the toggle sitting adds — the sheet's wardrobe line, the
   * re-roll switch's preselect, the notice's path arm — draws only when this
   * object is non-null, which is exactly *this roll was cast on a path*. A
   * top-level `path` would be a second thing a client could key on, and a
   * client-derived fallback beside it is how a dark feature leaks onto the 206
   * production rolls that have no path at all.
   */
  wardrobe: { path: CastingPath; line: string; enginePicked: boolean } | null;
  priceCredits: number;
  counts: { total: number; ready: number; casting: number; failed: number };
  createdAt: string;
  /**
   * HOW LONG THIS ROLL HAS BEEN WAITING, subtracted here rather than there
   * (entry 13 of the instrument doctrine; fable-670).
   *
   * The sheet says so past about two minutes — the supervised-wait promise —
   * and it used to decide that from `createdAt` minus the BROWSER's clock. Two
   * moments off two clocks: a laptop two minutes fast confessed an unusual wait
   * on every roll one second in, and a laptop two minutes slow never confessed
   * one at all, which is the same silence as the promise not existing. The
   * server holds both terms, so it does the subtraction and ships the answer.
   *
   * The same reasoning `variants.pending[].stage` already gives for keeping the
   * lease decision here (`routes/castingV2.ts`): a clock question belongs to
   * the side that owns the clock.
   */
  ageMs: number;
  candidates: CandidateProjection[];
};

export type SessionProjection = {
  sessionId: string;
  status: CastingSession["status"];
  originType: CastingSession["originType"];
  activeRollId: string | null;
  signedCastCount: number;
  createdAt: string;
  expiresAt: string | null;
};

/**
 * The facts behind the brief echo.
 *
 * Founder condition, 2026-08-01: *"the sentence generates from the same
 * validated lock contract the compiler enforces (one source of truth)."* So
 * this reads `roll.lockContract` — the column `validateLocks` checks every
 * candidate against — rather than re-deriving anything from the compiled brief.
 * If the sentence and the sheet ever disagree, it is because the validator
 * would also have disagreed, which is the only honest failure mode available.
 *
 * `open` is the other half of the law and the half the pill row could not show:
 * a field that is null is not unknown, it is deliberately varying, and the user
 * could not see that or pin it.
 *
 * Invariant 8: an explicit projection of named fields. The compiled brief is
 * written by a compiler that is an LLM behind a seam, so nothing crosses this
 * boundary without being checked against a closed list first.
 */
export type BriefFacts = {
  /**
   * The casting category, in the user's own words.
   *
   * Not in `lockContract`, because `LockFacts` is the validator's input and
   * has no role field — but it IS a lock, and the loudest one: the prompt
   * carries it as "CASTING CATEGORY (ABSOLUTE)" and a candidate who would not
   * be credible in it is a failed candidate (gate B5). An echo that omitted it
   * was omitting the single strongest constraint on the sheet.
   */
  role: string | null;
  locks: {
    sex?: string;
    ageBand?: string;
    agePhase?: string;
    heritage?: string[];
    build?: string;
    energy?: string;
    look?: string;
  };
  /** Fields the roll deliberately varied. Named, up to three; else collapsed. */
  open: string[];
  /** Which axis the eight differ along, when the compiler recorded one. */
  variationAxis: "look" | "disposition" | null;
  /**
   * Worn things the brief named, in the user's own words.
   *
   * NOT a lock — an accessory neither varies across the eight nor pins an
   * identity axis — which is why the echo renders it at full ink with no
   * picker. It is here because the sentence claims to say what the brief said,
   * and staying silent about a stated fact made that claim quietly incomplete.
   */
  statedAccessories: string[];
};

/** Closed lists, so a compiler-side surprise cannot reach the client. */
const FACT_VOCABULARIES: Record<string, readonly string[]> = {
  sex: SEXES,
  ageBand: AGE_BANDS,
  agePhase: AGE_PHASES,
  build: BUILDS,
  energy: ENERGY_KEYS,
  look: LOOK_KEYS,
};

/** Everything the echo can name as varying, in the order it reads best. */
const OPEN_AXES = ["sex", "ageBand", "heritage", "build", "energy", "look"] as const;

export function readBriefFacts(
  lockContract: unknown,
  compiledBrief: unknown,
  briefText = "",
): BriefFacts {
  const raw = (lockContract ?? {}) as Record<string, unknown>;
  const locks: BriefFacts["locks"] = {};

  for (const [field, vocabulary] of Object.entries(FACT_VOCABULARIES)) {
    const value = raw[field];
    if (typeof value === "string" && vocabulary.includes(value)) {
      (locks as Record<string, string>)[field] = value;
    }
  }

  if (Array.isArray(raw.heritage)) {
    const heritages = raw.heritage
      .map((entry) =>
        entry && typeof entry === "object" ? (entry as { heritage?: unknown }).heritage : null,
      )
      .filter((value): value is string => typeof value === "string" && HERITAGES.includes(value as never));
    if (heritages.length > 0) locks.heritage = heritages.slice(0, 2);
  }

  const open = OPEN_AXES.filter((axis) => !(axis in locks));

  const intent = (compiledBrief as { intent?: Record<string, unknown> } | null)?.intent;
  const axis = intent?.variationAxis;
  const variationAxis = axis === "look" || axis === "disposition" ? axis : null;

  /*
    Free text, so it is bounded and stripped rather than enum-checked — the
    only field here that cannot be. The interpreter caps it at 12 words; this
    is the belt to that braces, because the compiled brief is written by a
    model behind a seam.
  */
  const rawRole = intent?.role;
  const role =
    typeof rawRole === "string" && rawRole.trim().length > 0
      ? rawRole.replace(/\s+/g, " ").trim().slice(0, 60)
      : null;

  /*
    CHECKED AGAIN, HERE, against the user's own sentence.

    The interpreter already refuses a phrase carrying a word the brief does not
    contain, and this asks the same question a second time at the boundary the
    text actually crosses — the same reason `readVarianceHeld` re-validates a
    stored JSON column rather than forwarding it. The compiled brief is written
    by a model behind a seam, and a projection that trusted it would be an
    injection path to the client (invariant 8).

    Every word rendered in the echo is therefore provably the user's own.
  */
  const rawAccessories = intent?.statedAccessories;
  const statedAccessories = Array.isArray(rawAccessories)
    ? rawAccessories
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.replace(/\s+/g, " ").trim().slice(0, 40))
        .filter((entry) => tokensComeFromBrief(entry, briefText))
        .slice(0, 3)
    : [];

  return { role, locks, open, variationAxis, statedAccessories };
}

const CHIP_KINDS = new Set<CastingChip["kind"]>(["subject", "style", "direction", "lineage"]);

/**
 * Chips are stored inside the internal compiled brief, so they are read back
 * through a validator rather than trusted. The compiled brief is written by a
 * compiler that will one day be an LLM behind a seam — a projection that
 * forwarded whatever it found there would be an injection path straight to
 * the client.
 */
export function readChips(compiledBrief: unknown): CastingChip[] {
  if (!compiledBrief || typeof compiledBrief !== "object") return [];
  const raw = (compiledBrief as { chips?: unknown }).chips;
  if (!Array.isArray(raw)) return [];
  const chips: CastingChip[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { label, kind, removable, field } = entry as Record<string, unknown>;
    if (typeof label !== "string" || !label) continue;
    if (typeof kind !== "string" || !CHIP_KINDS.has(kind as CastingChip["kind"])) continue;
    chips.push({
      label: label.slice(0, 60),
      kind: kind as CastingChip["kind"],
      removable: removable === true,
      // Checked against the closed list, not forwarded: the sheet sends this
      // back as an `unlock`, so a value invented upstream would be a value the
      // client then posts to a strict enum and gets refused for.
      ...(typeof field === "string" && UNLOCKABLE_FIELDS.includes(field as UnlockableField)
        ? { field: field as UnlockableField }
        : {}),
    });
  }
  return chips.slice(0, 12);
}

/**
 * A candidate's public status.
 *
 * `discarded` returns null — a discarded card is gone from the sheet, and the
 * client's undo affordance holds the id it just discarded rather than reading
 * it back from a projection.
 *
 * `expired` projects as `failed-refunded` WITH ITS IMAGE SUPPRESSED, and the
 * distinction between those two halves is the whole rule.
 *
 * An expired candidate arrived after its roll was cancelled and was refunded
 * under the generosity ruling (2026-07-31), which is only defensible because
 * the user never receives the image. That constraint is about the IMAGE, not
 * about the tile — and the first version enforced it by returning null, which
 * removed the tile as well.
 *
 * The founder found what that costs: cancel a roll whose eight were already
 * dispatched, every candidate lands and expires, and the sheet empties out
 * completely. Not even skeletons — a blank page where eight faces had been,
 * with no account of what happened to them. A sheet that erases itself is a
 * worse answer than one that says "cancelled · refunded" eight times.
 *
 * So the tile stays and the image does not. `imageUrl` and `thumbUrl` are
 * nulled for every refunded candidate below, at the projection rather than in
 * the component, so no future caller can reintroduce the leak by rendering a
 * field it found on the object.
 *
 * `cancelled` — the slices that never ran — projects as `failed-refunded`,
 * and the sheet reads the roll's own `cancelled` status to say so in the
 * user's own terms rather than blaming us for a failure they chose. The §J
 * enum stays as ratified; the copy is derived, not a fourth state.
 */
export function projectCandidateStatus(
  status: CastingCandidate["status"],
): CandidateProjectionStatus | null {
  switch (status) {
    case "queued":
    case "dispatched":
      return "casting";
    case "ready":
      return "ready";
    case "signed":
      return "signed";
    case "failed":
    case "cancelled":
    case "expired":
      return "failed-refunded";
    case "discarded":
      return null;
  }
}

/**
 * What a candidate looks like RIGHT NOW — the row, plus the face it shows.
 *
 * The face fields are REQUIRED, and that is the design rather than pedantry.
 * `CandidateWithFace` extends `CastingCandidate`, so a projection that took a
 * plain candidate would still compile when handed the richer row and would
 * quietly render the ORIGINAL while Sign spent the refinement — a surface
 * lying about what its own button does, with nothing failing to say so.
 * Requiring the fields makes that a compile error at every call site.
 */
export type ProjectableCandidate = CastingCandidate & {
  selectedVariantPublicId: string | null;
  faceImageKey: string | null;
  faceThumbKey: string | null;
};

export function projectCandidate(
  candidate: ProjectableCandidate,
  castPublicId?: string | null,
): CandidateProjection | null {
  const status = projectCandidateStatus(candidate.status);
  if (!status) return null;
  return {
    candidateId: candidate.publicId,
    position: candidate.position,
    // "01" through "08" — display metadata only. Nothing is ever keyed by it.
    indexLabel: String(candidate.position + 1).padStart(2, "0"),
    status,
    /*
      Built from the key at read time; the key itself never leaves the server.

      A REFUNDED CANDIDATE NEVER CARRIES ITS IMAGE. An `expired` one has a real
      `imageKey` — it landed, just too late to be shown — and the generosity
      refund is only defensible because the user does not receive it. Suppressed
      here rather than left to the tile, so the rule holds for every caller
      including ones that do not exist yet.
    */
    imageUrl: status === "failed-refunded" || !candidate.faceImageKey
      ? null
      : storagePublicUrl(candidate.faceImageKey),
    castId: castPublicId ?? null,
    thumbUrl: status === "failed-refunded" || !candidate.faceThumbKey
      ? null
      : storagePublicUrl(candidate.faceThumbKey),
    personaLine: candidate.personaLine,
    kept: candidate.keptAt !== null,
    failure: candidate.status === "failed" ? { kind: candidateFailureKind(candidate.failureClass) } : null,
  };
}

/**
 * Did the sheet fail to reach the variance floor even after the release?
 *
 * Validated rather than trusted, like every other read of a json column — the
 * shape is written by the compiler today, but a column parsed as whatever it
 * happens to contain is one migration away from being a lie the echo repeats.
 */
function readVarianceHeld(compiledBrief: unknown): boolean {
  if (!compiledBrief || typeof compiledBrief !== "object") return false;
  const variance = (compiledBrief as { variance?: unknown }).variance;
  if (!variance || typeof variance !== "object") return false;
  return (variance as { confess?: unknown }).confess === true;
}

/**
 * Was this roll compiled from a READ brief, or from the raw sentence?
 *
 * The compiler has recorded this since Path A shipped and nothing has ever
 * shown it. That silence is the bug: when the interpreter is unreachable, or
 * its reply cannot be read, the compile falls back to the sentence itself and
 * **every lock the user stated is lost** — the sex, the age, the heritage they
 * typed. The roll still runs and is still charged, and the sheet looks exactly
 * like an ordinary one. A paid roll that quietly ignored half the brief.
 *
 * Fail-open on purpose (catalog H30): an interpreter outage must never cost
 * someone their roll. Nothing here changes that. It only stops the outage being
 * invisible to the person who paid for it.
 *
 * `=== false` rather than falsy, and the reason matters: rolls compiled before
 * this field existed have no value, and "absent" is not "it fell back". An
 * unknown must never be reported as a failure.
 */
/**
 * The authored prompt as SHOWN, read through a validator like everything else
 * lifted out of `compiledBrief` — and REBUILT from the customer's own parts
 * rather than sliced out of `register.prompt` (#168): the brief as sent, the
 * family clause where one was carried, the author's content. The locked house
 * block sits at the end of `register.prompt` and is the studio's framework
 * (his ruling), so the whole-prompt field is never forwarded — a block
 * sentence structurally cannot appear here because no part this function
 * assembles ever contained one (`containsHouseSentence` proves it in the
 * suite, with a sabotage arm). `AUTHORED_PROMPT_MAX` is a validator bound,
 * not a product one: the word budget keeps a real prompt well under it.
 */
export const AUTHORED_PROMPT_MAX = 8000;
export function readAuthoredPrompt(briefText: string, compiledBrief: unknown): string | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const register = (compiledBrief as { register?: unknown }).register;
  if (!register || typeof register !== "object") return null;
  const { kind, prompt, content, briefSent, carried } = register as {
    kind?: unknown;
    prompt?: unknown;
    content?: unknown;
    briefSent?: unknown;
    carried?: unknown;
  };
  /* An author row always records the whole prompt; a row without one never painted. */
  if (kind !== "author" || typeof prompt !== "string") return null;
  const parts: string[] = [];
  const brief = typeof briefSent === "string" && briefSent.trim().length > 0 ? briefSent : briefText;
  if (brief.trim().length > 0) parts.push(brief.trim());
  const clause = carried && typeof carried === "object" ? (carried as { clause?: unknown }).clause : null;
  if (typeof clause === "string" && clause.trim().length > 0) parts.push(clause.trim());
  if (typeof content === "string" && content.trim().length > 0) parts.push(content.trim());
  const shown = parts.join("\n\n");
  if (shown.length === 0 || shown.length > AUTHORED_PROMPT_MAX) return null;
  return shown;
}

/** Brief + the author's content — what a customer may roll again with. Null without authored content. */
export function readAuthoredText(briefText: string, compiledBrief: unknown): string | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const register = (compiledBrief as { register?: unknown }).register;
  if (!register || typeof register !== "object") return null;
  const { kind, content, briefSent } = register as { kind?: unknown; content?: unknown; briefSent?: unknown };
  if (kind !== "author" || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > AUTHORED_PROMPT_MAX) return null;
  /* The brief AS SENT (#164): a chip edit rewrote the sentence, and rolling
     again with the pre-edit text would silently undo the customer's own change. */
  const brief = typeof briefSent === "string" && briefSent.trim().length > 0 ? briefSent : briefText;
  return `${brief.trim()}\n\n${trimmed}`;
}

export function readImagination(compiledBrief: unknown): Imagination | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const register = (compiledBrief as { register?: unknown }).register;
  if (!register || typeof register !== "object") return null;
  const { kind, imagination } = register as { kind?: unknown; imagination?: unknown };
  if (kind !== "author") return null;
  return (IMAGINATIONS as readonly unknown[]).includes(imagination) ? (imagination as Imagination) : null;
}

export function readCastStyle(compiledBrief: unknown): CastStyle | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const register = (compiledBrief as { register?: unknown }).register;
  if (!register || typeof register !== "object") return null;
  const { kind, style } = register as { kind?: unknown; style?: unknown };
  if (kind !== "author") return null;
  return (CAST_STYLES as readonly unknown[]).includes(style) ? (style as CastStyle) : null;
}

/**
 * The two reasons the author road USED TO decline a roll under the flag (before
 * #154) — the vocabulary the compiler's former `houseBecause` wrote, pinned
 * here so the sheet's copy and the rows already written cannot drift apart (a
 * reason this list does not know projects null, and the arm in
 * `rollProjection.test.ts` that reads a made-up reason is what keeps that
 * honest rather than silent).
 */
export const AUTHOR_SAT_OUT_REASONS = ["anchored", "edited"] as const;
export type AuthorSatOutReason = (typeof AUTHOR_SAT_OUT_REASONS)[number];

export function readAuthorSatOut(compiledBrief: unknown): AuthorSatOutReason | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const register = (compiledBrief as { register?: unknown }).register;
  if (!register || typeof register !== "object") return null;
  const { kind, because } = register as { kind?: unknown; because?: unknown };
  if (kind !== "house") return null;
  return (AUTHOR_SAT_OUT_REASONS as readonly unknown[]).includes(because) ? (because as AuthorSatOutReason) : null;
}

function readFellBack(compiledBrief: unknown): boolean {
  if (!compiledBrief || typeof compiledBrief !== "object") return false;
  return (compiledBrief as { interpreted?: unknown }).interpreted === false;
}

/**
 * The sheet's wardrobe line and whether it was chosen for her.
 *
 * Beside the projection rather than inside it because it is three derivations
 * and one of them — the engine-pick label — is a product promise rather than a
 * field copy.
 */
function projectWardrobe(
  roll: CastingRoll,
): { path: CastingPath; line: string; enginePicked: boolean } | null {
  const resolution = currentWardrobeLine({
    rollPath: roll.path,
    rollLine: roll.wardrobeLine,
  });
  if (resolution.kind !== "line") return null;
  return {
    /*
      The path the ONE OWNER resolved, never `roll.path` read again here.

      They cannot disagree today — `currentWardrobeLine` returns the column it
      was handed — and reading the column a second time three lines below the
      call that already answered is the parallel-copy shape (working law 4) in
      miniature. It is also the field a client keys every new §6 surface on, so
      it should come from the same answer the line does.
    */
    path: resolution.path,
    line: resolution.line,
    enginePicked: resolution.path === "wardrobe"
      && resolution.line !== HOUSE_WARDROBE_LINE
      && !statesWardrobe(roll.briefText),
  };
}

export function projectRoll(input: {
  roll: CastingRoll;
  candidates: readonly ProjectableCandidate[];
  parentCandidatePublicId?: string | null;
  parentCandidatePosition?: number | null;
  parentRollPublicId?: string | null;
  /** Signed candidates → their Cast's public id, resolved owner-scoped. */
  castPublicIdByCandidateId?: ReadonlyMap<number, string>;
  /**
   * The moment this projection is made, defaulting to one reading taken here.
   *
   * `ageMs` subtracts it from `roll.createdAt`, which the roll's own insert
   * wrote off this same clock (`db/castingV2.ts` supplies `createdAt`; the
   * column's `defaultNow()` is never reached). Both terms, one clock, one
   * reading — which is the whole of entry 13. Injectable so the test can fix
   * the instant rather than sleep.
   */
  now?: Date;
}): RollProjection {
  const now = input.now ?? new Date();
  const candidates = input.candidates
    .map((candidate) =>
      projectCandidate(candidate, input.castPublicIdByCandidateId?.get(candidate.id) ?? null))
    .filter((candidate): candidate is CandidateProjection => candidate !== null)
    .sort((left, right) => left.position - right.position);

  return {
    rollId: input.roll.publicId,
    rollIndex: input.roll.rollIndex,
    status: input.roll.status,
    // The user's own sentence, returned to them. Never the compiled brief.
    briefText: input.roll.briefText,
    chips: readChips(input.roll.compiledBrief),
    varianceHeld: readVarianceHeld(input.roll.compiledBrief),
    fellBack: readFellBack(input.roll.compiledBrief),
    /*
      Derived from the sentence rather than persisted beside it.

      A stored copy would be a second copy of a fact the roll already carries —
      the class the `expiredReason` ruling named ("a second copy of a fact is a
      copy that can be wrong"). `briefText` is immutable on a committed roll, so
      deriving here is stable for the life of the roll, needs no migration, and
      cannot drift from the sentence it describes.
    */
    statedWardrobe: statesWardrobe(input.roll.briefText),
    authoredPrompt: readAuthoredPrompt(input.roll.briefText, input.roll.compiledBrief),
    authoredText: readAuthoredText(input.roll.briefText, input.roll.compiledBrief),
    imagination: readImagination(input.roll.compiledBrief),
    style: readCastStyle(input.roll.compiledBrief),
    authorSatOut: readAuthorSatOut(input.roll.compiledBrief),
    /*
      THE OUTFIT, THROUGH THE ONE OWNER (§3.3), and the label derived beside it.

      `currentWardrobeLine` rather than the column, even though a roll has no
      branch and its `edited` arm cannot fire here: reading the column directly
      at one of the six readers is how the seventh reader gets written the same
      way, and condition (v) exists because that seventh reader was Sign.

      ⚠ **`enginePicked` is derived from facts the row already carries** — never
      a stored flag, which would be a second copy of something derivable and
      therefore a copy that can be wrong (the `expiredReason` ruling, and the
      same argument `statedWardrobe` above is written on). Three conditions, and
      each one excludes a case that is NOT an engine pick:

        the WARDROBE path        Basics is the path's own outfit, not a choice
                                 anybody made for her;
        not the house line       §4(c) is the studio default this product has
                                 always painted, not something picked;
        her sentence named no
        clothing                 if she said "in a red apron", the outfit is
                                 hers — completed in the same register, but
                                 hers. §4.1(1): she is never told she asked for
                                 something she did not, and this is the other
                                 half of that promise.
    */
    wardrobe: projectWardrobe(input.roll),
    facts: readBriefFacts(input.roll.lockContract, input.roll.compiledBrief, input.roll.briefText),
    lineage: {
      ...(input.parentCandidatePublicId ? { fromCandidateId: input.parentCandidatePublicId } : {}),
      ...(typeof input.parentCandidatePosition === "number"
        ? { fromCandidateLabel: String(input.parentCandidatePosition + 1).padStart(2, "0") }
        : {}),
      ...(input.parentRollPublicId ? { fromRollId: input.parentRollPublicId } : {}),
    },
    priceCredits: input.roll.priceCredits,
    counts: {
      total: input.candidates.length,
      ready: candidates.filter((candidate) => candidate.status === "ready").length,
      casting: candidates.filter((candidate) => candidate.status === "casting").length,
      failed: candidates.filter((candidate) => candidate.status === "failed-refunded").length,
    },
    createdAt: input.roll.createdAt.toISOString(),
    /*
      Never negative. A row written a few milliseconds ahead of this reading —
      two app processes, or a clock nudged between the insert and the read — is
      a roll zero seconds old, not one that started in the future. Clamping
      here keeps a nonsense value from reaching a threshold comparison as a very
      large negative number, which reads as "brand new" forever.
    */
    ageMs: Math.max(0, now.getTime() - input.roll.createdAt.getTime()),
    candidates,
  };
}

export type ShortlistEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  sourceRollIndex: number;
  indexLabel: string;
};

export function projectShortlist(
  entries: readonly { candidate: ProjectableCandidate; rollIndex: number }[],
): ShortlistEntry[] {
  return entries.map(({ candidate, rollIndex }) => ({
    candidateId: candidate.publicId,
    // The face, for the same reason the tile shows it: the dock's Sign spends
    // the selected refinement, and the tray is where that Sign is aimed.
    thumbUrl: candidate.faceThumbKey ? storagePublicUrl(candidate.faceThumbKey) : null,
    imageUrl: candidate.faceImageKey ? storagePublicUrl(candidate.faceImageKey) : null,
    personaLine: candidate.personaLine,
    sourceRollIndex: rollIndex,
    // The face's own label, so the dock's Sign can NAME who it is about to
    // spend on rather than saying "sign the selection".
    indexLabel: String(candidate.position + 1).padStart(2, "0"),
    /*
      NO `signed` FIELD, and the absence is the ruling (fable-744 §3b).

      This projection used to send one, under a comment saying *"a kept
      candidate that has already been signed stays in the tray — it is still
      part of this sheet's story"*. The loader one layer down never honoured
      that sentence: `listKeptCandidates` filters `status = 'ready'`, so a
      signed candidate has never reached this function at all. Verified in the
      running app on the one dev sheet that has both — 3 kept, 2 signed, **1
      chip drawn**.

      Asked which one was the product, the ruling took the LOADER: a signed
      face's shortlist job is done — she graduated to the roster, and dimmed
      residue in the tray is clutter by the founder's own minimalism law. So
      the field went rather than the filter, because a projection carrying a
      fact its own loader makes unreachable is a second copy waiting to drift
      (working law 4), and the comment was already describing a product that
      did not exist.

      Reversible in one line if signed faces are ever wanted here — and the
      dock's aim does not depend on it either way: `signTarget.ts` holds that
      rule, and it holds it structurally rather than by trusting this row.
    */
  }));
}

export function projectSession(session: CastingSession): SessionProjection {
  return {
    sessionId: session.publicId,
    status: session.status,
    originType: session.originType,
    // Deliberately null here: the numeric id is internal. The session
    // projection carries the active roll's *public* id, resolved by the
    // caller that already loaded it.
    activeRollId: null,
    signedCastCount: session.signedCastCount,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
  };
}
