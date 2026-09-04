/**
 * THE BRIEFING — everything the night shifts say, as a file (issue #41, design
 * `docs/specs/CREW_TAB_DESIGN.md` §2).
 *
 * The other half of the Crew tab's store. `crew_replies` holds the founder's
 * words; this holds the team's, and the page merges them at read time. It is a
 * tracked JSON file rather than database rows because git is already the
 * shifts' audit trail and their merge discipline, and the WIP cap — one shift
 * at a time — is already its lock. A shift writing production rows outside
 * deployed code is the class of direct production change the local law reserves
 * for the founder.
 *
 * # ⚠ THE BRIEFING MAY NEVER TAKE PRODUCTION DOWN
 *
 * The 2026-07-31 prod boot-guard incident is the law here, and it is why this
 * module is shaped the way it is rather than the obvious way:
 *
 *   - **it does NOT parse at import.** A top-level `SCHEMA.parse(json)` in a
 *     module the router imports turns a malformed briefing into a crash-loop on
 *     the deploy that carried it. The page would take the product with it.
 *   - **it parses lazily, on the first `crew.getState`, and caches the result.**
 *   - **a parse failure returns a DEGRADED STATE and logs.** Empty sections,
 *     plus one synthetic `problems` entry that says plainly what happened and
 *     where the fallback is. The founder sees a page that admits it is broken,
 *     which is the honest outcome; he does not see a 502.
 *
 * In practice a malformed file cannot reach production anyway — `crewBriefing.test.ts`
 * parses the real file on every commit, and the static import below makes
 * esbuild PARSE AND INLINE the JSON at build time, so a broken file fails the
 * build before any deploy. The degraded path is what stands behind those two,
 * not instead of them.
 *
 * ⚠ **THE JSON IS A STATIC IMPORT AND MUST STAY ONE.** The first version read
 * it with `readFileSync` at a path resolved from `import.meta.url` — which in
 * production is the esbuild bundle (`dist/index.js`), so the path named
 * `dist/crew-briefing.json`, a file the build never emits, and every
 * production `crew.getState` would have served the degraded state forever.
 * Found by the PR #72 gate review, at the build scripts rather than at the
 * running dev server, because `pnpm dev` runs the UNBUNDLED tree where the
 * broken path happens to work. The static import dissolves the path entirely:
 * the briefing travels inside the bundle. `crewBriefing.test.ts` pins this
 * shape at the source.
 *
 * # HOW A SHIFT WRITES IT
 *
 * At shift close: read his new replies first (`scripts/crew-read-replies.mts`)
 * — merge, never overwrite — then edit the JSON. Bump `edition`, refresh
 * `updatedAt` and `shift`, move pipeline and milestone states to what is
 * actually true, open or close needs-you cards, and
 * extend `acknowledgedReplyIds` with every reply id the shift has READ. Then
 * `pnpm check`, this test file, and push through the rite.
 *
 * # ACKNOWLEDGEMENT IS HONEST BY CONSTRUCTION
 *
 * `acknowledgedReplyIds` is the only thing that marks a reply "seen by the
 * crew", and only a DEPLOYED edition can name an id. There is no timestamp
 * theatre and no read receipt the server writes for itself: a reply is seen
 * when the team's own next push proves it was read.
 */
import { z } from "zod";

import { CREW_HELD_STATES, CREW_HOLD_REASON_MAX } from "../../shared/crewNextUpHold.js";
import { CREW_LADDER_GROUP_KEYS, onePlaceViolations } from "../../shared/crewPipelineGroups.js";

import briefingJson from "./crew-briefing.json";

/**
 * A datetime the page can SORT — `Date.parse` must read it, or a timeline
 * would place the entry at a NaN's arbitrary position instead of this parse
 * reddening the shift's commit, which is the one gate built to catch exactly
 * a shift's typo. (Named for what writers emit — ISO-8601 with an offset —
 * but validated for what readers need.)
 */
const isoDateTime = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !Number.isNaN(Date.parse(value)), "not a parseable datetime");

const focusSchema = z.object({
  state: z.enum(["confirmed", "proposed", "none"]),
  title: z.string(),
  /** His verbatim word that set it — never paraphrased, and null when none. */
  quote: z.string().nullable(),
  quotedAt: isoDateTime.nullable(),
}).strict();

