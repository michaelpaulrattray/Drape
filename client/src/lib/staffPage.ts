/**
 * staffPage — a `lazy()` route whose chunk may have been deployed away (#744,
 * PR #832 review finding 1).
 *
 * Production deploys whenever `main` moves (#508). A staff member holding a tab
 * from BEFORE a deploy who then first opens a staff page they have not visited
 * asks for a chunk filename the new build no longer serves; the dynamic import
 * rejects, `React.lazy` caches the rejection, and the app-wide ErrorBoundary
 * shows a raw stack over a page that would work on a plain reload. The
 * monolith never had this failure — one chunk, always present — so the split
 * that shields customers (their routes are static) owes staff this one guard.
 *
 * The remedy is the standard one: reload ONCE. A flag in `sessionStorage` stops
 * a reload loop when the chunk is genuinely broken — the second failure is
 * rethrown and the boundary shows it, which is the honest outcome. The flag is
 * cleared the moment any staff chunk loads, so the next deploy gets its own
 * single reload rather than inheriting a spent one.
 *
 * The retry is a plain function over injected `storage` and `reload` so it can
 * be driven in node (`staffPage.test.ts`) without a browser or a bundle.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const STAFF_CHUNK_RELOAD_KEY = "drape_staff_chunk_reloaded";

type Loader<T> = () => Promise<{ default: T }>;

interface RetryDeps {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  reload: () => void;
}

/**
 * Runs `load`; on the first failure reloads the page once and never resolves
 * (the reload replaces the document); on a failure after a reload, rethrows.
 */
export async function loadStaffChunk<T>(load: Loader<T>, deps: RetryDeps): Promise<{ default: T }> {
  try {
    const mod = await load();
    deps.storage.removeItem(STAFF_CHUNK_RELOAD_KEY);
    return mod;
  } catch (error) {
    if (deps.storage.getItem(STAFF_CHUNK_RELOAD_KEY) === "1") throw error;
    deps.storage.setItem(STAFF_CHUNK_RELOAD_KEY, "1");
    deps.reload();
    return new Promise<never>(() => {});
  }
}

const browserDeps = (): RetryDeps => ({
  storage: window.sessionStorage,
  reload: () => window.location.reload(),
});

/** A staff-only page as a lazy route with the once-only reload above. */
export function staffPage<T extends ComponentType<unknown>>(load: Loader<T>): LazyExoticComponent<T> {
  return lazy(() => loadStaffChunk(load, browserDeps()));
}
