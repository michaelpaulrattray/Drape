import type { ReactNode } from "react";

import { AppChrome } from "@/components/AppChrome";

/**
 * The staff frame (brief 05 §3) — the one place Admin and Moderation own their
 * layout, so that no page does.
 *
 * ## Why the pages stopped owning it
 *
 * Every staff page used to open `min-h-screen bg-[#EBEBEB]` and centre its own
 * `max-w-7xl` column, which meant nine files each stated the page background,
 * the page height and the content width. Three of them disagreed — two were
 * `max-w-5xl`, Crew was `max-w-3xl` — and none of the three was a decision
 * anybody had made. **They are all the shell's now**, and a page that wants a
 * different measure asks for it here rather than inventing one (working law 4).
 *
 * ## The scroll belongs to the pane, not to the page
 *
 * `overflow: hidden` on the frame, `overflow-y: auto` on the pane, so the bar
 * stays put while a 4,000-row audit table scrolls under it. This is the
 * opposite of the lobby, and deliberately so: staff surfaces are working tools
 * and the tabs are what you reach for half way down a table.
 *
 * ## Two things it does NOT do
 *
 * ⚠ **It mounts `AppChrome`, not `AppShell`** — the brief says `AppShell`,
 * which is the layout primitive underneath. A page mounting that directly gets
 * a rail and an otherwise empty topbar: no account menu, no credits chip, no
 * settings gear. That is #278's defect exactly, and `appChrome.test.ts` is the
 * arm that stops it recurring.
 *
 * ⚠ **It passes no `current` to the rail.** Staff is not a rail destination —
 * it is reached from the account menu, where the founder put it (*"Two
 * doorways, both in the STAFF group"*). Lighting a rail item for a surface the
 * rail does not contain would be the rail lying about where you are.
 */
export function StaffSurface({
  /** The staff bar. Rendered `flex: none` above the scrolling pane. */
  bar,
  /**
   * `work` is the 1240px working column every staff surface uses.
   * `read` is Crew's 790px — a briefing you read, not a grid you scan.
   */
  measure = "work",
  breadcrumb,
  children,
}: {
  bar: ReactNode;
  measure?: "work" | "read";
  breadcrumb?: string;
  children: ReactNode;
}) {
  return (
    <AppChrome breadcrumb={breadcrumb} width="bare">
      <div className="dp-staff">
        {bar}
        <div className="dp-staff__pane">
          <div className={`dp-staff__col${measure === "read" ? " dp-staff__col--read" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </AppChrome>
  );
}
