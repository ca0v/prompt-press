/**
 * Main test runner for PromptPress
 * Run with: node out/test/runner.js
 */

import { runXAIClientTests } from './xaiClient.test';

async function main() {
    console.log('🚀 PromptPress Test Suite\n');
    console.log('Running tests...\n');
    
    try {
        await runXAIClientTests();
        
        console.log('\n✅ All test suites completed\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    }
}

main();
