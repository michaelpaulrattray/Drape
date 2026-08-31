import { Link } from "wouter";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { BrandOrb } from "./BrandOrb";
import { Icon, P } from "./icons";

/**
 * The 76px rail (foundation README §4, plan §D.5, handoff chapter 01).
 *
 * ⚠ **EIGHT destinations, from now on** — Home, Create, Canvas, Templates,
 * Casting, Cinema, Assets, Library. Four exist; four do not yet, and they
 * render as quiet inert stubs rather than being left out.
 *
 * ⚠ **CINEMA SITS AFTER CASTING, AND THE SECTION-02 BRIEF THAT SAID OTHERWISE
 * IS SUPERSEDED BY ITS OWN AUTHOR** (#321 defect b, 2026-08-30, verbatim):
 * *"you have Cinema before Casting. My section-02 brief said that, and **the
 * brief was wrong**; the prototype is … Templates · Casting · Cinema · Assets ·
 * Library."* So #270 and section 02 are corrected on this one point and on
 * nothing else — the reversal to eight below is untouched, and the eighth is
 * still Cinema. Recorded here rather than only in the card because the previous
 * order was itself pinned in `section02-guard.test.ts`, and a reader who finds
 * the guard asserting Casting-then-Cinema should see WHY before assuming drift.
 *
 * **This is a REVERSAL of founder ruling F1 (2026-07-31), not a contradiction
 * of it, and it is his own** (section 02, 2026-08-30, verbatim): *"F1 is
 * reversed. The rail goes to eight with Cinema, inert, between Templates and
 * Casting. Then the shape is fixed at eight — update the comment so the next
 * reader sees a reversal rather than a contradiction."* F1 fixed the rail at
 * seven; Cinema is the eighth and the last. **The shape is fixed at eight.**
 *
 * The reason the shape is fixed at all is unchanged: **the rail never changes
 * shape**. A navigation bar that grows an item every few weeks teaches people
 * to re-read it every time they open the app, and the muscle memory they build
 * is wrong by construction. Better to show the whole map at once and be honest
 * about which roads are open. That is also why the eighth arrives now, while
 * Cinema is unbuilt, rather than on the day it ships.
 *
 * The stubs are not links and not buttons: no href, no handler, out of the tab
 * order, `aria-disabled`. A control that looks clickable and does nothing is
 * worse than one that plainly says "not yet" — and §B-8's real point, that we
 * never fake a product that does not exist, still holds. Nothing here claims a
 * capability; it names a place.
 *
 * Home/Canvas/Library point at the legacy surfaces they still live on — the
 * shell is adopted route by route (plan §D.12).
 *
 * ---------------------------------------------------------------------------
 * **THE ACCOUNT CHIP IS NOT HERE ANY MORE** (section 02 §2b, his ruling):
 * *"The account chip moves to the topbar, and the rail's foot gets a gear
 * instead. Same face in both corners doing two different things is ambiguous.
 * The face is you, the gear is settings."* Everything reached *through* the
 * account — credits, billing, settings, notifications, theme — already sits at
 * the topbar's right end, so leaving the account itself in the opposite corner
 * split one thing in two. `Topbar.tsx` owns the chip, its menu and its
 * dismissal behaviour now; this file kept none of it.
 *
 * ---------------------------------------------------------------------------
 * **THE GLYPHS ARE THE HOUSE SET NOW** (#280, his order): every destination
 * here carries meaning, so every one of them is drawn from `./icons` rather
 * than from Lucide. Two Lucide glyphs are retired outright on his word —
 * `Sparkles` for Create (*"the universal AI mark … says nothing about making a
 * picture"*, replaced by `P.image`) and `Settings` for the foot's gear
 * (*"eight teeth plus an inner circle, which mushes into a blurred ring at
 * 16px"*, replaced by `P.settings`, **not** `P.cog` — *"don't use both"*).
 * `Plus` stays, because the Invite `+` is incidental and redrawing a good
 * general set where nobody looks is effort spent in the wrong place.
 *
 * Stroke is no longer set here. `Icon` fixes it at 1.7 and takes no stroke
 * prop, which is what makes his rule — *"icons get bigger, never heavier"* —
 * true by construction rather than by everyone remembering it; the rail's old
 * 1.8 was the last place it was set by hand.
 */

export type RailDestinationId =
  | "home"
  | "create"
  | "canvas"
  | "templates"
  | "cinema"
  | "casting"
  | "assets"
  | "library";

type Destination = {
  id: RailDestinationId;
  label: string;
  /** Absent = built but not yet: rendered inert, never as a dead link. */
  href?: string;
  /** A house glyph from `P` — a path string, never a component (#280). */
  glyph: string;
};

/**
 * The eight, in his own order, each against the key he named for it (#280:
 * *"P.studio, P.image, P.thread, P.campaign, P.avatar, P.asset, P.library,
 * plus Cinema"* — seven keys listed in rail order, with Cinema after Casting
 * per his #321 correction of his own section-02 brief.
 */