const milestoneSchema = z.object({
  title: z.string(),
  steps: z.array(z.object({
    title: z.string(),
    state: z.enum(["done", "in-progress", "waiting", "blocked"]),
  }).strict()),
}).strict();

const ladderRungSchema = z.object({
  key: z.string(),
  title: z.string(),
  state: z.enum(["done", "current", "queued", "parked"]),
}).strict();

/**
 * One open card waiting on the ladder (#493 move 2) — the roadmap, parked and
 * design-unbuilt populations, homed under THE PROGRAM instead of re-listed in
 * the pipeline block.
 *
 * `kind` is the card's pipeline group (`shared/crewPipelineGroups.ts`'s ladder
 * homes), so the page can say *parked* or *unbuilt design* beside the row
 * without a second vocabulary. `rung` is the ladder key the record names via a
 * `rung:` label, or `null` for the honest remainder — *on the ladder, rung not
 * yet named*. A refinement below refuses a rung the ladder does not hold.
 */
const ladderCardSchema = z.object({
  issueNumber: z.number().int().positive(),
  title: z.string().min(1).max(300),
  kind: z.enum(CREW_LADDER_GROUP_KEYS as [string, ...string[]]),
  rung: z.string().nullable(),
}).strict();

/**
 * The ladder's own queue (#493) — a derived snapshot, exactly the NEXT UP
 * pattern (#290): `scripts/crew-desk-sweep.mts` writes it mechanically from
 * the queue's labels through `pipelineGroupFor`, the ONE partition, so a card
 * offered on the switches or queued in NEXT UP can never also appear here.
 * `readAt` is rendered out loud, never implied, for `nextUp.readAt`'s reason.
 */
const ladderCardsSchema = z.object({
  readAt: isoDateTime,
  items: z.array(ladderCardSchema).max(100)
    .refine(uniqueBy<{ issueNumber: number }>("ladder card", (item) => String(item.issueNumber)),
      "ladderCards.items[].issueNumber must be unique"),
}).strict();

/**
 * An at-a-glance state reading at the top of the banner (#74 — his own gap
 * list: "production healthy, what just went live, team running"). It is a
 * CLAIM, so `source` names the reading it was taken from — a receipt, a
 * commit, a row — or is null only for claims the page itself embodies
 * (working law 7b: a health sentence with no reading behind it is not said).
 *
 * ⚠ **THE LABEL IS CAPPED AT 40 AND THAT CAP IS THE FIX, NOT A TIDY (#492).**
 * The founder, at a frame of this block: *"the top of the programs card with
 * the little status card readings needs a better design honest it looks
 * terribly designed"*. The design fault was one thing and it was structural —
 * shifts wrote HEADLINES into a field built for a few words, so a stroked pill
 * wrapped to two lines of 12px text and the grey sentence beneath it carried
 * the actual reading. The three labels on the edition he was looking at ran
 * **42, 67 and 59** characters against an 80 cap that never bound.
 *
 * **So the cap moved to the schema rather than into a shift's memory.** A
 * label past 40 is REFUSED by the rite's conformance judge before it deploys,
 * which is the only kind of rule this page has ever kept: `.agents/` prose has
 * failed four times on this feature alone. 40 is measured, not chosen — it is
 * the longest the eyebrow face fits on one line in the narrowest cell of a
 * three-column grid at 1440, with the two-column and one-column fallbacks
 * wider still.
 *
 * ⚠ **AND THE SENTENCE HAS SOMEWHERE TO GO, WHICH IS WHY THIS IS NOT A LOSS.**
 * `source` is the reading and it is now drawn in the page's normal reading
 * face rather than in 10px grey — the hierarchy his frame showed inverted, put
 * back the right way up. A shift with a headline writes it there.
 *
 * ⚠ **`source` CAME DOWN FROM 200 TO 100 IN THE SAME COMMIT, AND THAT NUMBER
 * WAS MEASURED IN THE BROWSER RATHER THAN CHOSEN.** The card asks for the
 * reading to sit in *"one or two lines"*, and the first drive of the finished
 * strip failed its own arm on all three cells — 171, 133 and 165 characters
 * came out at **five, four and five lines**. The sentences were not too long
 * for the old shape; they were written FOR the old shape, a full-width 10px
 * paragraph under a pill, and a 213px column at 1440 fits **33 characters a
 * line**. So three lines is 99, and the cap is 100.
 *
 * ⚠ **NOT 70, WHICH IS WHAT "one or two lines" LITERALLY BUYS.** `source` is
 * the EVIDENCE half of the claim — working law 7b's *a health sentence with no
 * reading behind it is not said* — and a cap tight enough to make citing
 * awkward is a cap that produces `source: null`. Three lines of real citation
 * beats two lines of none.
 */
