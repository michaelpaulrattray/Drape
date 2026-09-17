import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, RefreshCw, Home } from "lucide-react";
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

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

// ============ Generation Error Boundary ============

/**
 * Specialized Error Boundary for Generation/API errors
 * Provides more context-specific messaging and compact styling
 */
interface GenerationErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  context?: 'headshot' | 'fullBody' | 'multiView' | 'iteration' | 'eraser';
}

interface GenerationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const CONTEXT_MESSAGES: Record<string, { title: string; description: string }> = {
  headshot: {
    title: 'Headshot Generation Failed',
    description: 'We couldn\'t generate your model headshot. This might be due to high demand or a temporary issue.',
  },
  fullBody: {
    title: 'Full Body Generation Failed',
    description: 'We couldn\'t generate the full body image. Please try again.',
  },
  multiView: {
    title: 'Multi-View Generation Failed',
    description: 'We couldn\'t generate the additional views. Please try again.',
  },
  iteration: {
    title: 'Image Refinement Failed',
    description: 'We couldn\'t apply your refinements. Please try again with a different prompt.',
  },
  eraser: {
    title: 'Magic Eraser Failed',
    description: 'We couldn\'t process the eraser operation. Please try again.',
  },
  default: {
    title: 'Generation Error',
    description: 'Something went wrong during image generation. Please try again.',
  },
};

class GenerationErrorBoundary extends Component<
  GenerationErrorBoundaryProps,
  GenerationErrorBoundaryState
> {
  constructor(props: GenerationErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GenerationErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('GenerationErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const messages = CONTEXT_MESSAGES[this.props.context || 'default'] || CONTEXT_MESSAGES.default;

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-red-50/50 border border-red-200 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h4 className="text-sm font-semibold text-red-800 mb-1">
            {messages.title}
          </h4>
          <p className="text-xs text-red-600/80 mb-4 text-center max-w-xs">
            {messages.description}
          </p>
          {this.state.error && (
            <p className="text-xs text-red-500/60 mb-3 font-mono">
              Error: {this.state.error.message.slice(0, 100)}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleRetry}
            className="gap-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-3 h-3" />
            Retry Generation
            {this.state.retryCount > 0 && (
              <span className="text-xs opacity-60">({this.state.retryCount})</span>
            )}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
