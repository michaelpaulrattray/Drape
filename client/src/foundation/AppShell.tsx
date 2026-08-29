import type { ReactNode } from "react";

import { Rail, type RailAccount, type RailDestinationId } from "./Rail";
import { Topbar } from "./Topbar";

/**
 * The app shell (plan §D.4): 76px rail + 56px topbar + centred content column.
 *
 * `.dp-root` is also the token scope at M1 — see the header of tokens.css.
 * One shell instance should wrap a route family so navigation never remounts
 * the rail.
 *
 * Content width is a shell decision, not a feature's: 1180px for browsing and
 * detail, 1240px for working surfaces that need grid room (README §7).
 */
export function AppShell({
  breadcrumb,
  current,
  account,
  topbarRight,
  width = "browse",
  gutter = "default",
  children,
}: {
  breadcrumb?: string;
  current?: RailDestinationId;
  account?: RailAccount;
  topbarRight?: ReactNode;
  /**
   * `browse` (1180px) and `working` (1240px) are the two documented content
   * columns. `bare` gives the surface the raw column with no padding or
   * maximum — for surfaces that still own their own layout, like the lobby
   * views during the M2 shell adoption (§D.14 wraps them, it does not
   * restyle them). New surfaces should not use `bare`.
   */
  width?: "browse" | "working" | "bare";
  /**
   * The gutter below the content column. `default` is the shell's 80px of
   * scroll room; `tight` is 44px.
   *
   * It is a separate prop rather than a fourth width because **the width
   * vocabulary is closed at three numbers** (foundation README §7, *"No fourth
   * number"*) and a bottom gutter is not a width. The casting page is the one
   * surface that names its own — the founder's own values for it, verbatim on
   * #240: *"max-width: 1240px; margin: 0 auto; padding: 34px 32px 44px"*. The
   * other two numbers in that sentence are already what `working` gives, which
   * is why only this one needed anywhere to live.
   */
  gutter?: "default" | "tight";
  children: ReactNode;
}) {
  const contentClass = [
    "dp-content",
    width === "bare" ? "dp-content--bare" : width === "working" ? "dp-content--working" : "",
    /* `bare` has no padding at all, so a gutter on it would be a contradiction. */
    gutter === "tight" && width !== "bare" ? "dp-content--tight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="dp-root">
      <Rail current={current} account={account} />
      <div className="dp-main">
        <Topbar breadcrumb={breadcrumb} right={topbarRight} />
        <div className={contentClass}>{children}</div>
      </div>
    </div>
  );
}