const chipSchema = z.object({
  label: z.string().min(1).max(40),
  tone: z.enum(["good", "warn", "neutral"]),
  source: z.string().max(100).nullable(),
}).strict();

const needsYouSchema = z.object({
  /** Stable slug — a reply points at it, and it outlives the card's wording. */
  id: z.string().max(64),
  title: z.string(),
  /** LEADS the card. His standing order: product impact before flags. */
  productImpact: z.string(),
  workedExample: z.string().nullable(),
  options: z.array(z.object({
    key: z.string(),
    label: z.string(),
    consequence: z.string(),
  }).strict()),
  /** Stated FIRST when options exist — his standing order again. */
  recommendation: z.string().nullable(),
  state: z.enum(["open", "answered", "done"]),
  filedAt: isoDateTime,
  issueNumber: z.number().int().positive().nullable(),
}).strict();

const pipelineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["building", "in-review", "waiting-founder", "merged", "blocked"]),
  prNumber: z.number().int().positive().nullable(),
  note: z.string().nullable(),
  /**
   * The needs-you card this row is waiting on — REQUIRED on a
   * `waiting-founder` row and refused on any other (the refinement below).
   *
   * It exists because the page told him two contradictory things at once
   * (#291): seven pipeline rows said "Waiting on you" while his desk said
   * nothing was. `waiting-founder` was a status a shift TYPED, so it survived
   * his own answer — the same write-once-never-re-read shape as the queue,
   * the standing-exceptions ranking and the `answered` state. Naming the card
   * makes the claim derivable instead of asserted, and the parse refuses the
   * disagreement rather than rendering it.
   */
  cardId: z.string().max(64).nullable().optional(),
}).strict();

/**
 * What a shift's queue reading found waiting — the NEXT UP block (#290).
 *
 * His question, verbatim: *"i cant see what its planned as the next shift etc
 * or can i see it im just missing it"* — and he was not missing it. The
 * pipeline's five statuses are all happening-now or already-done, so the page
 * had no state that means QUEUED and his question had nowhere to be answered.
 *
 * # IT IS A DERIVED SNAPSHOT AND IT IS NEVER TYPED
 *
 * The rows come from `gh issue list --label founder-ordered --state open`,
 * written mechanically by `scripts/crew-desk-sweep.mts`. **No shift composes
 * this list**, which is what keeps it from becoming the sixth hand-kept list
 * found rotting on 2026-08-30.
 *
 * ⚠ **`readAt` IS NOT DECORATION — IT IS THE HONEST PART**, for exactly the
 * reason `crew_queue_counts.countedAt` carries the same stamp: a truly live
 * list needs the server to hold a GitHub token, which is a founder-level
 * decision about a credential rather than a shift's call. So the block says
 * when it looked instead of implying an instant it does not have.
 *
 * ⚠ **AND `blockedOnYou` IS DELIBERATELY ABSENT FROM THIS SHAPE.** Whether a
 * queued card is waiting on HIM is read at render time off the open needs-you
 * cards, which is the desk's own state — the one rule #291 exists to enforce.
 * A boolean here would be a second copy of it, and a second copy is what put
 * seven false "Waiting on you" rows in front of him in the first place.
 */
const nextUpSchema = z.object({
  /** When the queue was read. Rendered out loud, never implied. */
  readAt: isoDateTime,
  items: z.array(z.object({
    issueNumber: z.number().int().positive(),
    title: z.string().min(1).max(300),
    /** The card's own labels, so `urgent` can be shown without a second list. */
    urgent: z.boolean(),
    /**
     * Why a shift has not taken this one yet, when something is stopping it
     * (#298). Absent means takeable, which is why it is optional rather than
     * nullable-with-a-default: every edition written before this field existed
     * still parses, and it says the true thing about those rows.
     *
     * `state` is derived from a LABEL and `because` from one line of the card
     * body — see `shared/crewNextUpHold.ts` for why those two halves are held
     * to different standards. ⚠ **`.strict()` sits INSIDE `.optional()`**:
     * `ZodOptional` has no `.strict` in zod 4, and calling it on the wrapper
     * is how a strictness that reads as present ends up doing nothing.
     */
    held: z.object({
      state: z.enum(CREW_HELD_STATES),
      because: z.string().min(1).max(CREW_HOLD_REASON_MAX).optional(),
    }).strict().optional(),
  }).strict()).max(40)
    .refine(uniqueBy<{ issueNumber: number }>("queued card", (item) => String(item.issueNumber)),
      "nextUp.items[].issueNumber must be unique"),
}).strict();

const problemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "urgent"]),
  state: z.enum(["open", "resolved"]),
}).strict();

/**
 * One frame inside an eye item (#75 — his verbatim ask: *"when these things
 * run and require my eyes is there a gallery built into this page so i can
 * genuinely view the tests with an explaination about what im looking at?"*).
 *
 * `key` is pinned to the `crew-eye/` prefix with a UUID basename because the
 * deployed briefing IS the serving route's allowlist: `/api/crew/eye-frame`
 * refuses any key no edition names, so a briefing typo cannot turn the route
 * into an open proxy over the bucket. The caption carries what he is LOOKING
 * AT; the item's `question` carries what he is JUDGING — his card law, product
 * meaning before mechanics.
 */
const eyeFrameSchema = z.object({
  key: z.string().regex(
    /^crew-eye\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$/,
    "an eye frame key is crew-eye/<uuid>.<png|jpg|jpeg|webp>",
  ),
  caption: z.string().min(1).max(500),
  /** Which arm produced it (e.g. "A", "control") — null for a lone frame. */
  arm: z.string().max(40).nullable(),
}).strict();

const eyeItemSchema = z.object({
  /** Stable slug; his verdict replies point at it, exactly like a card id. */
  id: z.string().max(64),
  title: z.string(),
  /** What he is judging — the question, never just the picture. */
  question: z.string(),
  state: z.enum(["open", "answered", "done"]),
  filedAt: isoDateTime,
  issueNumber: z.number().int().positive().nullable(),
  frames: z.array(eyeFrameSchema).min(1).max(24),
  /**
   * The needs-you card that asks the question these frames answer, when one
   * does. It exists so the two cannot disagree: his verdict answers the CARD,
   * and the eye item stayed `open` after it (roll 217, edition 25 — he
   * noticed, `5dae3df0`; #133). The refinement below refuses that shape at
   * the parse.
   */
  cardId: z.string().max(64).nullable().optional(),
}).strict();

/**
 * Every identity in an array is unique within it (PR #78 review, law 7):
 * React keys on these ids, replies point at them, and a duplicated id
 * renders one row where two claims were written — silently, at his screen.
 * Enforced HERE so a shift's duplicate reddens `crewBriefing.test.ts` (which
 * parses the real file on every commit) at write time, never degrades at
 * render time.
 */
function uniqueBy<T>(name: string, of: (item: T) => string) {
  return (items: readonly T[]) => {
    const seen = new Set<string>();
    for (const item of items) {
      const id = of(item);
      if (seen.has(id)) return false;
      seen.add(id);
    }
    return true;
  };
}
const uniqueMessage = (field: string) => `${field} must be unique within its array`;

/**
 * `.strict()` at every level (invariant 4's spirit on a file rather than a
 * wire): a key nobody declared is a shift's typo, and a typo that parses is a
 * fact the page silently does not show.
 */
