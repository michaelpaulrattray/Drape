import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Clapperboard, Frame, Home, Images, Library, Sparkles, User, Users } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { BrandOrb } from "./BrandOrb";

/**
 * The 76px rail (foundation README §4, plan §D.5, handoff chapter 01).
 *
 * **Seven destinations, from now on** (founder ruling F1, 2026-07-31): Home,
 * Create, Canvas, Templates, Casting, Assets, Library. Four exist; three do
 * not yet, and they render as quiet inert stubs rather than being left out.
 *
 * That reverses the earlier "real routes only" reading of §B-8, deliberately
 * and on the handoff's own rule: **the rail never changes shape**. A navigation
 * bar that grows an item every few weeks teaches people to re-read it every
 * time they open the app, and the muscle memory they build is wrong by
 * construction. Better to show the whole map at once and be honest about which
 * roads are open.
 *
 * The stubs are not links and not buttons: no href, no handler, out of the tab
 * order, `aria-disabled`. A control that looks clickable and does nothing is
 * worse than one that plainly says "not yet" — and §B-8's real point, that we
 * never fake a product that does not exist, still holds. Nothing here claims a
 * capability; it names a place.
 *
 * Home/Canvas/Library point at the legacy surfaces they still live on — the
 * shell is adopted route by route (plan §D.12).
 */

export type RailDestinationId =
  | "home"
  | "create"
  | "canvas"
  | "templates"
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
  { id: "casting", label: "Casting", href: "/casting", Icon: Users },
  { id: "assets", label: "Assets", Icon: Images },
  { id: "library", label: "Library", href: "/app/models", Icon: Library },
];

export type RailAccount = {
  /** Up to two characters. Omitted rather than faked when unknown. */
  initials?: string;
  label: string;
  /** The app supplies the real avatar; the chip only owns size and ring. */
  avatar?: ReactNode;
  /**
   * The account menu. The shell owns the chip and its open/close behaviour;
   * what the menu offers is the app's business, so a surface can reach parity
   * with whatever its old account row exposed.
   */
  menu?: ReactNode;
};

export function Rail({
  current,
  account,
}: {
  current?: RailDestinationId;
  account?: RailAccount;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const footRef = useRef<HTMLDivElement>(null);

  // Escape closes, and a click anywhere outside dismisses — the same contract
  // shadcn's popovers give, without pulling a portal into the shell.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!footRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

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
      <div className="dp-rail__foot" ref={footRef}>
        <span className="dp-rail__divider" />
        <div className="dp-account-anchor">
          <button
            type="button"
            className="dp-account"
            title={account?.label ?? "Account"}
            aria-label={account?.label ?? "Account"}
            aria-haspopup={account?.menu ? "menu" : undefined}
            aria-expanded={account?.menu ? menuOpen : undefined}
            onClick={() => account?.menu && setMenuOpen((open) => !open)}
          >
            {account?.avatar ?? account?.initials ?? (
              <User size={14} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
          {account?.menu && menuOpen ? (
            <div className="dp-account-menu" role="menu">
              {account.menu}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