export const RAIL_DESTINATIONS: readonly Destination[] = [
  { id: "home", label: "Home", href: "/app", glyph: P.studio },
  { id: "create", label: "Create", glyph: P.image },
  { id: "canvas", label: "Canvas", href: "/app/boards", glyph: P.thread },
  { id: "templates", label: "Templates", glyph: P.campaign },
  { id: "casting", label: "Casting", href: "/casting", glyph: P.avatar },
  { id: "cinema", label: "Cinema", glyph: P.cinema },
  { id: "assets", label: "Assets", glyph: P.asset },
  { id: "library", label: "Library", href: "/app/models", glyph: P.library },
];

/**
 * The rail's foot: the workspace, not the account (section 02 §2c).
 *
 * ⚠ **THE MEMBER STACK DRAWS NO FACE IT CANNOT NAME.** The prototype shows
 * three overlapping avatars; there is no members API in this product — no
 * router, no query, no table — so three faces here would be three invented
 * people. His own rule from the 00b frames, verbatim: *"A number in a
 * screenshot that no server produces is a lie that survives into the build."*
 * When members are real, `members` fills and the stack draws them — the shape
 * is already here, and this component never constructs one.
 *
 * ⚠ **ONE FACE IS NAMEABLE TODAY AND HE RULED THAT IT SHOULD BE DRAWN**
 * (#281, 2026-08-30, verbatim and entire): *"Show your own face beside the +,
 * but keep it stubbed out until membership exists."* The signed-in user is a
 * real `users` row, so `AppChrome` hands exactly that one member and nothing
 * else — the rule above is untouched, because the constraint was never
 * *"draw no faces"*, it was *"draw no face no server produces"*.
 *
 * ⚠ **AND THE STUB TREATMENT IS THE OTHER HALF OF HIS SENTENCE, NOT AN
 * OVERSIGHT.** `.dp-invite` keeps `aria-disabled`, `cursor: default` and the
 * *"not built yet"* title, and the `+` still has no hover. He asked for
 * *"make it live"* and the hover in the same breath (#281); *"keep it stubbed
 * out until membership exists"* is him answering that himself, and the
 * Members surface it would open still does not exist. A face that made this
 * block look finished would be the invented-data failure in a costume.
 *
 * **The gear renders when the surface hands it somewhere to go.** It is not
 * optional in the design — his ruling is that the foot gets a gear rather than
 * a second avatar — but a gear on a page with no settings modal would be a
 * control that looks clickable and does nothing, which is the one thing the
 * stubs above exist to avoid, and *"Settings — not built yet"* would be a lie
 * on top of it: settings ARE built, they are simply not reachable from a
 * casting route. So the shell draws it where a surface owns one, exactly as
 * `topbarLeft` / `topbarRight` already work.
 */
export type RailWorkspace = {
  /**
   * Real members only — every entry must be a row a server produced.
   * Today that is exactly one: the signed-in user, on his #281 ruling.
   */
  members?: readonly { id: string; label: string; avatar?: ReactNode }[];
  /** Opens the surface's own settings. Absent = the gear is not drawn. */
  onOpenSettings?: () => void;
};

/** Up to three faces, then the `+` (section 02 §2c). */
const MEMBER_STACK_MAX = 3;

export function Rail({
  current,
  workspace,
}: {
  current?: RailDestinationId;
  workspace?: RailWorkspace;
}) {
  const members = (workspace?.members ?? []).slice(0, MEMBER_STACK_MAX);

  return (
    <nav className="dp-rail" aria-label="Primary">
      <BrandOrb />
      {RAIL_DESTINATIONS.map(({ id, label, href, glyph }) =>
        href ? (
          <Link
            key={id}
            href={href}
            className="dp-rail__item"
            aria-current={id === current ? "page" : undefined}
          >
            <Icon d={glyph} size={17} />
            <span className="dp-rail__label">{label}</span>
          </Link>
        ) : (
          <span
            key={id}
            className="dp-rail__item dp-rail__item--stub"
            aria-disabled="true"
            title={`${label} — not built yet`}
          >
            <Icon d={glyph} size={17} />
            <span className="dp-rail__label">{label}</span>
          </span>
        ),
      )}
      <div className="dp-rail__foot">
        <span className="dp-invite" aria-disabled="true" title="Invite — not built yet">
          <span className="dp-memberstack">
            {members.map((member) => (
              <span key={member.id} className="dp-memberstack__face" title={member.label}>
                {member.avatar}
              </span>
            ))}
            <span className="dp-memberstack__add" aria-hidden="true">
              <Plus size={9} strokeWidth={2.6} />
            </span>
          </span>
          <span className="dp-rail__label">Invite</span>
        </span>
        {workspace?.onOpenSettings ? (
          <>
            <span className="dp-rail__divider" />
            <button
              type="button"
              className="dp-iconbtn"
              onClick={workspace.onOpenSettings}
              title="Settings"
              aria-label="Settings"
            >
              <Icon d={P.settings} size={16} />
            </button>
          </>
        ) : null}
      </div>
    </nav>
  );
}
