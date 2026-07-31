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

export function BriefEcho({
  facts,
  followLabel,
  terse,
  onAdjust,
}: {
  facts: BriefFacts;
  followLabel?: string | null;
  /** True on the second and later rolls of a session. */
  terse?: boolean;
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
        <EchoSpanView key={index} span={span} facts={facts} onAdjust={onAdjust} />
      ))}
    </p>
  );
}

function EchoSpanView({
  span,
  facts,
  onAdjust,
}: {
  span: EchoSpan;
  facts: BriefFacts;
  onAdjust: (adjustment: EchoAdjustment) => void;
}) {
  if (span.kind === "text") return <span className="dpc-echo__prose">{span.text}</span>;

  const { field } = span;
  const current = currentValue(facts, field);
  const pinned = span.kind === "fact";

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
