/**
 * BACKGROUND WORK — his switch, so an idle night is his choice (issue #277).
 *
 * Founder-ordered 2026-08-30:
 *
 *   *"if the shifts have nothing to work on … it should have a toggle on the
 *    crew page showing bug fixes etc that can run outside of the main work so
 *    if i go to sleep i can toggle it on and the shifts will go ahead with bug
 *    fixes an stuff when waiting on me to make decision on the main stuff"*
 *
 * ⚠ **ITS ADJACENCY WAS BROKEN BY HIS ORDER (#437, 2026-09-02), and the reason
 * is kept rather than deleted.** It sat directly under **Working now** (#272)
 * because the two answer one question: *what is happening while I am not
 * looking.* **NEXT UP** now sits between them, on his instruction — *"moving
 * the next up card in the crew tab under working now"*. The reasoning was
 * sound; it lost to his.
 *
 * # IT INVERTS TODAY'S DEFAULT, WHICH IS THE POINT
 *
 * Maintenance mode is currently what a shift falls into on its own judgement
 * when no focus is confirmed. This makes background work OPT-IN and the switch
 * his — stricter than what we have, and it guards a failure he named himself:
 * *"we need to ensure if they are waiting a long time for me they dont
 * completly over engineer security or anything because they are bored."*
 *
 * # ⚠ A CATEGORY WITH NOTHING IN IT SHOWS ZERO AND STAYS SWITCHABLE
 *
 * His bar, in his words: *"it must not vanish, or he cannot tell 'nothing to
 * do' from 'not offered'."* So every category is drawn always, and `Bugs (0)`
 * is a real answer rather than an absence.
 *
 * # ⚠ AND THE COUNT NAMES ITS CARDS (#285)
 *
 * Founder, at this panel: *"am i suppose to see a list under these
 * categories?"* — then *"file it"*. Up to five titles, most recent first, with
 * a `+N more` for the tail. His reason is the one that matters: **a count asks
 * him to trust the queue, and the queue is precisely what the freshness pass
 * found rotting.** `Bugs (10)` says there is a night's work and nothing about
 * whether it is work he wants; the titles turn the switch from *trust the
 * number* into *see what you are authorising*.
 *
 * They are DRAWN AS TEXT, never as links or markdown: they are data written by
 * whoever filed the card, and his card permits a link only *"if it is free"* —
 * a link needs an owner/repo string hard-coded here, which is a second list.
 *
 * ⚠ **A CATEGORY WITH A COUNT AND NO TITLES DRAWS NO `+N more`.** Between this
 * shipping and his ceremony the column does not exist, so every row has a real
 * count and zero titles; subtracting blindly would promise a list that is not
 * there. `queueTitlesView` owns that rule and is tested directly.
 *
 * # ⚠ AND THE COUNT IS WHAT IS ON OFFER, WITH WHAT IT LEFT OUT BESIDE IT (#324)
 *
 * Founder, at this panel: *"how do we know they are not already scheduled to be
 * fixed in current pipeline or work?"* Measured: **two of the thirteen bugs
 * were `#320` and `#316`, both `founder-ordered` and both already in NEXT UP** —
 * the same card offered to him twice, once as work he had queued and again as
 * background work a shift may take on its own judgement.
 *
 * So the number is now the OFFERED population, and the reasons ride inside the
 * same parenthesis: `Bugs (11, 2 already queued)`. **The clause is the whole
 * fix, not the subtraction** — his card's own sentence is that *a count that
 * silently shrinks for an invisible reason is the confident-wrong-number
 * failure this panel already exists to avoid.* A category that excluded nothing
 * draws no clause and looks exactly as it does today.
 *
 * # ⚠ THE COUNT SAYS HOW OLD IT IS, RATHER THAN IMPLYING AN INSTANT
 *
 * The categories are derived from the queue's own labels, so a card relabelled
 * in GitHub moves category here with nobody touching this file. The COUNT is a
 * derived cache written by a shift — a live one would need the server to hold a
 * GitHub token, which is his decision rather than a shift's (migration 0056's
 * header). So the age is printed. A number without its age is the confident
 * wrong number this whole card is about.
 *
 * # ⚠ BRIEF 08 NEVER SAW THIS COMPONENT — AND IT IS THE BIGGEST FILE HERE
 *
 * #277/#285/#324/#325 all landed after the mockup was drawn, so §6 does not
 * list it; it held 49 of the directory's 199 colour literals, more than any
 * other file. It is restyled to the same grammar under §8's bar, and no
 * behaviour is touched: the switch is still a real `<button role="switch">`,
 * every count keeps its age and its exclusion clause, and the *Not relevant*
 * tap keeps the sentence that replaces it.
 */
