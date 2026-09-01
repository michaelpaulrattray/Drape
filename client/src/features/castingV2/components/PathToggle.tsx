import { ScopePill } from "@/foundation";
import { type CastingPath } from "@shared/castingPaths";

import { CASTING_PATH_NAMES, CASTING_PATH_ORDER } from "../castingPathCopy";

/**
 * THE TOGGLE — which path a cast is born on (design
 * `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §6; founder ruling 2026-08-21).
 *
 * # One control, two surfaces, and why it is a component
 *
 * §6: *"Two surfaces, because there are two places a roll is bought, and a
 * toggle on only one of them is a path a customer can change by accident."*
 * The lobby hero chooses the path for a new sheet; the re-roll box shows the
 * path this sheet was cast on and may switch it. Two hand-built pill rows would
 * be two chances for the pills to disagree about which one is selected, which
 * is the same class the copy module's own header names.
 *
 * # It is the roster filter's control, deliberately — `aria-pressed`, not a radio
 *
 * `ScopePill` is the house's one-of-several control and it announces itself
 * with `aria-pressed`; the roster's scope filter on this same page is built
 * from it. `role="radio"` would have been the tidier semantic and it is
 * REFUSED on a measured ground rather than a taste one: the pill's selected
 * appearance is painted by `.dp-scopepill[aria-pressed="true"]`, so a radio
 * would have had to either carry a contradictory `aria-pressed` or ship a
 * second selected-state rule — a fork of a primitive, for two pills. The
 * wrapper carries `role="group"` and a name, which is what makes the pair read
 * as one question.
 *
 * # ⚠ IT NEVER DECIDES WHETHER IT IS DRAWN
 *
 * §6: *"it does not appear when `CASTING_TWO_PATHS_SCOPE` is off. No disabled
 * control, no 'coming soon' — a disabled toggle is a question with no answer,
 * which is D-180's dead end wearing a tap target."* That question is
 * `config.twoPathsEnabled`, a server-owned gate, and it is asked by each
 * caller at its own site rather than here: a component that renders nothing
 * under some condition is a component whose absence is invisible in a diff.
 *
 * # The note is the caller's sentence, not the control's
 *
 * The lobby says what the SELECTED path does; the re-roll box says only when
 * the next roll will differ from the sheet in front of you. Same slot, two
 * different jobs, and neither belongs to a pill row — so the sentence arrives
 * as a prop and the layout lives here once.
 */
export function PathToggle({
  value,
  onChange,
  note,
  idPrefix,
  label,
}: {
  value: CastingPath;
  onChange: (path: CastingPath) => void;
  /** The line under the pills — the caller's sentence. `null` draws nothing. */
  note?: string | null;
  /** Distinguishes the two instances when both are mounted on one page. */
  idPrefix: string;
  /** What the group is FOR, for anyone who cannot see the pills. */
  label: string;
}) {
  return (
    <div className="dpc-paths">
      <div className="dpc-paths__row" role="group" aria-label={label}>
        {/*
          The eyebrow is `.dp-chrome`, the house's machine-ish label: a tag
          beside a control, never a sentence. ⚠ This used to cite the TRY row
          as the precedent; #375 removed that row, and the convention it named
          is the tag's own rather than that one call site's.
        */}
        <span className="dp-chrome">PATH</span>
        {CASTING_PATH_ORDER.map((path) => (
          <ScopePill
            key={path}
            id={`${idPrefix}-${path}`}
            active={value === path}
            onClick={() => onChange(path)}
          >
            {CASTING_PATH_NAMES[path]}
          </ScopePill>
        ))}
      </div>
      {/*
        THE TRADEOFF IS TOLD BEFORE THE ROLL — his own condition, verbatim:
        "as long as we make it clear before they go to cast someone."

        One line, following the selection, rather than both lines stacked. Two
        grey sentences under a control is the wall of small print `sheetNotice`
        exists to prevent, and the default path's own line already states the
        bound a Basics customer is choosing away from.
      */}
      {note ? <p className="dpc-paths__note">{note}</p> : null}
    </div>
  );
}
