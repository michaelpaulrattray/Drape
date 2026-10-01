/**
 * THE MANAGER'S FACT SHEET — its shape, its validator, and the reader that
 * decides whether a pass may use one (#1658, founder-ordered 2026-10-01).
 *
 * His word, verbatim: *"it would be more intelligent if an ai agent had full
 * overview of the current open cards etc and then could batch and launch
 * shifts"*, and on who owns it: *"you code it into the crew so an opus manager
 * runs and checks them all before the cut is made"*. On an outside checker for
 * it: *"opus 5 is really smart already and it lives within our codebase so it
 * would be difficult to get somthing wrong."* And the priority: *"I want the
 * filed urgently like next we cant keep guessing things."*
 *
 * # WHAT IT REPLACES, AND WHY A MODEL IS THE RIGHT READER FOR IT
 *
 * `scripts/lib/seatBatches.mts` decides dependencies and product areas by
 * GUESSING from prose: `DEPENDENCY_PHRASES` inside a 90-character window of a
 * `#N`, and `resolveCardArea` from whichever file paths a body happens to name.
 * Measured at the seat plans of 2026-09-30/10-01: all seven open P1 cards were
 * held every pass on the sentence *"cites #1598 and nothing says whether it
 * builds on them"* — because each body opens **"Parent: #1598."**, a bare
 * citation no human would read as a dependency. The pool read 0–3 takeable
 * cards per pass since 27 September, one seat or none.
 *
 * A phrase list cannot be repaired by lengthening it; that is the shape working
 * law 4 warns about, and the measured cost was the whole milestone backlog
 * running through one agent while up to four seats sat idle.
 *
 * # ⚠ THE MANAGER NEVER WRITES THIS FILE, AND THAT IS NOT A STYLE CHOICE
 *
 * The card's done-when says *"the manager session has no write tools"*. So the
 * manager's ONLY output is the `rows` array, printed; `scripts/manager-fact-sheet.mts`
 * is what stamps and writes the document. Two things follow and both matter:
 *
 *  1. **The stamps are the runner's, never the model's.** `pass` and `readAt`
 *     are facts about when the queue was dumped, and a stamp the model types is
 *     a stamp the model can get wrong — which would make the staleness check,
 *     the one guard here that must be mechanically honest, depend on prose.
 *  2. **The GitHub read is a snapshot the runner takes before launching it**, so
 *     the manager needs no `Bash` either. That is what makes `Read`, `Grep` and
 *     `Glob` a sufficient tool grant, and a sufficient grant is what makes
 *     read-only provable rather than promised.
 *
 * # THE FOUR UNUSABLE STATES, AND WHY EACH ONE REJECTS THE WHOLE SHEET
 *
 * The card's §5: *"a missing, unparseable, stale … or partial sheet leaves the
 * cut exactly as it is now."* Each is named separately because the reason is
 * printed into the plan, and *the manager did not run* and *the manager answered
 * half the queue* are different facts about a pass.
 *
 *  - `missing` — no file. The ordinary state when the manager was skipped, was
 *    killed at its wall-clock ceiling, or printed nothing a validator accepts.
 *  - `unparseable` — not JSON, not the declared shape, or a row the validator
 *    refuses. ⚠ **ONE bad row rejects the SHEET, not the row.** Dropping it
 *    would run two policies in one pass — half the cards on the manager's
 *    reading and half on the phrase reader — with nothing in the plan able to
 *    say which was which. Fail whole, and name the row.
 *  - `stale` — the `pass` is not this pass, or the queue snapshot behind it is
 *    older than `MANAGER_SHEET_MAX_AGE_MS`. A sheet left on disk by an earlier
 *    pass is the real risk here, and it is the one a plausible-looking file
 *    hides best.
 *  - `partial` — the manager did not cover the queue it was HANDED. Measured
 *    against the snapshot it read, never against the cut's own live read: a card
 *    filed between the snapshot and the cut is NOT the manager's failure, and
 *    rejecting a whole sheet for it would reject nearly every sheet, because the
 *    relay files cards mid-pass. ⚠ That distinction is the difference between a
 *    guard and a feature nobody can keep working.
 *
 * ⚠ **WHAT IS NOT AN UNUSABLE STATE: a card the sheet has no row for.** Inside
 * an accepted sheet every snapshot card has exactly one row, so this happens
 * only for a card filed after the snapshot — and such a card falls back to
 * today's readers, with the plan naming which reader answered it. The card's §3
 * says the manager's readings apply *"wherever a row exists"*, and this is that
 * sentence read honestly rather than as a whole-sheet demand.
 *
 * # FAILS TOWARD TODAY, NEVER TOWARD MORE SEATS
 *
 * Every verdict but `usable` leaves the cut exactly as it was before this
 * existed. That is the card's §5, and it is why none of this can be dangerous:
 * the expensive direction is a pass handing four seats work somebody is already
 * building, and nothing here can produce a seat the walls in
 * `scripts/lib/seatBatches.mts` would not have produced anyway.
 *
 * Everything here is pure over values a caller has read, so
 * `server/managerFactSheet.test.ts` drives it without a model, a file or GitHub.
 */