import { useState } from "react";

import {
  CREW_PIPELINE_GROUPS,
  CREW_PIPELINE_ORPHAN_GROUPS,
} from "@shared/crewPipelineGroups";
import {
  indexIntentsByCard,
  type CrewCardIntentView,
} from "@shared/crewCardIntents";
import { queueExclusionSentence } from "@shared/crewQueueExclusions";
import { queueTitlesView } from "@shared/crewQueueTitles";
import { CardTitles } from "./CrewCardTitles";
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  backgroundWorkAllowed,
} from "@shared/crewWorkSwitches";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import type { CrewCardIntentsView, CrewWorkStateView } from "./crewTypes";

/** "counted 14 min ago" — coarse, like everything else on this page. */
function ago(value: Date | string, now: number): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * The switch itself.
 *
 * A real `<button role="switch">` with `aria-checked` rather than a styled
 * `div`: this is the one control on this panel and it must be reachable by
 * keyboard like the reply boxes beside it.
 *
 * ⚠ Its focus ring is the shell's blanket `.dp-root :focus-visible` rule now,
 * not a hand-written outline colour. That was the last hex on this control and
 * it was the one that mattered least in light mode and most in dark.
 */
function Switch({
  checked, disabled, onChange, label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("dp-crew__switch", checked && "dp-crew__switch--on")}
    >
      <span aria-hidden className="dp-crew__knob" />
    </button>
  );
}

