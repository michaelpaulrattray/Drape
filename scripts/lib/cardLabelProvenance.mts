/**
 * HOW A CARD CAME TO CARRY THE WORK LABEL IT CARRIES — #1273.
 *
 * # THE INCIDENT, READ AT THE ARTIFACT RATHER THAN AT THE CARD
 *
 * On 2026-09-25 six cards were relabelled at two-second intervals
 * (`10:45:56Z` → `10:46:06Z`): #1203, #1220, #1143, #1183, #1188, #1151. Read
 * at `repos/.../issues/N/timeline` on 2026-09-26, every one of the six was a
 * **move** — a work label removed and another added in the same instant — and
 * **not one of them left a comment.** There is no comment on any of the six
 * between 10:00Z and 12:00Z that day.
 *
 * On #1220 that move undid a relabel a shift had made 2h55m earlier and
 * explained on the card (`07:50:10Z` move, `07:50:12Z` comment). Nothing
 * recorded the disagreement, so the next two shifts read `bug` + `rung:N2`
 * over work that was a measurement and one of them carried it into its handoff
 * as an open question. `bug` is the label that jumps the queue, so a silent
 * move of it is a machine choosing the night's work.
 *
 * # THE CLASS, AND WHY THE WRITER WAS NEVER THE PROBLEM
 *
 * `scripts/jev-card-category-file.mts` cannot do this and never could:
 * `decideCardFiling` refuses an already-filed card before it reads anything
 * else, and the relay set that rule on the PR that shipped it (#1247). The
 * road the six cards actually took is the CHECK's — `jev-card-category-check`
 * prints a disagreement as one line, *"#1220 labelled bug reads castingUpkeep
 * conf 0.94"*, and a shift acts on it by hand.
 *
 * ⚠ **The one field the reader is given is the one guaranteed to be stale.**
 * A title is a card's name and is not rewritten when the work moves on; the
 * sentence saying the defect was fixed is three screens down. So the check's
 * line is a true reading of a stale field presented as a finding about a
 * label — and a shift has no way to tell, from that line, that a person
 * already decided this exact question.
 *
 * # WHAT THIS MODULE ANSWERS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It answers one thing from the timeline, exactly: **did this work label
 * arrive by displacing another one (a MOVE), or by filling a blank (a FILL)?**
 * That is read off `labeled`/`unlabeled` events and involves no judgement.
 *
 * ⚠ **It does NOT classify a move as deliberate or careless, and refusing to
 * is the point.** Every actor on this repository is `michaelpaulrattray` — the
 * shifts, the relay and the founder share one account — so the actor cannot
 * separate a person from a pass. The only signal is whether somebody wrote
 * something, and "a comment landed within N seconds" is a heuristic that fails
 * in the permissive direction: an unrelated comment posted seconds before a
 * silent move would read as its explanation. So the module REPORTS the nearest
 * comment after the move with its lag and its first line, and lets the reader
 * judge. `counselOnDisagreement` refuses to call a move actionable either way.
 */

/** One timeline row, reduced to the three kinds that bear on a label. */
export type CardTimelineEvent =
  | { readonly kind: "labeled"; readonly at: string; readonly label: string }
  | { readonly kind: "unlabeled"; readonly at: string; readonly label: string }
  | { readonly kind: "commented"; readonly at: string; readonly excerpt: string };

/**
 * How far after a label change a comment may land and still be shown beside
 * it. Measured on the real relabels rather than chosen: every explained move
 * on the record commented 1–3 seconds later (#1220 at +2s, #1183 at +1s,
 * #1151 at +2s) because the same script posts both. Two minutes is generous
 * for that and short enough that an unrelated comment rarely lands inside it.
 *
 * ⚠ **A comment inside this window is EVIDENCE SHOWN, never a verdict
 * reached.** Nothing in this module treats its presence as permission.
 */
export const LABEL_EXPLANATION_WINDOW_MS = 120_000;

/** How much of a nearby comment goes in the report. One line, enough to place it. */
export const EXPLANATION_EXCERPT_CHARS = 140;

export type NearbyComment = {
  readonly at: string;
  readonly excerpt: string;
  readonly lagSeconds: number;
};

