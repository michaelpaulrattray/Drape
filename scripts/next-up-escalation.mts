/**
 * THE AUTO-ESCALATION VERDICT — does the top of NEXT UP need a Fable shift?
 * (card #541, founder-ordered and URGENT, 2026-09-05.)
 *
 * # The defect, measured
 *
 * His question, verbatim: *"a bunch of next up in que says need fable are these
 * blocked? we have acesss to fable?"* — and they were, by nothing.
 *
 * The model split (founder, 2026-08-28) runs every shift on Opus and reaches
 * Fable ONLY when an Opus shift writes `.agents/foreman/ESCALATE` naming one
 * brief. The `awaiting-fable` label ("Needs Fable" on his page,
 * `shared/crewNextUpHold.ts`) is a HOLD WITH NO EXPIRY: a shift labels a card
 * judgment-class, correctly steps over it, and **nothing anywhere ever writes
 * the marker.** Measured 2026-09-05: five of his own ordered cards carried the
 * label (#508, #530, #534, #535, #539), no marker existed, and every shift took
 * something smaller. Five orders of his, frozen behind a label nobody acted on.
 *
 * That is invariant 7 wearing a label instead of a function: *a control that is
 * not invoked does not exist.* The hold was built, rendered on his page, and
 * had no road out of itself.
 *
 * # Why the verdict lives HERE and not in the runner
 *
 * `.agents/foreman/foreman-runner.ps1` is the process that acts on this, and it
 * is gitignored — no vitest suite can ever see a line of it. Re-implementing
 * the NEXT UP order and the hold rules in PowerShell would also be a second
 * copy of `scripts/crew-desk-sweep.mts`'s ordering and of
 * `shared/crewNextUpHold.ts`'s hold semantics, which is working law 4 exactly:
 * a second list shadowing a source of truth always drifts from it, and the
 * first anyone would know is a Fable session spent on the wrong card.
 *
 * So the DECISION is here, in tracked TypeScript, importing the one owner of
 * hold semantics and applying the one documented sort; the runner does nothing
 * but read a line and obey it. That is the same shape as `check-wake.ps1`,
 * `check-park.ps1` and `classify-shift-failure.ps1` — except that those are in
 * `.agents/` and this one is drivable by `server/nextUpEscalation.test.ts` in
 * CI, which is strictly better and is why it was put in `scripts/`.
 *
 * # ⚠ IT FAILS TOWARD **NOT** ESCALATING, AND THAT DIRECTION IS HIS
 *
 * His words on the design: *"permanent fix is better but fable shifts are
 * expensive so my question is how many of the cards can the fable shift picup
 * at once … it would be rediculous to be running a fable shift per card if they
 * are small fixes"*.
 *
 * Every unreadable state — `gh` down, unauthenticated, a bad JSON body, a
 * missing state file — answers `NONE`. A gate that failed the other way would
 * spend an expensive session on a card it could not read, which is the one
 * failure this must not have. The cost of failing closed is that the team keeps
 * running Opus shifts exactly as it did yesterday: the bug comes back, nothing
 * breaks, and a human sees it.
 *
 * ⚠ **AN UNAUTHENTICATED `gh` PRINTS NOTHING, WHICH LOOKS EXACTLY LIKE AN EMPTY
 * QUEUE** — the same trap #504 names for the NEXT UP read that parks the team.
 * `gh()` returns `null` on any failure and `null` is never read as "no cards".
 *
 * # ⚠ ONE HOLD ON HIS PAGE IS INVISIBLE HERE, AND IT IS NAMED RATHER THAN LEFT
 *
 * `resolveHold`'s **`you`** — *Waiting on you* — is derived from HIS OWN DESK
 * (an open `needsYou` card naming the issue, #291's rule), not from a label. It
 * outranks every label on the page. This gate reads `gh issue list` and cannot
 * see it, so a card he is blocking CAN still be escalated here if it also
 * carries `awaiting-fable`.
 *
 * That is an accepted cut rather than an oversight: the alternative is reading
 * `server/crew/crew-briefing.json`, which the desk sweep writes at shift CLOSE
 * and is therefore a shift stale at the moment this runs — a hold that is one
 * shift out of date is a worse input than a hold that is honestly absent. The
 * cost is bounded and it is one session: a Fable shift that opens a card
 * waiting on him reads the card, finds the question, and says so.
 *
 * ⚠ **THE OTHER DIRECTION OF THAT CUT WAS NOT BOUNDED, AND IT IS CLOSED NOW
 * (#586).** The paragraph above argues the case where a desk-held card ALSO
 * carries `awaiting-fable` — cost, one wasted Fable session. The case it did
 * not consider is a desk-held card carrying **NO LABEL AT ALL**: this gate
 * reads it as takeable, answers `NONE`, and **every `awaiting-fable` card
 * behind it freezes.** Measured on 2026-09-06, when #508 sat on his desk
 * unlabelled and #535 — the next Fable card in his own order — was never
 * escalated.
 *
 * The repair is NOT a read of the briefing from here, for the staleness reason
 * above. It is that `crew-desk-sweep.mts` now applies `blocked` to any open
 * `founder-ordered` card an OPEN `needsYou` card names, so the desk's answer
 * arrives in the one vocabulary this gate already speaks. **This file is
 * unchanged by that and deliberately so** — it still reads labels only, and
 * still cannot see a desk-held card the sweep has not reached yet.
 *
 * # THE NO-REPEAT RULE — "a bug here must cost one session, never five"
 *
 * The runner DELETES the marker as it launches, so without state a card that
 * survives its Fable session would be re-escalated on the next shift, and the
 * one after, forever. The state file records the last card auto-escalated; the
 * same number is never escalated automatically twice in a row. If a Fable
 * session fails to close its card, the next shift is Opus and a person sees it.
 *
 * The state is written by `--record <n>`, called by the runner AFTER it has
 * written the marker — never as a side effect of asking. A reader that writes
 * is how a dry run moves a fixture (`free-answer-is-a-write`).
 *
 * # THE BUNDLE IS CANDIDATES, NOT A COMPUTED LIST
 *
 * The card asks for the judgment card *"PLUS the small cards adjacent to it in
 * NEXT UP that the same sitting can clear"*, and his batching rule of the same
 * day says the SHIFT sizes each card at the code. Nothing on a GitHub issue
 * states its size, so this script does not pretend to know: it names the
 * takeable cards that follow the judgment card in NEXT UP order and leaves the
 * sizing where his rule puts it. Naming a card is not ordering it built.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { heldStatesFromLabels } from "../shared/crewNextUpHold.js";

type Json = Record<string, any>;

const KNOWN_FLAGS = new Set(["--state", "--queue", "--record", "--today"]);

/**
 * The `gh --limit`, stated ONCE and reused as its own floor guard: a limit and
 * the number a reader compares against are the same fact, and two copies of one
 * fact is how a list silently starts capping (working law 4).
 */
