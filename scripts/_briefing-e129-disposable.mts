/**
 * Briefing edition 129 — foreman-115.
 *
 * The lobby lane's first segment is BUILT. He named it at 00:34Z last night
 * ("00 as one PR, 00b as one PR, then stop and show me") and the previous
 * shift deliberately did not start it with minutes left. This shift did it.
 *
 * The card he needs is not a decision — he has already decided the order. It
 * is a REPORT with one thing in it he did not ask for and should see: the
 * acceptance test he set ("no visible change") was measured at the pixels,
 * and the first reading FAILED before both causes turned out to be the
 * instrument rather than the code.
 *
 * Also: the spec refresh he made step one CANNOT BE DONE HERE. The updated
 * prototype files are not on this machine and only he can supply them. That
 * goes on the card as a blocking ask, not buried in a journal line.
 *
 * ⚠ The six frames below were uploaded to the PRODUCTION bucket with
 * `railway run --service Drape` — a local upload lands in the dev bucket and
 * he would see nothing.
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

const FILED_AT = "2026-08-30T14:05:00+10:00";

briefing.edition = 129;
briefing.shift = "foreman-115";
briefing.updatedAt = FILED_AT;

/* THE LANE CARD becomes a report on segment 1 plus the one thing only he can
   unblock. It stays `open` because it carries a real ask. */
const lane = find(briefing.needsYou, "lobby-segments-228");
lane.state = "open";
lane.title = "Lobby segment 1 is built — and step one, your spec refresh, needs a file only you have";
lane.productImpact =
  "SEGMENT 1 IS DONE. `00 — foundation top-up` is one PR (#259) exactly as you asked, and it ships the nine parts that twelve of your surfaces all reuse: the media card, the actions that appear when you hover one, the bar at the top of a working surface, the staff table whose rows open in place instead of opening a dialog, the priced-choice block, the milestone rail, the transcript, the marquee, and the popover behaviour every dropdown in the redesign owes.\n\n"
  + "NOTHING YOU CAN SEE CHANGED, which was your test for this one, and it was measured rather than promised. I photographed the four sections of the developer gallery that render every part the studio already had — buttons, inputs, chips, cards, media, the empty states — on this branch and on the live code, and compared them pixel by pixel. ZERO pixels differ, across all four.\n\n"
  + "THE HONEST PART OF THAT NUMBER. The first comparison said THREE of the four HAD changed, one of them by 29 per cent. Neither cause was the new code. One was the sticky bar at the bottom of that page painting itself into the screenshot — adding six sections made the page longer, so the bar landed over a different part of it. The other was the LIVE code's own photograph having a blank strip where its heading should be: the text had not finished painting when the camera fired. I cropped that strip and looked at it rather than reasoning about the number.\n\n"
  + "WHAT I NEED FROM YOU, AND IT IS THE THING YOU CALLED STEP ONE. The refreshed prototype is not on this machine. I searched for it: the only copies of `Klieg Studio.dc.html`, `support.js` and `image-slot.js` anywhere are the stale ones already in the repo, and your own check fails on them — the committed copy has no Cinema in the rail and no STAFF group in the account menu. So the spec refresh cannot be done from here. Drop the current four files in and it is a five-minute job with no code in it.\n\n"
  + "I BUILT 00 ANYWAY RATHER THAN STOPPING, and the reason is specific rather than impatient. 00's two sources are the shared-patterns document — which is NOT on your refresh list, so it is current — and the shipped foundation itself, and I checked that the shipped tokens already carry the scrim and error groups the README says the stale prototype is missing. Everything the staleness actually affects — Cinema, Crew, Admin, Moderation, Templates, the Home rebuild, the widths — belongs to section 01 and later. If you would rather I had waited, say so and I will treat the refresh as blocking for 00b.\n\n"
  + "ONE THING I DID NOT DO THAT THE BRIEF ASKS FOR, because it collides with your own test. The brief says to delete the two colour-constant files in this same section. Nine screens in Admin and Moderation render those colours, so deleting them repaints the audit log, the activity tab and five dialogs — a visible change, which is the one thing this section may not make. The replacement ships now so the staff section can use it; the screens move when that section moves them. It is on the PR as a declared deviation, not left quiet.";
lane.workedExample =
  "Concretely, on the staff audit log once the staff section lands: today a `critical` row is a red-tinted badge, a `warning` is amber, an `info` is blue, and the category beside it is one of four more tints — seven colours across two screens. After: all three severities are plain greyscale outlines except `critical`, which wears the studio's one red, and what the entry is ABOUT is carried by the action text itself (`stripe.refund.manual`), which tells you more than a colour can. The component that does this shipped tonight; the screens change when that section does.";
lane.options = [];
lane.recommendation =
  "Drop the four refreshed prototype files into `docs/specs/Casting-ui-ux-design/design_handoff_studio/` (and `drape-foundation/tokens.css`) when you get a minute. Then 00b is the next and last PR before the lane stops for your eye, exactly as you set it.";

