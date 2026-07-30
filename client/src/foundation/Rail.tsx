import { Link } from "wouter";
import { Frame, Home, Library, User, Users } from "lucide-react";
import type { ComponentType } from "react";

import { BrandOrb } from "./BrandOrb";

/**
 * The 76px rail (foundation README §4, plan §D.5).
 *
 * Destinations are real routes only (plan §B-8): no greyed-out products, no
 * workspace switcher until workspaces exist. Home/Canvas/Library point at the
 * legacy surfaces they still live on — the shell is adopted route by route
 * (plan §D.12), so a rail item leaving the foundation chrome is expected.
 *
 * Items are <a>, so keyboard and middle-click work without any handler.
 */

export type RailDestinationId = "home" | "canvas" | "casting" | "library";

type Destination = {
  id: RailDestinationId;
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
};

export const RAIL_DESTINATIONS: readonly Destination[] = [
  { id: "home", label: "Home", href: "/app", Icon: Home },
  { id: "canvas", label: "Canvas", href: "/app/boards", Icon: Frame },
  { id: "casting", label: "Casting", href: "/casting", Icon: Users },
  { id: "library", label: "Library", href: "/app/models", Icon: Library },
];

export type RailAccount = {
  /** Up to two characters. Omitted rather than faked when unknown. */
  initials?: string;
  label: string;
};

export function Rail({
  current,
  account,
}: {
  current?: RailDestinationId;
  account?: RailAccount;
}) {
  return (
    <nav className="dp-rail" aria-label="Primary">
      <BrandOrb />
      {RAIL_DESTINATIONS.map(({ id, label, href, Icon }) => (
        <Link
          key={id}
          href={href}
          className="dp-rail__item"
          aria-current={id === current ? "page" : undefined}
        >
          <Icon size={17} strokeWidth={1.8} />
          <span className="dp-rail__label">{label}</span>
        </Link>
      ))}
      <div className="dp-rail__foot">
        <span className="dp-rail__divider" />
        <button type="button" className="dp-account" title={account?.label ?? "Account"}>
          {account?.initials ? (
            account.initials
          ) : (
            <>
              <User size={14} strokeWidth={1.8} aria-hidden="true" />
              <span className="dp-sr">{account?.label ?? "Account"}</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
