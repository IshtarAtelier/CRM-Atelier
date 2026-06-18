/**
 * Utility functions for retrying operations with exponential backoff.
 * Useful for handling transient network issues, Google API socket closes, etc.
 */

export interface RetryOptions {
    maxRetries?: number;
    delayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    label?: string;
    shouldRetry?: (error: any) => boolean;
}

/**
 * Checks if an error is a transient network or connection error that can be retried.
 */
export function isTransientNetworkError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || error.toString() || '').toLowerCase();
    
    return (
        msg.includes('premature close') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('socket hang up') ||
        msg.includes('network') ||
        msg.includes('fetch failed') ||
        msg.includes('invalid response body') ||
        msg.includes('oauth2') ||
        msg.includes('failed to fetch') ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504
    );
}

/**
 * Retries an asynchronous function with exponential backoff.
 * Can be used on both server-side (Node) and client-side (browser).
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delayMs = 1000,
        maxDelayMs = 4000,
        factor = 2,
        label = 'Operation',
        shouldRetry = isTransientNetworkError
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            const isRetryable = shouldRetry(error);
            const hasMoreAttempts = attempt < maxRetries;

            if (hasMoreAttempts && isRetryable) {
                // Calculate exponential backoff delay: delay * factor^(attempt-1)
                const delay = Math.min(delayMs * Math.pow(factor, attempt - 1), maxDelayMs);
                
                console.warn(
                    `[RetryUtils] ${label} failed (attempt ${attempt}/${maxRetries}) due to transient error: "${error.message || error}". ` +
                    `Retrying in ${delay}ms...`
                );

                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // No more attempts or not retryable
                if (!isRetryable) {
                    console.error(`[RetryUtils] ${label} failed with non-retryable error (attempt ${attempt}/${maxRetries}):`, error);
                } else {
                    console.error(`[RetryUtils] ${label} failed after maximum of ${maxRetries} attempts:`, error);
                }
                throw error;
            }
        }
    }

    throw lastError;
}
