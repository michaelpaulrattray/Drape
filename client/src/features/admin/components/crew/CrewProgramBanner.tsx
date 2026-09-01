/**
 * The program banner — mission, focus, current milestone, ladder.
 *
 * First on the page because it is first in his reading order on the Desk: what
 * we are building, what he has confirmed, where we are inside it. His verbatim
 * confirming quote is rendered as a quote and never paraphrased — a focus is
 * set by his word, and the word is the evidence that it was.
 *
 * ⚠ **BRIEF 08 CHANGED THE SURFACE AND NOTHING ELSE (#398).** The order of the
 * blocks, the words in them, the quote and its attribution, and the ONE
 * progress number read off the steps are all exactly as they were. What moved:
 * every hex literal became a token, every measured value became mono, the
 * `font-semibold` titles became 500, and the quote lost its italic — his §4,
 * whose argument is that a quote already carries two markers (its rule and its
 * attribution) and a third marker for one fact says nothing new.
 */
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import { milestoneCountLine, milestoneProgress } from "./crewTypes";
import type { CrewBriefingView } from "./crewTypes";

const FOCUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  proposed: "Proposed — awaiting your word",
  none: "No focus set",
};

const STEP_LABEL: Record<string, string> = {
  done: "Done",
  "in-progress": "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
};

const RUNG_LABEL: Record<string, string> = {
  done: "Done",
  current: "Current",
  queued: "Queued",
  parked: "Parked",
};

/*
  ⚠ **`warn` IS THE HOUSE RED, AND NOW IT SAYS SO.** It carried the literal
  with a comment explaining that the value came from tokens.css. The value IS
  `--errorInk`, brief 08 §5 names it, and the chip's own argument — a warn chip
  is a problem wearing a smaller badge — stands unchanged once the colour is
  the token rather than a copy of one.
*/
const CHIP_TONE: Record<string, string> = {
  good: "dp-crew__chip--good",
  warn: "dp-crew__chip--warn",
  neutral: "",
};

export function CrewProgramBanner({ program }: { program: CrewBriefingView["program"] }) {
  return (
    <section className="dp-crew__card">
      <TableHead eyebrow="The program" />

      {/* At-a-glance chips (#74). A chip's source is the reading it cites —
          shown under it in small type, never hidden in a tooltip he has to
          discover. */}
      {program.chips.length > 0 && (
        <div className="dp-crew__chips dp-crew__gap">
          {program.chips.map((chip, index) => (
            /* Composite key (PR #78 review nit): labels are writer-controlled
               and the schema does not force them unique. */
            <div key={`${index}-${chip.label}`} className="dp-crew__chipcell">
              <span className={cn("dp-crew__chip", CHIP_TONE[chip.tone] ?? CHIP_TONE.neutral)}>
                {chip.label}
              </span>
              {chip.source && <p className="dp-crew__chipsrc">{chip.source}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="dp-crew__mission dp-crew__gap">{program.mission}</p>

      <div className="dp-crew__rule">
        <div className="dp-crew__focus">
          <span className="dp-crew__subhead">Focus</span>
          <span className="dp-crew__title">{program.focus.title || "—"}</span>
          <span
            className={cn(
              "dp-crew__chip",
              program.focus.state === "confirmed" && "dp-crew__chip--good",
            )}
          >
            {FOCUS_LABEL[program.focus.state] ?? program.focus.state}
          </span>
        </div>

        {/* ⚠ VERBATIM, AND NOT ITALIC (§4). The words are untouchable — §1's
            first rule — and the face is the only thing this brief changes. */}
        {program.focus.quote && (
          <blockquote className="dp-crew__quote">
            “{program.focus.quote}”
            {program.focus.quotedAt && (
              <span className="dp-crew__quoteWho"> — you, {shortDate(program.focus.quotedAt)}</span>
            )}
          </blockquote>
        )}
      </div>

      {program.milestone && (
        <div className="dp-crew__rule">
          <h3 className="dp-crew__title">{program.milestone.title}</h3>

          {/* The progress bar (#74 item 1) — READ off the steps below, never a
              second number beside them. An in-progress step fills half, so the
              bar moves the day work starts. */}
          {program.milestone.steps.length > 0 && (() => {
            const progress = milestoneProgress(program.milestone.steps);
            return (
              <div className="dp-crew__gap">
                <div className="dp-crew__track">
                  <div
                    className="dp-crew__fill"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="dp-crew__mono dp-crew__gap--tight">
                  {milestoneCountLine(progress)}
                </p>
              </div>
            );
          })()}

          <ol className="dp-crew__steps">
            {program.milestone.steps.map((step, index) => (
              <li key={`${index}-${step.title}`} className="dp-crew__step">
                <span className="dp-crew__num dp-crew__stepnum">{index + 1}</span>
                <span
                  className={cn(
                    "dp-crew__steptext",
                    step.state === "done" && "dp-crew__steptext--done",
                  )}
                >
                  {step.title}
                </span>
                <span className="dp-crew__mono dp-crew__stepstate">
                  {STEP_LABEL[step.state] ?? step.state}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {program.ladder.length > 0 && (
        <div className="dp-crew__rule">
          <h3 className="dp-crew__subhead">The ladder</h3>

          {/* The rung bar (#74 item 2) — the whole climb in one glance: filled
              is done, ringed is where we stand, light is queued, dashed is
              parked. The list below stays the reading copy. */}
          <div className="dp-crew__rungbar dp-crew__gap" aria-hidden="true">
            {program.ladder.map((rung) => (
              <div key={`bar-${rung.key}`} className="dp-crew__rungcell">
                <span className={cn("dp-crew__rungseg", `dp-crew__rungseg--${rung.state}`)} />
                <span
                  className={cn(
                    "dp-crew__rungkey",
                    rung.state === "current" && "dp-crew__rungkey--current",
                  )}
                >
                  {rung.key}
                </span>
              </div>
            ))}
          </div>

          <ul className="dp-crew__rungs">
            {program.ladder.map((rung) => (
              <li key={rung.key} className="dp-crew__rung">
                <span className="dp-crew__num dp-crew__rungid">{rung.key}</span>
                <span
                  className={cn(
                    "dp-crew__rungtitle",
                    rung.state === "current" && "dp-crew__rungtitle--current",
                  )}
                >
                  {rung.title}
                </span>
                <span className="dp-crew__mono">{RUNG_LABEL[rung.state] ?? rung.state}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * A date he can read at a glance. Never a relative "2 hours ago" — a ruling's
 * date is a fact and relative time makes it a moving one.
 *
 * ⚠ **24-HOUR, FORCED — AND THIS IS THE SECOND INSTANCE OF A CLASS THE PAGE
 * HAD ALREADY RULED ON.** `CrewWorkingNow`'s `clockTime` carries the ruling in
 * its own docblock: *"the locale default here is `03:48 pm` … every other time
 * in his world is 24-hour — the runner's close-stamps, the shift rows, his own
 * #295 report quoting `19:46` and `20:17` — so the one clock he would be
 * comparing against was the one written differently."*
 *
 * That fix reached one of the three formatters on this page. This one and
 * `CrewNextUp`'s `readStamp` were its siblings and were missed, so his own
 * confirming quote read *"— you, 25 Aug, 07:17 pm"* directly above a shift
 * strip printing `20:17`. Found by LOOKING at the rendered page during brief
 * 08's drive, which is how the first instance was found too.
 */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
