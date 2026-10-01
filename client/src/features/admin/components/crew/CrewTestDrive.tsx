/**
 * THE TEST DRIVE — the one section on this page that is a list of things for his
 * HANDS rather than a question for his word (#1646).
 *
 * His word, 2026-10-01, on N2's completion card: *"i mean this could be a card
 * on my desk if it tell me exactly what to drive and test but it didnt??"* —
 * and on the two-part proposal, *"yes."* #1644 carried a seven-step drive in its
 * body, and his Desk draws a card as its title, one hold line and an answer box.
 * The body never rendered, so the one thing the card existed for was visible
 * only on GitHub.
 *
 * # THE DISAPPEARING-TECHNOLOGY GATE, ANSWERED (the law's three questions)
 *
 * 1. **What must he learn?** Nothing. Read the step; press one of two words.
 *    There is no third state, no severity, no category and no form.
 * 2. **What decision does it put in front of him, and has he a basis?** Exactly
 *    the one he came to make — did this match or not — and the basis is the
 *    screen he just looked at. Nothing else is asked.
 * 3. **Where does the technology show?** Nowhere. The card numbers every step
 *    of #1644's drive ends in (*"…instead of being refused (#1582, #1612)"*) are
 *    the crew's bookkeeping; `testDriveFromBody` lifts them out of the sentence
 *    and they are used only by the bug card he never sees. No engine name, no
 *    percentage, no flag, no step id in the chrome.
 *
 * # ⚠ IT IS NOT A HOLD AND MUST NEVER BECOME ONE
 *
 * The card's own clause: *"an unanswered drive is not a hold and never lands in
 * NEEDS YOU"*. A milestone he has not got round to driving is not a question
 * blocking the crew — N2 wrapped and P1 opened without it — and putting seven
 * rows in NEEDS YOU would bury the one card that genuinely wants his answer.
 * So this is its own section, drawn below the things that do want him, and the
 * empty state is ABSENT rather than reassuring: brief 07's rule (a section with
 * nothing to show disappears) applies here, unlike NEEDS YOU, because *"nothing
 * to test drive"* is not an answer to any question he has.
 *
 * # ⚠ A `did not match` IS A REPLY, AND THE BUG CARD IS CUT FROM IT BY HAND
 *
 * The card asks for the answer to **file a `bug` card**. Nothing in `server/`
 * writes to GitHub — the Desk's reads are unauthenticated-capable and every
 * write in this family is a script — so what happens is the honest half: the
 * answer is an ordinary Desk reply carrying the step, his note and what the step
 * proves, mirrored onto the completion card within a minute (#1539), and the
 * relay or the next shift cuts the card from that comment. `shared/crewTestDrive.ts`
 * carries the same statement beside the format, so neither half can claim the
 * other does it.
 */
import { useState } from "react";

import {
  CREW_TEST_DRIVE_WORD,
  testDriveAnswerBody,
  testDriveAnswers,
  testDriveCardId,
  type CrewTestDriveStep,
  type CrewTestDriveVerdict,
} from "../../../../../../shared/crewTestDrive";
import { cn } from "@/lib/utils";
import { Field, TableHead } from "@/foundation";
import type { CrewLiveTestDrive, CrewReplyView } from "./crewTypes";

