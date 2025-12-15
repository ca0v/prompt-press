import * as vscode from 'vscode';
import * as path from 'path';
import { XAIClient, ChatMessage } from '../ai/xaiClient';
import { ConversationManager } from '../services/conversationManager';
import { ContextBuilder } from '../services/contextBuilder';

export class ChatPanelProvider implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private currentArtifact: string | undefined;
    private currentFilePath: string | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private aiClient: XAIClient,
        private conversationManager: ConversationManager,
        private contextBuilder: ContextBuilder
    ) {}

    /**
     * Show the chat panel
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'promptpressChat',
            'PromptPress Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleWebviewMessage(message);
            },
            null,
            this.disposables
        );

        // Cleanup when panel is closed
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.disposables
        );
    }

    /**
     * Notify about file changes
     */
    public notifyFileChange(
        uri: vscode.Uri,
        changeType: string,
        specType: string
    ): void {
        this.currentFilePath = uri.fsPath;
        
        // Extract artifact name from file path
        const fileName = path.basename(uri.fsPath);
        const artifactName = fileName.replace(/\.(req|design|impl)\.md$/, '');
        this.currentArtifact = artifactName;

        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'fileChange',
                data: {
                    file: fileName,
                    changeType,
                    specType,
                    artifact: artifactName
                }
            });
        }
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'sendMessage':
                await this.handleUserMessage(message.text);
                break;
            case 'clearHistory':
                if (this.currentArtifact) {
                    this.conversationManager.clearConversation(this.currentArtifact);
                    this.panel?.webview.postMessage({
                        type: 'historyCleared'
                    });
                }
                break;
            case 'loadHistory':
                if (this.currentArtifact) {
                    const history = this.conversationManager.getHistory(this.currentArtifact);
                    this.panel?.webview.postMessage({
                        type: 'historyLoaded',
                        data: history
                    });
                }
                break;
        }
    }

    /**
     * Handle user message and get AI response
     */
    private async handleUserMessage(userMessage: string): Promise<void> {
        if (!this.currentArtifact || !this.currentFilePath) {
            this.panel?.webview.postMessage({
                type: 'error',
                data: 'No artifact selected. Please open or modify a spec file first.'
            });
            return;
        }

        // Show loading state
        this.panel?.webview.postMessage({
            type: 'loading',
            data: true
        });

        try {
            // Build context
            const { context, summary } = await this.contextBuilder.buildContext(
                this.currentFilePath
            );

            // Estimate tokens
            const estimatedTokens = this.contextBuilder.estimateTokens(context);
            console.log(`Context: ${estimatedTokens} tokens (estimated)`);

            // Format context for AI
            const contextText = this.contextBuilder.formatContextForAI(context);

            // Build messages for AI
            const messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: this.getSystemPrompt()
                },
                {
                    role: 'system',
                    content: `Context:\n${contextText}`
                }
            ];

            // Add conversation history
            const history = this.conversationManager.getHistory(this.currentArtifact, 10);
            messages.push(...history as ChatMessage[]);

            // Add current user message
            messages.push({
                role: 'user',
                content: userMessage
            });

            // Save user message
            this.conversationManager.addMessage(
                this.currentArtifact,
                'user',
                userMessage
            );

            // Get AI response
            const aiResponse = await this.aiClient.chat(messages);

            // Parse response for structured markers
            const parsed = this.aiClient.parseResponse(aiResponse);

            // Save AI message
            this.conversationManager.addMessage(
                this.currentArtifact,
                'assistant',
                parsed.mainContent
            );

            // Send response to webview
            this.panel?.webview.postMessage({
                type: 'assistantMessage',
                data: {
                    content: parsed.mainContent,
                    questions: parsed.questions,
                    requestedDocs: parsed.requestedDocs,
                    validationStatus: parsed.validationStatus
                }
            });

            // Handle requested documents
            if (parsed.requestedDocs.length > 0) {
                await this.handleRequestedDocuments(parsed.requestedDocs);
            }

        } catch (error: any) {
            console.error('AI request failed:', error);
            this.panel?.webview.postMessage({
                type: 'error',
                data: error.message || 'Failed to get AI response'
            });
        } finally {
            this.panel?.webview.postMessage({
                type: 'loading',
                data: false
            });
        }
    }

    /**
     * Handle AI-requested documents
     */
    private async handleRequestedDocuments(docRefs: string[]): Promise<void> {
        const docs = await this.contextBuilder.loadRequestedDocuments(docRefs);
        
        if (docs.length > 0) {
            this.panel?.webview.postMessage({
                type: 'documentsLoaded',
                data: {
                    count: docs.length,
                    files: docs.map(d => path.basename(d.filePath))
                }
            });
        }
    }

    /**
     * Get system prompt for AI
     */
    private getSystemPrompt(): string {
        return `You are an AI assistant for PromptPress, a prompt-driven development tool.

Your role is to help developers refine specification documents across three phases:
1. Requirements (.req.md) - What needs to be built
2. Design (.design.md) - How it will be built  
3. Implementation (.impl.md) - Precise build instructions

Guidelines:
- Respond in a structured format using markers: [RESPONSE], [QUESTION: section], [VALIDATION: passed|failed]
- When you need more information, use: REQUEST-DOC: artifact-name.phase
- Help identify ambiguities and suggest improvements
- For implementation specs, be extremely precise and unambiguous
- Remember: these specs will be used to generate code, so clarity is critical

When responding:
- Be concise but thorough
- Ask clarifying questions when specifications are unclear
- Suggest concrete improvements with examples
- Validate completeness and consistency`;
    }

    /**
     * Get webview HTML content
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PromptPress Chat</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        #messages {
            height: calc(100vh - 150px);
            overflow-y: auto;
            margin-bottom: 10px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
        }
        .user-message {
            background-color: var(--vscode-input-background);
            margin-left: 20px;
        }
        .assistant-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            margin-right: 20px;
        }
        .system-message {
            background-color: var(--vscode-editorWarning-background);
            font-style: italic;
            font-size: 0.9em;
        }
        #input-container {
            display: flex;
            gap: 5px;
        }
        #user-input {
            flex: 1;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .loading {
            text-align: center;
            padding: 10px;
            font-style: italic;
        }
        .questions {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-editorInfo-background);
            border-left: 3px solid var(--vscode-editorInfo-foreground);
        }
        .doc-request {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-editorWarning-background);
            border-left: 3px solid var(--vscode-editorWarning-foreground);
        }
    </style>
</head>
<body>
    <div id="messages"></div>
    <div id="input-container">
        <input type="text" id="user-input" placeholder="Ask about the spec or request changes..." />
        <button onclick="sendMessage()">Send</button>
        <button onclick="clearHistory()">Clear</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const userInput = document.getElementById('user-input');

        // Handle Enter key
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        function sendMessage() {
            const text = userInput.value.trim();
            if (!text) return;

            addMessage('user', text);
            userInput.value = '';

            vscode.postMessage({
                type: 'sendMessage',
                text: text
            });
        }

        function clearHistory() {
            if (confirm('Clear conversation history?')) {
                vscode.postMessage({ type: 'clearHistory' });
                messagesDiv.innerHTML = '';
            }
        }

        function addMessage(role, content, extra) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}-message\`;
            
            const contentDiv = document.createElement('div');
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);

            if (extra) {
                if (extra.questions && extra.questions.length > 0) {
                    const questionsDiv = document.createElement('div');
                    questionsDiv.className = 'questions';
                    questionsDiv.innerHTML = '<strong>Questions:</strong><br>' + 
                        extra.questions.map(q => '• ' + q).join('<br>');
                    messageDiv.appendChild(questionsDiv);
                }

                if (extra.requestedDocs && extra.requestedDocs.length > 0) {
                    const docsDiv = document.createElement('div');
                    docsDiv.className = 'doc-request';
                    docsDiv.innerHTML = '<strong>Requested Documents:</strong><br>' + 
                        extra.requestedDocs.map(d => '• ' + d).join('<br>');
                    messageDiv.appendChild(docsDiv);
                }
            }

            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
                case 'fileChange':
                    addMessage('system', 
                        \`File \${message.data.changeType}: \${message.data.file} (\${message.data.specType})\`
                    );
                    break;
                case 'assistantMessage':
                    addMessage('assistant', message.data.content, message.data);
                    break;
                case 'error':
                    addMessage('system', 'Error: ' + message.data);
                    break;
                case 'loading':
                    if (message.data) {
                        const loadingDiv = document.createElement('div');
                        loadingDiv.id = 'loading-indicator';
                        loadingDiv.className = 'loading';
                        loadingDiv.textContent = 'Thinking...';
                        messagesDiv.appendChild(loadingDiv);
                    } else {
                        const loadingDiv = document.getElementById('loading-indicator');
                        if (loadingDiv) loadingDiv.remove();
                    }
                    break;
                case 'historyCleared':
                    messagesDiv.innerHTML = '';
                    addMessage('system', 'Conversation history cleared');
                    break;
                case 'historyLoaded':
                    message.data.forEach(msg => {
                        addMessage(msg.role, msg.content);
                    });
                    break;
            }
        });

        // Load history on startup
        vscode.postMessage({ type: 'loadHistory' });
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        this.panel?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
