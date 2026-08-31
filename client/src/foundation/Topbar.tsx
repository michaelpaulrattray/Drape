import { useEffect, useRef, useState } from "react";
import { ChevronDown, User } from "lucide-react";
import type { ReactNode } from "react";

import { useTheme } from "@/contexts/ThemeContext";

import { SearchStub } from "./ChromeStubs";
import { Icon, P } from "./icons";

/**
 * The 56px glass topbar (foundation README §4, plan §D.6, section 02 §1).
 *
 * **Three zones, not two: context · search · you.** It was brand + breadcrumb
 * on the left and chrome on the right, with 800px of nothing between them.
 * Section 02 fills the middle and moves the account to the end of the right.
 *
 * ⚠ **THE BRAND WORDMARK IS GONE ON PURPOSE** (§1a). `BrandOrb` already
 * carries the brand at the top of the rail, two inches away; the space belongs
 * to the project switcher. `BRAND_NAME` still exists and is still the one place
 * the product's name is written — nothing in the chrome renders it now.
 *
 * ⚠ **THE THEME TOGGLE IS THE SHELL'S OWN CONTROL, AND IT IS DRAWN ONE STEP
 * SMALLER THAN THE SURFACE'S** (#321 defects c and d, his measurement):
 * *"In the prototype it's deliberately one step smaller than the bug/help/
 * what's-new buttons, with a lighter hover — `--fill` rather than
 * `--fillStrong`. It's the shell's own control sitting among the surface's, and
 * the size difference is what separates them."* Hence `dp-iconbtn--theme`:
 * 28px against the surface's 30px, and the lighter hover. It is a modifier
 * rather than a second class because everything else about the button — the
 * radius, the colour, the transition — is `.dp-iconbtn`'s and should stay
 * there.
 *
 * And its glyphs are the house set's now (`P.sun` / `P.moon`), not Lucide's at
 * a hand-set 1.8. **This was the last place in the product where a
 * house-family stroke was set by hand**; `Icon` fixes it at 1.7 and takes no
 * stroke prop, so his rule — *"icons get bigger, never heavier"* — is true by
 * construction here rather than by everyone remembering it.
 *
 * The theme toggle is owned by the shell and never by a feature (plan §D.8).
 * `right` is where a surface puts its own chrome — the credits chip, the bug
 * and help buttons, What's new — and it renders BEFORE the shell's own theme
 * toggle and account chip, which are always last.
 *
 * `left` is the same idea on the other end: it sits at the head of the context
 * zone, before the breadcrumb, and section 00b puts the inert project switcher
 * there.
 *
 * ⚠ **`left` AND `right` ARE SLOTS RATHER THAN UNCONDITIONAL CHROME, AND THAT
 * IS DELIBERATE.** Four casting pages mount this same shell, and the lobby lane
 * the switcher belongs to has casting FROZEN (founder, #228: casting is *"the
 * only page in the live app that has had real design put into it"*, and it is
 * the lane's reference rather than its subject). A slot changes the lobby and
 * leaves casting's own chrome alone. **The FRAME itself is not a slot** — the
 * search, the missing wordmark and the account's new corner apply everywhere,
 * because section 02 is the frame every later page sits inside and his brief
 * says so in its first line.
 */
export function Topbar({
  breadcrumb,
  left,
  right,
  account,
}: {
  breadcrumb?: string;
  left?: ReactNode;
  right?: ReactNode;
  account?: TopbarAccount;
}) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="dp-topbar">
      <div className="dp-topbar__context">
        {left}
        {left && breadcrumb ? <span className="dp-topbar__divider" aria-hidden="true" /> : null}
        {breadcrumb ? <span className="dp-breadcrumb">{breadcrumb}</span> : null}
      </div>
      <div className="dp-topbar__centre">
        <SearchStub />
      </div>
      <div className="dp-topbar__right">
        {right}
        <button
          type="button"
          className="dp-iconbtn dp-iconbtn--theme"
          onClick={toggleTheme}
          title={`Switch to ${nextTheme} theme`}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          <Icon d={theme === "dark" ? P.sun : P.moon} size={15} />
        </button>
        {account ? <AccountChip account={account} /> : null}
      </div>
    </header>
  );
}

/** The 1px × 18px hairline between the balance chips and the icon buttons. */
export function TopbarDivider() {
  return <span className="dp-topbar__divider dp-topbar__divider--gutter" aria-hidden="true" />;
}

export type TopbarAccount = {
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

/**
 * The account chip (section 02 §2b) — **relocated from `Rail.tsx`, not
 * rewritten**. The chevron beside the avatar is the one addition his brief
 * asks for; the Escape key, the outside-click dismissal and the anchoring are
 * the rail's own implementation carried across, because it was correct.
 *
 * It stays hand-rolled rather than adopting `useAnchoredPanel`: the hook
 * measures for panels that would otherwise be clipped or mis-placed, and this
 * one sits in a `position: relative` anchor at the end of a 56px bar with
 * nothing to clip it. Section 00's popover discipline is about the three
 * implementations that fight over placement, and this is not one of them.
 *
 * ⚠ **#304 collapsed those three onto one owner and deliberately left this
 * fourth alone**, and the question of whether it should follow them was put to
 * the founder as #356 rather than decided here. **He answered it on
 * 2026-08-31, Crew reply #69, verbatim and entire: "Leave it."**
 *
 * So the chip stays hand-rolled BY RULING, not by omission, and this comment is
 * where that ruling lives. The two costs he accepted are named rather than
 * hidden: Escape closes the menu without returning focus to the chevron, and
 * the menu can sit open beside another panel. Both are small on four rows in a
 * bar with nothing to clip it — which is the argument the paragraph above has
 * made since the chip moved here.
 *
 * **Do not re-open this by reading the table in #356 and concluding the hook is
 * tidier.** It is; he was shown that and chose the pixels he had already
 * approved over it. A FIFTH hand-rolled owner is a different matter and is
 * caught by `anchoredPanel.test.ts`, which derives its population from the
 * directory rather than from this sentence.
 */
function AccountChip({ account }: { account: TopbarAccount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

  return (
    <div className="dp-account-anchor" ref={anchorRef}>
      <button
        type="button"
        className="dp-accountchip"
        title={account.label}
        aria-label={account.label}
        aria-haspopup={account.menu ? "menu" : undefined}
        aria-expanded={account.menu ? menuOpen : undefined}
        onClick={() => account.menu && setMenuOpen((open) => !open)}
      >
        <span className="dp-account">
          {account.avatar ?? account.initials ?? (
            <User size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
        </span>
        <ChevronDown size={9} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {account.menu && menuOpen ? (
        <div className="dp-account-menu" role="menu">
          {account.menu}
        </div>
      ) : null}
    </div>
  );
}
