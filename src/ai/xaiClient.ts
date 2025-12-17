import * as vscode from 'vscode';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class XAIClient {
    private baseURL: string;
    private headers: Record<string, string>;
    private model: string;
    private apiKey: string;
    private outputChannel: vscode.OutputChannel | undefined;

    constructor(apiKey: string, config: vscode.WorkspaceConfiguration, outputChannel?: vscode.OutputChannel) {
        this.apiKey = apiKey;
        this.outputChannel = outputChannel;
        this.baseURL = config.get<string>('apiEndpoint', 'https://api.x.ai/v1');
        this.model = config.get<string>('model', 'grok-code-fast-1');

        this.headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Send a chat completion request
     */
    public async chat(messages: ChatMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        const request: ChatCompletionRequest = {
            model: this.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4000,
            stream: false
        };

        const url = `${this.baseURL}/chat/completions`;

        try {
            const logMsg = `[XAI] Sending chat completion request: model=${request.model}, messages=${messages.length}, temp=${request.temperature}, maxTokens=${request.max_tokens}`;
            if (this.outputChannel) {
                this.outputChannel.appendLine(logMsg);
            }
            console.log(logMsg);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(request),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                const errorDetails = {
                    status: response.status,
                    statusText: response.statusText,
                    errorMessage: errorData.error?.message || `HTTP ${response.status}`,
                    errorType: errorData.error?.type,
                    url: url,
                    method: 'POST'
                };
                
                const errorLog = `[XAI] API Request Failed:\n${JSON.stringify(errorDetails, null, 2)}`;
                const payloadLog = `[XAI] Request payload:\n${JSON.stringify(request, null, 2)}`;
                
                if (this.outputChannel) {
                    this.outputChannel.appendLine(errorLog);
                    this.outputChannel.appendLine(payloadLog);
                    this.outputChannel.show(); // Show the output panel
                }
                console.error(errorLog);
                console.error(payloadLog);
                
                const message = errorData.error?.message || `HTTP ${response.status}`;
                throw new Error(`xAI API Error: ${message} (Status: ${response.status})`);
            }

            const data: ChatCompletionResponse = await response.json() as ChatCompletionResponse;

            if (data.choices && data.choices.length > 0) {
                const successMsg = `[XAI] Received response: finishReason=${data.choices[0].finish_reason}, promptTokens=${data.usage?.prompt_tokens}, completionTokens=${data.usage?.completion_tokens}`;
                if (this.outputChannel) {
                    this.outputChannel.appendLine(successMsg);
                }
                console.log(successMsg);
                return data.choices[0].message.content;
            }

            throw new Error('No response from AI');
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                const timeoutError = `[XAI] Request timed out after 60 seconds`;
                if (this.outputChannel) {
                    this.outputChannel.appendLine(timeoutError);
                    this.outputChannel.show();
                }
                console.error(timeoutError);
                throw new Error('xAI API Error: Request timed out (Status: timeout)');
            }

            const unexpectedError = `[XAI] Unexpected error: ${error}`;
            if (this.outputChannel) {
                this.outputChannel.appendLine(unexpectedError);
                this.outputChannel.show();
            }
            console.error(unexpectedError);
            throw error;
        }
    }

    /**
     * List available models
     */
    public async listModels(): Promise<string[]> {
        const url = `${this.baseURL}/models`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as any;
            return data.data.map((model: any) => model.id);
        } catch (error) {
            console.error('Failed to list models:', error);
            return [];
        }
    }

    /**
     * Test API connectivity
     */
    public async testConnection(): Promise<boolean> {
        try {
            const response = await this.chat([
                { role: 'user', content: 'Hello' }
            ]);
            return response.length > 0;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    /**
     * Parse AI response for structured markers
     */
    public parseResponse(response: string): {
        mainContent: string;
        questions: string[];
        requestedDocs: string[];
        validationStatus?: 'passed' | 'failed';
    } {
        const questions: string[] = [];
        const requestedDocs: string[] = [];
        let validationStatus: 'passed' | 'failed' | undefined;
        let mainContent = response;

        // Extract [QUESTION: ...] markers
        const questionRegex = /\[QUESTION:\s*([^\]]+)\]/g;
        let match;
        while ((match = questionRegex.exec(response)) !== null) {
            questions.push(match[1].trim());
        }

        // Extract REQUEST-DOC: markers
        const docRegex = /REQUEST-DOC:\s*([a-zA-Z0-9-]+\.(req|design|impl))/g;
        while ((match = docRegex.exec(response)) !== null) {
            requestedDocs.push(match[1].trim());
        }

        // Extract [VALIDATION: ...] markers
        const validationRegex = /\[VALIDATION:\s*(passed|failed)\]/i;
        const validationMatch = response.match(validationRegex);
        if (validationMatch) {
            validationStatus = validationMatch[1].toLowerCase() as 'passed' | 'failed';
        }

        // Clean main content of markers
        mainContent = mainContent
            .replace(questionRegex, '')
            .replace(docRegex, '')
            .replace(validationRegex, '')
            .replace(/\[RESPONSE\]/g, '')
            .trim();

        return {
            mainContent,
            questions,
            requestedDocs,
            validationStatus
        };
    }
}
