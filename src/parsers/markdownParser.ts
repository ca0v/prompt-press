import * as fs from 'fs/promises';
import * as YAML from 'yaml';

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
            const metadata = YAML.parse(frontmatterMatch[1]) as SpecMetadata;
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
        const regex = /@ref:([a-zA-Z0-9-]+\.(req|design|impl))/g;
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            references.push(match[1]);
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
}
