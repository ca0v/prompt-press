import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { DebounceManager } from '../utils/debounce.js';

export async function runDebounceTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('DebounceManager (core)', () => {
        it('should execute function after delay', async () => {
            const manager = new DebounceManager();
            let executed = false;

            manager.debounce('test', () => { executed = true; }, 10);

            // Should not be executed immediately
            Assert.equal(executed, false);

            // Wait for execution
            await new Promise(resolve => setTimeout(resolve, 20));
            Assert.equal(executed, true);
        });

        it('should cancel previous call when debounced again', async () => {
            const manager = new DebounceManager();
            let callCount = 0;

            manager.debounce('test', () => { callCount++; }, 20);
            await new Promise(resolve => setTimeout(resolve, 10));
            manager.debounce('test', () => { callCount++; }, 20);

            // Wait for second delay
            await new Promise(resolve => setTimeout(resolve, 25));
            // Only the second call should have executed
            Assert.equal(callCount, 1);
        });

        it('should handle multiple keys independently', async () => {
            const manager = new DebounceManager();
            let callCount1 = 0;
            let callCount2 = 0;

            manager.debounce('key1', () => { callCount1++; }, 10);
            manager.debounce('key2', () => { callCount2++; }, 10);

            await new Promise(resolve => setTimeout(resolve, 20));
            Assert.equal(callCount1, 1);
            Assert.equal(callCount2, 1);
        });

        it('should cancel specific key', async () => {
            const manager = new DebounceManager();
            let executed = false;

            manager.debounce('test', () => { executed = true; }, 10);
            manager.cancel('test');

            await new Promise(resolve => setTimeout(resolve, 20));
            Assert.equal(executed, false);
        });

        it('should cancel all pending calls', async () => {
            const manager = new DebounceManager();
            let callCount1 = 0;
            let callCount2 = 0;

            manager.debounce('key1', () => { callCount1++; }, 10);
            manager.debounce('key2', () => { callCount2++; }, 10);
            manager.cancelAll();

            await new Promise(resolve => setTimeout(resolve, 20));
            Assert.equal(callCount1, 0);
            Assert.equal(callCount2, 0);
        });
    });
    await runner.run();
}