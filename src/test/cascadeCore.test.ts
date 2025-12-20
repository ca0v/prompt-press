/**
 * Tests for CascadeCore - applyChange method
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { CascadeCore } from '../services/cascadeCore.js';
import { TersifyActionParser } from '../services/TersifyActionParser.js';
import { MarkdownParser } from '../parsers/markdownParser.js';

// Mock logger
class MockLogger {
    logs: string[] = [];
    log(message: string) {
        this.logs.push(message);
    }
}

const runner = new TestRunner();

runner.describe('CascadeCore applyChange Tests', () => {

    it('should remove text from secondary section', async () => {
        const core = new CascadeCore({} as any, '/tmp', new MockLogger());
        const parser = new MarkdownParser();

        // Mock content with FR-8
        const content = `## Functional Requirements

- FR-8: @geode-pyrite.req shall have the special power to move one space in any direction, with fissures applying.

- FR-9: Other requirement.
`;

        const change = {
            type: 'Remove from',
            section: 'Functional Requirements FR-8',
            content: 'FR-8: @geode-pyrite.req shall have the special power to move one space in any direction, with fissures applying.'
        };

        const result = core.applyChange(content, change);

        // Should remove the FR-8 line
        Assert.ok(!result.includes('FR-8:'), 'FR-8 should be removed');
        Assert.ok(result.includes('FR-9: Other requirement.'), 'Other content should remain');
    });

    it('should add to AI-CLARIFY section', async () => {
        const core = new CascadeCore({} as any, '/tmp', new MockLogger());

        const content = `## Overview

Some overview text.
`;

        const change = {
            type: 'Add to',
            section: 'AI-CLARIFY section',
            content: 'This is a clarification.'
        };

        const result = core.applyChange(content, change);

        Assert.ok(result.includes('## Questions & Clarifications'), 'Should add Questions & Clarifications section');
        Assert.ok(result.includes('This is a clarification.'), 'Should add the clarification text');
    });

    it('should handle remove from primary section', async () => {
        const core = new CascadeCore({} as any, '/tmp', new MockLogger());

        const content = `## Overview

The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;

Other overview text.
`;

        const change = {
            type: 'Remove from',
            section: 'Overview',
            content: 'The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;'
        };

        const result = core.applyChange(content, change);

        Assert.ok(!result.includes('The base faction is called'), 'Should remove the text');
        Assert.ok(result.includes('Other overview text.'), 'Should keep other text');
    });

    // Add more tests based on the provided response
    it('should handle the provided tersify response changes', async () => {
        const core = new CascadeCore({} as any, '/tmp', new MockLogger());
        const parser = new MarkdownParser();

        // Mock faction.req content (simplified)
        const factionContent = `## Overview

The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;

Player 1's faction start in row 1, Player 2's in row 5.

Operationally, players control these geodes in web-based sessions, selecting and moving them strategically during turns, with @geode-pyrite.req serving as the critical erosion target, under constraints like real-time validation and balanced win rates to promote user engagement.

## Functional Requirements

- FR-8: @geode-pyrite.req shall have the special power to move one space in any direction, with fissures applying.

- FR-9: @geode-rose-quartz.req shall have the special power to move one space in any direction, with fissures not applying.

- FR-10: @geode-calcite.req shall have the special power to move any number of spaces in vertical or horizontal direction, with fissures applying.

- FR-11: @geode-amethyst.req shall have the special power to move any number of spaces in a diagonal direction, with fissures applying.

- FR-12: @geode-quartz.req shall have the special power to move any number of spaces in any direction, with fissures applying.

- FR-13: All factions in the game shall include a @geode-pyrite.req piece, which shall be the target piece that needs to be captured to win the game.

- FR-15: Players shall control the geodes in web-based game sessions.

- FR-16: Players shall select and move geodes strategically during their turns.

- FR-17: Movement of geodes shall be validated in real-time.
`;

        // Apply remove changes
        const removeChanges = [
            { type: 'Remove from', section: 'Overview', content: 'The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;' },
            { type: 'Remove from', section: 'Overview', content: "Player 1's faction start in row 1, Player 2's in row 5." },
            { type: 'Remove from', section: 'Overview', content: 'Operationally, players control these geodes in web-based sessions, selecting and moving them strategically during turns, with @geode-pyrite.req serving as the critical erosion target, under constraints like real-time validation and balanced win rates to promote user engagement.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-8: @geode-pyrite.req shall have the special power to move one space in any direction, with fissures applying.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-9: @geode-rose-quartz.req shall have the special power to move one space in any direction, with fissures not applying.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-10: @geode-calcite.req shall have the special power to move any number of spaces in vertical or horizontal direction, with fissures applying.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-11: @geode-amethyst.req shall have the special power to move any number of spaces in a diagonal direction, with fissures applying.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-12: @geode-quartz.req shall have the special power to move any number of spaces in any direction, with fissures applying.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-13: All factions in the game shall include a @geode-pyrite.req piece, which shall be the target piece that needs to be captured to win the game.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-15: Players shall control the geodes in web-based game sessions.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-16: Players shall select and move geodes strategically during their turns.' },
            { type: 'Remove from', section: 'Functional Requirements', content: 'FR-17: Movement of geodes shall be validated in real-time.' },
        ];

        let modifiedContent = factionContent;
        for (const change of removeChanges) {
            modifiedContent = core.applyChange(modifiedContent, change);
        }

        // Check that removes worked
        Assert.ok(!modifiedContent.includes('The base faction is called'), 'Should remove faction description');
        Assert.ok(!modifiedContent.includes("Player 1's faction start"), 'Should remove player start info');
        Assert.ok(!modifiedContent.includes('FR-8:'), 'Should remove FR-8');
        Assert.ok(!modifiedContent.includes('FR-9:'), 'Should remove FR-9');
        // etc.

        // Add the clarification
        const addChange = {
            type: 'Add to',
            section: 'AI-CLARIFY section',
            content: "Contradiction: FR-6 lists the base faction as consisting of pyrite, rose-quartz, calcite, amethyst, quartz, but geode-amethyst.req FR-4 claims Amethyst has exclusive access to the purple line as a special power, which is not mentioned here."
        };

        modifiedContent = core.applyChange(modifiedContent, addChange);

        Assert.ok(modifiedContent.includes('## Questions & Clarifications'), 'Should add clarifications section');
        Assert.ok(modifiedContent.includes('Contradiction: FR-6'), 'Should add the clarification');
    });

    it('should handle changes from tersify response file', async () => {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const core = new CascadeCore({} as any, '/tmp', new MockLogger());
        const parser = new MarkdownParser();

        // Read the tersify response file
        const responseFile = path.join(__dirname, '../../test/data/tersify-response.md');
        const responseContent = fs.readFileSync(responseFile, 'utf-8');

        // Parse the table from the response using parseChangeTable
        const tableChanges = parser.parseChangeTable(responseContent);

        // Group changes by document
        const changesByDoc = parser.groupChangesByDocument(tableChanges);

        // Read the mock content for faction.req
        const requestFile = path.join(__dirname, '../../test/data/tersify-faction.req.md');
        let mockContent = fs.readFileSync(requestFile, 'utf-8');

        // Apply changes for faction.req
        const factionChanges = changesByDoc.get('faction.req') || [];
        for (const change of factionChanges) {
            mockContent = core.applyChange(mockContent, change);
        }

        // No assertions - for debugging purposes
        console.log('Final result after applying all changes:', mockContent);
    });

});

export { runCascadeCoreTest as default };

async function runCascadeCoreTest() {
    await runner.run();
    runner.printSummary();
}