/**
 * Unit tests for MarkdownFormatter utility
 */

import { MarkdownFormatter } from '../utils/markdownFormatter.js';
import { Assert } from './Assert.js';

export async function runMarkdownFormatterTests(): Promise<void> {
    console.log('🧪 Testing MarkdownFormatter...\n');

    // Test 1: Basic table formatting
    console.log('1️⃣  Testing table formatting...');
    const tableInput = `| Term | Description |
|------|-------------|
|Test|A test term|
|Another|Another description|`;

    const tableResult = MarkdownFormatter.format(tableInput);
    console.log('Input:');
    console.log(JSON.stringify(tableInput));
    console.log('Output:');
    console.log(JSON.stringify(tableResult));
    // For now, just check that it's not empty and contains the expected structure
    Assert.ok(tableResult.includes('| Term | Description |'), 'Table should contain formatted header');
    Assert.ok(tableResult.includes('| Test | A test term |'), 'Table should contain formatted first row');

    // Test 2: Header formatting
    console.log('2️⃣  Testing header formatting...');
    const headerInput = `#Header 1
##Header 2
###  Header 3`;

    const expectedHeader = `# Header 1
## Header 2
### Header 3
`;

    const headerResult = MarkdownFormatter.format(headerInput);
    Assert.equal(headerResult, expectedHeader, 'Headers should have consistent spacing');

    // Test 3: List formatting
    console.log('3️⃣  Testing list formatting...');
    const listInput = `-Item 1
*  Item 2
+Item 3
1.Numbered item
2.  Another numbered`;

    const listResult = MarkdownFormatter.format(listInput);
    console.log('List Input:');
    console.log(JSON.stringify(listInput));
    console.log('List Output:');
    console.log(JSON.stringify(listResult));
    Assert.ok(listResult.includes('- Item 1'), 'Bullet lists should have space after dash');
    Assert.ok(listResult.includes('1. Numbered item'), 'Numbered lists should have space after period');

    // Test 4: Line ending normalization
    console.log('4️⃣  Testing line ending normalization...');
    const lineEndingInput = `Line 1\r\nLine 2\rLine 3\nLine 4`;

    const lineEndingResult = MarkdownFormatter.format(lineEndingInput);
    console.log('Line Input:');
    console.log(JSON.stringify(lineEndingInput));
    console.log('Line Output:');
    console.log(JSON.stringify(lineEndingResult));
    Assert.ok(lineEndingResult.includes('Line 1\nLine 2\nLine 3\nLine 4'), 'Line endings should be normalized to \\n');

    // Test 5: Trailing whitespace removal
    console.log('5️⃣  Testing trailing whitespace removal...');
    const whitespaceInput = `Line with trailing spaces   \nAnother line\t\nNormal line`;

    const expectedWhitespace = `Line with trailing spaces
Another line
Normal line
`;

    const whitespaceResult = MarkdownFormatter.format(whitespaceInput);
    Assert.equal(whitespaceResult, expectedWhitespace, 'Trailing whitespace should be removed');

    // Test 6: Multiple blank lines consolidation
    console.log('6️⃣  Testing blank line consolidation...');
    const blankLinesInput = `Line 1


Line 2



Line 3`;

    const expectedBlankLines = `Line 1

Line 2

Line 3
`;

    const blankLinesResult = MarkdownFormatter.format(blankLinesInput);
    Assert.equal(blankLinesResult, expectedBlankLines, 'Multiple blank lines should be consolidated to max 2');

    // Test 7: Empty input handling
    console.log('7️⃣  Testing empty input handling...');
    Assert.equal(MarkdownFormatter.format(''), '', 'Empty string should return empty string');
    Assert.equal(MarkdownFormatter.format(null as any), null, 'Null input should return null');
    Assert.equal(MarkdownFormatter.format(undefined as any), undefined, 'Undefined input should return undefined');

    // Test 8: Complex markdown with mixed elements
    console.log('8️⃣  Testing complex markdown...');
    const complexInput = `# Title

Some text here.

|Term|Description|
|----|-----------|
|API|Application Programming Interface|
|UI|User Interface|

## Section 2

- List item 1
- List item 2

1.First numbered
2.Second numbered

### Subsection

More text.`;

    const complexResult = MarkdownFormatter.format(complexInput);
    console.log('Complex Input:');
    console.log(JSON.stringify(complexInput));
    console.log('Complex Output:');
    console.log(JSON.stringify(complexResult));
    Assert.ok(complexResult.includes('# Title'), 'Should format headers');
    Assert.ok(complexResult.includes('| API | Application Programming Interface |'), 'Should format tables');
    Assert.ok(complexResult.includes('- List item 1'), 'Should format lists');

    console.log('✅ All MarkdownFormatter tests passed!\n');
}