export type LabelArrival = {
  /** The work label the card carries now. */
  readonly label: string;
  /** When it was last added, or `null` when the timeline does not say. */
  readonly at: string | null;
  /**
   * `move` — it displaced another work label in the same instant.
   * `fill`  — it arrived where the card carried no work label.
   * `unknown` — no `labeled` event for it is in the timeline read.
   */
  readonly shape: "move" | "fill" | "unknown";
  /** The work labels removed in the same instant, in timeline order. */
  readonly displaced: readonly string[];
  /** The first comment at or after the arrival, inside the window above. */
  readonly nearestComment: NearbyComment | null;
};

/**
 * The GitHub timeline, reduced to the rows this module reads.
 *
 * ⚠ **It is a FUNCTION rather than an inline `.map` in the script, so the
 * shape assumption can be driven.** The three event kinds carry their
 * timestamp in different places on that API — a `labeled` row has
 * `created_at` and `label.name`, a `commented` row has `created_at` and
 * `body` — and a reduction that silently drops a kind produces a timeline
 * that reads as "nothing ever happened here", which is the arrival shape
 * `unknown`. An arm holds all three against rows copied from the real API.
 */
export function mapGithubTimeline(rows: readonly unknown[]): CardTimelineEvent[] {
  const events: CardTimelineEvent[] = [];
  for (const row of rows) {
    const entry = row as {
      event?: string;
      created_at?: string;
      label?: { name?: string };
      body?: string;
    };
    if (!entry.created_at) continue;
    if ((entry.event === "labeled" || entry.event === "unlabeled") && entry.label?.name) {
      events.push({ kind: entry.event, at: entry.created_at, label: entry.label.name });
    } else if (entry.event === "commented") {
      events.push({ kind: "commented", at: entry.created_at, excerpt: entry.body ?? "" });
    }
  }
  return events;
}

function toMillis(at: string): number {
  const millis = Date.parse(at);
  if (!Number.isFinite(millis)) {
    throw new Error(`cardLabelProvenance: unreadable timestamp "${at}"`);
  }
  return millis;
}

/**
 * ⚠ **"The same instant" is a WINDOW, not an equality, and the real data is
 * why.** GitHub stamps the two halves of a relabel from one API call with the
 * same second on every move on the record — but two `gh` calls a fraction of a
 * second apart would not, and a move made as two commands is still a move.
 * One second either way covers both without reaching the next act.
 */
export const SAME_INSTANT_MS = 1_000;

/**
 * Read how the card's current work label arrived.
 *
 * `workLabels` is passed in rather than imported so this module never has an
 * opinion about which labels are work labels — the caller derives that from
 * `CREW_WORK_CATEGORIES`, the one source of truth.
 */
export function readLabelArrival(input: {
  readonly events: readonly CardTimelineEvent[];
  readonly workLabels: readonly string[];
  readonly label: string;
}): LabelArrival {
  const workLabels = new Set(input.workLabels);
  if (!workLabels.has(input.label)) {
    throw new Error(
      `cardLabelProvenance: "${input.label}" is not one of the work labels ` +
        `(${input.workLabels.join(", ")}) — reading its arrival would answer a different question`,
    );
  }

  /* Newest first, so the arrival found is the one that is standing. A label
     added, removed and added again has two `labeled` rows and only the last
     one describes the card as it is now. */
  const additions = input.events
    .filter((event) => event.kind === "labeled" && event.label === input.label)
    .sort((a, b) => toMillis(b.at) - toMillis(a.at));

  const arrival = additions[0];
  if (!arrival) {
    return { label: input.label, at: null, shape: "unknown", displaced: [], nearestComment: null };
  }

  const arrivedAt = toMillis(arrival.at);
  const displaced = input.events
    .filter(
      (event) =>
        event.kind === "unlabeled" &&
        workLabels.has(event.label) &&
        Math.abs(toMillis(event.at) - arrivedAt) <= SAME_INSTANT_MS,
    )
    .sort((a, b) => toMillis(a.at) - toMillis(b.at))
    .map((event) => (event as { label: string }).label);

  const nearest = input.events
    .filter((event): event is Extract<CardTimelineEvent, { kind: "commented" }> => event.kind === "commented")
    .filter((event) => {
      const lag = toMillis(event.at) - arrivedAt;
      return lag >= 0 && lag <= LABEL_EXPLANATION_WINDOW_MS;
    })
    .sort((a, b) => toMillis(a.at) - toMillis(b.at))[0];

  return {
    label: input.label,
    at: arrival.at,
    shape: displaced.length > 0 ? "move" : "fill",
    displaced,
    nearestComment: nearest
      ? {
          at: nearest.at,
          excerpt: firstLine(nearest.excerpt),
          lagSeconds: Math.round((toMillis(nearest.at) - arrivedAt) / 1000),
        }
      : null,
  };
}