/** A row the manager wrote about one open card. */
export interface ManagerCardRow {
  /** The card this row is about. */
  readonly card: number;
  /**
   * The open cards it genuinely BUILDS ON. An empty list is a positive
   * statement of independence, which is the whole point of asking.
   */
  readonly dependsOn: readonly number[];
  /** The product area it touches, in the Atlas's own vocabulary, or `null`. */
  readonly area: string | null;
  /** Open cards or pull requests whose files it would touch at the same time. */
  readonly collidesWith: readonly number[];
  /** Whether a seat could start it right now. */
  readonly ready: "yes" | "no";
  /** Why not, when `ready` is `no`; empty when it is `yes`. */
  readonly why: string;
  /** Which cards belong in one seat with it, and why — one line, or `null`. */
  readonly batchHint: string | null;
  /** One sentence a human can check against the card itself. */
  readonly reason: string;
}

/** The document `scripts/manager-fact-sheet.mts` writes. */
export interface ManagerFactSheet {
  /** The runner's pass stamp — a sheet belongs to exactly one pass. */
  readonly pass: string;
  /** When the queue snapshot behind this sheet was taken, ISO-8601. */
  readonly readAt: string;
  /** When this document was written, ISO-8601. */
  readonly writtenAt: string;
  /** How many open cards the snapshot held — the denominator of `partial`. */
  readonly snapshotCards: number;
  /**
   * THE OPEN PULL REQUESTS THE MANAGER WAS SHOWN, and it is on the document for
   * two reasons rather than one.
   *
   * It is the **allowlist** `collidesWith` is validated against — at write time
   * and again at read time, where the snapshot lists are long gone — and it is the
   * **discriminator** the cut needs: an entry that is a pull request means *a
   * branch is editing this card's files right now*, which is a hold on the card,
   * while an entry that is a card is the pair reading. Without this field a later
   * reader could not tell the two apart, and that ambiguity is exactly what the
   * relay's finding on PR #1668 was about.
   */
  readonly prNumbers: readonly number[];
  /** The model that produced the rows, for the record. */
  readonly model: string;
  /**
   * What the manager session cost, from its own envelope — `null` when the run
   * reported none. The card's done-when: *"its cost is on the pass's recorded
   * spend"*, and a figure read out of the session beats one estimated anywhere
   * else (the Machinist's #513 lesson: a spend summed from remembered calls read
   * $13.48 where the provider's books said $16.74).
   */
  readonly costUsd: number | null;
  readonly rows: readonly ManagerCardRow[];
}

/** Why a sheet may not be used; the word is printed into the plan. */
export type ManagerSheetUnusable = "missing" | "unparseable" | "stale" | "partial";

export type ManagerSheetVerdict =
  | { readonly kind: "usable"; readonly sheet: ManagerFactSheet }
  | { readonly kind: "unusable"; readonly state: ManagerSheetUnusable; readonly why: string };

/**
 * HOW OLD A QUEUE SNAPSHOT MAY BE AND STILL DECIDE A CUT.
 *
 * The runner dumps the queue, launches the manager, and runs the cut when it
 * returns, so in a healthy pass this is minutes. The ceiling exists for the
 * other shape: a manager that read GitHub and then thought for an hour, whose
 * `dependsOn` and `collidesWith` are readings of a queue that has since moved.
 *
 * ⚠ **It is deliberately LONGER than the manager's own wall-clock ceiling**
 * (`$MANAGER_CEILING_MINUTES` in the runner, 10 at the time of writing). A
 * ceiling shorter than the thing it bounds would reject every sheet from a
 * manager that ran to its limit, which reads as *the manager is broken* when
 * what actually happened is that two numbers disagreed.
 */
