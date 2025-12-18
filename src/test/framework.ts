/**
 * Bespoke Test Framework for PromptPress
 * Lightweight testing without heavy dependencies
 */

import { Assert } from "./Assert";

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

export const expect = {
    toBe: (actual: any, expected: any) => Assert.equal(actual, expected),
    toEqual: (actual: any, expected: any) => Assert.deepEqual(actual, expected),
    toBeTruthy: (value: any) => Assert.ok(value),
    toBeFalsy: (value: any) => Assert.notOk(value),
    toContain: (haystack: string | any[], needle: any) => Assert.includes(haystack, needle),
    toMatch: (actual: string, pattern: RegExp) => Assert.match(actual, pattern)
};
