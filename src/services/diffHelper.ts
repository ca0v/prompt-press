export interface ChangeDetectionResult {
    hasChanges: boolean;
    modifiedSections: string[];
    summary: string;
    oldContent: string;
    newContent: string;
}

export class DiffHelper {
    /**
     * Compare two content strings and detect changes
     */
    public static compareContent(oldContent: string, newContent: string): ChangeDetectionResult {
        if (oldContent === newContent) {
            return {
                hasChanges: false,
                modifiedSections: [],
                summary: 'No changes',
                oldContent,
                newContent
            };
        }

        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const modifiedSections = DiffHelper.findModifiedSections(oldLines, newLines);
        const summary = DiffHelper.generateChangeSummary(oldLines, newLines, modifiedSections);

        return {
            hasChanges: true,
            modifiedSections,
            summary,
            oldContent,
            newContent
        };
    }

    /**
     * Find modified sections by comparing line-by-line
     */
    public static findModifiedSections(oldLines: string[], newLines: string[]): string[] {
        const sections = new Set<string>();
        const oldSections = DiffHelper.buildSectionMap(oldLines);
        const newSections = DiffHelper.buildSectionMap(newLines);

        for (const [section, newContent] of newSections) {
            const oldContent = oldSections.get(section);
            if (!oldContent || oldContent !== newContent) {
                sections.add(section);
            }
        }
        for (const section of oldSections.keys()) {
            if (!newSections.has(section)) {
                sections.add(section);
            }
        }
        return Array.from(sections);
    }

    /**
     * Build section map from content lines
     */
    public static buildSectionMap(lines: string[]): Map<string, string> {
        const sections = new Map<string, string>();
        let currentSection = '';
        let currentContent: string[] = [];

        for (const line of lines) {
            if (line.startsWith('##')) {
                if (currentSection) {
                    sections.set(currentSection, currentContent.join('\n'));
                }
                currentSection = line.replace(/^##\s+/, '').trim();
                currentContent = [];
            } else if (currentSection) {
                currentContent.push(line);
            }
        }
        if (currentSection) {
            sections.set(currentSection, currentContent.join('\n'));
        }
        return sections;
    }

    /**
     * Generate change summary
     */
    public static generateChangeSummary(oldLines: string[], newLines: string[], modifiedSections: string[]): string {
        const added = newLines.length - oldLines.length;
        const sections = modifiedSections.length;
        let summary = `Modified ${sections} section(s)`;
        if (added > 0) {
            summary += `, added ${added} line(s)`;
        } else if (added < 0) {
            summary += `, removed ${Math.abs(added)} line(s)`;
        }
        return summary;
    }
}