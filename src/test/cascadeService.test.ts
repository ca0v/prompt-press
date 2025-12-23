/**
 * Tests for CascadeService - change detection and cascading
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { CascadeCore, CascadeUI } from '../services/CascadeCore.js';

// Mock XAI Client
class MockXAIClient {
    public callCount = 0;
    public lastMessages: any[] = [];

    async chat(messages: any[], options?: any): Promise<string> {
        this.callCount++;
        this.lastMessages = messages;

        // Return different responses based on content
        const userContent = messages[1]?.content || '';
        const systemContent = messages[0]?.content || '';
        
        // Check for refinement first (looks for "refin" keyword)
        if (systemContent.includes('refining') || systemContent.includes('Analyze the changes')) {
            // Return empty string to skip refinement in tests
            return '';
        }
        // Check for tersify
        if (userContent.includes('Tersify Spec Documents')) {
            return 'No changes required.';
        }
        // Check for implementation first to avoid substring clashes
        if (userContent.includes('implementation')) {
            return this.generateMockImplementation();
        } else if (userContent.includes('design')) {
            return this.generateMockDesign();
        }
        
        return 'Mock response';
    }

    private generateMockDesign(): string {
        return `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# Test Artifact - Design

## Architecture Overview
Updated architecture with new changes integrated.

## Component Design
Updated components to support new features.`;
    }

    private generateMockImplementation(): string {
        return `---
artifact: test-artifact
phase: implementation
depends-on: [test-artifact.req, test-artifact.design]
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# Test Artifact - Implementation

## File Structure
Updated file structure for new features.

## Module Implementation
Updated module implementation with new changes.`;
    }

    parseResponse(response: string): any {
        return { content: response };
    }
}

// Mock Output Channel
class MockOutputChannel {
    name: string = 'Test';
    lines: string[] = [];

    append(value: string): void {
        this.lines.push(value);
    }

    appendLine(value: string): void {
        this.lines.push(value);
    }

    clear(): void {
        this.lines = [];
    }

    show(): void { }
    hide(): void { }
    dispose(): void { }
    replace(value: string): void { }
}

export async function runCascadeServiceTest(): Promise<void> {
    const runner = new TestRunner();
    const testDir = path.join(process.cwd(), 'test-output', 'cascade-test');
    let mockClient: MockXAIClient;
    let mockOutput: MockOutputChannel;
    let cascadeService: CascadeCore;
    const testUi: CascadeUI = {
        confirmGitStatus: async () => 'continue',
        confirm: async () => true,
        notifyInfo: () => undefined,
        notifyError: () => undefined
    };

    // Helper to setup test environment
    const setup = async () => {
        // Clean test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore errors if directory doesn't exist
        }
        await fs.mkdir(testDir, { recursive: true });

        // Create cache directory
        const cacheDir = path.join(testDir, '.promptpress', 'cache');
        await fs.mkdir(cacheDir, { recursive: true });

        // Initialize mocks
        mockClient = new MockXAIClient();
        mockOutput = new MockOutputChannel();
        cascadeService = new CascadeCore(
            mockClient as any,
            testDir,
            {
                log: (msg: string) => mockOutput.appendLine(msg)
            }
        );
    };

    runner.describe('CascadeService Tests', () => {
        it('should detect changes between baseline and current content', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const baselineContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Original overview text.

## Functional Requirements
- FR-1: Original requirement`;

            const updatedContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Original overview text with NEW FEATURE added.

## Functional Requirements
- FR-1: Original requirement
- FR-2: New requirement for new feature`;

            // Write baseline
            const cacheDir = path.join(testDir, '.promptpress', 'cache');
            await fs.writeFile(
                path.join(cacheDir, 'test-artifact.req.md.baseline'),
                baselineContent,
                'utf-8'
            );

            // Write current file
            await fs.writeFile(reqFile, updatedContent, 'utf-8');

            // Apply changes (should detect differences)
            const result = await cascadeService.refactorSpec(reqFile, testUi);

            Assert.equal(result.success, true);
            Assert.ok(mockOutput.lines.some(line => line.includes('Changes detected')));
        });

        it('should cascade from requirement to design', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const designFile = path.join(testDir, 'test-artifact.design.md');

            // Create requirement file
            const reqContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
System with new feature.

## Functional Requirements
- FR-1: Support new feature`;

            await fs.writeFile(reqFile, reqContent, 'utf-8');

            // Create existing design file
            const oldDesignContent = `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
version: 1.0.0
---

# Test Artifact - Design

## Architecture Overview
Old architecture.`;

            await fs.writeFile(designFile, oldDesignContent, 'utf-8');

            // No baseline exists, so entire file treated as changes
            const result = await cascadeService.refactorSpec(reqFile, testUi);

            Assert.equal(result.success, true);
            Assert.ok(result.updatedFiles.includes(designFile));
            Assert.ok(mockClient.callCount > 0);

            // Verify design was updated
            const updatedDesign = await fs.readFile(designFile, 'utf-8');
            Assert.ok(updatedDesign.includes('Test Artifact - Design'));
            Assert.ok(updatedDesign.includes('artifact: test-artifact'));
            Assert.ok(updatedDesign.includes('phase: design'));
        });

        it('should cascade from requirement to design and implementation', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const designFile = path.join(testDir, 'test-artifact.design.md');
            const implFile = path.join(testDir, 'test-artifact.impl.md');

            // Create requirement file
            const reqContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Complete system specification.

## Functional Requirements
- FR-1: Core functionality
- FR-2: Advanced features`;

            await fs.writeFile(reqFile, reqContent, 'utf-8');

            // Create existing design and implementation files
            await fs.writeFile(designFile, `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
version: 1.0.0
---

# Test Artifact - Design

## Architecture Overview
Old design.`, 'utf-8');

            await fs.writeFile(implFile, `---
artifact: test-artifact
phase: implementation
depends-on: [test-artifact.req, test-artifact.design]
version: 1.0.0
---

# Test Artifact - Implementation

## File Structure
Old implementation.`, 'utf-8');

            // Apply changes
            const result = await cascadeService.refactorSpec(reqFile, testUi);

            Assert.equal(result.success, true);
            Assert.ok(result.updatedFiles.includes(designFile));
            Assert.ok(result.updatedFiles.includes(implFile));
            // May also include reqFile if self-refinement occurred
            Assert.ok(mockClient.callCount >= 2); // At least design + impl, possibly +1 for refinement

            // Verify both files were updated
            const updatedDesign = await fs.readFile(designFile, 'utf-8');
            Assert.ok(updatedDesign.includes('Test Artifact - Design'));

            const updatedImpl = await fs.readFile(implFile, 'utf-8');
            Assert.ok(updatedImpl.includes('Test Artifact - Implementation'));
        });

        it('should not cascade if no changes detected', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const content = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Unchanged content.`;

            await fs.writeFile(reqFile, content, 'utf-8');

            // Create baseline with same content
            const cacheDir = path.join(testDir, '.promptpress', 'cache');
            await fs.writeFile(
                path.join(cacheDir, 'test-artifact.req.md.baseline'),
                content,
                'utf-8'
            );

            const result = await cascadeService.refactorSpec(reqFile, testUi);

            Assert.equal(result.success, true);
            Assert.equal(result.updatedFiles.length, 0);
            Assert.equal(mockClient.callCount, 0);
        });

        it('should update baseline cache after successful cascade', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const designFile = path.join(testDir, 'test-artifact.design.md');
            
            const reqContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
New content for baseline test.`;

            await fs.writeFile(reqFile, reqContent, 'utf-8');
            await fs.writeFile(designFile, `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
version: 1.0.0
---

# Old Design`, 'utf-8');

            // Apply changes
            await cascadeService.refactorSpec(reqFile, testUi);

            // Verify baseline was created/updated
            const baselineFile = path.join(
                testDir, 
                '.promptpress', 
                'cache', 
                'test-artifact.req.md.baseline'
            );
            
            const baselineExists = await fs.access(baselineFile)
                .then(() => true)
                .catch(() => false);
            
            Assert.equal(baselineExists, true);

            // Verify baseline content matches current file
            const baselineContent = await fs.readFile(baselineFile, 'utf-8');
            Assert.equal(baselineContent, reqContent);
        });

        it('should handle missing design file gracefully', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            
            await fs.writeFile(reqFile, `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Content for missing design test.`, 'utf-8');

            // No design file exists
            const result = await cascadeService.refactorSpec(reqFile, testUi);

            Assert.equal(result.success, true);
            // May have 1 file (reqFile) if self-refinement occurred, or 0 if skipped
            Assert.ok(result.updatedFiles.length <= 1);
            Assert.ok(mockOutput.lines.some(line => 
                line.includes('No design file found')
            ));
        });

        it('should fail when cascading from design without requirement', async () => {
            await setup();
            
            const designFile = path.join(testDir, 'test-artifact.design.md');
            
            await fs.writeFile(designFile, `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
version: 1.0.0
---

# Test Artifact - Design

## Architecture Overview
Design without requirement.`, 'utf-8');

            const result = await cascadeService.refactorSpec(designFile, testUi);

            Assert.equal(result.success, false);
            Assert.ok(result.errors.some(err => 
                err.includes('Cannot cascade from design without requirement')
            ));
        });

        it('should include change summary in AI prompts', async () => {
            await setup();
            
            const reqFile = path.join(testDir, 'test-artifact.req.md');
            const designFile = path.join(testDir, 'test-artifact.design.md');
            
            const originalContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Original requirements.`;

            // Create baseline
            const cacheDir = path.join(testDir, '.promptpress', 'cache');
            await fs.writeFile(path.join(cacheDir, 'test-artifact.req.md.baseline'), originalContent, 'utf-8');
            
            // Now write updated content
            const updatedContent = `---
artifact: test-artifact
phase: requirement
depends-on: []
version: 1.0.0
---

# Test Artifact - Requirements

## Overview
Requirements with specific feature mention.`;

            await fs.writeFile(reqFile, updatedContent, 'utf-8');

            await fs.writeFile(designFile, `---
artifact: test-artifact
phase: design
depends-on: [test-artifact.req]
version: 1.0.0
---

# Old Design`, 'utf-8');

            await cascadeService.refactorSpec(reqFile, testUi);

            // Check that AI was called and received the requirement content
            Assert.ok(mockClient.callCount > 0, 'AI should have been called');
            Assert.ok(mockClient.lastMessages.length >= 2, 'Should have system and user messages');
            
            // Verify that requirement content was passed to AI
            const allContent = mockClient.lastMessages.map((m: any) => m.content).join(' ');
            Assert.ok(allContent.includes('Requirements with specific feature'), 'AI should receive requirement content');
        });

        it('should tersify spec documents', async () => {
            await setup();

            // Create a requirement file with references
            const reqFile = path.join(testDir, 'specs', 'requirements', 'test-artifact.req.md');
            await fs.mkdir(path.dirname(reqFile), { recursive: true });
            await fs.writeFile(reqFile, `---
artifact: test-artifact
phase: requirement
references: ["test-artifact.design"]
---

# Test Requirements

Some details about the design.
`, 'utf-8');

            // Create referenced design file
            const designFile = path.join(testDir, 'specs', 'design', 'test-artifact.design.md');
            await fs.mkdir(path.dirname(designFile), { recursive: true });
            await fs.writeFile(designFile, `---
artifact: test-artifact
phase: design
---

# Test Design

Design details.
`, 'utf-8');

            // Tersify spec
            const result = await cascadeService.tersifySpec(reqFile, testUi);

            Assert.equal(result.success, true);
            Assert.ok(mockClient.callCount > 0, 'AI should have been called for tersify');
            
            // Check that the AI received the correct prompt
            const userMessage = mockClient.lastMessages[1]?.content || '';
            Assert.ok(userMessage.includes('Tersify Spec Documents'), 'Should call tersify prompt');
            Assert.ok(userMessage.includes('Some details about the design'), 'Should include source content');
            Assert.ok(userMessage.includes('Design details'), 'Should include referenced content');
        });
    });

    await runner.run();
    runner.printSummary();
}

export { runCascadeServiceTest as default };