export const MANAGER_SHEET_MAX_AGE_MS = 45 * 60 * 1000;

/**
 * How far into the future a stamp may sit before it is nonsense rather than
 * clock skew. Both stamps come from the same machine, so this is small.
 */
const MANAGER_SHEET_FUTURE_SKEW_MS = 2 * 60 * 1000;

/**
 * THE FIRST BALANCED `{ … }` IN A MODEL'S OUTPUT.
 *
 * ⚠ **A brace counter, and it is string-aware.** `claude -p` prints only its
 * final message and the brief asks for the object alone — but a model that
 * prefaces it with a sentence, or fences it, must not cost the pass its sheet,
 * and a `}` inside a `reason` string must not end the object early. A naive
 * `indexOf("{")` … `lastIndexOf("}")` survives both of those and then fails on
 * the one shape that matters: prose containing a `{` before the real object.
 *
 * Returns the substring, or `null` when no balanced, parseable object exists.
 */
export function extractJsonObject(text: string): string | null {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            /* Balanced but not valid JSON — try the next opening brace. */
            break;
          }
        }
      }
    }
  }
  return null;
}

/** What the manager's log yielded: the rows payload, and what the session cost. */
export interface ManagerPayload {
  readonly payload: unknown;
  /** The session's own figure when it reported one, `null` on the plain-text road. */
  readonly costUsd: number | null;
}

/**
 * THE ROWS, AND WHAT THE SESSION COST, OUT OF WHATEVER THE RUNNER CAPTURED.
 *
 * Two roads, because the card's done-when asks for both the rows and the cost:
 *
 *  - **plain text** — `claude -p` prints only its final message, so the first
 *    balanced object IS the rows payload and no cost is available;
 *  - **`--output-format json`** — the log is one ENVELOPE whose `result` holds
 *    that final message as a STRING, with `total_cost_usd` beside it. The runner
 *    uses this road, because *"its cost is on the pass's recorded spend"* is one
 *    of the card's conditions and the plain road cannot answer it.
 *
 * ⚠ **THE ENVELOPE IS WHY `extractJsonObject` ALONE IS NOT ENOUGH, and getting
 * this wrong fails in the confusing direction.** On the JSON road the first
 * balanced object is the envelope, which has no `rows` — so a reader that stopped
 * there would report *the manager answered in prose* about a session that
 * answered perfectly. The discriminator is `rows`: present, this IS the payload;
 * absent with a string `result`, the payload is inside it.
 */
export function unwrapManagerPayload(text: string): ManagerPayload | null {
  const outer = extractJsonObject(text);
  if (outer === null) return null;
  const parsed = JSON.parse(outer) as Record<string, unknown>;
  if (parsed !== null && typeof parsed === "object" && Array.isArray(parsed.rows)) {
    return { payload: parsed, costUsd: null };
  }
  const costUsd = typeof parsed?.total_cost_usd === "number" && Number.isFinite(parsed.total_cost_usd)
    ? parsed.total_cost_usd
    : null;
  const result = parsed?.result;
  if (typeof result !== "string") return { payload: parsed, costUsd };
  const inner = extractJsonObject(result);
  if (inner === null) return { payload: null, costUsd };
  return { payload: JSON.parse(inner) as unknown, costUsd };
}

/**
 * EVERY ENTRY THAT IS A NUMBER THE MANAGER WAS ACTUALLY SHOWN, or the complaint.
 *
 * ⚠ **`allowed` IS THE MANAGER'S OWN INPUTS, AND THAT IS THE WHOLE CONTROL.**
 * This function accepted any positive integer until the relay's finding on PR
 * #1668, and the measured consequence is the sharpest kind: **the brief's own
 * worked example was the failing input.** §3 asks for *"which open cards or pull
 * requests would it touch"* and shows `"collidesWith": [1649]` — a PULL REQUEST
 * number — while `managerPairVerdict` could only ever compare CARD numbers. A PR
 * number can never equal a card number, so a row that correctly named the
 * in-flight pull request editing the same file read as **no collision**, and
 * because the manager's verdict REPLACES `pairDisjointOnPaths` where both rows
 * exist, that row FREED a card the path rule would have held. A reader whose
 * unknown value means *clear* is worse than no reader.
 *
 * So membership is checked against the two files the manager was given, and a
 * number in neither refuses the whole sheet. A hallucinated number now costs the
 * pass its sheet rather than passing as a clearance.
 *
 * ⚠ **Issue and pull-request numbers share ONE space in a GitHub repository**, so
 * an entry is unambiguously one or the other and `collidesWith` can carry both
 * without a tag.
 */
