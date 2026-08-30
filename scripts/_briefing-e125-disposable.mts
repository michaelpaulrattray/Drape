/**
 * Briefing edition 125 — foreman-114, third and last edition of the shift.
 *
 * Two more replies (#37, #38) landed after edition 124 deployed. #37 confirms
 * the N3 handling that edition already shipped. #38 is a full build brief with
 * an exact sentence and an exact acceptance test, and it is FILED rather than
 * worked — his own reply grants that pause.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 125;
b.shift = "foreman-114";
b.updatedAt = "2026-08-30T12:05:00+10:00";

const NEW_REPLIES = [37, 38];

const creature = b.needsYou.find((x: { id: string }) => x.id === "creature-widening-243");
if (!creature) throw new Error("the creature-widening card is gone from needsYou — refusing to write an edition that drops it");
creature.state = "answered";
creature.title = "The species rule - your sentence is written down and the four checks are set up for the next shift";
creature.productImpact =
  "Your instruction is on the card word for word, and it is specific enough to build from without asking you anything else, which is why nothing was guessed at tonight.\n\n"
  + "The sentence going into the house block is yours: \"Show anatomy the species implies, even when the brief doesn't name the part. People lane unchanged: mouth closed, no teeth, no tongue.\" The four checks are anglerfish, lamia, sphinx, goth woman. Your two rollback conditions are written down as two separate tests rather than one score, because they protect different things - if the goth grows fangs the sentence goes back, and if the lamia loses her coils the sentence was wrong. One arm guards people, the other guards creatures, and collapsing them into a single pass/fail would hide whichever one failed.\n\n"
  + "Also written down: you forbade tightening it to \"only anatomy the user typed\", in your words, because it would turn a lamia into a woman in a dress.\n\n"
  + "Not started tonight. It changes the house block, which goes into EVERY cast on the author road, and it comes with four paid renders - so it is a whole shift's work rather than the tail of one, and your own line gave the pause: \"Leave the live behaviour tonight if you need a measured prompt change.\" The live behaviour is untouched.\n\n"
  + "One more thing recorded, because you have now said it three times in three replies: don't trust the pixel tool, the pictures are the result. That is written into the brief as the method - the four checks get judged by eye, and a number can sit beside a verdict but can never be one. You are also right about the specific instrument. The thing that counted horns as tusks is the same reader you ruled to N3 twenty minutes earlier.";
creature.workedExample = null;
creature.options = [];
creature.recommendation = null;

b.journal.unshift({
  at: "2026-08-30T12:05:00+10:00",
  shift: "foreman-114",
  text:
    "Last note - two more from you after the previous one went out.\n\n"
    + "On the lookalike reader: yes, exactly as you said, and it was already done before your message arrived - the note is in the plan at N3 with the measurements and the list of places it actually affects.\n\n"
    + "On the species rule: your sentence and your four checks are written down on the card word for word, and nothing has been started. That is deliberate. It changes the house block, which goes into every cast on the author road, and it needs four paid renders to check - so it is a whole shift rather than the last twenty minutes of one, and your own line gave the pause. The live behaviour is untouched tonight, as you asked.\n\n"
    + "I have set your two rollback conditions up as two separate tests rather than one score, because they guard different things: the goth growing fangs condemns the sentence, and the lamia losing her coils condemns it too, but for the opposite reason. Rolled into one verdict you would not be able to see which happened.\n\n"
    + "And you have now told us three times in three replies not to trust the pixel tool. It is written into the brief as the method rather than as a note - the four checks get judged by eye. You are right about that instrument specifically, which is the part I would not have wanted you to have to say twice: the thing that counted horns as tusks is the same reader you ruled to N3 half an hour earlier.",
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
