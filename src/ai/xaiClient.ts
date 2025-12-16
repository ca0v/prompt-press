import axios, { AxiosInstance } from 'axios';
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
    private client: AxiosInstance;
    private model: string;
    private apiKey: string;
    private outputChannel: vscode.OutputChannel | undefined;

    constructor(apiKey: string, config: vscode.WorkspaceConfiguration, outputChannel?: vscode.OutputChannel) {
        this.apiKey = apiKey;
        this.outputChannel = outputChannel;
        const baseURL = config.get<string>('apiEndpoint', 'https://api.x.ai/v1');
        this.model = config.get<string>('model', 'grok-code-fast-1');

        this.client = axios.create({
            baseURL,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout
        });
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

        try {
            const logMsg = `[XAI] Sending chat completion request: model=${request.model}, messages=${messages.length}, temp=${request.temperature}, maxTokens=${request.max_tokens}`;
            if (this.outputChannel) {
                this.outputChannel.appendLine(logMsg);
            }
            console.log(logMsg);

            const response = await this.client.post<ChatCompletionResponse>(
                '/chat/completions',
                request
            );

            if (response.data.choices && response.data.choices.length > 0) {
                const successMsg = `[XAI] Received response: finishReason=${response.data.choices[0].finish_reason}, promptTokens=${response.data.usage?.prompt_tokens}, completionTokens=${response.data.usage?.completion_tokens}`;
                if (this.outputChannel) {
                    this.outputChannel.appendLine(successMsg);
                }
                console.log(successMsg);
                return response.data.choices[0].message.content;
            }

            throw new Error('No response from AI');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorDetails = {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    errorMessage: error.response?.data?.error?.message || error.message,
                    errorType: error.response?.data?.error?.type,
                    url: error.config?.url,
                    method: error.config?.method
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
                
                const message = error.response?.data?.error?.message || error.message;
                const status = error.response?.status || 'unknown';
                throw new Error(`xAI API Error: ${message} (Status: ${status})`);
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
        try {
            const response = await this.client.get('/models');
            return response.data.data.map((model: any) => model.id);
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
