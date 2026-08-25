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
 * actually true, append the journal entry, open or close needs-you cards, and
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

import briefingJson from "./crew-briefing.json";

/**
 * A datetime the page can SORT — `Date.parse` must read it, or the journal's
 * timeline would place the entry at a NaN's arbitrary position instead of
 * this parse reddening the shift's commit, which is the one gate built to
 * catch exactly a shift's typo. (Named for what writers emit — ISO-8601 with
 * an offset — but validated for what readers need.)
 */
const isoDateTime = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !Number.isNaN(Date.parse(value)), "not a parseable datetime");

/**
 * How many shift entries the file carries (§2).
 *
 * Not a retention rule — nothing is destroyed. Older history lives in git,
 * which is the whole reason this half is a tracked file. The cap is about what
 * a page can be read down in one sitting.
 */
export const CREW_JOURNAL_CAP = 40;

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
 * An at-a-glance chip at the top of the banner (#74 — his own gap list:
 * "production healthy, what just went live, team running"). A chip is a CLAIM,
 * so `source` names the reading it was taken from — a receipt, a commit, a
 * row — or is null only for claims the page itself embodies (working law 7b:
 * a health sentence with no reading behind it is not said).
 */
const chipSchema = z.object({
  label: z.string().min(1).max(80),
  tone: z.enum(["good", "warn", "neutral"]),
  source: z.string().max(200).nullable(),
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
}).strict();

const problemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "urgent"]),
  state: z.enum(["open", "resolved"]),
}).strict();

const journalEntrySchema = z.object({
  at: isoDateTime,
  shift: z.string(),
  text: z.string(),
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
    /** At-a-glance state, capped so the strip stays a glance (#74). */
    chips: z.array(chipSchema).max(6),
  }).strict(),
  needsYou: z.array(needsYouSchema)
    .refine(uniqueBy("card", (card) => card.id), uniqueMessage("needsYou[].id")),
  /** Courts and measurements waiting on his EYE — frames with captions (#75). */
  eyeItems: z.array(eyeItemSchema)
    .refine(uniqueBy("eye item", (item) => item.id), uniqueMessage("eyeItems[].id")),
  pipeline: z.array(pipelineItemSchema)
    .refine(uniqueBy("item", (item) => item.id), uniqueMessage("pipeline[].id")),
  problems: z.array(problemSchema)
    .refine(uniqueBy("problem", (problem) => problem.id), uniqueMessage("problems[].id")),
  /** Shift entries only — his notes arrive as replies. Capped; git holds the rest. */
  journal: z.array(journalEntrySchema).max(CREW_JOURNAL_CAP),
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
      chips: [],
    },
    needsYou: [],
    eyeItems: [],
    pipeline: [],
    problems: [{
      id: "briefing-unreadable",
      title: "This edition of the briefing failed to load",
      detail:
        "The team's half of this page could not be read, so everything above is empty. "
        + "Your replies are unaffected — they live in the database and are still being "
        + "written and read. The journal in git history is the fallback while a shift "
        + "repairs the file.",
      severity: "urgent",
      state: "open",
    }],
    journal: [],
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
