import * as fs from 'fs/promises';

export interface SpecMetadata {
    artifact: string;
    phase: 'requirement' | 'design' | 'implementation';
    dependsOn?: string[];
    references?: string[];
    version?: string;
    lastUpdated?: string;
}

export interface ParsedSpec {
    metadata: SpecMetadata;
    content: string;
    sections: Map<string, string>;
    clarifications: string[];
    references: string[];
}

export class MarkdownParser {
    /**
     * Simple YAML parser for frontmatter (bespoke implementation)
     */
    private parseYaml(yaml: string): any {
        const obj: any = {};
        const lines = yaml.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')); // ignore comments

        for (const line of lines) {
            if (!line.includes(':')) continue;
            const colonIndex = line.indexOf(':');
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();

            if (value.startsWith('[') && value.endsWith(']')) {
                // array
                value = value.slice(1, -1);
                obj[key] = value ? value.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
            } else {
                // string, remove quotes if present
                obj[key] = value.replace(/^["']|["']$/g, '');
            }
        }
        return obj;
    }
    /**
     * Parse a markdown spec file
     */
    public async parseFile(filePath: string): Promise<ParsedSpec> {
        const content = await fs.readFile(filePath, 'utf-8');
        return this.parse(content);
    }

    /**
     * Parse markdown content
     */
    public parse(content: string): ParsedSpec {
        const metadata = this.extractMetadata(content);
        const sections = this.extractSections(content);
        const clarifications = this.extractClarifications(content);
        const references = this.extractReferences(content);

        return {
            metadata,
            content,
            sections,
            clarifications,
            references
        };
    }

    /**
     * Extract YAML frontmatter metadata
     */
    private extractMetadata(content: string): SpecMetadata {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (!frontmatterMatch) {
            // Default metadata if not found
            return {
                artifact: 'unknown',
                phase: 'requirement'
            };
        }

        try {
            const raw = this.parseYaml(frontmatterMatch[1]);
            const dependsOn = raw['depends-on'] ?? raw.dependsOn ?? [];
            const references = raw.references ?? [];
            const metadata: SpecMetadata = {
                artifact: raw.artifact || 'unknown',
                phase: raw.phase || 'requirement',
                dependsOn,
                references,
                version: raw.version,
                lastUpdated: raw['last-updated'] ?? raw.lastUpdated
            };
            return metadata;
        } catch (error) {
            console.error('Failed to parse metadata:', error);
            return {
                artifact: 'unknown',
                phase: 'requirement'
            };
        }
    }

    /**
     * Extract markdown sections (## headings)
     */
    private extractSections(content: string): Map<string, string> {
        const sections = new Map<string, string>();
        
        // Remove frontmatter
        const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        
        // Split by ## headers
        const sectionRegex = /^## (.+)$/gm;
        const matches = [...withoutFrontmatter.matchAll(sectionRegex)];
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const sectionName = match[1].trim();
            const startIndex = match.index! + match[0].length;
            const endIndex = i < matches.length - 1 ? matches[i + 1].index! : withoutFrontmatter.length;
            const sectionContent = withoutFrontmatter.substring(startIndex, endIndex).trim();
            
            sections.set(sectionName, sectionContent);
        }
        
        return sections;
    }

    /**
     * Extract [AI-CLARIFY: ...] markers
     */
    private extractClarifications(content: string): string[] {
        const clarifications: string[] = [];
        const regex = /\[AI-CLARIFY:\s*([^\]]+)\]/g;
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            clarifications.push(match[1].trim());
        }
        
