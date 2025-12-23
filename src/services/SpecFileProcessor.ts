import * as path from 'path';
import { resolveSpecPath as resolveSpecPathSync } from '../spec/resolveSpecPath.js';
import * as fs from 'fs/promises';
import { MarkdownParser, SpecMetadata, ParsedSpec } from '../parsers/markdownParser.js';

export interface ValidationError {
  message: string;
  line: number;
  column: number;
  length: number;
}

export class SpecFileProcessor {
  private parser: MarkdownParser;
  private workspaceRoot: string;

  constructor(parser: MarkdownParser, workspaceRoot: string) {
    this.parser = parser;
    this.workspaceRoot = workspaceRoot;
  }

  // PromptPress/IMP-1057
  async updateMetadata(document: any): Promise<void> {
    const vscode = await import('vscode');
    try {
      const content = document.getText();
      const parsed = this.parser.parse(content);
      if (parsed.metadata) {
        const today = new Date().toISOString().split('T')[0];
        parsed.metadata.lastUpdated = today;

        // Enforce correct phase based on file extension
        if (document.fileName.endsWith('.req.md')) {
          parsed.metadata.phase = 'requirement';
        } else if (document.fileName.endsWith('.design.md')) {
          parsed.metadata.phase = 'design';
        } else if (document.fileName.endsWith('.impl.md')) {
          parsed.metadata.phase = 'implementation';
        }

        // Set artifact from filename if not present
        const fileName = path.basename(document.fileName);
        const artifactName = fileName.replace(/\.(req|design|impl)\.md$/, '');
        if (parsed.metadata.artifact === 'unknown') {
          parsed.metadata.artifact = artifactName;
        }

        // Sync references with mentions
        await this.syncReferencesWithMentions(document, parsed);

        // Find frontmatter range
        const lines = content.split('\n');
        let startLine = -1;
        let endLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === '---') {
            if (startLine === -1) {
              startLine = i;
            } else {
              endLine = i;
              break;
            }
          }
        }

        if (startLine !== -1 && endLine !== -1) {
          // Reconstruct frontmatter with updated metadata
          const updatedFrontmatter = this.updateFrontmatter('', parsed.metadata).split('\n').slice(0, -1).join('\n'); // remove the empty line at end

          const start = new vscode.Position(startLine, 0);
          const end = new vscode.Position(endLine, lines[endLine].length);
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(start, end), updatedFrontmatter);
          await vscode.workspace.applyEdit(edit);

          console.log(`PromptPress: Updated last-updated/phase in ${fileName}`);
        }
      }
    } catch (error) {
      console.warn(`PromptPress: Could not update metadata for ${path.basename(document.fileName)}: ${error}`);
    }
  }

  // PromptPress/IMP-1058
  async syncReferencesWithMentions(document: any, parsed?: ParsedSpec): Promise<void> {
    const vscode = await import('vscode');
    try {
      const content = document.getText();
      const spec = parsed || this.parser.parse(content);
      
      // Get unique mentions (references from content)
      const mentions = new Set(spec.references);
      
      // Update metadata references to match mentions
      spec.metadata.references = Array.from(mentions).sort();
      
      // Find frontmatter range
      const lines = content.split('\n');
      let startLine = -1;
      let endLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          if (startLine === -1) {
            startLine = i;
          } else {
            endLine = i;
            break;
          }
        }
      }

      if (startLine !== -1 && endLine !== -1) {
        // Reconstruct frontmatter with synced references
        const updatedFrontmatter = this.updateFrontmatter('', spec.metadata).split('\n').slice(0, -1).join('\n');

        const start = new vscode.Position(startLine, 0);
        const end = new vscode.Position(endLine, lines[endLine].length);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(start, end), updatedFrontmatter);
        await vscode.workspace.applyEdit(edit);

        console.log(`PromptPress: Synced references with mentions in ${path.basename(document.fileName)}`);
      }
    } catch (error) {
      console.warn(`PromptPress: Could not sync references for ${path.basename(document.fileName)}: ${error}`);
    }
  }

  private updateFrontmatter(content: string, metadata: SpecMetadata): string {
    // Remove existing frontmatter
    const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Reconstruct frontmatter
    const frontmatterLines = [
      '---',
      `artifact: ${metadata.artifact}`,
      `phase: ${metadata.phase}`,
    ];

    if (metadata.dependsOn !== undefined) {
      const items = (metadata.dependsOn || []).map(v => `"${v}"`).join(', ');
      frontmatterLines.push(`depends-on: [${items}]`);
    }
    if (metadata.references !== undefined) {
      const items = (metadata.references || []).map(v => `"${v}"`).join(', ');
      frontmatterLines.push(`references: [${items}]`);
    }
    if (metadata.version) {
      frontmatterLines.push(`version: ${metadata.version}`);
    }
    if (metadata.lastUpdated) {
      frontmatterLines.push(`last-updated: ${metadata.lastUpdated}`);
    }
    frontmatterLines.push('---');

    return frontmatterLines.join('\n') + '\n' + withoutFrontmatter;
  }

  // PromptPress/IMP-1059
  async validateReferences(filePath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = this.parser.parse(content);

      const fileName = path.basename(filePath);
      const specRef = fileName.replace(/\.(req|design|impl)\.md$/, '.$1');
      const isConOps = fileName === 'ConOps.md';

      // Validate depends-on
      if (parsed.metadata.dependsOn) {
        for (const dep of parsed.metadata.dependsOn) {
          const range = this.findMetadataRange(content, 'depends-on', dep);

          // Check for self-reference
          if (dep === specRef) {
            errors.push({
              message: `Cannot depend on itself`,
              line: range.line,
              column: range.column,
              length: range.length
            });
            continue;
          }

          // For ConOps, warn if it has any dependencies
          if (isConOps) {
            errors.push({
              message: `ConOps should not have dependencies`,
              line: range.line,
              column: range.column,
              length: range.length
            });
            continue;
          }

          // Check over-specification
          if (!/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(dep)) {
            errors.push({
              message: `Depends-on '${dep}' is over-specified`,
              line: range.line,
              column: range.column,
              length: range.length
            });
          } else {
            // Check existence
            if (!await this.fileExists(this.resolveSpecPath(dep))) {
              errors.push({
                message: `Dependency '${dep}' not found`,
                line: range.line,
                column: range.column,
                length: range.length
              });
            } else {
              // Check circular dependency
              const allDeps = await this.getAllDependencies(dep);
              if (allDeps.has(specRef)) {
                errors.push({
                  message: `Dependency '${dep}' creates a circular dependency`,
                  line: range.line,
                  column: range.column,
                  length: range.length
                });
              }
            }
          }
        }
      }

      // Validate references
      if (parsed.metadata.references) {
        for (const ref of parsed.metadata.references) {
          const range = this.findMetadataRange(content, 'references', ref);

          // Check for self-reference
          if (ref === specRef) {
            errors.push({
              message: `Cannot reference itself`,
              line: range.line,
              column: range.column,
              length: range.length
            });
            continue;
          }

          // Check over-specification
          if (!/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(ref)) {
            errors.push({
              message: `Reference '${ref}' is over-specified`,
              line: range.line,
              column: range.column,
              length: range.length
            });
          } else {
            // Check existence
            if (!await this.fileExists(this.resolveSpecPath(ref))) {
              errors.push({
                message: `Reference '${ref}' not found`,
                line: range.line,
                column: range.column,
                length: range.length
              });
            } else {
              // Check if referenced document depends on this document
              const refDeps = await this.getAllDependencies(ref);
              if (refDeps.has(specRef)) {
                errors.push({
                  message: `Cannot reference '${ref}' which depends on this document`,
                  line: range.line,
                  column: range.column,
                  length: range.length
                });
              }

              // For ConOps, check that references are only .req
              if (isConOps && !ref.endsWith('.req')) {
                errors.push({
                  message: `ConOps can only reference .req files, not '${ref}'`,
                  line: range.line,
                  column: range.column,
                  length: range.length
                });
              }
            }
          }
        }
      }

      // Validate content references
      for (const ref of parsed.references) {
        const range = this.findContentReferenceRange(content, ref);

        // Check over-specification: allow punctuation but not . followed by letter
        if (!/^[a-zA-Z0-9-]+\.(req|design|impl)[^\w]*$/.test(ref)) {
          errors.push({
            message: `Mention '${ref}' is over-specified`,
            line: range.line,
            column: range.column,
            length: range.length
          });
        } else {
          // Extract base ref for existence and type checks
          const baseRefMatch = ref.match(/^([a-zA-Z0-9-]+\.(req|design|impl))/);
          const baseRef = baseRefMatch ? baseRefMatch[1] : ref;

          // Check for self-reference
          if (baseRef === specRef) {
            errors.push({
              message: `Cannot reference itself`,
              line: range.line,
              column: range.column,
              length: range.length
            });
            continue;
          }

          // Check existence
          if (!await this.fileExists(this.resolveSpecPath(baseRef))) {
            errors.push({
              message: `Mention '${ref}' not found`,
              line: range.line,
              column: range.column,
              length: range.length
            });
          } else {
            // Check if mentioned document depends on this document
            const refDeps = await this.getAllDependencies(baseRef);
            if (refDeps.has(specRef)) {
              errors.push({
                message: `Cannot reference '${ref}' which depends on this document`,
                line: range.line,
                column: range.column,
                length: range.length
              });
            }

            if (isConOps && !baseRef.endsWith('.req')) {
              // ConOps can only reference .req files
              errors.push({
                message: `ConOps can only reference requirement files`,
                line: range.line,
                column: range.column,
                length: range.length
              });
            }
          }
        }
      }

      // New validation: references list must match mentions
      const mentionedRefs = new Set(parsed.references);
      if (parsed.metadata.references) {
        for (const ref of parsed.metadata.references) {
          if (!mentionedRefs.has(ref)) {
            const range = this.findMetadataRange(content, 'references', ref);
            errors.push({
              message: `Reference '${ref}' is listed but not mentioned in content`,
              line: range.line,
              column: range.column,
              length: range.length
            });
          }
        }
      }

      // New validation: depends-on must have corresponding mentions
      if (parsed.metadata.dependsOn) {
        for (const dep of parsed.metadata.dependsOn) {
          if (!mentionedRefs.has(dep)) {
            const range = this.findMetadataRange(content, 'depends-on', dep);
            errors.push({
              message: `Depends-on '${dep}' has no corresponding mention in content`,
              line: range.line,
              column: range.column,
              length: range.length
            });
          }
        }
      }
    } catch (error) {
      // If parsing fails, don't add errors
    }

    return errors;
  }

  private findMetadataRange(content: string, key: string, value: string): {line: number, column: number, length: number} {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith(`${key}:`) && line.includes(value)) {
        const start = lines[i].indexOf(value);
        return {line: i, column: start, length: value.length};
      }
    }
    // Fallback to first line of frontmatter
    return {line: 0, column: 0, length: lines[0]?.length || 0};
  }

  private findContentReferenceRange(content: string, ref: string): {line: number, column: number, length: number} {
    const lines = content.split('\n');
    const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = ref.endsWith('.md') ? '' : '@';
    const regex = new RegExp(`${prefix}${escapedRef}`, 'g');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        const index = line.indexOf(`${prefix}${ref}`);
        return {line: i, column: index, length: `${prefix}${ref}`.length};
      }
    }
    // Fallback
    return {line: 0, column: 0, length: 0};
  }

  private resolveSpecPath(specRef: string): string {
    // Use the shared helper for path resolution
    return resolveSpecPathSync(this.workspaceRoot, specRef);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getSpecType(fileName: string): 'requirement' | 'design' | 'implementation' | null {
    if (fileName.endsWith('.req.md')) {
      return 'requirement';
    } else if (fileName.endsWith('.design.md')) {
      return 'design';
    } else if (fileName.endsWith('.impl.md')) {
      return 'implementation';
    }
    return null;
  }

  // PromptPress/IMP-1060
  async getAllDependencies(specRef: string, visited: Set<string> = new Set()): Promise<Set<string>> {
    if (visited.has(specRef)) {
      return new Set(); // Cycle detected, but return empty to avoid infinite
    }
    visited.add(specRef);

    const filePath = this.resolveSpecPath(specRef);
    if (!await this.fileExists(filePath)) {
      return new Set();
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = this.parser.parse(content);
      const deps = new Set<string>();

      if (parsed.metadata.dependsOn) {
        for (const dep of parsed.metadata.dependsOn) {
          if (!visited.has(dep)) {
            deps.add(dep);
            const subDeps = await this.getAllDependencies(dep, new Set(visited));
            subDeps.forEach(d => deps.add(d));
          }
        }
      }

      return deps;
    } catch {
      return new Set();
    }
  }

  // PromptPress/IMP-1061
  async convertOverspecifiedReferences(filePath: string): Promise<void> {
    try {
      let content = await fs.readFile(filePath, 'utf-8');

      // Scan for overspecified references: artifact.phase.md and convert to @artifact.phase
      const regex = /\b([a-zA-Z0-9-]+)\.(req|design|impl)\.md\b/g;
      const originalContent = content;
      content = content.replace(regex, '@$1.$2');

      // Write back if changed
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`PromptPress: Converted overspecified references in ${path.basename(filePath)}`);
      }
    } catch (error) {
      // If parsing fails, don't convert
    }
  }
}