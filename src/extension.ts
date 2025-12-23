import * as vscode from 'vscode';
import { SpecFileWatcher } from './watchers/specFileWatcher.js';
import { XAIClient } from './ai/xaiClient.js';
import { ChatPanelProvider } from './ui/chatPanelProvider.js';
import { ConversationManager } from './services/conversationManager.js';
import { ContextBuilder } from './services/contextBuilder.js';
import { ScaffoldService } from './services/scaffoldService.js';
import { CascadeServiceCommands } from './services/cascadeService.js';
import { ImplParser } from './services/implParser.js';
import { FileStructureParser } from './services/fileStructureParser.js';
import { MarkdownParser } from './parsers/markdownParser.js';
import { SpecCompletionProvider } from './providers/specCompletionProvider.js';
import { SpecReferenceManager } from './spec/SpecReferenceManager.js';
import { PromptService } from './services/promptService.js';

// PromptPress/IMP-1013
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
    
    // Initialize spec provider
    const specProvider = new SpecCompletionProvider(workspaceRoot);
    const specRefManager = new SpecReferenceManager(workspaceRoot);
    
    // Register spec completion and link providers
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            { scheme: 'file', pattern: '**/specs/**/*.{req.md,design.md,impl.md,md}' },
            specProvider
        )
    );

    // Register completion provider for @ mentions
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', pattern: '**/specs/**/*.{req.md,design.md,impl.md,md}' },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
                const filePath = document.uri.fsPath;
                const fileName = filePath.split('/').pop() || filePath;
                const isConOps = fileName === 'ConOps.md';
                const currentRefMatch = fileName.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)\.md$/);
                const currentRef = currentRefMatch ? `${currentRefMatch[1]}.${currentRefMatch[2]}` : (isConOps ? 'ConOps' : null);
                const currentPhase = currentRefMatch ? currentRefMatch[2] : null;

                const line = document.lineAt(position).text;
                const linePrefix = line.substr(0, position.character);

                // Check if @ mention
                if (linePrefix.includes('@')) {
                    const atIndex = line.lastIndexOf('@');
                    const afterAt = line.substr(atIndex + 1, position.character - atIndex - 1);
                    
                    const allRefs = specRefManager.getAllSpecRefs();
                    const allowedRefs = allRefs.filter(ref => {
                        if (ref === currentRef) return false; // don't show current
                        if (ref.endsWith('.impl')) return false; // don't show .impl
                        if (isConOps && !ref.endsWith('.req')) return false; // ConOps only .req
                        if (currentPhase === 'req' && ref.endsWith('.design')) return false;
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
                    let isReferences = false;
                    for (let i = position.line - 1; i >= frontmatterStart; i--) {
                        if (lines[i].includes('depends-on:')) {
                            isDependsOn = true;
                            break;
                        }
                        if (lines[i].includes('references:')) {
                            isReferences = true;
                            break;
                        }
                    }
                    
                    if (isDependsOn && isConOps) {
                        // ConOps should not have depends-on
                        return [];
                    }
                    
                    const allRefs = specRefManager.getAllSpecRefs();
                    const allowedRefs = allRefs.filter(ref => {
                        if (ref === currentRef) return false; // don't show current
                        if (ref.endsWith('.impl')) return false; // don't show .impl
                        if (currentPhase === 'req' && ref.endsWith('.design')) return false;
                        if (isConOps && isReferences && !ref.endsWith('.req')) return false; // ConOps references only .req
                        if (isDependsOn && currentRef && specRefManager.wouldCreateCycle(ref, currentRef)) return false; // no circular
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

    // Initialize UI
    const chatPanelProvider = new ChatPanelProvider(
        context.extensionUri,
        aiClient,
        conversationManager,
        contextBuilder
    );

    const promptService = new PromptService();

    // Initialize file watcher (no auto-chat prompts; updates metadata and validates refs)
    const specsWatcher = new SpecFileWatcher(
        config.get<boolean>('autoMonitor', true),
        workspaceRoot,
        diagnosticCollection
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.openChat', () => {
            chatPanelProvider.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.syncCodeWithSpec', async () => {
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
        vscode.commands.registerCommand('promptpress.createRequirementSpec', async () => {
            await scaffoldService.createRequirementSpec();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.refactorSpec', async () => {
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
                    await cascadeService.refactorSpec(filePath);
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.tersifySpec', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor. Please open a spec file.');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.match(/specs\/.*\.(req|design)\.md$/)) {
                vscode.window.showErrorMessage('Please open a requirement or design spec file (.req.md or .design.md)');
                return;
            }

            outputChannel.appendLine(`[Command] Tersify Spec triggered for ${filePath}`);
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Tersifying spec documents...',
                    cancellable: false
                },
                async () => {
                    await cascadeService.tersifySpec(filePath);
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.syncImplementationSpec', async () => {
            await scaffoldService.syncImplementationSpecSpec();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.syncConOps', async () => {
            await scaffoldService.syncConOps();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.syncTOC', async () => {
            await scaffoldService.syncTOC();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.codeToImplementationSpecification', async () => {
            await promptService.executePrompt('code-to-impl-spec');
        }),
        vscode.commands.registerCommand('promptpress.implementationToDesignSpecification', async () => {
            await promptService.executePrompt('impl-to-design-spec');
        }),
        vscode.commands.registerCommand('promptpress.designToRequirementsSpecification', async () => {
            await promptService.executePrompt('design-to-req-spec');
        }),
        vscode.commands.registerCommand('promptpress.applyRequirementSpecRefactoring', async () => {
            await promptService.executePrompt('apply-req-spec');
        }),
        vscode.commands.registerCommand('promptpress.satisfyReqSpec', async () => {
            await promptService.executePrompt('satisfy-req-spec');
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

// PromptPress/IMP-1014
export function deactivate() {
    console.log('PromptPress extension is now deactivated');
}
