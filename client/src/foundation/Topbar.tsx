import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";

import { useTheme } from "@/contexts/ThemeContext";

import { BRAND_NAME } from "./brand";

/**
 * The 56px glass topbar (foundation README §4, plan §D.6).
 *
 * The theme toggle is owned by the shell and never by a feature (plan §D.8).
 * `right` is where a surface puts its own chrome — the credits chip lands
 * there at M5, when there is a real balance to show (D-45); nothing fake
 * occupies it before then.
 *
 * `left` is the same idea on the other end: it sits after the brand block and
 * before the breadcrumb, and section 00b puts the inert project switcher there.
 *
 * ⚠ **IT IS A SLOT RATHER THAN UNCONDITIONAL CHROME, AND THAT IS DELIBERATE.**
 * The switcher is chrome, so rendering it here for everyone would be the more
 * natural shape — but four casting pages mount this same shell, and the lobby
 * lane the switcher belongs to has casting FROZEN (founder, #228: casting is
 * *"the only page in the live app that has had real design put into it"*, and
 * it is the lane's reference rather than its subject). A slot changes the
 * lobby and leaves casting byte-identical; unconditional chrome would have
 * redesigned a frozen page as a side effect.
 */
export function Topbar({
  breadcrumb,
  left,
  right,
}: {
  breadcrumb?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="dp-topbar">
      <div className="dp-topbar__brand">
        <span className="dp-brandblock">
          <span className="dp-brandblock__tile" aria-hidden="true" />
          {BRAND_NAME}
        </span>
        {left}
        {breadcrumb ? (
          <>
            <span className="dp-topbar__divider" aria-hidden="true" />
            <span className="dp-breadcrumb">{breadcrumb}</span>
          </>
        ) : null}
      </div>
      <div className="dp-topbar__spacer" />
      {right}
      <button
        type="button"
        className="dp-iconbtn"
        onClick={toggleTheme}
        title={`Switch to ${nextTheme} theme`}
        aria-label={`Switch to ${nextTheme} theme`}
      >
        {theme === "dark" ? (
          <Sun size={15} strokeWidth={1.8} />
        ) : (
          <Moon size={15} strokeWidth={1.8} />
        )}
      </button>
    </header>
  );
}
