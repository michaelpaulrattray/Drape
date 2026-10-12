import { Button } from "@/components/ui/button";
import { reportClientError } from "@/monitoring/errorReporter";
import { Component, ReactNode } from "react";

/**
 * Where "Go to Home" leads: the lobby, which the rail itself calls Home
 * (`foundation/Rail.tsx`). Not the marketing `/` — a signed-in customer who
 * hits a broken page wants their work, not the landing page. Someone who is
 * not signed in meets the lobby's own guard and is sent to sign in (#2379).
 */
export const ERROR_PAGE_HOME_HREF = "/app";

// ============ Base Error Boundary ============

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * ⚠ THE PAGE A CRASH LEAVES BEHIND SHOWS NO MACHINERY (#2379).
 *
 * It printed `error.stack` — function names, file paths, line numbers — to
 * every visitor, under "An unexpected error occurred.", and its way back to
 * the product sat behind a `showHomeButton` prop the app's only boundary never
 * passed. The stack served nobody there: it already goes to the console and to
 * the error report (`componentDidCatch`, below). So the boundary no longer
 * keeps the error in state at all — what the page draws cannot reach it — and
 * the way home is always on. `errorBoundaryPage.test.ts` drives `render()`.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    /*
     * ⚠ A BOUNDARY-CAUGHT RENDER CRASH REACHES NO GLOBAL HANDLER, WHICH IS WHY
     * THIS LINE IS THE MOST VALUABLE ONE IN #509's BROWSER HALF.
     *
     * React reports an error it could NOT hand to a boundary through
     * `window.onerror`; one a boundary DOES catch goes to `onCaughtError`, whose
     * default is a console line. This component wraps the whole app, so until
     * now every render crash in this product — React #310 among them, which has
     * happened here — was written to a console nobody was reading and reached
     * nobody at all.
     *
     * ⚠ **`errorInfo.componentStack` IS PASSED NOW (#1420), AND IT IS THE FIELD
     * THIS CALL SITE EXISTS FOR.** A render crash's own stack points at React's
     * internals — `commitHookEffectListMount`, `renderWithHooks` — and names no
     * component of ours; the component stack is the only thing that says WHICH
     * PART OF THE TREE was rendering. It was left out by #1418 because the
     * scrub's projection had no field for it and could not carry it; that field
     * exists now (`contexts.react.componentStack`), where the SDK's own React
     * integration puts it, so Sentry renders it rather than burying it.
     *
     * It is OUR component names and never a customer's words, which is why this
     * widening is a small one — and it still goes through the scrub's redaction
     * and cap like every other free-text value, because a DEV build's component
     * stack carries source paths and a path can name a person.
     */
    reportClientError(error, {
      kind: 'render',
      route: window.location.pathname,
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  /* A reload is the honest "try again": an in-place re-render of the same
     tree almost always throws the same error, and a reload also recovers a
     stale bundle after a deploy. */
  handleTryAgain = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = ERROR_PAGE_HOME_HREF;
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <h1 className="text-lg font-medium">Something went wrong on this page.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Try again, or go back to Home.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={this.handleTryAgain}>Try again</Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                Go to Home
              </Button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
