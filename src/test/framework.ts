/**
 * Bespoke Test Framework for PromptPress
 * Lightweight testing without heavy dependencies
 */

export interface TestResult {
    name: string;
    passed: boolean;
    error?: Error;
    duration: number;
}

export interface TestSuite {
    name: string;
    tests: Test[];
}

export interface Test {
    name: string;
    fn: () => Promise<void> | void;
}

export class TestRunner {
    private suites: TestSuite[] = [];
    private results: TestResult[] = [];

    describe(suiteName: string, fn: () => void): void {
        const suite: TestSuite = {
            name: suiteName,
            tests: []
        };
        
        // Temporarily set current suite
        const prevTest = global.currentTest;
        global.currentTest = (name: string, testFn: () => Promise<void> | void) => {
            suite.tests.push({ name, fn: testFn });
        };
        
        fn();
        
        global.currentTest = prevTest;
        this.suites.push(suite);
    }

    async run(): Promise<TestResult[]> {
        this.results = [];
        
        for (const suite of this.suites) {
            console.log(`\n📦 ${suite.name}`);
            
            for (const test of suite.tests) {
                const start = Date.now();
                try {
                    await test.fn();
                    const duration = Date.now() - start;
                    this.results.push({
                        name: `${suite.name} > ${test.name}`,
                        passed: true,
                        duration
                    });
                    console.log(`  ✅ ${test.name} (${duration}ms)`);
                } catch (error) {
                    const duration = Date.now() - start;
                    this.results.push({
                        name: `${suite.name} > ${test.name}`,
                        passed: false,
                        error: error as Error,
                        duration
                    });
                    console.log(`  ❌ ${test.name} (${duration}ms)`);
                    console.log(`     ${(error as Error).message}`);
                }
            }
        }
        
        return this.results;
    }

    printSummary(): void {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`📊 Test Summary: ${passed}/${total} passed`);
        if (failed > 0) {
            console.log(`❌ Failed tests: ${failed}`);
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`   - ${result.name}`);
                if (result.error) {
                    console.log(`     ${result.error.message}`);
                }
            });
        }
        console.log(`${'='.repeat(50)}\n`);
    }
}

// Global test function
declare global {
    // eslint-disable-next-line no-var
    var currentTest: ((name: string, fn: () => Promise<void> | void) => void) | undefined;
}

export function it(name: string, fn: () => Promise<void> | void): void {
    if (global.currentTest) {
        global.currentTest(name, fn);
    } else {
        throw new Error('it() must be called within a describe() block');
    }
}

// Assertion helpers
export class Assert {
    static equal(actual: any, expected: any, message?: string): void {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, but got ${actual}`);
        }
    }

    static deepEqual(actual: any, expected: any, message?: string): void {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
    }

    static throws(fn: () => void | Promise<void>, expectedError?: string | RegExp): void {
        let thrown = false;
        try {
            const result = fn();
            if (result instanceof Promise) {
                throw new Error('Assert.throws does not support async functions. Use Assert.rejects instead.');
            }
        } catch (error) {
            thrown = true;
            if (expectedError) {
                const message = (error as Error).message;
                if (typeof expectedError === 'string') {
                    if (!message.includes(expectedError)) {
                        throw new Error(`Expected error message to include "${expectedError}", but got "${message}"`);
                    }
                } else {
                    if (!expectedError.test(message)) {
                        throw new Error(`Expected error message to match ${expectedError}, but got "${message}"`);
                    }
                }
            }
        }
        if (!thrown) {
            throw new Error('Expected function to throw, but it did not');
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
                        throw new Error(`Expected error message to include "${expectedError}", but got "${message}"`);
                    }
                } else {
                    if (!expectedError.test(message)) {
                        throw new Error(`Expected error message to match ${expectedError}, but got "${message}"`);
                    }
                }
            }
        }
        if (!thrown) {
            throw new Error('Expected function to reject, but it did not');
        }
    }

    static ok(value: any, message?: string): void {
        if (!value) {
            throw new Error(message || `Expected truthy value, but got ${value}`);
        }
    }

    static notOk(value: any, message?: string): void {
        if (value) {
            throw new Error(message || `Expected falsy value, but got ${value}`);
        }
    }

    static includes(haystack: string | any[], needle: any, message?: string): void {
        const includes = typeof haystack === 'string' 
            ? haystack.includes(needle as string)
            : haystack.includes(needle);
        
        if (!includes) {
            throw new Error(message || `Expected ${haystack} to include ${needle}`);
        }
    }

    static match(actual: string, pattern: RegExp, message?: string): void {
        if (!pattern.test(actual)) {
            throw new Error(message || `Expected "${actual}" to match ${pattern}`);
        }
    }
}

export const expect = {
    toBe: (actual: any, expected: any) => Assert.equal(actual, expected),
    toEqual: (actual: any, expected: any) => Assert.deepEqual(actual, expected),
    toBeTruthy: (value: any) => Assert.ok(value),
    toBeFalsy: (value: any) => Assert.notOk(value),
    toContain: (haystack: string | any[], needle: any) => Assert.includes(haystack, needle),
    toMatch: (actual: string, pattern: RegExp) => Assert.match(actual, pattern)
};