export function CrewTestDrive({
  drives,
  replies,
  sending,
  onSend,
}: {
  drives: readonly CrewLiveTestDrive[];
  replies: readonly CrewReplyView[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  /* Brief 07's rule, and NEEDS YOU's exception does not apply (see the header). */
  if (drives.length === 0) return null;

  return (
    <section className="dp-crew__section" data-testid="crew-test-drive">
      <TableHead eyebrow="Test drive" />
      <div className="dp-crew__stack">
        {drives.map((drive) => (
          <DriveCard
            key={drive.issueNumber}
            drive={drive}
            replies={replies}
            sending={sending}
            onSend={onSend}
          />
        ))}
      </div>
    </section>
  );
}

function DriveCard({
  drive,
  replies,
  sending,
  onSend,
}: {
  drive: CrewLiveTestDrive;
  replies: readonly CrewReplyView[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  const answers = testDriveAnswers(drive.issueNumber, replies);
  const done = drive.steps.filter((step) => answers.has(step.n)).length;
  const all = drive.steps.length;

  return (
    <article className="dp-crew__card" id={`crew-drive-${drive.issueNumber}`}>
      <div className="dp-crew__cardhead">
        {/* The rung is HIS vocabulary for the milestone — "N2" is what he types
            and what the ladder beside it is labelled. A card with no rung label
            says nothing rather than inventing one. */}
        <h3 className="dp-crew__title">
          {drive.rung === null ? "Your test drive" : `Your test drive · ${drive.rung}`}
        </h3>
        <span className="dp-chrome dp-crew__ref">
          {done === all ? "all done" : `${done} of ${all} answered`}
        </span>
      </div>

      <p className="dp-crew__body dp-crew__body--soft dp-crew__gap">
        {drive.title}
      </p>

      {/* A closed card still takes his answers — the reply is keyed on the card
          number, not on its state — and he should not have to wonder why a
          finished-looking list is still asking. */}
      {drive.cardClosed && (
        <p className="dp-crew__body dp-crew__body--quiet dp-crew__gap--tight">
          This one is already written up. Answering still reaches the crew.
        </p>
      )}

      <ol className="dp-crew__drive">
        {drive.steps.map((step) => (
          <DriveStep
            key={step.n}
            cardId={testDriveCardId(drive.issueNumber)}
            step={step}
            answered={answers.get(step.n) ?? null}
            sending={sending}
            onSend={onSend}
          />
        ))}
      </ol>
    </article>
  );
}

function DriveStep({
  cardId,
  step,
  answered,
  sending,
  onSend,
}: {
  cardId: string;
  step: CrewTestDriveStep;
  answered: { verdict: CrewTestDriveVerdict; note: string | null } | null;
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  /* The note box opens only on the press, so the resting state of a step is the
     sentence and two words — nothing to fill in, nothing to dismiss. */
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

  async function answer(verdict: CrewTestDriveVerdict, body: string | null) {
    try {
      await onSend({ cardId, body: testDriveAnswerBody({ step: step.n, verdict, note: body }) });
      setNoting(false);
      setNote("");
    } catch {
      /* The page raises the toast; what he typed stays where he can see it. */
    }
  }

  return (
    <li className="dp-crew__drivestep">
      <p className="dp-crew__body">{step.text}</p>

      {answered !== null && (
        <p className="dp-crew__taken">
          You said it {CREW_TEST_DRIVE_WORD[answered.verdict]}
          {answered.note !== null && <> — “{answered.note}”</>}
        </p>
      )}

      <div className="dp-crew__drivearms">
        {/* TWO WORDS, and the answered one carries the mark. A pressed step is
            still pressable: he drives a milestone over days and may find on
            Tuesday that Monday's "matched" did not (`testDriveAnswers` keeps the
            newest reply per step for exactly this). */}
        <button
          type="button"
          className={cn("dp-crew__tap", answered?.verdict === "matched" && "dp-crew__tap--marked")}
          disabled={sending}
          onClick={() => void answer("matched", null)}
        >
          Matched
        </button>
        <button
          type="button"
          className={cn("dp-crew__tap", answered?.verdict === "did-not-match" && "dp-crew__tap--marked")}
          disabled={sending}
          onClick={() => setNoting(true)}
        >
          Did not match
        </button>
      </div>

      {noting && (
        <div className="dp-crew__drivenote">
          {/* The reply box's own field and input, so the note he types here
              looks and paints exactly like the one under a needs-you card —
              `.dp-crew__replyinput` is borderless by design and gets its box
              from `Field` (see `CrewReplyBox`: a box forced white would be the
              only white rectangle on a dark page). */}
          <Field className="dp-crew__replyfield">
            <textarea
              value={note}
              autoFocus
              rows={2}
              placeholder="What happened instead? (optional)"
              className="dp-crew__replyinput"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void answer("did-not-match", note.trim() === "" ? null : note.trim());
                }
              }}
            />
          </Field>
          <div className="dp-crew__drivearms">
            <button
              type="button"
              className="dp-crew__tap dp-crew__tap--marked"
              disabled={sending}
              onClick={() => void answer("did-not-match", note.trim() === "" ? null : note.trim())}
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              className="dp-crew__tap"
              disabled={sending}
              onClick={() => { setNoting(false); setNote(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
