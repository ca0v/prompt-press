---
artifact: ai-provider-integration
phase: design
depends-on: []
references: ["ai-provider-integration.req"]
version: 1.0.0
last-updated: 2025-12-19
---

# AI Provider Integration - Design

## Overview
The AI Provider Integration design adopts a modular, abstraction-based approach to enable seamless multi-provider support within PromptPress, prioritizing reliability and uninterrupted workflows. At its core, the design introduces an API abstraction layer that standardizes interactions with diverse AI providers (e.g., xAI as primary, OpenAI via ChatGPT API, Anthropic, and extensible to others like Google Gemini or Meta Llama). This layer ensures a unified interface for prompt refinement, design generation, and code generation, while implementing automatic fallback mechanisms to mitigate provider failures such as API rate limits, outages, or deprecations. Health monitoring and dynamic provider switching are handled proactively, with context window management to accommodate varying token limits. Configurations are user-managed via VS Code settings, promoting usability and maintainability. The design maintains backward compatibility with xAI, treats providers as pluggable modules for scalability, and integrates logging for operational traceability, ensuring 99.9% uptime and minimal disruption to SDLC workflows.

## Architecture
The architecture is layered and modular, built on top of the existing PromptPress VS Code extension framework. It consists of the following components and layers:

- **Presentation Layer**: Interfaces with VS Code UI elements, such as commands ("Switch AI Provider"), status indicators (e.g., active provider icons in the status bar), and configuration panels for API keys and priorities. This layer handles user inputs and displays real-time feedback on provider status and fallbacks.

- **Application Layer**: Orchestrates high-level workflows like prompt refinement and code generation. It includes a Provider Manager module that selects providers based on configuration and health status, and a Workflow Orchestrator that integrates fallback logic into SDLC phases (e.g., cascading updates during "Apply Changes").

- **Service Layer**: Core to the design, featuring:
  - **API Abstraction Layer**: A standardized facade that normalizes provider APIs, handling differences in request/response formats (e.g., converting Markdown prompts to provider-specific inputs and parsing outputs back to PromptPress formats).
  - **Provider Adapters**: Pluggable modules for each supported provider (e.g., xAIAdapter, OpenAIAdapter, AnthropicAdapter), encapsulating API calls, error handling, and token management.
  - **Health Monitor**: A background service that performs periodic health checks (e.g., every 60 seconds) via lightweight API pings or test queries, updating a shared status registry.

