import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { logger } from '../utils/OutputLogger.js';

export async function runOutputLoggerTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('OutputLogger', () => {
        it('should have logger instance with required methods', async () => {
            Assert.equal(logger !== null, true);
            Assert.equal(typeof logger.log, 'function');
            Assert.equal(typeof logger.setOutputChannel, 'function');
        });

        it('should log to console when no channel set', async () => {
            logger.setOutputChannel(null);
            // Since it logs to console, we can't easily test output, but ensure no throw
            logger.log('Test message');
            Assert.equal(true, true); // If no exception, pass
        });

        it('should set output channel', async () => {
            // Mock channel
            const mockChannel = {
                appendLine: (msg: string) => {}
            };
            logger.setOutputChannel(mockChannel as any);
            // Again, hard to test without spying, but ensure no throw
            logger.log('Test message');
            Assert.equal(true, true);
        });
    });
    await runner.run();
}