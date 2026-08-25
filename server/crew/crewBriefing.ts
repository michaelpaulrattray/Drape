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
 * parses the real file on every commit, and esbuild refuses broken JSON at
 * build time, both of them before any deploy. The degraded path is what stands
 * behind those two, not instead of them.
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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** ISO-8601 with an offset, which is what every writer here emits. */
const isoDateTime = z.string().min(1).max(64);

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
    ladder: z.array(ladderRungSchema),
  }).strict(),
  needsYou: z.array(needsYouSchema),
  pipeline: z.array(pipelineItemSchema),
  problems: z.array(problemSchema),
  /** Shift entries only — his notes arrive as replies. Capped; git holds the rest. */
  journal: z.array(journalEntrySchema).max(CREW_JOURNAL_CAP),
  acknowledgedReplyIds: z.array(z.number().int().positive()),
}).strict();

export type CrewBriefing = z.infer<typeof crewBriefingSchema>;

/** Where the file lives, resolved from this module so the cwd never matters. */
const BRIEFING_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "crew-briefing.json",
);

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
    },
    needsYou: [],
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
 * The briefing, parsed once and kept.
 *
 * ⚠ **Never called at import** — see the header. The cache is a module-level
 * variable rather than anything cleverer because the file only changes when a
 * deploy replaces the process.
 */
export function readCrewBriefing(): CrewBriefing {
  if (cached) return cached;
  try {
    const parsed = crewBriefingSchema.parse(JSON.parse(readFileSync(BRIEFING_PATH, "utf8")));
    cached = parsed;
    return parsed;
  } catch (cause) {
    /* Logged rather than thrown: the page degrades and says so. */
    console.error(
      `[crew] the briefing at ${BRIEFING_PATH} could not be read — serving the degraded state`,
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
