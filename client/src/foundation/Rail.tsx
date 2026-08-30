import { Link } from "wouter";
import { Clapperboard, Film, Frame, Home, Images, Library, Plus, Settings, Sparkles, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { BrandOrb } from "./BrandOrb";

/**
 * The 76px rail (foundation README §4, plan §D.5, handoff chapter 01).
 *
 * ⚠ **EIGHT destinations, from now on** — Home, Create, Canvas, Templates,
 * Cinema, Casting, Assets, Library. Four exist; four do not yet, and they
 * render as quiet inert stubs rather than being left out.
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
  Icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
};

export const RAIL_DESTINATIONS: readonly Destination[] = [
  { id: "home", label: "Home", href: "/app", Icon: Home },
  { id: "create", label: "Create", Icon: Sparkles },
  { id: "canvas", label: "Canvas", href: "/app/boards", Icon: Frame },
  { id: "templates", label: "Templates", Icon: Clapperboard },
  { id: "cinema", label: "Cinema", Icon: Film },
  { id: "casting", label: "Casting", href: "/casting", Icon: Users },
  { id: "assets", label: "Assets", Icon: Images },
  { id: "library", label: "Library", href: "/app/models", Icon: Library },
];

/**
 * The rail's foot: the workspace, not the account (section 02 §2c).
 *
 * ⚠ **THE MEMBER STACK DRAWS NO FACE IT CANNOT NAME.** The prototype shows
 * three overlapping avatars; there is no members API in this product — no
 * router, no query, no table — so three faces here would be three invented
 * people. His own rule from the 00b frames, verbatim: *"A number in a
 * screenshot that no server produces is a lie that survives into the build."*
 * What ships is the affordance the brief asks for and nothing behind it: the
 * dashed `+` and the word Invite, inert, because the Members surface does not
 * exist either. When members are real, `members` fills and the stack draws
 * them — the shape is already here.
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
  /** Real members only. Empty today: nothing in the product produces them. */
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
      {RAIL_DESTINATIONS.map(({ id, label, href, Icon }) =>
        href ? (
          <Link
            key={id}
            href={href}
            className="dp-rail__item"
            aria-current={id === current ? "page" : undefined}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span className="dp-rail__label">{label}</span>
          </Link>
        ) : (
          <span
            key={id}
            className="dp-rail__item dp-rail__item--stub"
            aria-disabled="true"
            title={`${label} — not built yet`}
          >
            <Icon size={17} strokeWidth={1.8} />
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
              <Settings size={16} strokeWidth={1.8} />
            </button>
          </>
        ) : null}
      </div>
    </nav>
  );
}
