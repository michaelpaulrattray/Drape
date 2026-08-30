/**
 * Briefing edition 126 — foreman-114, fourth and final edition of the shift.
 *
 * Replies #39 (the reader court) and #40 (the hero) landed after edition 125
 * deployed. He worked through his whole desk tonight: ten replies in half an
 * hour, across six cards. All ten are recorded against their issues.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 126;
b.shift = "foreman-114";
b.updatedAt = "2026-08-30T12:35:00+10:00";

const NEW_REPLIES = [39, 40];

const find = (id: string) => {
  const hit = b.needsYou.find((x: { id: string }) => x.id === id);
  if (!hit) throw new Error(`briefing item "${id}" is gone — refusing to write an edition that silently drops it`);
  return hit;
};

const court = find("reader-rules-court-231");
court.state = "answered";
court.title = "The reader court - Sonnet stays, and you voided the score for the right reason";
court.productImpact =
  "You threw out my court's verdict and you were right to, on a point I should have caught before showing it to you: the Grok arm was dying at 45 seconds, and a model that never answered has not refused anything. Scoring those cells as refusals turned a slow reader into a bad one. Your sentence for it - \"that is not a reader score\" - is now written on the card.\n\n"
  + "So: Sonnet stays in production, nothing swaps, and the re-run is a bench only. Same pictures, same spec, same 300-character cap, and the result reported as completed pairs with a time-to-finish beside each - not a win rate, because a win rate over a population that includes non-answers repeats the same mistake in different arithmetic.\n\n"
  + "You also split the question in two, which the first court had muddled: the bench answers whether Grok is BETTER, and it does not answer whether we swap. If it is better and slow, that is an infrastructure problem. If it is better and around ten seconds, that is a conversation. And you attached a real product bound to it - no 90-second spinner on upload-a-concept, which is a screen a customer sits and waits at.\n\n"
  + "Your five scoring rules are on the card in your words. The character cap stays.\n\n"
  + "One thing in that reply is bigger than this court and is recorded as its own rule, because it decides what any description may contain rather than how to score one: props are not in this studio - a tail is anatomy so write it, a staff is a prop so omit it, and if you cannot tell what the band behind the shoulder is, write neither. That last clause is the valuable one. It says an unclear thing is left out rather than guessed at, which is the opposite of what the reader you ruled to N3 does.";
court.workedExample = null;
court.options = [];
court.recommendation = null;

const hero = find("hero-showcase-240");
hero.state = "done";
hero.title = "The casting hero - you passed it";
hero.productImpact =
  "\"Hero showcase is working great.\" Accepted and closed.\n\n"
  + "One piece of it is still open on its own card so it does not disappear behind a green light: the spec toggle and the locked-traits pill from your hero spec, which are waiting on the panel they open to exist.";
hero.workedExample = null;
hero.options = [];
hero.recommendation = null;

/* His verdict was ON the strips, so the eye item closes with the card it points
   at. The #133 guard catches this exactly — an open eye item beside an answered
   card is a picture still asking a question that has been answered. */
const strips = b.eyeItems.find((x: { id: string }) => x.id === "hero-showcase-240-strips");
if (!strips) throw new Error("the hero eye item is gone — refusing to write an edition that drops it");
strips.state = "answered";

b.journal.unshift({
  at: "2026-08-30T12:35:00+10:00",
  shift: "foreman-114",
  text:
    "You cleared your whole desk tonight - ten replies in about half an hour, across six cards. Every one of them is now written against its issue in your own words, so none of it lives only in a message. Nothing new was built after the first piece of work; the rest of the shift was making sure your answers landed somewhere they survive.\n\n"
    + "On the reader court: you were right and I was wrong, and the mistake is worth naming because it is a specific one rather than bad luck. The Grok arm was timing out at 45 seconds, and I let those cells count as refusals - so a slow reader got scored as a bad one, and my write-up said Grok refused the creature when Grok never answered at all. Sonnet stays, nothing swaps, and the re-run is a bench with completed pairs and a time beside each.\n\n"
    + "The rule you slipped into that reply is the part I would flag as bigger than the court it arrived in: props are not in this studio, a tail is anatomy so write it, a staff is a prop so omit it, and if you cannot tell what a thing is, write neither. That last clause is the opposite of what our region reader does - it never writes neither, it always draws something - which is the fault you ruled to N3 twenty minutes earlier. Two answers of yours pointing the same way in the same half hour.\n\n"
    + "The hero is marked done on your word. The spec toggle stays open on its own card so it does not vanish behind the green tick.\n\n"
    + "Nothing else was started tonight. The species-rule sentence, the bug-report reader, the MAX author fixes and the Grok bench are four separate shifts' work and they are all specified now, so the next shifts can pick them up without asking you anything.",
});

const JOURNAL_CAP = 40;
if (b.journal.length > JOURNAL_CAP) {
  const dropped = b.journal.slice(JOURNAL_CAP);
  if (dropped.some((e: { shift: string }) => e.shift === "foreman-114")) {
    throw new Error("the trim would drop this shift's own entry — refusing");
  }
  b.journal = b.journal.slice(0, JOURNAL_CAP);
}

const before = b.acknowledgedReplyIds.length;
b.acknowledgedReplyIds = [...new Set([...b.acknowledgedReplyIds, ...NEW_REPLIES])].sort((x: number, y: number) => x - y);
if (b.acknowledgedReplyIds.length !== before + NEW_REPLIES.length) {
  throw new Error(`acknowledgement count moved by ${b.acknowledgedReplyIds.length - before}, expected ${NEW_REPLIES.length}`);
}

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
console.log(`edition ${b.edition} · acknowledged ${b.acknowledgedReplyIds.length} (+${NEW_REPLIES.length}) · journal ${b.journal.length}`);

/* Exit discipline (#249). */
process.exit(0);