export const crewBriefingSchema = z.object({
  edition: z.number().int().positive(),
  updatedAt: isoDateTime,
  shift: z.string(),
  program: z.object({
    mission: z.string(),
    focus: focusSchema,
    milestone: milestoneSchema.nullable(),
    ladder: z.array(ladderRungSchema)
      .refine(uniqueBy("rung", (rung) => rung.key), uniqueMessage("ladder[].key")),
    /** The open cards waiting on the ladder, by rung where the record names one (#493). */
    ladderCards: ladderCardsSchema,
    /** At-a-glance state, capped so the strip stays a glance (#74). */
    chips: z.array(chipSchema).max(6),
  }).strict(),
  needsYou: z.array(needsYouSchema)
    .refine(uniqueBy("card", (card) => card.id), uniqueMessage("needsYou[].id")),
  /** Courts and measurements waiting on his EYE — frames with captions (#75). */
  eyeItems: z.array(eyeItemSchema)
    .refine(uniqueBy("eye item", (item) => item.id), uniqueMessage("eyeItems[].id")),
  /** The founder-ordered queue, read from the label rather than composed (#290). */
  nextUp: nextUpSchema,
  pipeline: z.array(pipelineItemSchema)
    .refine(uniqueBy("item", (item) => item.id), uniqueMessage("pipeline[].id")),
  problems: z.array(problemSchema)
    .refine(uniqueBy("problem", (problem) => problem.id), uniqueMessage("problems[].id")),
  acknowledgedReplyIds: z.array(z.number().int().positive()),
}).strict().refine(
  /*
    The reply cardId namespace is the UNION of needsYou and eyeItems (PR #79
    review finding 2): crew.reply takes a free string and both surfaces
    filter the same replies by the same id, so per-array uniqueness alone
    would let one id carry two claims — his verdict on the frames rendering
    as an answer to an unrelated card.
  */
  (briefing) =>
    uniqueBy<{ id: string }>("thread host", (host) => host.id)([
      ...briefing.needsYou,
      ...briefing.eyeItems,
    ]),
  "needsYou[].id and eyeItems[].id share one reply namespace and must be unique across both",
).refine(
  /*
    AN EYE ITEM CANNOT OUTLIVE ITS CARD (#133): where an eye item names the
    card that asks its question, that card must exist, and an `open` eye item
    needs an `open` card — an answered card with open frames beside it is the
    page telling him it is still waiting for a verdict he already gave.
  */
  (briefing) =>
    briefing.eyeItems.every((item) => {
      if (item.cardId == null) return true;
      const card = briefing.needsYou.find((candidate) => candidate.id === item.cardId);
      if (!card) return false;
      return item.state !== "open" || card.state === "open";
    }),
  "an eye item's cardId must name a needsYou card, and an open eye item needs an open card (#133)",
).refine(
  /*
    A PIPELINE ROW MAY NOT CLAIM HE IS BLOCKING IT UNLESS HIS DESK AGREES (#291).

    His own reading: *"the current pipeline design is a mess a massive list i
    cant tell whats going on"* — and underneath it, seven rows saying
    `waiting-founder` while Needs You was at ZERO open. The same page told him
    two different things about the same question, which costs more than either
    being wrong on its own.

    The rule is one line: a `waiting-founder` row NAMES the open card it is
    waiting on, and nothing else may name one. So the count on this section can
    never exceed the count on his desk, the day he answers a card its pipeline
    row goes red in the shift's own commit, and there is no second place where
    "he is blocking this" is stored. Working law 4, held at the parse.
  */
  (briefing) =>
    briefing.pipeline.every((item) => {
      if (item.status !== "waiting-founder") return item.cardId == null;
      if (item.cardId == null) return false;
      return briefing.needsYou.some(
        (card) => card.id === item.cardId && card.state === "open",
      );
    }),
  "a waiting-founder pipeline row must name an OPEN needsYou card, and only such a row may carry cardId (#291)",
).refine(
  /*
    A LADDER CARD'S RUNG MUST BE A RUNG THE LADDER HOLDS (#493). A `rung:N9`
    typo in GitHub reads as unplaced at the sweep; a rung typed into the file
    directly is refused here, so the page can never draw a rung that does not
    exist on the bar above it.
  */
  (briefing) => {
    const rungKeys = new Set(briefing.program.ladder.map((rung) => rung.key));
    return briefing.program.ladderCards.items.every(
      (item) => item.rung === null || rungKeys.has(item.rung),
    );
  },
  "a ladder card's rung must name a program.ladder[].key (#493)",
).refine(
  /*
    LADDER CARDS NEED A LADDER TO HANG FROM (PR #497 review, finding 1). The
    page draws the whole ladder-cards UI — including the unplaced remainder —
    inside the ladder block, so an edition with items and an EMPTY ladder
    would show those cards nowhere while the orphan block's quiet line still
    counts them "on the ladder": the exact no-place failure #493 guards
    against, and invisible to every other arm because nothing is doubled.
  */
  (briefing) =>
    briefing.program.ladderCards.items.length === 0 || briefing.program.ladder.length > 0,
  "ladder cards need a non-empty program.ladder to render under (#493, PR #497 finding 1)",
).refine(
  /*
    THE ONE-PLACE RULE, HELD AT THE PARSE (#493, the #291 precedent): a card in
    NEXT UP may not also sit on the ladder. The two lists are written by the
    same sweep from one partition, so this can only fire on a hand edit — and
    when it does, the rite refuses the edition rather than deploying a page
    that lists one card twice, which is the exact doubling his order names.
  */
  (briefing) =>
    onePlaceViolations([
      briefing.nextUp.items.map((item) => item.issueNumber),
      briefing.program.ladderCards.items.map((item) => item.issueNumber),
    ]).length === 0,
  "a card may not appear in both NEXT UP and the ladder — every open card has exactly one home (#493)",
);