export function CrewBackgroundWork({
  workState, cardIntents, now, onToggle, onIntent, pending, intentPendingCard,
}: {
  workState: CrewWorkStateView;
  cardIntents: CrewCardIntentsView;
  now: number;
  onToggle: (switchKey: string, enabled: boolean) => void;
  onIntent: (issueNumber: number, intent: "close" | null) => void;
  pending: boolean;
  /** Which card's tap is mid-flight, so only that button dims (#325). */
  intentPendingCard: number | null;
}) {
  /* Which switch is mid-flight, so only that row dims rather than the panel. */
  const [flying, setFlying] = useState<string | null>(null);

  /*
    ⚠ `available: false` ON THE INTENTS IS NOT AN EMPTY LIST, AND THE DIFFERENCE
    IS DRAWN. Between this deploy and his ceremony the table is absent, so an
    empty map is what BOTH "he has tapped nothing" and "the tap is not live yet"
    would look like. The buttons are withheld in that window rather than drawn
    over a store that cannot record them — a control that silently forgets is
    worse than one that is not there.
  */
  const intentsByCard = indexIntentsByCard(cardIntents.intents);
  const intentsLive = cardIntents.available;

  /*
    THE DARK PANEL SAYS SO. `available: false` means the tables are not in this
    database yet. Drawing six switches that all read off would be a confident
    answer from an instrument that cannot see — and worse here than on the
    status strip, because he would believe he had turned something on.
  */
  if (!workState.available) {
    return (
      <section className="dp-crew__card">
        <TableHead eyebrow="Background work" />
        <p className="dp-crew__mission dp-crew__body--soft dp-crew__gap">Not live yet.</p>
        <p className="dp-crew__body dp-crew__body--quiet dp-crew__gap--tight">
          The switches need their tables in this database — one command, and it is yours to run:
        </p>
        <p className="dp-crew__command dp-crew__gap--tight">
          railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-work-switches.mts
          --production
        </p>
      </section>
    );
  }

  const master = workState.switches[CREW_WORK_MASTER_KEY] ?? false;
  const countOf = (key: string) => workState.counts.find((row) => row.categoryKey === key);

  const handle = (key: string, next: boolean) => {
    setFlying(key);
    onToggle(key, next);
  };

  return (
    <section className="dp-crew__card">
      <TableHead eyebrow="Background work" />

      <div className="dp-crew__switchrow dp-crew__gap">
        <div className="dp-crew__min">
          <p className="dp-crew__mission">
            {master ? "On" : "Off"}
            <span className="dp-crew__body--quiet">
              {workState.changedAt ? ` · changed ${ago(workState.changedAt, now)}` : ""}
            </span>
          </p>
        </div>
        <Switch
          checked={master}
          disabled={pending && flying === CREW_WORK_MASTER_KEY}
          onChange={(next) => handle(CREW_WORK_MASTER_KEY, next)}
          label="Background work, all categories"
        />
      </div>

      <p className="dp-crew__conseq dp-crew__gap--tight">
        {master
          ? "With no focus confirmed and no side lane named, shifts may work the categories switched on below."
          : "With no focus confirmed and no side lane named, shifts stop and write why they are idle."}
      </p>

      <ul className="dp-crew__cats dp-crew__gap">
        {CREW_WORK_CATEGORIES.map((category) => {
          const own = workState.switches[category.key] ?? false;
          const live = backgroundWorkAllowed(workState.switches, category.key);
          const count = countOf(category.key);
          const titles = queueTitlesView(count?.openCount ?? 0, count?.titles ?? []);
          /* WHAT THE NUMBER LEFT OUT (#324) — `null` for the ordinary row, so
             `Process (12)` looks exactly as it does today. */
          const excluded = queueExclusionSentence(count?.excluded ?? {});
          return (
            <li key={category.key} className="dp-crew__switchrow">
              <div className="dp-crew__min">
                <p className={cn("dp-crew__catname", !live && "dp-crew__catname--off")}>
                  {category.label}
                  {/* ZERO IS A REAL ANSWER AND IS DRAWN. A category with nothing
                      in it must not vanish, or he cannot tell "nothing to do"
                      from "not offered" — his own sentence.

                      ⚠ AND THE EXCLUSION IS DRAWN INSIDE THE SAME PARENTHESIS
                      (#324), never as a second line: the number and the reason
                      it is smaller than the label's population are ONE fact, and
                      a count that shrinks with its reason a paragraph away is
                      the confident-wrong-number failure this panel exists to
                      prevent. `Bugs (11, 2 already queued)`. */}
                  <span className="dp-crew__count">
                    {" "}({count ? count.openCount : "—"}{excluded ? `, ${excluded}` : ""})
                  </span>
                </p>
                <p className="dp-crew__blurb">
                  {category.blurb}
                  {count && <> · counted {ago(count.countedAt, now)}</>}
                  {!count && <> · not counted yet</>}
                </p>
                {/*
                  WHAT THE NUMBER IS ABOUT (#285). Up to five, most recent
                  first, one line each — his card: *"Truncate on width, never
                  wrap to three lines. A long card title is normal here."* The
                  rule truncates rather than wrapping, so a switch panel stays a
                  switch panel however long a title gets.

                  The ellipsis needs every ancestor to allow shrinking; the
                  `div` above carries `min-width: 0` for exactly that reason and
                  the `li` is the flex parent it shrinks inside.
                */}
                {titles.shown.length > 0 && (
                  <ul className="dp-crew__titles">
                    <CardTitles
                      titles={titles.shown}
                      intents={intentsByCard}
                      onIntent={intentsLive ? onIntent : null}
                      pendingCard={intentPendingCard}
                    />
                    {/* The tail, never a scroll — and never drawn without a head
                        above it to be the tail OF (`queueTitlesView`). */}
                    {titles.moreCount > 0 && (
                      <li className="dp-crew__blurb">+{titles.moreCount} more</li>
                    )}
                  </ul>
                )}
              </div>
              <Switch
                checked={own}
                disabled={pending && flying === category.key}
                onChange={(next) => handle(category.key, next)}
                label={`Background work — ${category.label}`}
              />
            </li>
          );
        })}
      </ul>

      {/* The master's meaning, said once rather than repeated per row. A row can
          be on while the master is off; it simply does not run. */}
      {!master && Object.entries(workState.switches).some(([key, on]) => on && key !== CREW_WORK_MASTER_KEY) && (
        <p className="dp-crew__foot">
          Some categories are switched on but nothing runs while the master is off.
        </p>
      )}

      <PipelineGroups
        workState={workState}
        now={now}
        intentsByCard={intentsByCard}
        onIntent={intentsLive ? onIntent : null}
        intentPendingCard={intentPendingCard}
      />
    </section>
  );
}

