/** Briefing edition 127 — foreman-114, final edition. Reply #41 (the Fable cap). */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 127;
b.shift = "foreman-114";
b.updatedAt = "2026-08-30T12:55:00+10:00";

const cap = b.needsYou.find((x: { id: string }) => x.id === "fable-cap-review-arm-219");
if (!cap) throw new Error("the Fable cap card is gone — refusing to write an edition that drops it");
cap.state = "answered";
cap.title = "The Fable cap - you said do nothing, and that closes it";
cap.productImpact =
  "\"Do nothing - fable credits reset in 3 days.\" Understood, and it stops three shifts' worth of investigating something that fixes itself around the 2nd.\n\n"
  + "Worth being straight about: we measured this three separate ways on three nights, each time correctly, and none of it was needed. It was a billing date. I have written on the card that nobody should measure it a fourth time.\n\n"
  + "What it means meanwhile, so nobody misreads a red tick: the review check on our pull requests will be red or missing until the reset, and neither means anything was rejected - red means no review was produced at all. The rest of the gate is unaffected and still blocks bad merges, so nothing ships unchecked.\n\n"
  + "Your second sentence is taken as standing instruction rather than background: side-lane tasks run on Opus until the credits come back. That does not name lobby segment one, so the lobby lane is still waiting on you for that - it is the only thing on your desk tonight that nobody can start without you.";
cap.workedExample = null;
cap.options = [];
cap.recommendation = null;

b.journal.unshift({
  at: "2026-08-30T12:55:00+10:00",
  shift: "foreman-114",
  text:
    "Last one, and then I am done for the night.\n\n"
    + "The Fable cap: understood, doing nothing, and I have written on the card that nobody should measure it again. Three of us investigated it on three nights and every reading was right and none of it was needed - it was a date. That is the kind of thing worth saying out loud so the next shift does not make it four.\n\n"
    + "Tonight in one line: your lookalike reader is ruled to N3 and the note is written with the measurements and the list of places it actually affects; your species sentence and its four checks are written down and deliberately not started; the reader court's verdict is void and Sonnet stays; the hero is done; the bug-report reader and the MAX author fixes are specified and waiting. Everything you said tonight is on its issue in your own words.\n\n"
    + "The one thing still sitting with you is lobby segment one. Nothing in that lane can start until you name it, and I have not touched it.",
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
b.acknowledgedReplyIds = [...new Set([...b.acknowledgedReplyIds, 41])].sort((x: number, y: number) => x - y);
if (b.acknowledgedReplyIds.length !== before + 1) throw new Error("acknowledgement did not move by exactly one");

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
console.log(`edition ${b.edition} · acknowledged ${b.acknowledgedReplyIds.length} · journal ${b.journal.length}`);

/* Exit discipline (#249). */
process.exit(0);
