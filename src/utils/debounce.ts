/**
 * DebounceManager - Manages debounced function calls per key
 * Useful for debouncing operations that need to be unique per identifier (e.g., file URI)
 */
export class DebounceManager {
    private timeouts = new Map<string, NodeJS.Timeout>();

    /**
     * Debounces a function call for the given key.
     * If a previous call is pending for the same key, it is cancelled and replaced.
     * @param key Unique identifier for the debounced operation
     * @param func Function to execute after the delay
     * @param delay Delay in milliseconds
     */
    debounce(key: string, func: () => void, delay: number): void {
        const existing = this.timeouts.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        this.timeouts.set(key, setTimeout(() => {
            this.timeouts.delete(key);
            func();
        }, delay));
    }

    /**
     * Cancels any pending debounced call for the given key
     * @param key Unique identifier
     */
    cancel(key: string): void {
        const existing = this.timeouts.get(key);
        if (existing) {
            clearTimeout(existing);
            this.timeouts.delete(key);
        }
    }

    /**
     * Cancels all pending debounced calls
     */
    cancelAll(): void {
        for (const timeout of this.timeouts.values()) {
            clearTimeout(timeout);
        }
        this.timeouts.clear();
    }
}