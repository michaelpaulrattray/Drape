/** Briefing edition 128 — foreman-114, final. Reply #42: he named lobby segment 1. */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";
const b = JSON.parse(readFileSync(PATH, "utf8"));

b.edition = 128;
b.shift = "foreman-114";
b.updatedAt = "2026-08-30T13:20:00+10:00";

const lobby = b.needsYou.find((x: { id: string }) => x.id === "lobby-segments-228");
if (!lobby) throw new Error("the lobby segments card is gone — refusing to write an edition that drops it");
lobby.state = "answered";
lobby.title = "The lobby lane - you named the starting point, and corrected what we were reading";
lobby.productImpact =
  "Answered, and the lane is unblocked. You did not pick from my six - you corrected the thing they were written against, which is more useful.\n\n"
  + "The stale prototype: taken. Your updated pack is the one being read from now on, and step one is the spec refresh with no code, checked against your own test - the rail should show eight items including Cinema.\n\n"
  + "The order: 00 then 00b, not Home, and your reason is on the card because it is the whole point - Home is a surface, surfaces are assembled from the nine components 00 adds, and building Home first means building those nine inline and pulling them out again later. 00's acceptance test being \"nothing looks different\" is a good test and it is written down as one.\n\n"
  + "The unbuilt-capability reversal is taken as the ruling it is. Unbuilt things get designed in and greyed out, following the stub pattern the rail already uses - so the prompt box ships with Image live and the other five visible, greyed, \"not built yet\" on hover, not clickable, and no unread dot. Your line \"a stub names a place, never a capability\" is the rule now. The old no-dead-links comment in the code is marked superseded so nobody quotes it back at a reviewer next month.\n\n"
  + "Library as a replacement rather than a reconciliation, Library vs Assets as settled, the Kept/All lens shipping without the 30-day rule behind it - all recorded, including your instruction that if the data cannot answer the split cleanly that is a migration job and not a question to hand back to you.\n\n"
  + "And the one that governs everything else: casting is the only really designed page, so it is the reference and not a subject, and where the briefs are silent the answer is whatever casting already does. Prefer replacing over adapting.\n\n"
  + "Nothing is built yet. Your reply came in at the very end of the shift, and it starts with a spec refresh - starting that with twenty minutes left is how somebody ends up building against a half-refreshed prototype. It is two PRs and then you look, exactly as you asked.\n\n"
  + "One thing I did do: the pack you pointed at was sitting on the machine untracked, not in the repository at all, with the tidy-up patrol due tomorrow. It is committed now, so the briefs cannot be swept and the path in your message resolves.";
lobby.workedExample = null;
lobby.options = [];
lobby.recommendation = null;

/* His verdict answers the picture too — the #133 guard catches an open eye
   item beside an answered card, which is a picture still asking a settled
   question. */
const before228 = b.eyeItems.find((x: { id: string }) => x.id === "lobby-before-228");
if (!before228) throw new Error("the lobby eye item is gone — refusing to write an edition that drops it");
before228.state = "answered";

b.journal.unshift({
  at: "2026-08-30T13:20:00+10:00",
  shift: "foreman-114",
  text:
    "You named the lobby starting point - 00 then 00b, then stop and show you. Taken exactly like that, and nothing is started, because your reply landed in the last minutes of the shift and its first step is a spec refresh. Beginning that half-done is the one way to waste both PRs.\n\n"
    + "The correction about the stale prototype is the useful part and it is now in the team's own instructions rather than only on the card, so the next shift reads your pack and not the old one. Your check - eight items in the rail including Cinema - is written down as the test for that step.\n\n"
    + "Your reversal on greyed-out features is recorded as a ruling that changes existing code, not just future design: there is a comment in the utility menu justifying the opposite, and it is marked superseded so nobody quotes it at a reviewer next month. The fix living next to it - the one that stopped the menu being unclickable behind the theme toggle - is flagged as NOT superseded, because obeying one half of that file while undoing the other is an easy mistake to make.\n\n"
    + "One thing I did without being asked, and I would rather tell you than not: the pack you linked was sitting on my machine untracked - not in the repository at all - and the tidy-up patrol is due tomorrow. I committed the five briefs so they cannot be swept and so your path resolves for whoever picks this up.",
});

const JOURNAL_CAP = 40;
if (b.journal.length > JOURNAL_CAP) {
  const dropped = b.journal.slice(JOURNAL_CAP);
  if (dropped.some((e: { shift: string }) => e.shift === "foreman-114")) throw new Error("the trim would drop this shift's own entry — refusing");
  b.journal = b.journal.slice(0, JOURNAL_CAP);
}

const before = b.acknowledgedReplyIds.length;
b.acknowledgedReplyIds = [...new Set([...b.acknowledgedReplyIds, 42])].sort((x: number, y: number) => x - y);
if (b.acknowledgedReplyIds.length !== before + 1) throw new Error("acknowledgement did not move by exactly one");

writeFileSync(PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
console.log(`edition ${b.edition} · acknowledged ${b.acknowledgedReplyIds.length} · journal ${b.journal.length}`);

/* Exit discipline (#249). */
process.exit(0);
