import { create } from "zustand";

/**
 * THE AUTO-REFRESH TOGGLE IS ONE SWITCH FOR THE WHOLE STAFF PANEL (#453).
 *
 * **His words, Crew reply #104, 2026-09-02, verbatim:** *"Why are the refresh
 * controls acting as individual toggles per admin page? it should work the same
 * way it works for moderator pages if i toggle it on its on for all pages not
 * just 1."*
 *
 * # ⚠ THE MODERATOR PAGES DO NOT DO WHAT HE THINKS THEY DO
 *
 * He is right about the behaviour and the cause is not the one he named.
 * `/moderator` is **one route** (`App.tsx:127`) whose tabs live inside a single
 * component, so its toggle never unmounts and therefore never resets. Admin is
 * **eight routes**, and wouter unmounts a page on navigation. There was no
 * shared preference on either side — seven surfaces each held their own
 * `useState`, and that is the whole difference he was looking at.
 *
 * So the fix is not to copy the moderator page. It is to give both of them the
 * thing neither had.
 *
 * # What this owns, and what it deliberately does not
 *
 * **The boolean, and nothing else.** Each surface keeps its own
 * `refetchInterval`, its own refetch list and its own toast copy, because they
 * poll different readers at different rates — Audit logs and the moderator
 * dashboard read their stats at 60s and their lists at 30s. Folding *those* in
 * is the promotion pass `useStaffRefresh.ts` already names, and it needs his eye
 * on the words. **Only the switch is shared; what each page does when it is on
 * stays that page's business.**
 *
 * # ⚠ THE INITIAL VALUE IS ON, AND THAT IS A JUDGEMENT HE MAY OVERRULE
 *
 * One shared value means one default. `AdminOverview` is the only surface that
 * has ever defaulted ON — and its `useState(true)` comes from `a20b611d`, the
 * original scaffolding commit, **not from a founder ruling**, despite
 * `useStaffRefresh.ts`'s docblock describing the three inline copies as
 * *"decisions rather than accidents"*. Defaulting ON means **no page loses a
 * behaviour it has today** and his ask is satisfied with no clicks; defaulting
 * OFF would silently stop the landing page auto-refreshing. Recorded on #453 so
 * flipping it is one line and one word from him.
 */

/**
 * ⚠ THE KEY IS NAMESPACED AND VERSIONED-BY-MEANING, NOT BY DATE. If the stored
 * shape ever stops being a plain boolean, this string changes with it, so an old
 * value can never be read as a new one.
 */
const STORAGE_KEY = "drape_staff_auto_refresh";

/** The value a browser that has never been told otherwise gets. See the docblock. */
const DEFAULT_AUTO_REFRESH = true;

/*
  ⚠ EVERY `localStorage` TOUCH IS GUARDED, BOTH WAYS.

  Safari's private mode and a locked-down profile both throw on access — not on
  a missing key, on the property itself. An unguarded read here would take the
  entire admin panel down to a blank screen for the one class of browser that
  cannot be tested by looking at ours. The house idiom (`useReferralClaim.ts`,
  `useSessionPersistence.ts`) is try/catch and carry on, and the fallback is a
  working session-only toggle rather than a broken page.
*/
function readStored(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_AUTO_REFRESH;
    return raw === "1";
  } catch {
    return DEFAULT_AUTO_REFRESH;
  }
}

function writeStored(next: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* Storage denied or full. The switch still works for this session. */
  }
}

interface StaffAutoRefreshState {
  /** Whether every staff surface polls. Read it, never mirror it into local state. */
  autoRefresh: boolean;
  /** Sets it everywhere and remembers it. The only writer. */
  setAutoRefresh: (next: boolean) => void;
}

export const useStaffAutoRefreshStore = create<StaffAutoRefreshState>()((set) => ({
  autoRefresh: readStored(),
  setAutoRefresh: (next: boolean) => {
    writeStored(next);
    set({ autoRefresh: next });
  },
}));

/**
 * The pair every staff surface reads, shaped exactly like the `useState` it
 * replaces so a page's call site does not change.
 *
 * ⚠ **Two selectors, not one object literal.** A selector returning
 * `{ autoRefresh, setAutoRefresh }` builds a new object on every store change
 * anywhere, which re-renders every subscriber whether or not the value moved.
 */
export function useStaffAutoRefresh(): [boolean, (next: boolean) => void] {
  const autoRefresh = useStaffAutoRefreshStore((s) => s.autoRefresh);
  const setAutoRefresh = useStaffAutoRefreshStore((s) => s.setAutoRefresh);
  return [autoRefresh, setAutoRefresh];
}

/** Test-only: the key and default, so an arm cannot re-state them and drift. */
export const STAFF_AUTO_REFRESH_STORAGE_KEY = STORAGE_KEY;
export const STAFF_AUTO_REFRESH_DEFAULT = DEFAULT_AUTO_REFRESH;
