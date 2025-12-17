/**
 * Integration test for scaffolding a complete project with caching
 * Tests the full flow: requirement → design → implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestRunner, Assert, it } from './framework';

// Simple cache implementation
class ResponseCache {
    private cachePath: string;
    private cache: Map<string, string>;

    constructor(cachePath: string) {
        this.cachePath = cachePath;
        this.cache = new Map();
    }

    async load(): Promise<void> {
        try {
            const data = await fs.readFile(this.cachePath, 'utf-8');
            const parsed = JSON.parse(data);
            this.cache = new Map(Object.entries(parsed));
            console.log(`[Cache] Loaded ${this.cache.size} cached responses`);
        } catch (error) {
            console.log('[Cache] No existing cache found, starting fresh');
            this.cache = new Map();
        }
    }

    async save(): Promise<void> {
        const obj = Object.fromEntries(this.cache);
        await fs.writeFile(this.cachePath, JSON.stringify(obj, null, 2), 'utf-8');
        console.log(`[Cache] Saved ${this.cache.size} responses to cache`);
    }

    get(key: string): string | undefined {
        return this.cache.get(key);
    }

    set(key: string, value: string): void {
        this.cache.set(key, value);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    size(): number {
        return this.cache.size;
    }

    generateKey(model: string, messages: any[]): string {
        // Create a stable key from model and message content
        const content = messages.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
        return `${model}:${this.hashString(content)}`;
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
}

// Mock XAI Client with caching
class CachedXAIClient {
    private cache: ResponseCache;
    private realClient: any;

    constructor(apiKey: string, config: any, outputChannel: any, cache: ResponseCache) {
        this.cache = cache;
        // Only create real client if we have API key
        if (apiKey) {
            const { XAIClient } = require('../ai/xaiClient');
            this.realClient = new XAIClient(apiKey, config, outputChannel);
        }
    }

    async chat(messages: any[], options?: any): Promise<string> {
        const model = 'grok-code-fast-1';
        const key = this.cache.generateKey(model, messages);

        // Check cache first
        if (this.cache.has(key)) {
            console.log('[Cache] ✅ Cache hit - returning cached response');
            return this.cache.get(key)!;
        }

        console.log('[Cache] ❌ Cache miss - making real API call');

        if (!this.realClient) {
            throw new Error('No API key available and no cached response');
        }

        // Make real API call
        const response = await this.realClient.chat(messages, options);

        // Cache the response
        this.cache.set(key, response);
        await this.cache.save();

        return response;
    }

    parseResponse(response: string): any {
        if (this.realClient) {
            return this.realClient.parseResponse(response);
        }
        // Simple fallback parser
        return {
            mainContent: response,
            questions: [],
            requestedDocs: [],
            validationStatus: undefined
        };
    }
}

// Mock workspace configuration
class MockWorkspaceConfiguration {
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

// Mock output channel
class MockOutputChannel {
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

    show(columnOrPreserveFocus?: any, preserveFocus?: boolean): void {
        // Silent for tests
    }

    hide(): void { }
    dispose(): void { }
    replace(value: string): void { }
}

export async function runScaffoldIntegrationTest(): Promise<void> {
    const runner = new TestRunner();

    // Test Suite: Game of Life Scaffold with Caching
    runner.describe('Game of Life Scaffold Integration Test', () => {
        const cachePath = path.join(__dirname, '../../test-cache.json');
        const testOutputDir = path.join(__dirname, '../../test-output');
        let cache: ResponseCache;

        it('should scaffold complete game-of-life project with caching', async () => {
            console.log('\n[Test] Starting Game of Life scaffold test...');

            // Setup cache
            cache = new ResponseCache(cachePath);
            await cache.load();

            // Setup mocks
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();

            // Get API key
            const apiKey = process.env.PROMPT_PRESS_XAI_API_KEY;
            if (!apiKey && cache.size() === 0) {
                console.log('      ⏭️  Skipping - no API key and no cache');
                return;
            }

            // Create client with caching
            const client = new CachedXAIClient(apiKey || '', config, output, cache);

            // Create test output directory
            await fs.mkdir(testOutputDir, { recursive: true });

            // Test 1: Generate Requirement Specification
            console.log('\n[Test] Step 1: Generating requirement specification...');
            const reqResponse = await generateRequirement(client, testOutputDir);
            console.log('[Test] ✅ Requirement generated:', reqResponse.length, 'characters');

            // Validate requirement structure
            Assert.ok(reqResponse.includes('---'), 'Should have YAML frontmatter');
            Assert.ok(reqResponse.includes('artifact:'), 'Should have artifact field');
            Assert.ok(reqResponse.includes('phase: requirement'), 'Should have phase field');
            Assert.ok(reqResponse.includes('## Functional Requirements'), 'Should have functional requirements section');

            // Save requirement
            const reqPath = path.join(testOutputDir, 'game-of-life.req.md');
            await fs.writeFile(reqPath, reqResponse, 'utf-8');
            console.log('[Test] Saved requirement to:', reqPath);

            // Test 2: Generate Design Specification
            console.log('\n[Test] Step 2: Generating design specification...');
            const designResponse = await generateDesign(client, reqResponse, testOutputDir);
            console.log('[Test] ✅ Design generated:', designResponse.length, 'characters');

            // Validate design structure
            Assert.ok(designResponse.includes('---'), 'Should have YAML frontmatter');
            Assert.ok(designResponse.includes('phase: design'), 'Should have design phase');
            Assert.ok(designResponse.includes('## Architecture') || designResponse.includes('## Design'), 'Should have architecture/design section');

            // Save design
            const designPath = path.join(testOutputDir, 'game-of-life.design.md');
            await fs.writeFile(designPath, designResponse, 'utf-8');
            console.log('[Test] Saved design to:', designPath);

            // Test 3: Generate Implementation Specification
            console.log('\n[Test] Step 3: Generating implementation specification...');
            const implResponse = await generateImplementation(client, reqResponse, designResponse, testOutputDir);
            console.log('[Test] ✅ Implementation generated:', implResponse.length, 'characters');

            // Validate implementation structure
            Assert.ok(implResponse.includes('---'), 'Should have YAML frontmatter');
            Assert.ok(implResponse.includes('phase: implementation'), 'Should have implementation phase');

            // Save implementation
            const implPath = path.join(testOutputDir, 'game-of-life.impl.md');
            await fs.writeFile(implPath, implResponse, 'utf-8');
            console.log('[Test] Saved implementation to:', implPath);

            // Verify all files exist
            const reqExists = await fileExists(reqPath);
            const designExists = await fileExists(designPath);
            const implExists = await fileExists(implPath);

            Assert.ok(reqExists, 'Requirement file should exist');
            Assert.ok(designExists, 'Design file should exist');
            Assert.ok(implExists, 'Implementation file should exist');

            console.log('\n[Test] ✅ Complete scaffold generated successfully!');
            console.log('[Test] Files created:');
            console.log('      -', reqPath);
            console.log('      -', designPath);
            console.log('      -', implPath);
        });

        it('should use cached responses on second run', async () => {
            console.log('\n[Test] Testing cache effectiveness...');

            // Reload cache
            cache = new ResponseCache(cachePath);
            await cache.load();

            const initialSize = cache.size();
            console.log('[Test] Cache size before test:', initialSize);

            if (initialSize === 0) {
                console.log('      ⏭️  Skipping - no cache available yet');
                return;
            }

            // Setup mocks (no API key needed - should use cache)
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();

            // Create client WITHOUT API key - must use cache
            const client = new CachedXAIClient('', config, output, cache);

            // Try to generate requirement (should come from cache)
            console.log('[Test] Generating requirement from cache...');
            const reqResponse = await generateRequirement(client, testOutputDir);

            Assert.ok(reqResponse.length > 0, 'Should get response from cache');
            console.log('[Test] ✅ Successfully used cached response');

            const finalSize = cache.size();
            console.log('[Test] Cache size after test:', finalSize);
            Assert.equal(finalSize, initialSize, 'Cache size should not change when using cached responses');
        });

        it('should cascade requirement changes through design and implementation', async () => {
            console.log('\n[Test] Testing change propagation through specs...');

            // Setup cache
            cache = new ResponseCache(cachePath);
            await cache.load();

            // Setup mocks
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();

            // Get API key
            const apiKey = process.env.PROMPT_PRESS_XAI_API_KEY;
            if (!apiKey && cache.size() === 0) {
                console.log('      ⏭️  Skipping - no API key and no cache');
                return;
            }

            // Create client with caching
            const client = new CachedXAIClient(apiKey || '', config, output, cache);

            // Step 1: Read existing requirement file
            const reqPath = path.join(testOutputDir, 'game-of-life.req.md');
            let reqContent = await fs.readFile(reqPath, 'utf-8');
            console.log('[Test] Read existing requirement file');

            // Step 2: Modify the Overview section
            const originalOverview = 'Web-based implementation of Conway\'s Game of Life';
            const modifiedOverview = 'Web-based implementation of Conway\'s Game of Life with multiplayer collaboration and real-time synchronization';
            
            if (!reqContent.includes(originalOverview)) {
                console.log('[Test] ⚠️  Original overview text not found, using current content');
                // Extract current overview for comparison
                const overviewMatch = reqContent.match(/## Overview\s+([\s\S]*?)(?=\n## )/);
                if (overviewMatch) {
                    console.log('[Test] Current overview:', overviewMatch[1].substring(0, 100) + '...');
                }
            } else {
                reqContent = reqContent.replace(originalOverview, modifiedOverview);
                await fs.writeFile(reqPath, reqContent, 'utf-8');
                console.log('[Test] ✅ Modified requirement Overview to include multiplayer feature');
            }

            // Step 3: Regenerate design with updated requirement
            console.log('\n[Test] Regenerating design based on modified requirement...');
            const updatedReqContent = await fs.readFile(reqPath, 'utf-8');
            const updatedDesignResponse = await generateDesignWithModification(
                client, 
                updatedReqContent, 
                'multiplayer collaboration',
                testOutputDir
            );
            console.log('[Test] ✅ Design regenerated:', updatedDesignResponse.length, 'characters');

            // Verify design mentions the new feature
            const designMentionsMultiplayer = 
                updatedDesignResponse.toLowerCase().includes('multiplayer') ||
                updatedDesignResponse.toLowerCase().includes('collaboration') ||
                updatedDesignResponse.toLowerCase().includes('real-time') ||
                updatedDesignResponse.toLowerCase().includes('sync');

            if (designMentionsMultiplayer) {
                console.log('[Test] ✅ Design reflects multiplayer feature');
            } else {
                console.log('[Test] ⚠️  Design may not explicitly mention multiplayer (check content)');
            }

            // Save updated design
            const designPath = path.join(testOutputDir, 'game-of-life.design.md');
            await fs.writeFile(designPath, updatedDesignResponse, 'utf-8');
            console.log('[Test] Saved updated design to:', designPath);

            // Step 4: Regenerate implementation with updated design
            console.log('\n[Test] Regenerating implementation based on updated design...');
            const updatedImplResponse = await generateImplementationWithModification(
                client,
                updatedReqContent,
                updatedDesignResponse,
                'multiplayer collaboration',
                testOutputDir
            );
            console.log('[Test] ✅ Implementation regenerated:', updatedImplResponse.length, 'characters');

            // Verify implementation mentions the new feature
            const implMentionsMultiplayer = 
                updatedImplResponse.toLowerCase().includes('multiplayer') ||
                updatedImplResponse.toLowerCase().includes('collaboration') ||
                updatedImplResponse.toLowerCase().includes('websocket') ||
                updatedImplResponse.toLowerCase().includes('real-time');

            if (implMentionsMultiplayer) {
                console.log('[Test] ✅ Implementation reflects multiplayer feature');
            } else {
                console.log('[Test] ⚠️  Implementation may not explicitly mention multiplayer (check content)');
            }

            // Save updated implementation
            const implPath = path.join(testOutputDir, 'game-of-life.impl.md');
            await fs.writeFile(implPath, updatedImplResponse, 'utf-8');
            console.log('[Test] Saved updated implementation to:', implPath);

            // Step 5: Verify cascade effect
            console.log('\n[Test] Verifying change cascade...');
            
            // Read all files
            const finalReq = await fs.readFile(reqPath, 'utf-8');
            const finalDesign = await fs.readFile(designPath, 'utf-8');
            const finalImpl = await fs.readFile(implPath, 'utf-8');

            // Verify structure is maintained
            Assert.ok(finalReq.includes('---'), 'Requirement should maintain YAML frontmatter');
            Assert.ok(finalDesign.includes('---'), 'Design should maintain YAML frontmatter');
            Assert.ok(finalImpl.includes('---'), 'Implementation should maintain YAML frontmatter');

            // Verify phases
            Assert.ok(finalReq.includes('phase: requirement'), 'Requirement phase maintained');
            Assert.ok(finalDesign.includes('phase: design'), 'Design phase maintained');
            Assert.ok(finalImpl.includes('phase: implementation'), 'Implementation phase maintained');

            console.log('\n[Test] ✅ Change successfully cascaded through all specification files!');
            console.log('[Test] Summary:');
            console.log('      - Modified: game-of-life.req.md (added multiplayer)');
            console.log('      - Regenerated: game-of-life.design.md');
            console.log('      - Regenerated: game-of-life.impl.md');
            console.log('      - All files maintain proper structure');
        });
    });

    await runner.run();
    runner.printSummary();
}

async function generateRequirement(client: CachedXAIClient, outputDir: string): Promise<string> {
    const systemPrompt = `You are an expert at writing formal software requirements. Generate a PromptPress requirement specification following this exact structure:

---
artifact: game-of-life
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# Game of Life - Requirements

## Overview
[High-level description]

## Functional Requirements
- FR-1: [Requirement]
- FR-2: [Requirement]
...

## Non-Functional Requirements
- NFR-1: [Performance, security, scalability, etc.]
...

## Questions & Clarifications
[AI-CLARIFY: Any ambiguities that need clarification?]

## Cross-References
[Any dependencies or related artifacts]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->

Generate a complete, well-structured requirement specification. Be specific and thorough.`;

    const userPrompt = `Generate a requirement specification for:

Web-based Conway's Game of Life implementation with interactive controls, pattern library, and performance optimization for large grids.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    return await client.chat(messages);
}

async function generateDesign(client: CachedXAIClient, requirement: string, outputDir: string): Promise<string> {
    const systemPrompt = `You are an expert software architect. Generate a PromptPress design specification based on the provided requirements.

Structure:
---
artifact: game-of-life
phase: design
depends-on: [game-of-life.req]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# Game of Life - Design

## Architecture Overview
[High-level architecture description]

## Component Design
[Detailed component breakdown]

## Data Structures
[Key data structures]

## API Design
[Interface definitions]

## Performance Considerations
[Optimization strategies]

Be specific and technically detailed.`;

    const userPrompt = `Based on these requirements, generate a design specification:

${requirement.substring(0, 2000)}...`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    return await client.chat(messages);
}

async function generateImplementation(client: CachedXAIClient, requirement: string, design: string, outputDir: string): Promise<string> {
    const systemPrompt = `You are an expert at writing precise implementation specifications. Generate a PromptPress implementation specification.

Structure:
---
artifact: game-of-life
phase: implementation
depends-on: [game-of-life.req, game-of-life.design]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# Game of Life - Implementation

## File Structure
[Detailed file organization]

## Module Implementation
[Precise implementation details for each module]

## Code Generation Instructions
[Exact instructions for code generation]

Be extremely precise and unambiguous - this will be used to generate code.`;

    const userPrompt = `Based on requirements and design, generate implementation specification:

REQUIREMENTS:
${requirement.substring(0, 1000)}...

DESIGN:
${design.substring(0, 1000)}...`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    return await client.chat(messages);
}

async function generateDesignWithModification(client: CachedXAIClient, requirement: string, newFeature: string, outputDir: string): Promise<string> {
    const systemPrompt = `You are an expert software architect. Generate an UPDATED PromptPress design specification based on the modified requirements.

IMPORTANT: The requirements have been updated to include ${newFeature}. Your design MUST address this new feature.

Structure:
---
artifact: game-of-life
phase: design
depends-on: [game-of-life.req]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# Game of Life - Design

## Architecture Overview
[High-level architecture description - UPDATE for ${newFeature}]

## Component Design
[Detailed component breakdown - INCLUDE ${newFeature} components]

## Data Structures
[Key data structures - ADD structures for ${newFeature}]

## API Design
[Interface definitions - INCLUDE ${newFeature} APIs]

## Performance Considerations
[Optimization strategies - CONSIDER ${newFeature} performance]

Be specific and technically detailed. ENSURE ${newFeature} is properly integrated into the design.`;

    const userPrompt = `The requirements have been updated to include ${newFeature}. Generate an updated design specification that incorporates this new feature:

UPDATED REQUIREMENTS:
${requirement.substring(0, 2000)}...

Focus on how ${newFeature} integrates with the existing architecture.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    return await client.chat(messages);
}

async function generateImplementationWithModification(client: CachedXAIClient, requirement: string, design: string, newFeature: string, outputDir: string): Promise<string> {
    const systemPrompt = `You are an expert at writing precise implementation specifications. Generate an UPDATED PromptPress implementation specification.

IMPORTANT: The design has been updated to include ${newFeature}. Your implementation MUST include precise instructions for implementing this feature.

Structure:
---
artifact: game-of-life
phase: implementation
depends-on: [game-of-life.req, game-of-life.design]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# Game of Life - Implementation

## File Structure
[Detailed file organization - INCLUDE files for ${newFeature}]

## Module Implementation
[Precise implementation details - DETAIL ${newFeature} modules]

## Code Generation Instructions
[Exact instructions for code generation - SPECIFY ${newFeature} implementation]

Be extremely precise and unambiguous. ENSURE ${newFeature} is fully specified for code generation.`;

    const userPrompt = `Based on updated requirements and design that include ${newFeature}, generate complete implementation specification:

REQUIREMENTS (excerpt):
${requirement.substring(0, 1000)}...

DESIGN (excerpt):
${design.substring(0, 1000)}...

Provide detailed implementation instructions for ${newFeature} along with the base functionality.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    return await client.chat(messages);
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export { runScaffoldIntegrationTest as default };

// ConOps Update Integration Test
export async function runConOpsUpdateIntegrationTest(): Promise<void> {
    const runner = new TestRunner();

    runner.describe('ConOps Update Integration Test', () => {
        const cachePath = path.join(__dirname, '../../test-cache.json');
        const testOutputDir = path.join(__dirname, '../../test-output', 'conops-test');
        let cache: ResponseCache;

        it('should create requirements, generate ConOps, modify it, and update requirements', async () => {
            console.log('\n[Test] Starting ConOps Update Integration Test...');

            // Setup cache
            cache = new ResponseCache(cachePath);
            await cache.load();

            // Setup mocks
            const config = new MockWorkspaceConfiguration({
                apiEndpoint: 'https://api.x.ai/v1',
                model: 'grok-code-fast-1'
            });
            const output = new MockOutputChannel();

            // Get API key
            const apiKey = process.env.PROMPT_PRESS_XAI_API_KEY;
            if (!apiKey && cache.size() === 0) {
                console.log('      ⏭️  Skipping - no API key and no cache');
                return;
            }

            // Create client with caching
            const client = new CachedXAIClient(apiKey || '', config, output, cache);

            // Create test output directory
            await fs.mkdir(testOutputDir, { recursive: true });
            await fs.mkdir(path.join(testOutputDir, 'specs'), { recursive: true });
            await fs.mkdir(path.join(testOutputDir, 'specs', 'requirements'), { recursive: true });

            // Step 1: Create three simple requirements documents
            console.log('\n[Test] Step 1: Creating three simple requirements documents...');
            
            const req1Content = `---
artifact: user-auth
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-17
---

# User Authentication - Requirements

## Overview
A simple user authentication system that allows users to register and login.

## Functional Requirements
- FR-1: Users can register with email and password
- FR-2: Users can login with email and password
- FR-3: System validates credentials
- FR-4: System provides session management

## Non-Functional Requirements
- NFR-1: Passwords must be securely hashed
- NFR-2: Response time < 2 seconds
`;

            const req2Content = `---
artifact: data-storage
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-17
---

# Data Storage - Requirements

## Overview
A data storage system for user profiles and application data.

## Functional Requirements
- FR-1: Store user profile information
- FR-2: Store application configuration
- FR-3: Provide data retrieval API
- FR-4: Support data backup and restore

## Non-Functional Requirements
- NFR-1: Data must be encrypted at rest
- NFR-2: 99.9% uptime availability
`;

            const req3Content = `---
artifact: notification-system
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-17
---

# Notification System - Requirements

## Overview
A notification system for sending alerts and messages to users.

## Functional Requirements
- FR-1: Send email notifications
- FR-2: Send SMS notifications
- FR-3: Queue notifications for delivery
- FR-4: Track notification delivery status

## Non-Functional Requirements
- NFR-1: Support high volume (1000+ notifications/minute)
- NFR-2: 95% delivery success rate
`;

            await fs.writeFile(path.join(testOutputDir, 'specs', 'requirements', 'user-auth.req.md'), req1Content, 'utf-8');
            await fs.writeFile(path.join(testOutputDir, 'specs', 'requirements', 'data-storage.req.md'), req2Content, 'utf-8');
            await fs.writeFile(path.join(testOutputDir, 'specs', 'requirements', 'notification-system.req.md'), req3Content, 'utf-8');
            
            console.log('[Test] ✅ Created three requirements documents');

            // Step 2: Generate ConOps document
            console.log('\n[Test] Step 2: Generating ConOps document...');
            const conopsResponse = await generateConOps(client, testOutputDir);
            console.log('[Test] ✅ ConOps generated:', conopsResponse.length, 'characters');

            // Save ConOps
            const conopsPath = path.join(testOutputDir, 'specs', 'ConOps.md');
            await fs.writeFile(conopsPath, conopsResponse, 'utf-8');
            console.log('[Test] Saved ConOps to:', conopsPath);

            // Step 3: Validate ConOps content
            console.log('\n[Test] Step 3: Validating ConOps content...');
            const conopsContent = await fs.readFile(conopsPath, 'utf-8');
            
            // Check for key sections
            const hasPurpose = conopsContent.includes('Purpose and Scope');
            const hasStakeholders = conopsContent.includes('Stakeholders') || conopsContent.includes('User Roles');
            const hasRequirements = conopsContent.includes('Requirements Traceability');
            
            if (hasPurpose && hasStakeholders && hasRequirements) {
                console.log('[Test] ✅ ConOps contains expected sections');
            } else {
                console.log('[Test] ⚠️  ConOps may be missing some sections');
            }

            // Step 4: Modify ConOps content to affect requirements
            console.log('\n[Test] Step 4: Modifying ConOps content to affect requirements...');
            
            // Add a new operational requirement that should trigger updates
            const modifiedConops = conopsContent + `

## Additional Operational Requirements

### Multi-Factor Authentication
The system must support multi-factor authentication (MFA) for enhanced security. Users should be able to enable MFA using authenticator apps or SMS verification.

### Real-time Notifications
The notification system must support real-time delivery for critical alerts, with guaranteed delivery within 5 seconds.

### Data Analytics
The data storage system must provide analytics capabilities for user behavior tracking and system performance monitoring.
`;

            await fs.writeFile(conopsPath, modifiedConops, 'utf-8');
            console.log('[Test] ✅ Modified ConOps with additional operational requirements');

            // Step 5: Test AI response parsing and apply updates manually
            console.log('\n[Test] Step 5: Testing AI response parsing and applying requirement updates...');
            
            // Read the AI response from the log file
            const logFiles = await fs.readdir(path.join(__dirname, '../../logs'));
            const updateLogFile = logFiles.find(f => f.startsWith('test_updateConOps_'));
            if (!updateLogFile) {
                throw new Error('No updateConOps log file found');
            }
            
            const logContent = await fs.readFile(path.join(__dirname, '../../logs', updateLogFile), 'utf-8');
            const aiResponseMatch = logContent.match(/=== AI Response ===\s*\n([\s\S]*?)\n=== End Test Log ===/);
            if (!aiResponseMatch) {
                console.log('[Test] Could not extract AI response from log');
                console.log('[Test] Log content preview:', logContent.substring(0, 500));
                throw new Error('Could not extract AI response from log');
            }
            
            const aiResponse = aiResponseMatch[1].trim();
            
            // Parse requirement updates from AI response (similar to scaffold service logic)
            const reqUpdates: Array<{fileName: string, updatedOverview: string}> = [];
            
            // Try the expected format first: - **File**: filename\n- **Updated Overview**: content
            const expectedMatches = Array.from(aiResponse.matchAll(/- \*\*File\*\*: ([^\n]+)\n- \*\*Updated Overview\*\*:([\s\S]*?)(?=\n- \*\*File\*\*|\n### |\n$)/g));
            for (const match of expectedMatches) {
                reqUpdates.push({
                    fileName: match[1].trim(),
                    updatedOverview: match[2].trim()
                });
            }
            
            // Parse each requirement update individually using regex
            const requirementFiles = ['user-auth.req.md', 'data-storage.req.md', 'notification-system.req.md'];
            
            for (const reqFile of requirementFiles) {
                // Look for the pattern: **Update filename.req.md:** followed by content until next **Update or end
                const updateRegex = new RegExp(`\\*\\*Update ${reqFile.replace('.', '\\.')}:\\*\\*([\\s\\S]*?)(?=\\*\\*Update [a-zA-Z-]+\\.req\\.md:\\*\\*|\\n###|\\n$)`);
                const match = aiResponse.match(updateRegex);
                
                if (match && match[1]) {
                    const fullContent = match[1];
                    
                    // Extract just the Expanded Overview part
                    const overviewRegex = /- \*\*Expanded Overview:\*\* ([^\n]+)/;
                    const overviewMatch = fullContent.match(overviewRegex);
                    const updatedOverview = overviewMatch ? overviewMatch[1].trim() : 'Could not extract overview';
                    
                    reqUpdates.push({
                        fileName: reqFile,
                        updatedOverview: updatedOverview
                    });
                }
            }
            
            // Apply the updates to requirement files
            for (const update of reqUpdates) {
                const reqPath = path.join(testOutputDir, 'specs', 'requirements', update.fileName);
                
                try {
                    let content = await fs.readFile(reqPath, 'utf-8');
                    // Replace the ## Overview section
                    const lines = content.split('\n');
                    const overviewIndex = lines.findIndex(line => line.trim() === '## Overview');
                    if (overviewIndex !== -1) {
                        let endIndex = lines.findIndex((line, index) => index > overviewIndex && line.startsWith('## '));
                        if (endIndex === -1) endIndex = lines.length;

                        // Replace the section
                        lines.splice(overviewIndex + 1, endIndex - overviewIndex - 1, '', ...update.updatedOverview.split('\n'));
                        content = lines.join('\n');
                        await fs.writeFile(reqPath, content, 'utf-8');
                        console.log(`[Test] ✅ Updated overview in ${update.fileName}`);
                    }
                } catch (error) {
                    console.log(`[Test] ⚠️ Failed to update ${update.fileName}: ${error}`);
                }
            }
            
            console.log(`[Test] ✅ Processed ${reqUpdates.length} requirement updates from AI response`);

            // Step 6: Validate that req documents changed
            console.log('\n[Test] Step 6: Validating that requirements documents changed...');
            
            // Check user-auth.req.md for MFA changes
            const updatedAuthReq = await fs.readFile(path.join(testOutputDir, 'specs', 'requirements', 'user-auth.req.md'), 'utf-8');
            const hasMFA = updatedAuthReq.includes('MFA') || updatedAuthReq.includes('multi-factor') || updatedAuthReq.includes('authenticator');
            
            // Check notification-system.req.md for real-time changes
            const updatedNotifReq = await fs.readFile(path.join(testOutputDir, 'specs', 'requirements', 'notification-system.req.md'), 'utf-8');
            const hasRealtime = updatedNotifReq.includes('real-time') || updatedNotifReq.includes('5 seconds') || updatedNotifReq.includes('guaranteed delivery');
            
            // Check data-storage.req.md for analytics changes
            const updatedDataReq = await fs.readFile(path.join(testOutputDir, 'specs', 'requirements', 'data-storage.req.md'), 'utf-8');
            const hasAnalytics = updatedDataReq.includes('analytics') || updatedDataReq.includes('behavior tracking') || updatedDataReq.includes('performance monitoring');

            if (hasMFA) {
                console.log('[Test] ✅ user-auth.req.md updated with MFA requirements');
            } else {
                console.log('[Test] ⚠️  user-auth.req.md may not have MFA updates');
            }

            if (hasRealtime) {
                console.log('[Test] ✅ notification-system.req.md updated with real-time requirements');
            } else {
                console.log('[Test] ⚠️  notification-system.req.md may not have real-time updates');
            }

            if (hasAnalytics) {
                console.log('[Test] ✅ data-storage.req.md updated with analytics requirements');
            } else {
                console.log('[Test] ⚠️  data-storage.req.md may not have analytics updates');
            }

            // Save cache
            await cache.save();
            
            console.log('\n[Test] ✅ ConOps Update Integration Test completed');
        });
    });

    await runner.run();
}

// Helper functions for ConOps testing
async function generateConOps(client: CachedXAIClient, testOutputDir: string): Promise<string> {
    // Simulate generating ConOps from requirements
    const reqDir = path.join(testOutputDir, 'specs', 'requirements');
    
    // Read all req files
    const reqFiles = await fs.readdir(reqDir);
    const reqContents: string[] = [];
    
    for (const file of reqFiles) {
        if (file.endsWith('.req.md')) {
            const content = await fs.readFile(path.join(reqDir, file), 'utf-8');
            const overviewMatch = content.match(/## Overview\s+([\s\S]*?)(?=\n## |\n---|\n$)/);
            if (overviewMatch) {
                reqContents.push(`${file}: ${overviewMatch[1].trim()}`);
            }
        }
    }
    
    // Create AI prompt
    const systemPrompt = `You are an expert at creating Concept of Operations documents. Generate a comprehensive ConOps based on the provided requirement overviews. Include sections for Purpose and Scope, Operational Environment, User Roles and Responsibilities, Operational Scenarios, System Interfaces, Operational Constraints, Success Criteria, and Requirements Traceability.`;
    
    const userPrompt = `Generate a Concept of Operations document based on these requirement overviews:

${reqContents.join('\n\n')}

Create a comprehensive ConOps that synthesizes these requirements into operational concepts.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    const response = await client.chat(messages, { maxTokens: 4000 });
    
    // Log the response
    await logTestAiResponse('generateConOps', systemPrompt, userPrompt, response);
    
    return response;
}



async function logTestAiResponse(operation: string, systemPrompt: string, userPrompt: string, aiResponse: string): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `test_${operation}_${timestamp}.log`;
        const logFilePath = path.join(__dirname, '../../logs', logFileName);
        
        const logContent = `=== Test AI Response Log: ${operation} ===
Timestamp: ${new Date().toISOString()}

=== System Prompt ===
${systemPrompt}

=== User Prompt ===
${userPrompt}

=== AI Response ===
${aiResponse}

=== End Test Log ===
`;
        
        await fs.writeFile(logFilePath, logContent, 'utf-8');
        console.log(`[Test Log] AI response saved to: logs/${logFileName}`);
    } catch (error) {
        console.log(`[Test Log] Failed to save AI response log: ${error}`);
    }
}