        return clarifications;
    }

    /**
     * Extract @ref:artifact-name.phase references
     */
    private extractReferences(content: string): string[] {
        const references: string[] = [];
        const regex = /(@([a-zA-Z0-9-]+\.(req|design|impl))|([a-zA-Z0-9-]+\.(req|design|impl)\.md))/g;
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (match[1]) {
                // @ref
                references.push(match[2]);
            } else if (match[3]) {
                // ref.md
                references.push(match[3]);
            }
        }
        
        return references;
    }

    /**
     * Validate spec structure
     */
    public validate(spec: ParsedSpec): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!spec.metadata.artifact || spec.metadata.artifact === 'unknown') {
            errors.push('Missing or invalid artifact name in metadata');
        }

        if (!['requirement', 'design', 'implementation'].includes(spec.metadata.phase)) {
            errors.push('Invalid phase in metadata');
        }

        if (spec.sections.size === 0) {
            errors.push('No sections found in spec');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get the Overview section content
     */
    public getOverview(content: string): string {
        const match = content.match(/## Overview\n([\s\S]*?)(\n## |\n---|\n$)/);
        return match ? match[1].trim() : "";
    }

    /**
     * Set the Overview section content
     */
    public setOverview(content: string, newOverview: string): string {
        const regex = /(## Overview\n)([\s\S]*?)(\n## |\n---|\n$)/;
        if (regex.test(content)) {
            return content.replace(regex, `$1${newOverview}$3`);
        } else {
            // If no Overview section, add it after title
            const titleMatch = content.match(/^# .+\n/);
            if (titleMatch) {
                const insertPoint = titleMatch.index! + titleMatch[0].length;
                return content.slice(0, insertPoint) + `\n## Overview\n${newOverview}\n` + content.slice(insertPoint);
            }
            return content;
        }
    }

    /**
     * Get a section content, optionally with a secondary subsection
     */
    public getSection(content: string, primarySection: string, secondarySection?: string): string {
        const sectionRegex = new RegExp(`## ${this.escapeRegExp(primarySection)}\n([\\s\\S]*?)(\\n## |\\n---|\\n$)`, 'i');
        const sectionMatch = content.match(sectionRegex);
        if (!sectionMatch) return "";

        const sectionContent = sectionMatch[1];
        if (!secondarySection) return sectionContent.trim();

        // Find the secondary item (e.g., FR-1, NFR-1)
        const itemRegex = new RegExp(`- ${this.escapeRegExp(secondarySection)}: ([^\\n]+(?:\\n(?!- [^:]+: )[^\\n]*)*)`, 'gi');
        const itemMatch = itemRegex.exec(sectionContent);
        return itemMatch ? itemMatch[1].trim() : "";
    }

    /**
     * Set a section content, optionally with a secondary subsection
     */
    public setSection(content: string, primarySection: string, secondarySection: string | undefined, newBody: string): string {
        if (!secondarySection) {
            // Replace the whole section
            const regex = new RegExp(`(## ${this.escapeRegExp(primarySection)}\n)([\\s\\S]*?)(\\n## |\\n---|\\n$)`, 'i');
            if (regex.test(content)) {
                return content.replace(regex, `$1${newBody}$3`);
            } else {
                // Add new section at the end
                return content + `\n## ${primarySection}\n${newBody}\n`;
            }
        } else {
            // Replace within the section
            const sectionRegex = new RegExp(`## ${this.escapeRegExp(primarySection)}\n([\\s\\S]*?)(\\n## |\\n---|\\n$)`, 'i');
            const sectionMatch = content.match(sectionRegex);
            if (!sectionMatch) return content;

            const sectionContent = sectionMatch[1];
            const itemRegex = new RegExp(`(- ${this.escapeRegExp(secondarySection)}: )([^\\n]+(?:\\n(?!- [^:]+: )[^\\n]*)*)`, 'gi');
            const newSectionContent = sectionContent.replace(itemRegex, `$1${newBody}`);
            const newSection = `## ${primarySection}\n${newSectionContent}`;
            return content.replace(sectionRegex, newSection + sectionMatch[2]);
        }
    }

    /**
     * Helper to escape regex special characters
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Parse a Markdown table of changes for tersify
     */
    public parseChangeTable(content: string): { document: string; action: string; details: string; reason: string }[] {
        const tableData = this.parseMarkdownTable(content);
        return tableData.map(row => ({
            document: row['Target Document'] || '',
            action: row['Action'] || '',
            details: (row['Details'] || '') === '-' ? '' : (row['Details'] || ''),
            reason: (row['Reason'] || '') === '-' ? '' : (row['Reason'] || '')
        }));
    }

    /**
     * Generalized Markdown table parser
     * Returns an array of objects where keys are header names and values are cell content
     */
    public parseMarkdownTable(content: string): Record<string, string>[] {
        const lines = content.split('\n');
        const tableStart = lines.findIndex(line => line.trim().startsWith('|') && !line.includes('|---'));
        if (tableStart === -1) return [];

        // Find header row
        let headerIndex = tableStart;
        while (headerIndex < lines.length && !lines[headerIndex].includes('|')) {
            headerIndex++;
        }
        if (headerIndex >= lines.length) return [];

        const headerLine = lines[headerIndex].trim();
        const headers = headerLine.split('|').map(h => h.trim()).filter(h => h !== '');

        // Find separator row
        let separatorIndex = headerIndex + 1;
        while (separatorIndex < lines.length && !lines[separatorIndex].includes('|---')) {
            separatorIndex++;
        }
        if (separatorIndex >= lines.length) return [];

        // Parse data rows
        const rows: Record<string, string>[] = [];
        for (let i = separatorIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('|') || line.includes('|---') || line.trim() === '') continue;

            const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
            if (cells.length === headers.length) {
                const row: Record<string, string> = {};
                headers.forEach((header, index) => {
                    row[header] = cells[index] || '';
                });
                rows.push(row);
            }
        }
        return rows;
    }
}