function numberList(
  value: unknown,
  what: string,
  allowed: ReadonlySet<number>,
  allowedWord: string,
): readonly number[] | string {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return `${what} is not an array`;
  const seen = new Set<number>();
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry <= 0) {
      return `${what} holds ${JSON.stringify(entry)}, which is not a number`;
    }
    if (!allowed.has(entry)) {
      return `${what} names #${entry}, which is not ${allowedWord} the manager was shown`;
    }
    seen.add(entry);
  }
  return [...seen].sort((a, b) => a - b);
}

/** What `parseManagerRows` answers. */
export type ManagerRowsVerdict =
  | { readonly kind: "rows"; readonly rows: readonly ManagerCardRow[] }
  | { readonly kind: "refused"; readonly state: ManagerSheetUnusable; readonly why: string };

/**
 * VALIDATE THE MANAGER'S OUTPUT AGAINST THE QUEUE IT WAS GIVEN.
 *
 * `snapshot` is every open card number the runner dumped for it. The rules, and
 * each one answers a failure the card's own done-when names:
 *
 *  - the payload is an object carrying a `rows` array — otherwise `unparseable`;
 *  - every row names a card IN the snapshot, exactly once. A row for a card it
 *    was never shown, or two rows for one card, is `unparseable`: both say the
 *    reading is not of the queue it was handed;
 *  - every field has its declared type, and `ready` is one of two words;
 *  - ⚠ **a `ready: "no"` row carries a `why`.** A hold with no reason is the one
 *    thing his own rules refuse everywhere else — the desk sweep's decline, the
 *    `awaiting-fable` line — and a reader that accepted one would put a silent
 *    hold on his page;
 *  - ⚠ **every row carries a `reason`.** The card's §2: *"the sheet is the
 *    artifact; the manager's reasoning is not."* A row with no checkable
 *    sentence is a verdict nobody can audit, which is the whole thing this step
 *    is supposed to end;
 *  - the snapshot is covered — fewer rows than cards is `partial`, which is the
 *    shape a truncated or turn-limited session produces.
 */
