/**
 * lazyWithRetry — React.lazy() wrapper with automatic retry on import failure.
 *
 * During deployments or server restarts, dynamic imports can fail because
 * the dev/prod server is temporarily unavailable. This utility retries
 * the import with exponential backoff before giving up.
 *
 * Usage:
 *   const MyComponent = lazyWithRetry(() => import("./MyComponent"));
 */
import { lazy, type ComponentType } from "react";

interface LazyWithRetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry — doubles each attempt (default: 1000) */
  baseDelay?: number;
}

type LazyImportFn<T extends ComponentType<any>> = () => Promise<{
  default: T;
}>;

function retryImport<T extends ComponentType<any>>(
  importFn: LazyImportFn<T>,
  maxRetries: number,
  baseDelay: number,
): Promise<{ default: T }> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryImport = () => {
      importFn()
        .then(resolve)
        .catch((error: Error) => {
          attempt += 1;

          if (attempt > maxRetries) {
            reject(error);
            return;
          }

          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.warn(
            `[lazyWithRetry] Import failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
            error.message,
          );
          setTimeout(tryImport, delay);
        });
    };

    tryImport();
  });
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: LazyImportFn<T>,
  options?: LazyWithRetryOptions,
) {
  const { maxRetries = 3, baseDelay = 1000 } = options ?? {};
  return lazy(() => retryImport(importFn, maxRetries, baseDelay));
}
