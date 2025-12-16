/**
 * Main test runner for PromptPress
 * Run with: node out/test/runner.js
 * Run scaffold test: node out/test/runner.js scaffold
 */

import { runXAIClientTests } from './xaiClient.test';
import { runScaffoldIntegrationTest } from './scaffold-integration.test';

async function main() {
    const args = process.argv.slice(2);
    const runScaffoldTest = args.includes('scaffold');
    
    console.log('🚀 PromptPress Test Suite\n');
    console.log('Running tests...\n');
    
    try {
        if (runScaffoldTest) {
            console.log('📦 Running Scaffold Integration Test\n');
            await runScaffoldIntegrationTest();
        } else {
            console.log('📦 Running Standard Tests\n');
            await runXAIClientTests();
            
            console.log('\n💡 Tip: Run "node out/test/runner.js scaffold" for full integration test\n');
        }
        
        console.log('\n✅ All test suites completed\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    }
}

main();