export function parseManagerRows(
  payload: unknown,
  snapshot: readonly number[],
  /**
   * The open pull requests the manager was shown. `collidesWith` may name one;
   * `dependsOn` may not — a dependency is a card, and a PR number there means the
   * two columns were confused, which is a reason to refuse rather than to guess.
   */
  openPullRequests: readonly number[] = [],
): ManagerRowsVerdict {
  const refuse = (state: ManagerSheetUnusable, why: string): ManagerRowsVerdict => ({ kind: "refused", state, why });
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return refuse("unparseable", "the manager's output is not a JSON object");
  }
  const rawRows = (payload as { rows?: unknown }).rows;
  if (!Array.isArray(rawRows)) return refuse("unparseable", "the manager's output has no `rows` array");

  const expected = new Set(snapshot);
  const prs = new Set(openPullRequests);
  const collidable = new Set([...expected, ...prs]);
  const rows: ManagerCardRow[] = [];
  const seen = new Set<number>();

  for (const raw of rawRows) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return refuse("unparseable", `a row is not an object (${String(JSON.stringify(raw)).slice(0, 80)})`);
    }
    const row = raw as Record<string, unknown>;
    const cardNumber = row.card;
    if (typeof cardNumber !== "number" || !Number.isSafeInteger(cardNumber) || cardNumber <= 0) {
      return refuse("unparseable", `a row's \`card\` is ${JSON.stringify(cardNumber)}, which is not a card number`);
    }
    if (!expected.has(cardNumber)) {
      return refuse("unparseable", `the sheet has a row for #${cardNumber}, which was not in the queue it was given`);
    }
    if (seen.has(cardNumber)) {
      return refuse("unparseable", `the sheet has two rows for #${cardNumber}`);
    }
    seen.add(cardNumber);

    const dependsOn = numberList(row.dependsOn, `#${cardNumber}'s \`dependsOn\``, expected, "an open card");
    if (typeof dependsOn === "string") return refuse("unparseable", dependsOn);
    const collidesWith = numberList(
      row.collidesWith,
      `#${cardNumber}'s \`collidesWith\``,
      collidable,
      "an open card or an open pull request",
    );
    if (typeof collidesWith === "string") return refuse("unparseable", collidesWith);

    const area = row.area;
    if (area !== null && area !== undefined && typeof area !== "string") {
      return refuse("unparseable", `#${cardNumber}'s \`area\` is ${JSON.stringify(area)}, which is neither a name nor null`);
    }
    const ready = row.ready;
    if (ready !== "yes" && ready !== "no") {
      return refuse("unparseable", `#${cardNumber}'s \`ready\` is ${JSON.stringify(ready)}, which is neither "yes" nor "no"`);
    }
    const why = typeof row.why === "string" ? row.why.trim() : "";
    if (ready === "no" && why === "") {
      return refuse("unparseable", `#${cardNumber} is marked not ready with no reason — a hold without a reason is refused`);
    }
    const reason = typeof row.reason === "string" ? row.reason.trim() : "";
    if (reason === "") {
      return refuse("unparseable", `#${cardNumber} carries no \`reason\`, so nothing about this row can be checked against the card`);
    }
    const batchHint = typeof row.batchHint === "string" && row.batchHint.trim() !== "" ? row.batchHint.trim() : null;

    rows.push({
      card: cardNumber,
      dependsOn,
      area: typeof area === "string" && area.trim() !== "" ? area.trim() : null,
      collidesWith,
      ready,
      why,
      batchHint,
      reason,
    });
  }

  if (rows.length < expected.size) {
    const missing = snapshot.filter((card) => !seen.has(card));
    const named = missing.slice(0, 8).map((n) => `#${n}`).join(", ");
    const more = missing.length > 8 ? ` and ${missing.length - 8} more` : "";
    return refuse(
      "partial",
      `the manager covered ${rows.length} of the ${expected.size} cards it was given — missing ${named}${more}`,
    );
  }

  rows.sort((a, b) => a.card - b.card);
  return { kind: "rows", rows };
}

/** Stamp validated rows into the document — the runner's facts, not the model's. */
export function stampSheet(input: {
  readonly rows: readonly ManagerCardRow[];
  readonly pass: string;
  readonly readAt: string;
  readonly snapshotCards: number;
  readonly prNumbers: readonly number[];
  readonly model: string;
  readonly costUsd?: number | null;
  readonly nowMs: number;
}): ManagerFactSheet {
  return {
    pass: input.pass,
    readAt: input.readAt,
    writtenAt: new Date(input.nowMs).toISOString(),
    snapshotCards: input.snapshotCards,
    prNumbers: [...input.prNumbers].sort((a, b) => a - b),
    model: input.model,
    costUsd: input.costUsd ?? null,
    rows: input.rows,
  };
}

/**
 * MAY THIS PASS USE THIS SHEET? — the read-time half of the two checks.
 *
 * ⚠ **The write side already validated these rows, and this validates them
 * again.** Two readings of one fact is the cheapest guard there is, and the file
 * on disk is the thing a pass actually consumes: the shape that bites is a
 * plausible sheet left behind by an earlier pass, which no amount of care at
 * write time can prevent.
 *
 * The caller hands over the file's text, or `null` when there is no file — so
 * this function touches no disk and the arms need none.
 */