- **Data Layer**: Manages persistent and transient data, including configuration storage (via VS Code's extension storage API) and in-memory caches for provider status and recent interactions.

- **Infrastructure Layer**: Leverages VS Code Extension API for file monitoring, logging, and security (e.g., encrypted key storage). External dependencies handle HTTP requests and JSON parsing.

The architecture supports horizontal scalability for new providers via adapter additions without core changes, and vertical integration with existing PromptPress modules (e.g., prompt management and code generation).

## API Contracts
The design defines the following key interfaces and contracts for internal and external interactions:

- **IProvider Interface**: Abstract contract for all provider adapters.
  - `initialize(config: ProviderConfig): Promise<void>` - Initializes the provider with API keys, endpoints, and settings.
  - `refinePrompt(prompt: MarkdownSpec, context: ContextWindow): Promise<RefinedSpec>` - Refines a prompt spec, handling token limits.
  - `generateCode(spec: ImplementationSpec): Promise<GeneratedCode>` - Generates code from implementation specs.
  - `healthCheck(): Promise<HealthStatus>` - Performs a health check, returning status (e.g., { available: boolean, latency: number }).
  - `switchTo(): void` - Prepares for activation during fallback.

- **ProviderManager Class**: Manages provider selection and fallbacks.
  - `selectProvider(): Provider` - Returns the active provider based on priority and health.
  - `handleFallback(error: ApiError): Provider` - Triggers fallback to next available provider and logs the event.
  - `updateHealth(providerId: string, status: HealthStatus): void` - Updates provider status in the registry.

- **Data Structures**:
  - `ProviderConfig`: { id: string, apiKey: string, endpoint: string, priority: number, model: string, tokenLimit: number }
  - `ContextWindow`: { content: string, truncated: boolean, summary?: string }
  - `HealthStatus`: { available: boolean, latency: number, lastChecked: Date }
  - `ApiError`: { provider: string, code: number, message: string }

- **VS Code Extension API Contracts**: 
  - `vscode.workspace.onDidChangeConfiguration` - Listens for config changes to reload provider settings.
  - `vscode.commands.registerCommand('switchAiProvider', (providerId: string) => void)` - User-initiated switching.

External API contracts follow provider-specific standards (e.g., OpenAI's REST API with endpoints like `/v1/chat/completions`), abstracted through adapters to ensure uniformity.

## Data Model
The data model relies on lightweight, configuration-driven structures without a traditional database, using VS Code's persistent storage for reliability:

- **Configuration Schema** (Stored in VS Code Extension Storage):
  - `providers`: Array<ProviderConfig> - List of configured providers with keys encrypted via VS Code secrets API.
  - `fallbackPolicy`: { autoSwitch: boolean, maxRetries: number, timeout: number } - Defines fallback behavior.

- **In-Memory Registry** (Runtime Data Structures):
  - `ProviderRegistry`: Map<string, ProviderInstance> - Tracks active provider instances and their health statuses.
  - `InteractionLog`: Array<{ timestamp: Date, provider: string, action: string, success: boolean, latency: number }> - Circular buffer for recent logs (up to 1000 entries), flushed to file on extension close.

- **Relationships**:
  - ProviderConfig links to ProviderInstance via id; health statuses update dynamically via HealthMonitor.
  - No complex relationships; data is flat and event-driven, with logs referencing providers for traceability.

This model ensures security (keys not in plain text) and performance (in-memory for quick access), with no external DB dependencies.

## Algorithms & Logic
- **Fallback Logic**: A priority-based algorithm cycles through configured providers on failure. Pseudocode: If currentProvider.healthCheck() fails, iterate priority-ordered list; select first healthy provider; log switch; retry operation with new provider. Includes exponential backoff for retries (up to maxRetries).

- **Health Monitoring Algorithm**: Runs asynchronously every 60 seconds. For each provider: Send lightweight ping (e.g., GET to endpoint with minimal payload); measure latency; update status. If latency > 30s or error, mark unavailable. Triggers fallback if primary fails.

- **Context Window Management**: For prompt refinement, calculate required tokens; if exceeds provider's limit, apply summarization (e.g., extract key sections via regex or AI-summarized sub-prompt); truncate if necessary, preserving 80% core content. Decision flow: Check token count → Summarize if needed → Truncate → Proceed.

- **Provider Selection**: On workflow start (e.g., "Apply Changes"), query registry for highest-priority healthy provider. Manual switch overrides via command, updating registry immediately.

- **Business Logic for SDLC Integration**: During cascading updates, ensure provider switches don't alter spec determinism; retries maintain state via idempotent operations. Logs capture all decisions for reproducibility.

## Dependencies
- **Third-Party Libraries**:
  - `axios` (v1.x) for HTTP requests to AI APIs, with retry and timeout support.
  - `jsonwebtoken` (for secure token handling if needed by providers).
  - `markdown-it` for parsing Markdown specs in abstraction layer.
  - `vscode` API (built-in) for extension integration, configuration, and UI.

- **External Services**:
  - AI Provider APIs: xAI, OpenAI (ChatGPT), Anthropic, with potential for Google Gemini or Meta Llama via configurable endpoints.
  - VS Code Marketplace for distribution and updates.

- **Internal Dependencies**: Relies on existing PromptPress modules (e.g., prompt-management for spec handling, code-generation for output processing).

## Questions & Clarifications
[AI-CLARIFY: Confirm if new providers like Google Gemini require custom adapters or if they can reuse OpenAI-compatible interfaces; clarify handling of provider-specific model versioning (e.g., auto-updating to latest stable models); determine if health checks should include cost estimation to avoid unexpected API bills.]

## Cross-References
[Leave empty - references are documented in the metadata header above]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->