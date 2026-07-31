import {
  AGE_BANDS,
  AGE_PHASES,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "@shared/castingVocabularies";
import { Popover } from "@/foundation/Popover";

import {
  composeEcho,
  echoText,
  type BriefFacts,
  type EchoField,
  type EchoSpan,
} from "../briefEcho";
import type { LockOverrides } from "../sheetState";

/**
 * What the sheet says back after a brief compiles.
 *
 * Replaces the row of pills the founder called tokenized. One sentence, in the
 * same type as everything around it, with the facts the system pinned
 * underlined — click one to change it or let it vary.
 *
 * Three of the founder's conditions are visible in the markup rather than in a
 * comment somewhere:
 *
 *   **Two layers.** Pinned facts render at full ink; the connective prose
 *   between them at secondary. A regular scans the facts at chip-speed because
 *   they are the only thing at full contrast, and the sentence still reads as a
 *   sentence for someone seeing it for the first time.
 *
 *   **Two lines, hard.** `-webkit-line-clamp` caps it. The grammar already
 *   collapses rather than enumerating, so this is a backstop for a long
 *   heritage pair, not the mechanism.
 *
 *   **Terser on repeat.** A returning user has already read which axes are
 *   free; on the second and later rolls of a session the latitude clause drops
 *   and the pins stay, because the pins are what they are checking.
 */

/*
  Straight from the shared module — never a hand-copied list.

  The first draft of this file wrote them out by hand and got three heritages
  wrong, offering values the server would have refused. Nobody would have found
  that until a user picked one and the roll failed validation.
*/
const VOCABULARIES: Record<EchoField, readonly string[]> = {
  sex: SEXES,
  ageBand: AGE_BANDS,
  agePhase: AGE_PHASES,
  heritage: HERITAGES,
  build: BUILDS,
  energy: ENERGY_KEYS,
  look: LOOK_KEYS,
};

/** Everyday words for the popover heading, matching the sentence's register. */
const HEADINGS: Record<EchoField, string> = {
  sex: "Sex",
  ageBand: "Age",
  agePhase: "Age phase",
  heritage: "Heritage",
  build: "Build",
  energy: "Presence",
  look: "Look",
};

export type EchoAdjustment =
  | { kind: "set"; field: EchoField; value: LockOverrides[EchoField] & string }
  | { kind: "vary"; field: EchoField };

/**
 * Adjustments the user has made that the sheet in front of them cannot show.
 *
 * Rolls are immutable, so an adjustment can only ever change the NEXT roll —
 * and until this existed the only feedback was a toast, which is gone in three
 * seconds and leaves the sentence still reading the old value. The founder's
 * word for it was degenerate, and they were right: you could adjust a fact
 * twice and have no way to know either had registered.
 *
 * So the span itself shows the change, in the founder's own copy:
 * "early 20s → teens · next roll".
 */
export type PendingAdjustments = {
  overrides: Partial<Record<EchoField, string>>;
  unlocked: readonly string[];
};

export function BriefEcho({
  facts,
  followLabel,
  terse,
  pending,
  onAdjust,
}: {
  facts: BriefFacts;
  followLabel?: string | null;
  /** True on the second and later rolls of a session. */
  terse?: boolean;
  pending?: PendingAdjustments;
  onAdjust: (adjustment: EchoAdjustment) => void;
}) {
  const spans = composeEcho(facts, { terse, followLabel });
  if (spans.length === 0) return null;

  return (
    /*
      The whole sentence carries an accessible label as one string. A screen
      reader walking six separate buttons interleaved with prose fragments hears
      rubble; this way the sentence is read as a sentence, and each button still
      announces what it adjusts when reached.
    */
    <p className="dpc-echo" aria-label={echoText(spans)}>
      {spans.map((span, index) => (
        <EchoSpanView key={index} span={span} facts={facts} pending={pending} onAdjust={onAdjust} />
      ))}
    </p>
  );
}

function EchoSpanView({
  span,
  facts,
  pending,
  onAdjust,
}: {
  span: EchoSpan;
  facts: BriefFacts;
  pending?: PendingAdjustments;
  onAdjust: (adjustment: EchoAdjustment) => void;
}) {
  if (span.kind === "text") return <span className="dpc-echo__prose">{span.text}</span>;

  /*
    The casting category. Full ink like any other lock, and deliberately not a
    button: every adjustable fact opens a closed vocabulary, and a category is
    free text. An underline here would promise a picker that cannot exist —
    the brief box is where a category changes.
  */
  if (span.kind === "role") return <span className="dpc-echo__role">{span.text}</span>;

  const { field } = span;
  const current = currentValue(facts, field);
  const pinned = span.kind === "fact";

  /*
    A pending change reads as a change: the value it had, an arrow, the value
    it will have, and when. The whole span becomes read-only while it is
    pending — adjusting a fact that is already queued would need an undo the
    design does not have, and stacking two arrows would say nothing useful.
  */
  /*
    An override that has LANDED is not pending any more.

    Overrides are standing corrections — they persist across rolls by design, so
    the interpreter cannot re-derive them away. But the pending treatment was
    keyed on the override merely existing, so once the next roll came back
    carrying the new value the span read "severe minimal → severe minimal ·
    next roll": a change to itself, forever. And because a pending span is
    read-only, the fact became permanently uneditable — two decisions that were
    each defensible alone and wrong together.

    So the treatment is keyed on a DIFFERENCE, not on the presence of an
    override. When the roll already shows the queued value, there is nothing
    pending and the span goes back to being an ordinary adjustable fact.
  */
  const queued = pending?.overrides[field];
  const queuedValue = queued && queued !== current ? queued : undefined;
  const queuedVary = !queuedValue && pending?.unlocked.includes(field) === true && pinned;
  if (queuedValue || queuedVary) {
    return (
      <span className="dpc-echo__pending">
        <span className="dpc-echo__was">{span.text}</span>
        <span aria-hidden="true"> → </span>
        <span className="dpc-echo__will">{queuedValue ?? "varying"}</span>
        <span className="dp-chrome dpc-echo__when"> · next roll</span>
      </span>
    );
  }

  return (
    <Popover
      label={
        pinned
          ? `Change ${HEADINGS[field].toLowerCase()}, currently ${span.text}`
          : `Pin ${HEADINGS[field].toLowerCase()}, currently left to the roll`
      }
      heading={pinned ? HEADINGS[field] : `${HEADINGS[field]} · varying`}
      className={pinned ? "dpc-echo__fact" : "dp-pop__trigger--open"}
      options={VOCABULARIES[field].map((value) => ({
        value,
        label: value,
        current: value === current,
      }))}
      /*
        "Let it vary" only exists where something is pinned. Offering it on an
        axis that is already varying would be a control whose only outcome is
        nothing happening.
      */
      footer={
        pinned
          ? {
              label: `Let ${HEADINGS[field].toLowerCase()} vary`,
              onSelect: () => onAdjust({ kind: "vary", field }),
            }
          : null
      }
      onSelect={(value) =>
        // The popover only ever offers values from VOCABULARIES[field], which is
        // the shared list the server validates against — so this narrowing is
        // asserting what the options array already guarantees.
        onAdjust({ kind: "set", field, value: value as LockOverrides[EchoField] & string })
      }
    >
      {span.text}
    </Popover>
  );
}

function currentValue(facts: BriefFacts, field: EchoField): string | null {
  if (field === "heritage") return facts.locks.heritage?.[0] ?? null;
  return (facts.locks as Record<string, string | undefined>)[field] ?? null;
}