briefing.pipeline.unshift({
  id: "foundation-section-00-228",
  title: "Lobby segment 1 — the nine shared components, with nothing else moving",
  status: "in-review",
  prNumber: 259,
  note:
    "Brief 00 built as one PR on his word. Nine components, the popover hook, the severity helper, four keyframes and the one CSS rule that cannot be inline. Acceptance test measured at the pixels: 0 changed pixels across all four pre-existing gallery sections, branch against main, with same-tree controls reading 0 on BOTH trees and two false alarms chased to their causes (a sticky dock painting into a screenshot, and main's own capture missing a paint). Fifteen guard arms, every one with a positive control — one of which caught a real bug in its own matcher. Three declared deviations on the PR. Also carries a repair that is not part of the segment: `pnpm check` has been red on main since d50b1d3e, by a rite push CI never saw.",
});

briefing.eyeItems.unshift({
  id: "foundation-section-00-frames",
  title: "The nine new parts, in both themes — and one frame that is wrong on purpose",
  state: "open",
  filedAt: FILED_AT,
  issueNumber: 228,
  cardId: "lobby-segments-228",
  question:
    "NOTHING HERE IS ON A CUSTOMER SCREEN YET. These are the shared parts every later lobby section gets assembled from, rendered on the developer gallery. Worth two minutes because the next five segments inherit whatever you think of them now — and because component shapes are cheapest to argue about before they have consumers, which is your own reason for doing 00 before Home.\n\n"
    + "WHAT TO LOOK AT. The media card in four states: the dashed create tile that always sits first in a grid, an ordinary card, a KEPT card wearing the single accent bar, and one still casting. The staff table with a row opened IN PLACE — that shape replaces five separate dialogs. The transcript. The priced-choice blocks. The milestone rail, whose segments are sized by how big each milestone actually is rather than all being equal.\n\n"
    + "ONE FRAME IS WRONG AND I AM TELLING YOU RATHER THAN QUIETLY RETAKING IT: in the two long shots the marquee row at the bottom is an empty white band. It renders perfectly — the close-up proves it — but a full-page screenshot does not composite a moving, edge-faded element. Judge the marquee at its own frame, not at the long one.",
  frames: [
    {
      key: "crew-eye/e4c7da4e-590c-4563-ade0-19c63671e8aa.png",
      caption: "The whole gallery, light. Sections 05 to 10 are the new parts; 01 to 04 are the existing ones and are pixel-identical to what is live. The empty band at the bottom is the marquee not compositing — see its own frame.",
      arm: "light",
    },
    {
      key: "crew-eye/f6d0af26-81f8-431b-bb43-1ff657cd2147.png",
      caption: "The same page, dark. Every value resolves through a token, so nothing here branches on the theme.",
      arm: "dark",
    },
    {
      key: "crew-eye/e04db121-32fa-4d21-beb3-80f3ad6803c6.png",
      caption: "The media card in four states, light: the dashed create tile first, an ordinary card, a KEPT card with the one accent bar, and one still casting. The caption always sits BELOW the picture — on a short card it would otherwise land exactly where a bottom overlay's text does.",
      arm: "light",
    },
    {
      key: "crew-eye/64d73ca0-4bda-4641-8e72-0f62b4a64c0b.png",
      caption: "The same four cards, dark.",
      arm: "dark",
    },
    {
      key: "crew-eye/5c8288d9-212f-4af0-b95a-fddea1390ca4.png",
      caption: "The staff table with its top row opened in place — facts, a plain-English line, then the actions. This shape is what replaces five separate dialogs. Three severities, greyscale except the one red.",
      arm: "light",
    },
    {
      key: "crew-eye/b0119653-b5fa-4f3e-9b0e-efbe69af24d6.png",
      caption: "The marquee at its own frame, which is where to judge it. It loops without a jump — the shift is 1116.00px against a 2232.00px track, so it moves exactly one copy. Hovering pauses it.",
      arm: "light",
    },
  ],
});

briefing.journal.unshift({
  at: FILED_AT,
  shift: "foreman-115",
  text:
    "Segment 1 is built and in review as one PR, the way you set it. The nine shared parts exist now, and the test you gave it — nothing looks different — holds at zero changed pixels on every screen that uses the old parts. The first measurement said otherwise, and both causes turned out to be the camera rather than the code; that is on the card, because a number I had to argue away is worth more to you than a clean one I never checked. Step one, your spec refresh, is the one thing I cannot do: the current prototype files are not on this machine, and your own check — eight rail items including Cinema — fails on the copy we have. Drop them in when you can. 00b is next, and then the lane stops for your eye.",
});

/* The journal is capped at 40 at the schema, and it was full. The oldest entry
   falls off so the newest can land — trimmed here rather than discovered at
   the parse. */
briefing.journal = briefing.journal.slice(0, 40);

writeFileSync(PATH, `${JSON.stringify(briefing, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({
    edition: briefing.edition,
    needsYou: briefing.needsYou.length,
    eyeItems: briefing.eyeItems.length,
    pipeline: briefing.pipeline.length,
  }),
);
process.exit(0);