export type CrewBriefing = z.infer<typeof crewBriefingSchema>;

/**
 * The state the page gets when the briefing cannot be read.
 *
 * Every section is empty and ONE problem entry says why, in the plain English
 * the surface uses everywhere else. It is a `problems` row rather than a banner
 * because the page already renders problems and a second failure surface would
 * be a second thing to keep working.
 */
export function degradedCrewBriefing(): CrewBriefing {
  return {
    edition: 0,
    updatedAt: new Date().toISOString(),
    shift: "unknown",
    program: {
      mission: "",
      focus: { state: "none", title: "", quote: null, quotedAt: null },
      milestone: null,
      ladder: [],
      /* Empty rather than absent, for `nextUp`'s reason: the ladder block
         renders nothing extra and the page stays honest about not knowing. */
      ladderCards: { readAt: new Date().toISOString(), items: [] },
      chips: [],
    },
    needsYou: [],
    eyeItems: [],
    /* Empty rather than absent: the block renders its own "nothing queued"
       sentence, and a degraded page saying that is honest — the queue could
       not be read either. */
    nextUp: { readAt: new Date().toISOString(), items: [] },
    pipeline: [],
    problems: [{
      id: "briefing-unreadable",
      title: "This edition of the briefing failed to load",
      detail:
        "The team's half of this page could not be read, so everything above is empty. "
        + "Your replies are unaffected — they live in the database and are still being "
        + "written and read, and the General box below still works. A shift is "
        + "repairing the file.",
      severity: "urgent",
      state: "open",
    }],
    acknowledgedReplyIds: [],
  };
}

let cached: CrewBriefing | null = null;

/**
 * The briefing, validated once and kept.
 *
 * ⚠ **The zod parse is never run at import** — see the header. The IMPORT of
 * the JSON is compile-time and cannot throw at runtime; what could throw is
 * the schema refusing it, and that stays inside this function so a refusal
 * degrades instead of crash-looping a deploy. The cache is a module-level
 * variable rather than anything cleverer because the content only changes
 * when a deploy replaces the process.
 */
export function readCrewBriefing(): CrewBriefing {
  if (cached) return cached;
  try {
    const parsed = crewBriefingSchema.parse(briefingJson);
    cached = parsed;
    return parsed;
  } catch (cause) {
    /* Logged rather than thrown: the page degrades and says so. */
    console.error(
      "[crew] the deployed briefing did not parse — serving the degraded state",
      cause,
    );
    return degradedCrewBriefing();
  }
}

/** Test seam. Nothing in the product calls it. */
export function resetCrewBriefingCacheForTests(): void {
  cached = null;
}

/**
 * Whether the crew has read this reply — the ONLY definition of "seen".
 *
 * A pure function over the deployed edition's own list, so the page cannot
 * invent an acknowledgement and neither can the server. Extracted rather than
 * inlined at the call site so it has somewhere to be tested.
 */
export function replyIsAcknowledged(
  briefing: Pick<CrewBriefing, "acknowledgedReplyIds">,
  replyId: number,
): boolean {
  return briefing.acknowledgedReplyIds.includes(replyId);
}

/**
 * Every frame key the deployed briefing names — THE serving allowlist.
 *
 * `/api/crew/eye-frame` answers 404 for any key outside this set, whatever
 * exists in the bucket. Recomputed per call over the cached briefing (a Set
 * built from a few dozen strings), so there is no second cache to invalidate.
 */
export function eyeFrameKeys(briefing: Pick<CrewBriefing, "eyeItems">): ReadonlySet<string> {
  return new Set(briefing.eyeItems.flatMap((item) => item.frames.map((frame) => frame.key)));
}
