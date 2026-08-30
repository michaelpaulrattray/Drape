/**
 * Briefing edition 130 — foreman-115, second edition of the shift.
 *
 * Edition 129 left `lobby-segments-228` OPEN while carrying his answer, and
 * the state sweep was right to refuse it: **he answered that card's question**
 * (which segment is first), so leaving it open makes the desk ask him
 * something he has already decided — the exact failure edition 124 was written
 * to correct.
 *
 * The new ask is real but it is a DIFFERENT question, so it gets its own card:
 * the refreshed prototype files are not on this machine and only he can supply
 * them.
 *
 * Also: PR #259 merged (`0e59e990`), so its pipeline row moves to `merged`.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "server/crew/crew-briefing.json";

type BriefingItem = { id: string } & Record<string, unknown>;

const briefing = JSON.parse(readFileSync(PATH, "utf8")) as {
  edition: number;
  updatedAt: string;
  shift: string;
  needsYou: BriefingItem[];
  eyeItems: BriefingItem[];
  pipeline: BriefingItem[];
  journal: Record<string, unknown>[];
};

const find = (list: BriefingItem[], id: string): BriefingItem => {
  const hit = list.find((item) => item.id === id);
  if (!hit) throw new Error(`briefing item "${id}" is gone — refusing to write an edition that silently drops it`);
  return hit;
};

const FILED_AT = "2026-08-30T14:35:00+10:00";

briefing.edition = 130;
briefing.shift = "foreman-115";
briefing.updatedAt = FILED_AT;

/* HIS QUESTION IS ANSWERED — the card becomes the RECORD of it. */
const lane = find(briefing.needsYou, "lobby-segments-228");
lane.state = "answered";
lane.title = "Lobby segment 1 — you named it, it is built, and it is merged";
lane.productImpact =
  "SEGMENT 1 IS IN. `00 — foundation top-up` went in as one PR (#259) exactly as you set it, passed the gate and merged. It ships the nine parts that twelve of your surfaces all reuse: the media card, the actions that appear when you hover one, the bar at the top of a working surface, the staff table whose rows open in place instead of opening a dialog, the priced-choice block, the milestone rail, the transcript, the marquee, and the popover behaviour every dropdown in the redesign owes.\n\n"
  + "YOUR TEST HELD. \"No visible change\" was measured rather than promised: I photographed the four sections of the developer gallery that render every part the studio already had — buttons, inputs, chips, cards, media, the empty states — on the new code and on the live code, and compared them pixel by pixel. ZERO pixels differ, across all four.\n\n"
  + "THE HONEST PART OF THAT NUMBER, because it is the part worth your trust. The FIRST comparison said THREE of the four HAD changed, one of them by 29 per cent. Neither cause was the new code. One was the sticky bar at the bottom of that page painting itself into the screenshot — adding six sections made the page longer, so the bar landed over a different part of it. The other was the LIVE code's own photograph having a blank strip where its heading should be: the text had not finished painting when the camera fired. I cropped that strip and looked at it rather than reasoning about the number.\n\n"
  + "ONE THING THE BRIEF ASKS FOR THAT I DID NOT DO, because it collides with your own test. It says to delete the two colour-constant files in this same section. Nine screens in Admin and Moderation render those colours, so deleting them repaints the audit log, the activity tab and five dialogs — a visible change, which is the one thing this section may not make. The replacement shipped so the staff section can use it; the screens move when that section moves them. Filed as its own card so it cannot be forgotten.\n\n"
  + "NEXT IS 00b, AND THEN THE LANE STOPS FOR YOUR EYE — your instruction, unchanged.";
lane.workedExample =
  "Concretely, on the staff audit log once the staff section lands: today a `critical` row is a red-tinted badge, a `warning` is amber, an `info` is blue, and the category beside it is one of four more tints — seven colours across two screens. After: all three severities are plain greyscale outlines except `critical`, which wears the studio's one red, and what the entry is ABOUT is carried by the action text itself (`stripe.refund.manual`), which tells you more than a colour can. The component that does this shipped tonight; the screens change when that section does.";
lane.options = [];
lane.recommendation = null;