const QUEUE_LIMIT = 200;

/* ─── arguments, refused rather than ignored ───
   Both crew writers REFUSE a flag they do not know, for the reason #288
   records: `--dry-run` was appended to a script that had no such word, was
   ignored, and stamped a running shift terminal on production. */
const argv = process.argv.slice(2);
const flags = new Map<string, string>();
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (!arg.startsWith("--")) {
    console.error(`REFUSING: stray argument ${arg}. Known: ${[...KNOWN_FLAGS].join(", ")}.`);
    process.exit(1);
  }
  if (!KNOWN_FLAGS.has(arg)) {
    console.error(`REFUSING: unknown argument ${arg}. Known: ${[...KNOWN_FLAGS].join(", ")}.`);
    process.exit(1);
  }
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`REFUSING: ${arg} needs a value.`);
    process.exit(1);
  }
  if (flags.has(arg)) {
    /* Last-wins on a repeat is the same fault as ignoring an unknown flag: the
       caller's second intention silently beats their first and nothing says so. */
    console.error(`REFUSING: ${arg} was given twice.`);
    process.exit(1);
  }
  flags.set(arg, value);
  i += 1;
}

const STATE_PATH = resolve(flags.get("--state") ?? ".agents/foreman/escalation-state.json");
/**
 * The day the session counter belongs to, passed in so the roll can be driven
 * without waiting for midnight.
 *
 * ⚠ **UTC, not his clock.** The counter therefore rolls at UTC midnight, which
 * is mid-morning in Sydney. It is a cost-visibility figure and nothing keys off
 * it, so the boundary being in the wrong place costs a line in a mailbox note
 * and never a decision — said here so the next reader does not have to work it
 * out from `toISOString`.
 */
