import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, RefreshCw, Home } from "lucide-react";
import { Component, ReactNode, useCallback, useState } from "react";
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
  context?: 'headshot' | 'fullBody' | 'multiView' | 'iteration' | 'upscale' | 'eraser';
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
  upscale: {
    title: 'Upscale Failed',
    description: 'We couldn\'t upscale your image. Please try again.',
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

export class GenerationErrorBoundary extends Component<
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

// ============ Inline Error Display Component ============

/**
 * Inline error display for use within forms/panels
 * Not a boundary - use for displaying caught errors inline
 */
interface InlineErrorProps {
  error: Error | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function InlineError({ error, onRetry, onDismiss, className }: InlineErrorProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm",
      className
    )}>
      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
      <span className="text-red-700 flex-1">{errorMessage}</span>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-red-600 hover:text-red-800 p-1"
            title="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 p-1"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Retry Hook ============

/**
 * Hook for handling async errors with retry logic
 * Use this for mutation/query error handling
 */
export function useRetryHandler(maxRetries = 3) {
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const handleError = useCallback((error: Error) => {
    setLastError(error);
    console.error('Retry handler caught error:', error);
  }, []);

  const retry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setLastError(null);
      return true;
    }
    return false;
  }, [retryCount, maxRetries]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setLastError(null);
  }, []);

  return {
    retryCount,
    lastError,
    canRetry: retryCount < maxRetries,
    handleError,
    retry,
    reset,
  };
}

// ============ Async Error Handler ============

/**
 * Wrapper for async operations with automatic retry
 * Returns a function that wraps your async operation with retry logic
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): T {
  const { maxRetries = 3, delayMs = 1000, onRetry } = options;

  return (async (...args: Parameters<T>) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          onRetry?.(attempt + 1, lastError);
          await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }) as T;
}
