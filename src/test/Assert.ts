// Assertion helpers

export class Assert {
    static equal(actual: any, expected: any, message?: string): void {
        if (actual !== expected) {
            const msg = message || `Expected ${expected}, but got ${actual}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    static deepEqual(actual: any, expected: any, message?: string): void {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            const msg = message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    static throws(fn: () => void | Promise<void>, expectedError?: string | RegExp): void {
        let thrown = false;
        try {
            const result = fn();
            if (result instanceof Promise) {
                const msg = 'Assert.throws does not support async functions. Use Assert.rejects instead.';
                console.error(msg);
                throw new Error(msg);
            }
        } catch (error) {
            thrown = true;
            if (expectedError) {
                const message = (error as Error).message;
                if (typeof expectedError === 'string') {
                    if (!message.includes(expectedError)) {
                        const msg = `Expected error message to include "${expectedError}", but got "${message}"`;
                        console.error(msg);
                        throw new Error(msg);
                    }
                } else {
                    if (!expectedError.test(message)) {
                        const msg = `Expected error message to match ${expectedError}, but got "${message}"`;
                        console.error(msg);
                        throw new Error(msg);
                    }
                }
            }
        }
        if (!thrown) {
            const msg = 'Expected function to throw, but it did not';
            console.error(msg);
            throw new Error(msg);
        }
    }

    static async rejects(fn: () => Promise<void>, expectedError?: string | RegExp): Promise<void> {
        let thrown = false;
        try {
            await fn();
        } catch (error) {
            thrown = true;
            if (expectedError) {
                const message = (error as Error).message;
                if (typeof expectedError === 'string') {
                    if (!message.includes(expectedError)) {
                        const msg = `Expected error message to include "${expectedError}", but got "${message}"`;
                        console.error(msg);
                        throw new Error(msg);
                    }
                } else {
                    if (!expectedError.test(message)) {
                        const msg = `Expected error message to match ${expectedError}, but got "${message}"`;
                        console.error(msg);
                        throw new Error(msg);
                    }
                }
            }
        }
        if (!thrown) {
            const msg = 'Expected function to reject, but it did not';
            console.error(msg);
            throw new Error(msg);
        }
    }

    static ok(value: any, message?: string): void {
        if (!value) {
            const msg = message || `Expected truthy value, but got ${value}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    static notOk(value: any, message?: string): void {
        if (value) {
            const msg = message || `Expected falsy value, but got ${value}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    static includes(haystack: string | any[], needle: any, message?: string): void {
        const includes = typeof haystack === 'string'
            ? haystack.includes(needle as string)
            : haystack.includes(needle);

        if (!includes) {
            const msg = message || `Expected ${haystack} to include ${needle}`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    static match(actual: string, pattern: RegExp, message?: string): void {
        if (!pattern.test(actual)) {
            const msg = message || `Expected "${actual}" to match ${pattern}`;
            console.error(msg);
            throw new Error(msg);
        }
    }
}
