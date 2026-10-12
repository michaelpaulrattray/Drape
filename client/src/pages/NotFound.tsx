import { useAuth } from "@/_core/hooks/useAuth";
import { ERROR_PAGE_HOME_HREF } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

/** Where a signed-out visitor's way home leads: the landing page. */
export const NOT_FOUND_VISITOR_HOME_HREF = "/";

/**
 * Where "Go to Home" leads from a wrong address (#2380).
 *
 * A signed-in customer goes to the lobby — the same home the crash page uses
 * (`ERROR_PAGE_HOME_HREF`, #2379), read from there rather than restated — and
 * not the marketing `/`, which sent someone who mistyped a link out of the
 * product. Only a visitor the session check has SETTLED as signed out goes to
 * `/`. While the check is still out the answer is the lobby, because the
 * lobby's own guard sends a signed-out person to sign in, whereas `/` would
 * strand a signed-in customer on the marketing page.
 */
export function notFoundHomeHref(session: { loading: boolean; isAuthenticated: boolean }): string {
  if (!session.loading && !session.isAuthenticated) return NOT_FOUND_VISITOR_HOME_HREF;
  return ERROR_PAGE_HOME_HREF;
}

/**
 * The page itself, drawn from the app's tokens so it follows the theme and the
 * monochrome system — the scaffold's slate gradient, red pulse and blue button
 * are gone. One plain sentence and one way back, like the crash page.
 */
export function NotFoundView({ onGoHome }: { onGoHome: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <h1 className="text-lg font-medium">There is no page at this address.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check the link, or go back to Home.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={onGoHome}>Go to Home</Button>
        </div>
      </div>
    </main>
  );
}

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { loading, isAuthenticated } = useAuth();

  return <NotFoundView onGoHome={() => setLocation(notFoundHomeHref({ loading, isAuthenticated }))} />;
}
