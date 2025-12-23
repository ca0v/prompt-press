/**
 * Markdown formatting utilities from first principles
 */

export class MarkdownFormatter {
    /**
     * Format markdown content from first principles
     */
    // PromptPress/IMP-1072
    static format(content: string): string {
        if (!content || typeof content !== 'string') {
            return content;
        }

        let lines = content.split(/\r\n|\r|\n/);

        // Normalize line endings and trim trailing whitespace
        lines = lines.map(line => line.trimEnd());

        // Process each line
        const formattedLines: string[] = [];
        let inTable = false;
        let tableHeaders: string[] = [];
        let inCode = false;
        let lastBlockType = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Handle code blocks
            if (line.trim().startsWith('```')) {
                inCode = !inCode;
            }

            if (inCode) {
                formattedLines.push(line);
                continue;
            }

            // Determine block type
            let blockType = 'paragraph';
            if (!line.trim()) {
                blockType = 'blank';
            } else if (line.match(/^#{1,6}[^#]/)) {
                blockType = 'header';
            } else if (line.match(/^[\s]*[-*+]/) || line.match(/^[\s]*\d+\./)) {
                blockType = 'list';
            } else if (line.includes('|') && !line.startsWith('```')) {
                // Check if table
                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                if (cells.length >= 2 && i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (nextLine.includes('|') && /^[\s|:-]+$/.test(nextLine.replace(/\s/g, ''))) {
                        blockType = 'table';
                    }
                }
            }

            // Add blank line between different blocks
            if (blockType !== 'blank' && lastBlockType !== '' && lastBlockType !== 'blank' && blockType !== lastBlockType) {
                formattedLines.push('');
            }
            lastBlockType = blockType;

            // Handle table detection and formatting
            if (line.includes('|') && !line.startsWith('```')) {
                if (!inTable) {
                    // Check if this looks like a table header
                    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                    if (cells.length >= 2 && i + 1 < lines.length) {
                        const nextLine = lines[i + 1];
                        // Check if next line is a separator
                        if (nextLine.includes('|') && /^[\s|:-]+$/.test(nextLine.replace(/\s/g, ''))) {
                            inTable = true;
                            tableHeaders = cells;
                            formattedLines.push(`| ${cells.join(' | ')} |`);
                            i++; // Skip the separator line, we'll add our own
                            formattedLines.push(`| ${cells.map(() => '------').join(' | ')} |`);
                            continue;
                        }
                    }
                } else {
                    // In table, format data rows
                    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                    if (cells.length > 0) {
                        // Pad cells to match header count
                        while (cells.length < tableHeaders.length) {
                            cells.push('');
                        }
                        formattedLines.push(`| ${cells.join(' | ')} |`);
                        continue;
                    } else {
                        // Empty line or end of table
                        inTable = false;
                    }
                }
            } else if (inTable) {
                // End of table
                inTable = false;
            }

            // Normalize indentation for lists
            if (blockType === 'list') {
                const match = line.match(/^(\s*)(.*)$/);
                if (match) {
                    const indent = match[1];
                    const level = Math.floor(indent.length / 2);
                    const newIndent = '  '.repeat(level);
                    line = newIndent + match[2];
                }
            }

            // Handle headers - ensure space after # symbols
            if (line.match(/^#{1,6}[^#]/)) {
                const match = line.match(/^(#{1,6})\s*(.*)$/);
                if (match) {
                    line = `${match[1]} ${match[2]}`;
                }
            }

            // Handle lists - ensure consistent spacing
            if (line.match(/^[\s]*[-*+][\s]*/)) {
                line = line.replace(/^([\s]*)([-*+])([\s]*)(.*)$/, '$1$2 $4');
            }

            // Handle numbered lists
            if (line.match(/^[\s]*\d+\.[\s]*/)) {
                line = line.replace(/^([\s]*)(\d+)\.([\s]*)(.*)$/, '$1$2. $4');
            }

            formattedLines.push(line);
        }

        // Join lines with consistent line endings
        let result = formattedLines.join('\n');

        // Remove multiple consecutive blank lines (more than 2)
        result = result.replace(/\n{3,}/g, '\n\n');

        // Ensure single trailing newline
        result = result.trimEnd() + '\n';

        return result;
    }
}