export function readManagerSheet(input: {
  readonly raw: string | null;
  readonly pass: string;
  readonly nowMs: number;
  readonly maxAgeMs?: number;
}): ManagerSheetVerdict {
  if (input.raw === null) {
    return { kind: "unusable", state: "missing", why: "no fact sheet was written for this pass" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.raw);
  } catch (error) {
    return {
      kind: "unusable",
      state: "unparseable",
      why: `the fact sheet is not JSON (${error instanceof Error ? error.message : String(error)})`,
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "unusable", state: "unparseable", why: "the fact sheet is not a JSON object" };
  }
  const doc = parsed as Record<string, unknown>;
  const pass = typeof doc.pass === "string" ? doc.pass : "";
  if (pass === "") return { kind: "unusable", state: "unparseable", why: "the fact sheet names no pass" };
  if (pass !== input.pass) {
    return {
      kind: "unusable",
      state: "stale",
      why: `the fact sheet belongs to pass ${pass}, and this pass is ${input.pass}`,
    };
  }
  const readAt = typeof doc.readAt === "string" ? doc.readAt : "";
  const readAtMs = Date.parse(readAt);
  if (!Number.isFinite(readAtMs)) {
    return {
      kind: "unusable",
      state: "unparseable",
      why: `the fact sheet's \`readAt\` is ${JSON.stringify(doc.readAt)}, which is not a time`,
    };
  }
  const maxAgeMs = input.maxAgeMs ?? MANAGER_SHEET_MAX_AGE_MS;
  const ageMs = input.nowMs - readAtMs;
  if (ageMs > maxAgeMs) {
    return {
      kind: "unusable",
      state: "stale",
      why: `the queue behind the fact sheet was read ${Math.round(ageMs / 60000)} minutes ago, past the ${Math.round(maxAgeMs / 60000)}-minute ceiling`,
    };
  }
  if (ageMs < -MANAGER_SHEET_FUTURE_SKEW_MS) {
    return { kind: "unusable", state: "stale", why: `the fact sheet's \`readAt\` (${readAt}) is in the future` };
  }
  const declared = doc.snapshotCards;
  if (typeof declared !== "number" || !Number.isSafeInteger(declared) || declared < 0) {
    return { kind: "unusable", state: "unparseable", why: "the fact sheet does not say how many cards the manager was given" };
  }
  /*
    THE PULL-REQUEST ALLOWLIST, off the document, because the snapshot files are
    long gone by read time. ⚠ **An absent list is `unparseable`, never an empty
    one.** Defaulting it to `[]` would make every `collidesWith` entry naming a
    pull request unknown — and `numberList` would then refuse the sheet for a row
    that was correct when it was written, which is a refusal nobody could
    diagnose. A sheet written before this field existed cannot be read, and that
    is the honest answer rather than a guess at what it meant.
  */
  if (!Array.isArray(doc.prNumbers)) {
    return { kind: "unusable", state: "unparseable", why: "the fact sheet does not record which pull requests the manager was shown" };
  }
  const prNumbers = doc.prNumbers.filter(
    (n): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0,
  );
  /* The card rows are re-validated against THEMSELVES: the queue snapshot is gone,
     so the population check is `declared` below rather than a membership test.
     Shape, duplicates, the two reason rules and the collidesWith allowlist all
     still apply. */
  const selfSnapshot = Array.isArray(doc.rows)
    ? doc.rows
      .map((row) => (row !== null && typeof row === "object" ? (row as { card?: unknown }).card : undefined))
      .filter((card): card is number => typeof card === "number" && Number.isSafeInteger(card) && card > 0)
    : [];
  const verdict = parseManagerRows({ rows: doc.rows }, selfSnapshot, prNumbers);
  if (verdict.kind === "refused") return { kind: "unusable", state: verdict.state, why: verdict.why };
  if (verdict.rows.length === 0) {
    return { kind: "unusable", state: "partial", why: "the fact sheet holds no rows, so the manager read nothing this pass" };
  }
  if (verdict.rows.length < declared) {
    return {
      kind: "unusable",
      state: "partial",
      why: `the fact sheet holds ${verdict.rows.length} rows for the ${declared} cards the manager was given`,
    };
  }
  return {
    kind: "usable",
    sheet: {
      pass,
      readAt,
      writtenAt: typeof doc.writtenAt === "string" ? doc.writtenAt : readAt,
      snapshotCards: declared,
      prNumbers,
      model: typeof doc.model === "string" ? doc.model : "unrecorded",
      costUsd: typeof doc.costUsd === "number" && Number.isFinite(doc.costUsd) ? doc.costUsd : null,
      rows: verdict.rows,
    },
  };
}

/** The sheet's rows keyed by card, which is how every consumer wants them. */
export function managerRowsByCard(sheet: ManagerFactSheet): ReadonlyMap<number, ManagerCardRow> {
  return new Map(sheet.rows.map((row) => [row.card, row] as const));
}