const TODAY = flags.get("--today") ?? new Date().toISOString().slice(0, 10);

type EscalationState = {
  /** The last card auto-escalated. Never escalated automatically twice running. */
  lastCard: number | null;
  lastAt: string | null;
  /** `YYYY-MM-DD` the counter below belongs to. */
  day: string | null;
  /** Sessions auto-escalated on `day` — the cost line his card asks to be visible. */
  countToday: number;
};

const EMPTY_STATE: EscalationState = { lastCard: null, lastAt: null, day: null, countToday: 0 };

/**
 * The state, or the empty state.
 *
 * ⚠ **A CORRUPT STATE FILE READS AS EMPTY, AND THAT IS THE UNSAFE DIRECTION
 * NAMED OUT LOUD**: an empty state permits an escalation the no-repeat rule
 * might have refused. It is accepted because the alternative — refusing to run
 * at all — would let one bad byte freeze his queue again, which is the defect
 * this card exists to fix. The blast radius is one extra session, once.
 */
function readState(): EscalationState {
  if (!existsSync(STATE_PATH)) return { ...EMPTY_STATE };
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Json;
    return {
      lastCard: typeof raw.lastCard === "number" ? raw.lastCard : null,
      lastAt: typeof raw.lastAt === "string" ? raw.lastAt : null,
      day: typeof raw.day === "string" ? raw.day : null,
      countToday: typeof raw.countToday === "number" ? raw.countToday : 0,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/* ─── --record: the runner's write, after the marker exists ─── */

const record = flags.get("--record");
if (record !== undefined) {
  const card = Number(record);
  if (!Number.isInteger(card) || card <= 0) {
    console.error(`REFUSING: --record wants an issue number, got '${record}'.`);
    process.exit(1);
  }
  const previous = readState();
  const countToday = (previous.day === TODAY ? previous.countToday : 0) + 1;
  const next: EscalationState = {
    lastCard: card,
    lastAt: new Date().toISOString(),
    day: TODAY,
    countToday,
  };
  writeFileSync(STATE_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`RECORDED #${card} — Fable sessions auto-escalated today: ${countToday}`);
  process.exit(0);
}

/* ─── the queue ─── */

/** `gh` with no shell — it is an .exe, and the shell form emits DEP0190. */
function gh(args: string[]): unknown | null {
  try {
    const out = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * The founder-ordered queue, from `gh` or from a fixture.
 *
 * `--queue` exists so the suite can drive every branch without a network, a
 * token or a live queue — the same reason `patrol-clocks.mts` takes `--dir`.
 */
function readQueue(): Json[] | null {
  const fixture = flags.get("--queue");
  if (fixture !== undefined) {
    try {
      const rows = JSON.parse(readFileSync(resolve(fixture), "utf8"));
      return Array.isArray(rows) ? (rows as Json[]) : null;
    } catch {
      return null;
    }
  }
  const rows = gh([
    "issue", "list",
    "--label", "founder-ordered",
    "--state", "open",
    "--limit", String(QUEUE_LIMIT),
    "--json", "number,title,labels",
  ]);
  return Array.isArray(rows) ? (rows as Json[]) : null;
}

function none(why: string): never {
  console.log(`NONE: ${why}`);
  process.exit(1);
}

const rows = readQueue();
if (rows === null) none("the founder-ordered queue could not be read — no escalation is ever made on a queue nobody could see");
if (rows.length >= QUEUE_LIMIT) none(`${QUEUE_LIMIT} rows came back, which is the --limit — that is a floor, not a list`);

/**
 * NEXT UP order, and it is **the sweep's order or it is nothing**: urgent
 * first, then oldest first. `scripts/crew-desk-sweep.mts` writes exactly this
 * sort onto his page, and a gate that escalated a card he cannot see at the top
 * of his own queue would be answering a different question from the one he
 * asked. The two sorts are the one paragraph of shared logic that is duplicated
 * here, and `server/nextUpEscalation.test.ts` pins them against each other.
 */
/**
 * ⚠ **A ROW NOBODY CAN NAME MAKES THE WHOLE QUEUE UNREADABLE, and the reason is
 * the no-repeat rule rather than tidiness** (reviewer finding, PR #544).
 *
 * `Number(undefined)` is `NaN`. A malformed row carrying `awaiting-fable` could
 * become the top card, print `ESCALATE #NaN` — and then `--record NaN` is
 * refused by the integer check above, so the ledger never advances and the same
 * row buys a Fable session at **every** launch. That is "one session, never
 * five" running backwards, which is the one direction this gate must not have.
 */
if (rows.some((row) => !Number.isInteger(Number(row?.number)))) {
  none("a row in the founder-ordered queue has no usable issue number — a queue that cannot be read row by row is an unreadable queue");
}

const items = rows
  .map((row) => {
    const labels = Array.isArray(row.labels)
      ? row.labels.map((label: Json) => String(label?.name ?? ""))
      : [];
    return {
      issueNumber: Number(row.number),
      title: String(row.title ?? ""),
      urgent: labels.includes("urgent"),
      held: heldStatesFromLabels(labels),
    };
  })
  .sort((a, b) =>
    (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1) || a.issueNumber - b.issueNumber);

if (items.length === 0) none("NEXT UP is empty — nothing is ordered");

/**
 * ⚠ **WHICH ROW IS "THE TOP" — the card says *"the top TAKEABLE card in NEXT UP
 * (holds respected)"*, and `awaiting-fable` is itself a hold, so that sentence
 * needs reading rather than quoting.**
 *
 * What it means, and it is the only reading that does anything: walk the order
 * and skip the holds **no shift of either model can clear** — `blocked` (it
 * waits on something else) and `needs-sitting` (it waits on him at a machine).
 * The first row that remains is the one a shift would genuinely take next. If
 * that row is `awaiting-fable`, the ONLY seat that can take it is Fable, and
 * the marker is written. If it is takeable, an Opus shift takes it and nothing
 * is escalated — a Fable session is never spent on work Opus can do.
 *
 * ⚠ **A takeable card ahead of a Fable card therefore BLOCKS auto-escalation,
 * on purpose and with a cost.** Measured on the live queue the day this
 * shipped: #391 (his ladder ruling — money-path work with no `awaiting-fable`
 * label) sits above #508/#534/#535, so this gate answers NONE until #391 is
 * taken or labelled. That is correct — his running order is his — and it is
 * stated here rather than discovered, because a gate that quietly jumped his
 * order would be worse than one that waits.
 */
const firstTakeable = items.find(
  (item) => !item.held.includes("blocked") && !item.held.includes("sitting"),
);
if (firstTakeable === undefined) none(`every one of the ${items.length} ordered card(s) is blocked or needs a sitting — a Fable shift cannot clear those either`);
if (!firstTakeable.held.includes("fable")) {
  none(`the next card is #${firstTakeable.issueNumber}, which an Opus shift can take — Fable is not needed`);
}

const state = readState();
if (state.lastCard === firstTakeable.issueNumber) {
  none(
    `#${firstTakeable.issueNumber} was already auto-escalated once (${state.lastAt ?? "unknown time"}) and is still at the top — `
    + "a second Fable session for the same card is never automatic. A person looks now.",
  );
}

/**
 * The bundle: takeable rows AFTER the judgment card, in his order.
 *
 * Held rows are excluded because a hold is a hold whoever the seat is; the
 * judgment card's own siblings that also carry `awaiting-fable` are excluded
 * too, because his order for those is explicit (#534, then #535, then #508 —
 * *"one Fable session each"*) and a bundle must not quietly merge them.
 */
const after = items.slice(items.indexOf(firstTakeable) + 1);
const bundle = after.filter((item) => item.held.length === 0).map((item) => item.issueNumber);

const sessionsToday = state.day === TODAY ? state.countToday : 0;
console.log(
  `ESCALATE #${firstTakeable.issueNumber} | bundle=${bundle.length === 0 ? "none" : bundle.map((n) => `#${n}`).join(",")}`
  + ` | today=${sessionsToday} | ${firstTakeable.title}`,
);
process.exit(0);