/* THE NEW ASK — a different question, so a different card. */
briefing.needsYou.unshift({
  id: "prototype-refresh-228",
  title: "Step one of your own instruction needs a file only you have — the refreshed prototype is not on this machine",
  state: "open",
  filedAt: FILED_AT,
  issueNumber: 228,
  productImpact:
    "You made this step one, before any code: overwrite the committed `Klieg Studio.dc.html`, `support.js`, `image-slot.js` and `drape-foundation/tokens.css` with the current versions from design — *\"you're reading the stale prototype. That's most of the confusion.\"*\n\n"
    + "I CANNOT DO IT FROM HERE. I searched this machine: the only copies of those files anywhere are the stale ones already in the repo, and your own check fails on them — the committed copy has no Cinema in the rail and no STAFF group in the account menu. There is nothing to copy from.\n\n"
    + "I BUILT 00 ANYWAY RATHER THAN STALLING THE LANE, and the reasoning is here so you can overrule it. 00's two sources are the shared-patterns document — which is NOT on your refresh list, so it is current — and the shipped foundation itself, whose tokens I checked already carry the scrim and error groups the README says the stale prototype is missing. Everything the staleness actually affects — Cinema, Crew, Admin, Moderation, Templates, the Home rebuild, the widths — belongs to section 01 and later, not to 00.\n\n"
    + "IT MATTERS MORE FOR 00b THAN IT DID FOR 00. 00b is the account menu and the utility menu, and the account menu is one of the things the stale copy is missing (the STAFF group). So 00b built against the old copy is a real risk in a way 00 was not.",
  workedExample:
    "The practical difference: 00b has to decide what the account menu contains and in what order. The committed prototype shows it without a STAFF group at all — so an agent reading it would build the menu you had two months ago, then someone would notice and it would be rebuilt. That is the rework pass you told me to avoid, arriving through the spec instead of through the code.",
  options: [
    {
      key: "DROP",
      label: "Drop the four files in, then 00b runs against the real target",
      consequence: "Five minutes of your time, no code. 00b is built once.",
    },
    {
      key: "PROCEED",
      label: "Build 00b against the committed copy anyway",
      consequence: "00b ships sooner and the account menu is likely rebuilt when the refresh lands.",
    },
  ],
  recommendation:
    "DROP — it costs you five minutes and it is the difference between building 00b's menus once or twice. If you would rather I pressed on, say PROCEED and I will, with the risk named on the PR.",
});

/*
  THE EYE ITEM STANDS ON ITS OWN NOW (#133).

  Edition 129 pointed it at `lobby-segments-228`, which this edition marks
  ANSWERED — and an open eye item beside an answered card is refused at the
  parse, correctly: it is the page telling him it is waiting for a verdict he
  already gave.

  It is repointed to NOTHING rather than to the new card, because the new card
  asks about the prototype files and these frames answer no part of that. What
  they ask is a standalone question — are these nine shapes right — and a lone
  eye item is exactly what the schema's nullable `cardId` is for. Repointing it
  at whatever card happened to be open would have satisfied the checker and
  lied to the reader.
*/
find(briefing.eyeItems, "foundation-section-00-frames").cardId = null;

/* PR #259 merged. */
const row = find(briefing.pipeline, "foundation-section-00-228");
row.status = "merged";
row.note =
  "Brief 00 built and merged as one PR (`0e59e990`) on his word. Nine components, the popover hook, the severity helper, four keyframes and the one CSS rule that cannot be inline. His acceptance test measured at the pixels: 0 changed pixels across all four pre-existing gallery sections, branch against main, with same-tree controls reading 0 on BOTH trees and two false alarms chased to their causes (a sticky dock painting into a screenshot, and main's own capture missing a paint). Fifteen guard arms, every one with a positive control — one of which caught a real bug in its own matcher. Three declared deviations, the first now card #260. Gate: gate-checks pass, founder-gate pass, review red because the Fable cap is out (#219, his ruling), which means no verdict was produced rather than a rejection. Also carried a repair that was not part of the segment: `pnpm check` had been red on main since d50b1d3e, by a rite push CI never saw.";

briefing.journal.unshift({
  at: FILED_AT,
  shift: "foreman-115",
  text:
    "Segment 1 is merged. Your test — nothing looks different — held at zero changed pixels on every screen that uses the old parts, after a first measurement that said otherwise and turned out to be the camera twice over. The one thing left on your side is the step you called first: the refreshed prototype files are not on this machine, and your own check (eight rail items with Cinema) fails on the copy we have. It mattered less for 00 than it will for 00b, because 00b is the account menu and the stale copy is missing its STAFF group. New card for it rather than reopening the one you already answered.",
});

briefing.journal = briefing.journal.slice(0, 40);

writeFileSync(PATH, `${JSON.stringify(briefing, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({
    edition: briefing.edition,
    needsYou: briefing.needsYou.length,
    eyeItems: briefing.eyeItems.length,
  }),
);
process.exit(0);
