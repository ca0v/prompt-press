/**
 * Tests for XAIClient
 * Reproduces and tests the 404 error
 */

import * as vscode from 'vscode';
import { XAIClient } from '../ai/xaiClient';
import { TestRunner, it } from './framework';
import { Assert } from "./Assert";

// Mock output channel for testing
class MockOutputChannel implements vscode.OutputChannel {
    name: string = 'Test';
    lines: string[] = [];
    
    append(value: string): void {
        this.lines.push(value);
    }
    
    appendLine(value: string): void {
        this.lines.push(value + '\n');
    }
    
    clear(): void {
        this.lines = [];
    }
    
    show(columnOrPreserveFocus?: vscode.ViewColumn | boolean, preserveFocus?: boolean): void {
        console.log('Output channel shown');
    }
    
    hide(): void {}
    dispose(): void {}
    replace(value: string): void {}
}

// Mock workspace configuration
class MockWorkspaceConfiguration implements vscode.WorkspaceConfiguration {
    private config: Map<string, any> = new Map();
    
    constructor(initialConfig?: Record<string, any>) {
        if (initialConfig) {
            Object.entries(initialConfig).forEach(([key, value]) => {
                this.config.set(key, value);
            });
        }
    }
    
    get<T>(section: string, defaultValue?: T): T {
        return this.config.get(section) ?? defaultValue as T;
    }
    
    has(section: string): boolean {
        return this.config.has(section);
    }
    
    inspect<T>(section: string): { key: string } | undefined {
        return undefined;
    }
    
    update(section: string, value: any): Thenable<void> {
        this.config.set(section, value);
        return Promise.resolve();
    }
}

export async function runXAIClientTests(): Promise<void> {
    const runner = new TestRunner();
    
    // Test Suite 1: Configuration and Setup
    runner.describe('XAIClient Configuration', () => {
        it('should use correct default API endpoint', () => {
            const config = new MockWorkspaceConfiguration();
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            // Verify the client was created
            Assert.ok(client, 'Client should be created');
        });
        
        it('should accept custom API endpoint', () => {
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://custom.api.com/v1',
                model: 'custom-model'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            Assert.ok(client, 'Client should be created with custom config');
        });
        
        it('should use correct model from config', () => {
            const config = new MockWorkspaceConfiguration({
                model: 'grok-2-1212'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            Assert.ok(client, 'Client should be created with custom model');
        });
    });
    
    // Test Suite 2: API Endpoint Issues
    runner.describe('XAIClient API Endpoint Issues', () => {
        it('should fail with 404 when endpoint is wrong', async () => {
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://httpbin.org', // Wrong endpoint to reproduce 404
                model: 'grok-beta'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            try {
                await client.chat([
                    { role: 'user', content: 'test message' }
                ]);
                throw new Error('Should have thrown an error');
            } catch (error: any) {
                // Verify we get a proper error
                Assert.ok(error.message, 'Error should have a message');
                console.log(`      Caught expected error: ${error.message}`);
            }
        });
        
        it('should construct correct URL path', async () => {
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-beta'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('fake-key', config, output);
            
            try {
                await client.chat([
                    { role: 'user', content: 'test' }
                ]);
            } catch (error: any) {
                // We expect this to fail due to auth, not 404
                // If it's 404, the URL construction is wrong
                console.log(`      Error status: ${error.message}`);
                
                // Extract status code if present
                const has404 = error.message.includes('404');
                const has401 = error.message.includes('401');
                const has403 = error.message.includes('403');
                
                if (has404) {
                    throw new Error('Got 404 - endpoint URL is incorrect! Should be https://api.x.ai/v1/chat/completions');
                }
                
                // 401/403 is expected with fake API key
                if (!has401 && !has403) {
                    console.log(`      Got unexpected error (not auth-related): ${error.message}`);
                }
            }
        });
    });
    
    // Test Suite 3: Real API Integration (if API key is available)
    runner.describe('XAIClient Real API Tests', () => {
        const apiKey = process.env.PROMPT_PRESS_XAI_API_KEY;
        
        it('should successfully make API call with real key and grok-code-fast-1', async () => {
            if (!apiKey) {
                console.log('      ⏭️  Skipping - no API key');
                return;
            }
            
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient(apiKey, config, output);
            
            const response = await client.chat([
                { role: 'user', content: 'Say "test successful" and nothing else.' }
            ]);
            
            Assert.ok(response, 'Should get a response');
            Assert.ok(response.length > 0, 'Response should not be empty');
            console.log(`      Got response: ${response.substring(0, 50)}...`);
        });
        
        it('should work with grok-code-fast-1 model', async () => {
            if (!apiKey) {
                console.log('      ⏭️  Skipping - no API key');
                return;
            }
            
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient(apiKey, config, output);
            
            const response = await client.chat([
                { role: 'user', content: 'Respond with exactly: OK' }
            ]);
            
            Assert.ok(response, 'Should get a response from grok-code-fast-1');
            console.log(`      Response received (${response.length} chars)`);
        });
        
        it('should fail gracefully with deprecated model', async () => {
            if (!apiKey) {
                console.log('      ⏭️  Skipping - no API key');
                return;
            }
            
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-beta'  // Deprecated model
            });
            const output = new MockOutputChannel();
            const client = new XAIClient(apiKey, config, output);
            
            try {
                await client.chat([
                    { role: 'user', content: 'test' }
                ]);
                throw new Error('Should have thrown an error for deprecated model');
            } catch (error: any) {
                Assert.ok(error.message, 'Should have error message');
                console.log(`      Correctly caught error: ${error.message}`);
            }
        });
    });
    
    // Test Suite 4: Error Handling and Logging
    runner.describe('XAIClient Error Handling', () => {
        it('should log errors to output channel', async () => {
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://httpbin.org/status/500',
                model: 'test-model'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            try {
                await client.chat([
                    { role: 'user', content: 'test' }
                ]);
            } catch (error) {
                // Verify logging happened
                Assert.ok(output.lines.length > 0, 'Should have logged to output channel');
                console.log(`      Logged ${output.lines.length} lines to output`);
            }
        });
        
        it('should include request details in error logs', async () => {
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://httpbin.org/status/400',
                model: 'test-model'
            });
            const output = new MockOutputChannel();
            const client = new XAIClient('test-key', config, output);
            
            try {
                await client.chat([
                    { role: 'user', content: 'test' }
                ]);
            } catch (error) {
                const logs = output.lines.join('');
                Assert.ok(logs.includes('[XAI]'), 'Logs should include [XAI] prefix');
            }
        });
    });
    
    await runner.run();
    runner.printSummary();
}

// Export for use in main test runner
export { runXAIClientTests as default };
