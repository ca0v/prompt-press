import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SpecFileWatcher } from './watchers/specFileWatcher';
import { XAIClient } from './ai/xaiClient';
import { ChatPanelProvider } from './ui/chatPanelProvider';
import { ConversationManager } from './services/conversationManager';
import { ContextBuilder } from './services/contextBuilder';
import { ScaffoldService } from './services/scaffoldService';
import { CascadeServiceCommands } from './services/cascadeService';
import { ImplParser } from './services/implParser';
import { FileStructureParser } from './services/fileStructureParser';
import { MarkdownParser } from './parsers/markdownParser';

export function activate(context: vscode.ExtensionContext) {
    console.log('PromptPress extension is now active');

    // Create output channel for logging
    const outputChannel = vscode.window.createOutputChannel('PromptPress');
    context.subscriptions.push(outputChannel);
    
    // Create diagnostic collection for spec validation
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('promptpress');
    context.subscriptions.push(diagnosticCollection);
    
    // Redirect console.log to output channel
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args: any[]) => {
        outputChannel.appendLine(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        originalLog(...args);
    };
    
    console.error = (...args: any[]) => {
        outputChannel.appendLine('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        originalError(...args);
    };
    
    console.warn = (...args: any[]) => {
        outputChannel.appendLine('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        originalWarn(...args);
    };

    outputChannel.appendLine('PromptPress extension activated');
    outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);

    // Get configuration
    const config = vscode.workspace.getConfiguration('promptpress');
    const apiKey = config.get<string>('apiKey') || process.env.PROMPT_PRESS_XAI_API_KEY || '';
    
    if (!apiKey) {
        const message = 'PromptPress: No API key configured. Set PROMPT_PRESS_XAI_API_KEY or configure in settings.';
        outputChannel.appendLine(`[WARN] ${message}`);
        vscode.window.showWarningMessage(message);
    } else {
        outputChannel.appendLine('[INFO] API key configured');
    }

    // Initialize services
    const aiClient = new XAIClient(apiKey, config, outputChannel);
    const conversationManager = new ConversationManager(context);
    const contextBuilder = new ContextBuilder();
    const scaffoldService = new ScaffoldService(aiClient, outputChannel);
    const markdownParser = new MarkdownParser();
    const fileStructureParser = new FileStructureParser(outputChannel);
    const implParser = new ImplParser(markdownParser, aiClient, outputChannel, fileStructureParser);
    
    // Get workspace root for cascade service
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const cascadeService = new CascadeServiceCommands(aiClient, outputChannel, workspaceRoot);
    
    // Initialize UI
    const chatPanelProvider = new ChatPanelProvider(
        context.extensionUri,
        aiClient,
        conversationManager,
        contextBuilder
    );

    // Initialize file watcher (no auto-chat prompts; updates metadata and validates refs)
    const specsWatcher = new SpecFileWatcher(
        config.get<boolean>('autoMonitor', true),
        workspaceRoot,
        diagnosticCollection
    );

    // Function to resolve spec path
    function resolveSpecPath(specRef: string, workspaceRoot: string): string {
        const [artifact, phase] = specRef.split('.');
        let subdir = '';
        if (phase === 'req') {
            subdir = 'requirements';
        } else if (phase === 'design') {
            subdir = 'design';
        } else if (phase === 'impl') {
            subdir = 'implementation';
        }
        if (subdir) {
            return path.join(workspaceRoot, 'specs', subdir, `${artifact}.${phase}.md`);
        } else {
            return path.join(workspaceRoot, 'specs', `${artifact}.${phase}.md`);
        }
    }

    // Register document link provider for valid spec mentions
    const linkProvider = vscode.languages.registerDocumentLinkProvider(
        { scheme: 'file', pattern: '**/specs/**/*.{req.md,design.md,impl.md}' },
        {
            provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
                const links: vscode.DocumentLink[] = [];
                const text = document.getText();
                const regex = /@([a-zA-Z0-9-]+\.(req|design|impl))/g; // Only valid format mentions
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const ref = match[1];
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + match[0].length);
                    const range = new vscode.Range(startPos, endPos);
                    const filePath = resolveSpecPath(ref, workspaceRoot);
                    if (fs.existsSync(filePath)) {
                        const uri = vscode.Uri.file(filePath);
                        links.push(new vscode.DocumentLink(range, uri));
                    }
                }

                // Handle frontmatter references in depends-on and references
                const lines = text.split('\n');
                let frontmatterStartLine = -1;
                let frontmatterEndLine = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        if (frontmatterStartLine === -1) {
                            frontmatterStartLine = i;
                        } else {
                            frontmatterEndLine = i;
                            break;
                        }
                    }
                }
                if (frontmatterStartLine !== -1 && frontmatterEndLine !== -1) {
                    const frontmatterStartPos = document.lineAt(frontmatterStartLine + 1).range.start;
                    const frontmatterEndPos = document.lineAt(frontmatterEndLine).range.start;
                    const frontmatterRange = new vscode.Range(frontmatterStartPos, frontmatterEndPos);
                    const frontmatterText = document.getText(frontmatterRange);
                    const refRegex = /([a-zA-Z0-9-]+\.(req|design|impl))/g;
                    while ((match = refRegex.exec(frontmatterText)) !== null) {
                        const ref = match[1];
                        const startPos = document.positionAt(document.offsetAt(frontmatterRange.start) + match.index);
                        const endPos = document.positionAt(document.offsetAt(startPos) + ref.length);
                        const range = new vscode.Range(startPos, endPos);
                        const filePath = resolveSpecPath(ref, workspaceRoot);
                        if (fs.existsSync(filePath)) {
                            const uri = vscode.Uri.file(filePath);
                            links.push(new vscode.DocumentLink(range, uri));
                        }
                    }
                }

                return links;
            }
        }
    );
    context.subscriptions.push(linkProvider);

    // Function to get all spec refs
    function getAllSpecRefs(workspaceRoot: string): string[] {
        const refs: string[] = [];
        const specsDir = path.join(workspaceRoot, 'specs');
        if (!fs.existsSync(specsDir)) return refs;
        const subdirs = ['requirements', 'design', 'implementation'];
        for (const subdir of subdirs) {
            const dir = path.join(specsDir, subdir);
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
                for (const file of files) {
                    const match = file.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)\.md$/);
                    if (match) {
                        refs.push(`${match[1]}.${match[2]}`);
                    }
                }
            }
        }
        return refs;
    }

    // Function to get all dependencies of a spec
    function getAllDependencies(specRef: string, workspaceRoot: string, visited: Set<string> = new Set()): Set<string> {
        if (visited.has(specRef)) {
            return new Set();
        }
        visited.add(specRef);
        const filePath = resolveSpecPath(specRef, workspaceRoot);
        if (!fs.existsSync(filePath)) {
            return new Set();
        }
        const deps = new Set<string>();
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const yaml = frontmatterMatch[1];
                const dependsOnMatch = yaml.match(/depends-on:\s*\[([^\]]*)\]/);
                if (dependsOnMatch) {
                    const depsStr = dependsOnMatch[1];
                    const depRefs = depsStr.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                    for (const d of depRefs) {
                        if (d && !visited.has(d)) {
                            deps.add(d);
                            const sub = getAllDependencies(d, workspaceRoot, new Set(visited));
                            sub.forEach(sd => deps.add(sd));
                        }
                    }
                }
            }
        } catch {}
        return deps;
    }

    // Function to check if adding dep would create cycle
    function wouldCreateCycle(dep: string, currentRef: string, workspaceRoot: string): boolean {
        const allDeps = getAllDependencies(dep, workspaceRoot);
        return allDeps.has(currentRef);
    }

    // Register completion provider for @ mentions
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', pattern: '**/specs/**/*.{req.md,design.md,impl.md}' },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
                const filePath = document.uri.fsPath;
                const fileName = path.basename(filePath);
                const currentRefMatch = fileName.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)\.md$/);
                if (!currentRefMatch) return [];
                const currentRef = `${currentRefMatch[1]}.${currentRefMatch[2]}`;
                let currentPhase = currentRefMatch[2];

                const line = document.lineAt(position).text;
                const linePrefix = line.substr(0, position.character);

                // Check if @ mention
                if (linePrefix.includes('@')) {
                    const atIndex = line.lastIndexOf('@');
                    const afterAt = line.substr(atIndex + 1, position.character - atIndex - 1);
                    
                    const allRefs = getAllSpecRefs(workspaceRoot);
                    let allowedRefs = allRefs.filter(ref => {
                        if (ref.endsWith('.impl')) return false; // don't show .impl
                        if (currentPhase === 'req' && ref.endsWith('.design')) return false;
                        if (ref === currentRef) return false; // don't show current
                        return ref.startsWith(afterAt);
                    });
                    
                    return allowedRefs.map(ref => {
                        const item = new vscode.CompletionItem(ref, vscode.CompletionItemKind.Reference);
                        item.insertText = ref.substr(afterAt.length);
                        item.documentation = `Reference to ${ref}`;
                        return item;
                    });
                }

                // Check if in frontmatter list
                const lines = document.getText().split('\n');
                let frontmatterStart = -1;
                let frontmatterEnd = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim() === '---') {
                        if (frontmatterStart === -1) {
                            frontmatterStart = i;
                        } else {
                            frontmatterEnd = i;
                            break;
                        }
                    }
                }
                if (position.line > frontmatterStart && position.line < frontmatterEnd && line.trim().startsWith('- ')) {
                    // In frontmatter list, check if depends-on or references
                    let isDependsOn = false;
                    for (let i = position.line - 1; i >= frontmatterStart; i--) {
                        if (lines[i].includes('depends-on:')) {
                            isDependsOn = true;
                            break;
                        }
                        if (lines[i].includes('references:')) {
                            break;
                        }
                    }
                    
                    const allRefs = getAllSpecRefs(workspaceRoot);
                    let allowedRefs = allRefs.filter(ref => {
                        if (ref.endsWith('.impl')) return false; // don't show .impl
                        if (currentPhase === 'req' && ref.endsWith('.design')) return false;
                        if (ref === currentRef) return false; // don't show current
                        if (isDependsOn && wouldCreateCycle(ref, currentRef, workspaceRoot)) return false; // no circular
                        return true;
                    });
                    
                    return allowedRefs.map(ref => {
                        const item = new vscode.CompletionItem(ref, vscode.CompletionItemKind.Reference);
                        item.insertText = ref;
                        item.documentation = `Reference to ${ref}`;
                        return item;
                    });
                }

                return [];
            }
        },
        '@' // trigger character
    );
    context.subscriptions.push(completionProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.openChat', () => {
            chatPanelProvider.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.generateCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.endsWith('.impl.md')) {
                vscode.window.showErrorMessage('Please open an implementation spec (.impl.md) file');
                return;
            }

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating code from implementation spec...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: 'Parsing spec...' });
                    await implParser.parseAndGenerate(filePath);
                    progress.report({ increment: 100, message: 'Code generation complete' });
                });

                vscode.window.showInformationMessage('Code generation completed successfully!');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Code generation failed: ${message}`);
                outputChannel.appendLine(`[ERROR] Code generation failed: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.validateSpec', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.match(/specs\/.*\.(req|design|impl)\.md$/)) {
                vscode.window.showErrorMessage('Not a PromptPress spec file');
                return;
            }

            // Trigger validation
            specsWatcher.validateFile(filePath);
            vscode.window.showInformationMessage('Spec validation completed. Check Problems panel for errors.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.toggleMonitoring', () => {
            specsWatcher.toggleMonitoring();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.scaffoldArtifact', async () => {
            await scaffoldService.scaffoldArtifact();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.scaffoldProject', async () => {
            await scaffoldService.scaffoldProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.applyChanges', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor. Please open a spec file.');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.match(/\.(req|design)\.md$/)) {
                vscode.window.showErrorMessage('Please open a requirement or design spec file (.req.md or .design.md)');
                return;
            }

            outputChannel.appendLine(`[Command] Apply Changes triggered for ${filePath}`);
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Applying changes...',
                    cancellable: false
                },
                async () => {
                    await cascadeService.applyChanges(filePath);
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.generateImplementation', async () => {
            await scaffoldService.generateImplementationSpec();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.updateConOps', async () => {
            await scaffoldService.updateConOps();
        })
    );

    // Register disposables
    context.subscriptions.push(specsWatcher);
    context.subscriptions.push(chatPanelProvider);

    // Show status
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(comment-discussion) PromptPress';
    statusBarItem.command = 'promptpress.openChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('PromptPress extension is now deactivated');
}