function firstLine(body: string): string {
  const line = (body ?? "").replace(/\r/g, "").split("\n").find((candidate) => candidate.trim().length > 0) ?? "";
  return line.trim().slice(0, EXPLANATION_EXCERPT_CHARS);
}

export type DisagreementCounsel = {
  /**
   * `hold` — a person already answered this exact question on this card; the
   *          reader's disagreement is a question for them, never an instruction.
   * `look` — nobody has ruled on this label; the reading is worth reading.
   */
  readonly verdict: "hold" | "look";
  readonly why: string;
};

/**
 * ⚠ **A READER MAY NOT OVERTURN A DECISION SOMEBODY ALREADY MADE — and the
 * whole control is that `move` is read off events rather than guessed.**
 *
 * A work label that displaced another one is a decision: somebody looked at
 * this card, saw a label, and chose a different one. A reader disagreeing with
 * that is disagreeing with a person, and the six cards of 2026-09-25 are what
 * happens when the report does not say so.
 *
 * A label that filled a blank is not a decision of that kind — nothing was
 * overturned — so the reading stands on its own and is worth looking at.
 */
export function counselOnDisagreement(arrival: LabelArrival): DisagreementCounsel {
  if (arrival.shape === "move") {
    return {
      verdict: "hold",
      why:
        `\`${arrival.label}\` was chosen over \`${arrival.displaced.join("`, `")}\` on ${arrival.at}` +
        (arrival.nearestComment
          ? ` and a comment landed ${arrival.nearestComment.lagSeconds}s later — read it first`
          : ` and NOTHING on the card says why — read the card before moving it again`),
    };
  }
  if (arrival.shape === "unknown") {
    return {
      verdict: "hold",
      why: `the timeline read does not say how \`${arrival.label}\` got here — read the card`,
    };
  }
  return {
    verdict: "look",
    why: `\`${arrival.label}\` filled a blank on ${arrival.at}; no earlier label was overturned`,
  };
}

/**
 * THE RECEIPT A MOVE LEAVES, AND WHY THE CHECK PRINTS THE COMMAND RATHER THAN
 * THE ADVICE.
 *
 * Recommendation A on #1273 is *"when a pass changes a work label a human set,
 * it says so on the card in one line."* A rule stated in a docblock is a rule
 * nobody runs. The check now prints the relabel as **two commands with the
 * receipt already written**, so recording the move is the cheaper road rather
 * than the diligent one — which is the disappearing-technology law applied to
 * the team's own tools: remove the decision instead of explaining it better.
 */
export function relabelReceipt(input: {
  readonly from: string;
  readonly to: string;
  readonly confidence: number;
  readonly arrival: LabelArrival;
}): string {
  const previous =
    input.arrival.shape === "move"
      ? `It was moved to \`${input.from}\` on ${input.arrival.at}, over \`${input.arrival.displaced.join("`, `")}\`` +
        (input.arrival.nearestComment
          ? `, and explained on this card ${input.arrival.nearestComment.lagSeconds}s later.`
          : `, with no reason recorded.`)
      : `It has carried \`${input.from}\` since ${input.arrival.at ?? "before this timeline read"}.`;
  return [
    `**Work label moved: \`${input.from}\` → \`${input.to}\`.**`,
    "",
    `The card-category reader reads this card as \`${input.to}\` at ${input.confidence.toFixed(2)} confidence. ${previous}`,
    "",
    `A reader never moves a label on its own — it cannot, and the one that files labels refuses any card that already carries one. This move was made by a shift that read the card. If it is wrong, move it back and say so here.`,
  ].join("\n");
}
