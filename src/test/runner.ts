/**
 * Main test runner for PromptPress
 * Run with: node out/test/runner.js
 * Run scaffold test: node out/test/runner.js scaffold
 * Run cascade test: node out/test/runner.js cascade
 * Run all tests: node out/test/runner.js all
 */

// Last commit hash for test updates: 6d6e538

// Removed vscode module interception; tests avoid vscode dependencies now.

import { runXAIClientTests } from './xaiClient.test.js';
import { runScaffoldIntegrationTest } from './scaffold-integration.test.js';
import { runCascadeServiceTest } from './cascadeService.test.js';
import { runConOpsUpdateIntegrationTest } from './scaffold-integration.test.js';
import { runImplParserTest } from './implParser.test.js';
import { runIdeValidationTests } from './ide-validation.test.js';

async function main() {
    const args = process.argv.slice(2);
    const runScaffoldTest = args.includes('scaffold');
    const runCascadeTest = args.includes('cascade');
    const runConOpsTest = args.includes('conops');
    const runAllTests = args.includes('all');
    const runParserTest = args.includes('parser');
    const runIdeTest = args.includes('ide');
    
    console.log('🚀 PromptPress Test Suite\n');
    console.log('Running tests...\n');
    
    try {
        if (runAllTests) {
            console.log('📦 Running All Tests\n');
            
            console.log('1️⃣  XAI Client Tests\n');
            await runXAIClientTests();
            
            console.log('\n2️⃣  Cascade Service Tests\n');
            await runCascadeServiceTest();
            
            console.log('\n5️⃣  ImplParser Tests\n');
            await runImplParserTest();
            
            console.log('\n6️⃣  IDE Validation Tests\n');
            await runIdeValidationTests();
            
            console.log('\n3️⃣  Scaffold Integration Tests\n');
            await runScaffoldIntegrationTest();
            
            console.log('\n4️⃣  ConOps Update Integration Tests\n');
            await runConOpsUpdateIntegrationTest();
        } else if (runScaffoldTest) {
            console.log('📦 Running Scaffold Integration Test\n');
            await runScaffoldIntegrationTest();
        } else if (runCascadeTest) {
            console.log('📦 Running Cascade Service Test\n');
            await runCascadeServiceTest();
        } else if (runConOpsTest) {
            console.log('📦 Running ConOps Update Integration Test\n');
            await runConOpsUpdateIntegrationTest();
        } else if (runParserTest) {
            console.log('📦 Running ImplParser Test\n');
            await runImplParserTest();
        } else if (runIdeTest) {
            console.log('📦 Running IDE Validation Tests\n');
            await runIdeValidationTests();
        } else {
            console.log('📦 Running Standard Tests\n');
            await runXAIClientTests();
            await runImplParserTest();
            
            console.log('\n💡 Tips:');
            console.log('  - Run "node out/test/runner.js scaffold" for scaffold integration tests');
            console.log('  - Run "node out/test/runner.js cascade" for cascade service tests');
            console.log('  - Run "node out/test/runner.js conops" for ConOps update integration tests');
            console.log('  - Run "node out/test/runner.js all" for complete test suite\n');
        }
        
        console.log('\n✅ All test suites completed\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    }
}

main();