/**
 * ZONE 2 — NOT ON ANY ROAD (#325's block, reshaped by #493).
 *
 * Founder, 2026-09-04, verbatim: *"the issue i have with the pipeline is its
 * doubling up for exable i can already see my next up so why do i need to see
 * qued by me again in the pipeline also some thing exist under the main
 * feature plan like n1 or n2 or n3 etc i shouldnt see to see these in the
 * pipeline if they are already under the main program card righ?"*
 *
 * He was right. This block used to draw all twelve groups, so "Queued by you"
 * repeated NEXT UP and roadmap/parked/design-unbuilt repeated the ladder the
 * Program card draws. **The one rule now: every open card appears in exactly
 * ONE section — the one that says what it is waiting on.** This block draws
 * only the groups homed HERE (`CREW_PIPELINE_ORPHAN_GROUPS`) — the cards on no
 * road at all — and everything homed elsewhere appears as one quiet line of
 * counts, so the arithmetic he asked for in #325 ("all 97") is still on the
 * page without a single card being listed twice.
 *
 * # ⚠ VISIBLE, AND NEVER SWITCHABLE — the distinction is still the whole design
 *
 * There is no `<Switch>` in this component and there must never be one. What
 * each group buys him is the SENTENCE under the count saying why nobody will
 * act without his word.
 *
 * # ⚠ THE EMPTY STATE IS AN ANSWER, NOT AN ABSENCE
 *
 * When every orphan group is at zero the block says *"Every open card is on a
 * road"* — his card's own sentence — with the count's age beside it, because a
 * reassuring sentence without its age is the confident wrong number this panel
 * exists to prevent. The rows themselves are not drawn at zero-everything; his
 * card says "and nothing else", and the sentence IS the real answer.
 */
