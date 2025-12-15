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

    constructor(apiKey: string, config: vscode.WorkspaceConfiguration) {
        this.apiKey = apiKey;
        const baseURL = config.get<string>('apiEndpoint', 'https://api.x.ai/v1');
        this.model = config.get<string>('model', 'grok-beta');

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
            console.log('[XAI] Sending chat completion request:', {
                model: request.model,
                messageCount: messages.length,
                temperature: request.temperature,
                maxTokens: request.max_tokens
            });

            const response = await this.client.post<ChatCompletionResponse>(
                '/chat/completions',
                request
            );

            if (response.data.choices && response.data.choices.length > 0) {
                console.log('[XAI] Received response:', {
                    finishReason: response.data.choices[0].finish_reason,
                    promptTokens: response.data.usage?.prompt_tokens,
                    completionTokens: response.data.usage?.completion_tokens
                });
                return response.data.choices[0].message.content;
            }

            throw new Error('No response from AI');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('[XAI] API Request Failed:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    headers: error.response?.headers,
                    requestUrl: error.config?.url,
                    requestMethod: error.config?.method
                });
                console.error('[XAI] Request payload:', JSON.stringify(request, null, 2));
                
                const message = error.response?.data?.error?.message || error.message;
                const status = error.response?.status || 'unknown';
                throw new Error(`xAI API Error: ${message} (Status: ${status})`);
            }
            console.error('[XAI] Unexpected error:', error);
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
