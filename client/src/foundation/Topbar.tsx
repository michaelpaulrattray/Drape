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
 */
export function Topbar({ breadcrumb, right }: { breadcrumb?: string; right?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="dp-topbar">
      <div className="dp-topbar__brand">
        <span className="dp-brandblock">
          <span className="dp-brandblock__tile" aria-hidden="true" />
          {BRAND_NAME}
        </span>
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
