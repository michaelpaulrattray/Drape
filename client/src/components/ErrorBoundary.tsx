import { cn } from "@/lib/utils";
import { reportClientError } from "@/monitoring/errorReporter";
import { AlertTriangle, RotateCcw, RefreshCw, Home } from "lucide-react";
import { Component, ReactNode } from "react";

// ============ Base Error Boundary ============

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  showHomeButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
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

  handleRetry = (): void => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
    this.props.onRetry?.();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RefreshCw size={16} />
                Try Again
                {this.state.retryCount > 0 && (
                  <span className="text-xs opacity-70">({this.state.retryCount})</span>
                )}
              </button>
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-muted text-muted-foreground",
                  "hover:bg-muted/80 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                Reload Page
              </button>
              {this.props.showHomeButton && (
                <button
                  onClick={this.handleGoHome}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    "bg-muted text-muted-foreground",
                    "hover:bg-muted/80 cursor-pointer"
                  )}
                >
                  <Home size={16} />
                  Go Home
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