function PipelineGroups({
  workState, now, intentsByCard, onIntent, intentPendingCard,
}: {
  workState: CrewWorkStateView;
  now: number;
  intentsByCard: ReadonlyMap<number, CrewCardIntentView>;
  onIntent: ((issueNumber: number, intent: "close" | null) => void) | null;
  intentPendingCard: number | null;
}) {
  const byKey = new Map(workState.groups.map((row) => [row.groupKey, row]));

  /*
    ⚠ NOTHING COUNTED YET SAYS SO, RATHER THAN DRAWING ZEROS. Between this
    deploy and the next shift's count there are no rows, and "every card is on
    a road" is the most reassuring and most wrong sentence this block could
    print — the same rule `countedAt` exists for one section up.
  */
  if (workState.groups.length === 0) {
    return (
      <div className="dp-crew__rule dp-crew__rule--tight">
        <h3 className="dp-crew__subhead">Not on any road</h3>
        <p className="dp-crew__blurb dp-crew__gap--tight">
          Not counted yet — the next shift fills this in when it starts.
        </p>
      </div>
    );
  }

  /* Every group, including the elsewhere-homed ones — the real total (#325). */
  const total = workState.groups.reduce((sum, row) => sum + row.openCount, 0);
  const orphanTotal = CREW_PIPELINE_ORPHAN_GROUPS.reduce(
    (sum, group) => sum + (byKey.get(group.key)?.openCount ?? 0),
    0,
  );
  /* ONE quiet line for everything that lives elsewhere (#493): each phrase is
     the group's own `elsewhere` word, so the line is derived from the same
     vocabulary that homes the cards — never a second list. Zero-count entries
     are omitted here (the sections themselves are the zero answer). */
  const homeRank: Record<string, number> = { switches: 0, "next-up": 1, ladder: 2 };
  const elsewhere = CREW_PIPELINE_GROUPS
    .filter((group) => group.elsewhere !== null)
    .map((group) => ({ group, count: byKey.get(group.key)?.openCount ?? 0 }))
    .filter((entry) => entry.count > 0)
    /* Section order down the page, then biggest first — his card's own example
       reads "on the ladder · parked · unbuilt designs", the annexes after the
       road they sit beside. */
    .sort((a, b) =>
      (homeRank[a.group.home] ?? 9) - (homeRank[b.group.home] ?? 9) || b.count - a.count)
    .map((entry) => `${entry.count} ${entry.group.elsewhere}`)
    .join(" · ");
  /* One age for the section: the groups are written in one pass, so they share
     a `countedAt` by construction. The oldest is taken rather than the first,
     so a row left standing by a skipped count cannot make the section look
     fresher than it is. */
  const oldest = workState.groups.reduce<Date | string | null>((worst, row) => {
    if (worst === null) return row.countedAt;
    const a = worst instanceof Date ? worst.getTime() : new Date(worst).getTime();
    const b = row.countedAt instanceof Date ? row.countedAt.getTime() : new Date(row.countedAt).getTime();
    return b < a ? row.countedAt : worst;
  }, null);
  const stamp = oldest ? ` · counted ${ago(oldest, now)}` : "";

  /* HIS CARD'S OWN EMPTY STATE: every open card has a home. The sentence and
     its age, and nothing else — the elsewhere sections are their own answer. */
  if (orphanTotal === 0) {
    return (
      <div className="dp-crew__rule dp-crew__rule--tight" data-testid="crew-orphans-empty">
        <h3 className="dp-crew__subhead">Not on any road</h3>
        <p className="dp-crew__catname dp-crew__gap--tight">
          Every open card is on a road
          <span className="dp-crew__count">{stamp}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="dp-crew__rule dp-crew__rule--tight">
      <h3 className="dp-crew__subhead">Not on any road</h3>
      <p className="dp-crew__catname dp-crew__gap--tight">
        {orphanTotal} of {total} open
        <span className="dp-crew__count">{stamp}</span>
      </p>
      <p className="dp-crew__conseq dp-crew__gap--tight">
        {/* His card's own reason there are no switches here. */}
        No switch offers these and no rung waits on them — each line says why, and nothing
        moves without your word.
      </p>

      <ul className="dp-crew__cats dp-crew__gap">
        {CREW_PIPELINE_ORPHAN_GROUPS.map((group) => {
          const row = byKey.get(group.key);
          const titles = queueTitlesView(row?.openCount ?? 0, row?.titles ?? []);
          return (
            <li key={group.key} className="dp-crew__min">
              <p className="dp-crew__catname">
                {group.label}
                {/* ZERO IS DRAWN, for the switch rows' reason: `Blocked (0)` is a
                    real answer, and a group that vanished when it emptied would
                    make "nothing there" and "not shown" identical. */}
                <span className="dp-crew__count"> ({row ? row.openCount : "—"})</span>
              </p>
              <p className="dp-crew__blurb">{group.blurb}</p>
              {titles.shown.length > 0 && (
                <ul className="dp-crew__titles">
                  <CardTitles
                    titles={titles.shown}
                    intents={intentsByCard}
                    onIntent={onIntent}
                    pendingCard={intentPendingCard}
                  />
                  {titles.moreCount > 0 && (
                    <li className="dp-crew__blurb">+{titles.moreCount} more</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* The quiet line (#493): where everything else lives, in one sentence. */}
      {elsewhere && (
        <p className="dp-crew__foot" data-testid="crew-elsewhere-line">
          Everything else has a home: {elsewhere}.
        </p>
      )}
    </div>
  );
}
