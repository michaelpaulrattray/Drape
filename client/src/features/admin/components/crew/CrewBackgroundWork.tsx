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
 * It sits directly under **Working now** (#272) because the two answer one
 * question: *what is happening while I am not looking.*
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
 */
import { useState } from "react";

import { queueExclusionSentence } from "@shared/crewQueueExclusions";
import { queueTitlesView } from "@shared/crewQueueTitles";
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  backgroundWorkAllowed,
} from "@shared/crewWorkSwitches";
import { cn } from "@/lib/utils";
import type { CrewWorkStateView } from "./crewTypes";

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
      className={cn(
        "relative shrink-0 w-9 h-5 rounded-full border transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]",
        checked ? "bg-[#0A0A0A] border-[#0A0A0A]" : "bg-white border-[#D5D5D5]",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all",
          checked ? "left-[20px] bg-white" : "left-[2px] bg-[#999]",
        )}
      />
    </button>
  );
}

export function CrewBackgroundWork({
  workState, now, onToggle, pending,
}: {
  workState: CrewWorkStateView;
  now: number;
  onToggle: (switchKey: string, enabled: boolean) => void;
  pending: boolean;
}) {
  /* Which switch is mid-flight, so only that row dims rather than the panel. */
  const [flying, setFlying] = useState<string | null>(null);

  /*
    THE DARK PANEL SAYS SO. `available: false` means the tables are not in this
    database yet. Drawing six switches that all read off would be a confident
    answer from an instrument that cannot see — and worse here than on the
    status strip, because he would believe he had turned something on.
  */
  if (!workState.available) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-2">Background work</h2>
        <p className="text-[14px] text-[#666]">Not live yet.</p>
        <p className="text-[12px] text-[#999] mt-1">
          The switches need their tables in this database — one command, and it is yours to run:
          {" "}
          <span className="font-mono text-[11px] text-[#666]">
            railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-work-switches.mts --production
          </span>
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
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-1">Background work</h2>
          <p className="text-[14px] text-[#0A0A0A]">
            {master ? "On" : "Off"}
            <span className="text-[#999]">
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

      <p className="text-[12px] leading-[1.55] text-[#666] mb-4">
        {master
          ? "With no focus confirmed and no side lane named, shifts may work the categories switched on below."
          : "With no focus confirmed and no side lane named, shifts stop and write why they are idle."}
      </p>

      <ul className="space-y-2.5">
        {CREW_WORK_CATEGORIES.map((category) => {
          const own = workState.switches[category.key] ?? false;
          const live = backgroundWorkAllowed(workState.switches, category.key);
          const count = countOf(category.key);
          const titles = queueTitlesView(count?.openCount ?? 0, count?.titles ?? []);
          /* WHAT THE NUMBER LEFT OUT (#324) — `null` for the ordinary row, so
             `Process (12)` looks exactly as it does today. */
          const excluded = queueExclusionSentence(count?.excluded ?? {});
          return (
            <li key={category.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={cn("text-[13px]", live ? "text-[#0A0A0A]" : "text-[#666]")}>
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
                  <span className="text-[#999]">
                    {" "}({count ? count.openCount : "—"}{excluded ? `, ${excluded}` : ""})
                  </span>
                </p>
                <p className="text-[11px] leading-[1.5] text-[#999]">
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

                  `truncate` needs every ancestor to allow shrinking; the `div`
                  above carries `min-w-0` for exactly that reason and the `li`
                  is the flex parent it shrinks inside.
                */}
                {titles.shown.length > 0 && (
                  <ul className="mt-1.5 ml-0.5 pl-2.5 border-l border-[#EEE] space-y-0.5">
                    {titles.shown.map((card) => (
                      <li
                        key={card.number}
                        className="text-[11px] leading-[1.5] text-[#666] truncate"
                        title={`#${card.number} ${card.title}`}
                      >
                        <span className="text-[#999] tabular-nums">#{card.number}</span>
                        {" "}
                        {card.title}
                      </li>
                    ))}
                    {/* The tail, never a scroll — and never drawn without a head
                        above it to be the tail OF (`queueTitlesView`). */}
                    {titles.moreCount > 0 && (
                      <li className="text-[11px] leading-[1.5] text-[#999]">+{titles.moreCount} more</li>
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
        <p className="text-[11px] text-[#999] mt-4 pt-3 border-t border-[#EEE]">
          Some categories are switched on but nothing runs while the master is off.
        </p>
      )}
    </section>
  );
}
