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
                return links;
            }
        }
    );
    context.subscriptions.push(linkProvider);

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
