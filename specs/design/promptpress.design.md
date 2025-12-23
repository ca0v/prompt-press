---
artifact: promptpress
phase: design
depends-on: []
references: ["promptpress.req"]
last-updated: 2025-12-23
---
# Design Specification for promptpress

## Overview
PromptPress is a VS Code extension that facilitates prompt-driven development by managing AI prompts as persistent, versioned specifications. It integrates with AI providers, parses markdown specs, and provides tools for scaffolding, validation, and synchronization of code with specs.

Key design elements:
- Data Models: ChatMessage (DES-1000), ChatCompletionRequest (DES-1001), ChatCompletionResponse (DES-1002), SpecMetadata (DES-1003), ParsedSpec (DES-1004), CascadeResult (DES-1005), CascadeUI (DES-1006), Logger (DES-1007), ReferencedArtifact (DES-1008), ContextItem (DES-1009), Conversation (DES-1010), ChangeDetectionResult (DES-1011), FileInfo (DES-1012), ValidationError (DES-1013)
- Components: XAIClient (DES-1014), MarkdownParser (DES-1015), SpecCompletionProvider (DES-1016), TersifyActionParser (DES-1017), CascadeCore (DES-1018), CascadeServiceCommands (DES-1019), ContextBuilder (DES-1020), ConversationManager (DES-1021), DiffHelper (DES-1022), FileStructureParser (DES-1023), GitHelper (DES-1024), ImplParser (DES-1025), PromptService (DES-1026), PromptServiceCore (DES-1027), ScaffoldService (DES-1028), SpecFileProcessor (DES-1029), SpecReferenceManager (DES-1030), ChatPanelProvider (DES-1031), PromptLogger (DES-1032), SpecFileWatcher (DES-1033)
- Dependencies: VS Code API (DES-1034), XAI API (DES-1035)

## Requirements
- @promptpress.req/FR-1000: DES-1014
- @promptpress.req/FR-1001: DES-1015
- @promptpress.req/FR-1002: DES-1016
- @promptpress.req/FR-1003: DES-1017
- @promptpress.req/FR-1004: DES-1018, DES-1019
- @promptpress.req/FR-1005: DES-1020
- @promptpress.req/FR-1006: DES-1021
- @promptpress.req/FR-1007: DES-1022
- @promptpress.req/FR-1008: DES-1023
- @promptpress.req/FR-1009: DES-1024
- @promptpress.req/FR-1010: DES-1025
- @promptpress.req/FR-1011: DES-1026, DES-1027
- @promptpress.req/FR-1012: DES-1028
- @promptpress.req/FR-1013: DES-1029
- @promptpress.req/FR-1014: DES-1030
- @promptpress.req/FR-1015: DES-1031
- @promptpress.req/FR-1016: DES-1032
- @promptpress.req/FR-1017: DES-1033

## Data Models
### ChatMessage (DES-1000)
- **Description**: Represents a message in a chat conversation with role and content.
- **Fields/Properties**: role (system, user, assistant), content (text)
- **Relationships**: Used in ChatCompletionRequest and ChatCompletionResponse.

### ChatCompletionRequest (DES-1001)
- **Description**: Structure for requesting chat completions from AI.
- **Fields/Properties**: model, messages, temperature, max_tokens, stream
- **Relationships**: Contains ChatMessage array.

### ChatCompletionResponse (DES-1002)
- **Description**: Response from AI chat completion API.
- **Fields/Properties**: id, object, created, model, choices (with messages), usage
- **Relationships**: Contains ChatMessage in choices.

### SpecMetadata (DES-1003)
- **Description**: Metadata for spec files including artifact, phase, dependencies.
- **Fields/Properties**: artifact, phase, dependsOn, references, version, lastUpdated
- **Relationships**: Part of ParsedSpec.

### ParsedSpec (DES-1004)
- **Description**: Parsed representation of a markdown spec file.
- **Fields/Properties**: metadata, content, sections, clarifications, references
- **Relationships**: Uses SpecMetadata.

### CascadeResult (DES-1005)
- **Description**: Result of cascading operations on specs.
- **Fields/Properties**: success, updatedFiles, errors
- **Relationships**: Returned by cascade components.

### CascadeUI (DES-1006)
- **Description**: Interface for user interactions during cascade operations.
- **Methods**: confirm, confirmGitStatus, notifyInfo, notifyError
- **Relationships**: Used by CascadeCore.

### Logger (DES-1007)
- **Description**: Logging interface for operations.
- **Methods**: log
- **Relationships**: Implemented by output channel.

### ReferencedArtifact (DES-1008)
- **Description**: Represents artifacts referenced in specs.
- **Fields/Properties**: name, requirement, design
- **Relationships**: Used in cascade operations.

### ContextItem (DES-1009)
- **Description**: Item in context for AI prompts.
- **Fields/Properties**: type, content, source
- **Relationships**: Built by ContextBuilder.

### Conversation (DES-1010)
- **Description**: Structure for AI conversations.
- **Fields/Properties**: id, messages, createdAt, updatedAt
- **Relationships**: Managed by ConversationManager.

### ChangeDetectionResult (DES-1011)
- **Description**: Result of comparing file contents for changes.
- **Fields/Properties**: hasChanges, modifiedSections, summary, oldContent, newContent
- **Relationships**: Produced by DiffHelper.

### FileInfo (DES-1012)
- **Description**: Information about files for code generation.
- **Fields/Properties**: path, content, language
- **Relationships**: Used by ImplParser.

### ValidationError (DES-1013)
- **Description**: Represents errors found during spec validation.
- **Fields/Properties**: file, line, message, severity
- **Relationships**: Produced by SpecFileProcessor.

## Components
### XAIClient (DES-1014)
- **Description**: Client for interacting with XAI API for AI chat completions.
- **Type**: Class
- **Key Methods**: chat (send requests), listModels, testConnection, parseResponse
- **Dependencies**: XAI API, VS Code configuration

### MarkdownParser (DES-1015)
- **Description**: Parses markdown spec files to extract structured data.
- **Type**: Class
- **Key Methods**: parseFile, parse, validate, getOverview, setOverview, getSection, setSection, parseChangeTable, groupChangesByDocument, parseMarkdownTable
- **Dependencies**: File system access

### SpecCompletionProvider (DES-1016)
- **Description**: Provides navigation links for spec references in VS Code.
- **Type**: Class
- **Key Methods**: provideDocumentLinks
- **Dependencies**: VS Code DocumentLinkProvider

### TersifyActionParser (DES-1017)
- **Description**: Parses tersify actions for spec modifications.
- **Type**: Class
- **Key Methods**: isRemoveFromAction, isAddToAction, isNoneAction, isKnownAction, getActionName, getActionTarget
- **Dependencies**: None

### CascadeCore (DES-1018)
- **Description**: Core logic for applying cascading changes to specs using AI.
- **Type**: Class
- **Key Methods**: refactorSpec, tersifySpec, syncImplementationSpec, syncConOps, syncTOC
- **Dependencies**: XAIClient, MarkdownParser, PromptLogger

### CascadeServiceCommands (DES-1019)
- **Description**: VS Code command wrappers for cascade operations.
- **Type**: Class
- **Key Methods**: refactorSpec, tersifySpec
- **Dependencies**: CascadeCore, Logger

### ContextBuilder (DES-1020)
- **Description**: Builds context from related specs for AI prompts.
- **Type**: Class
- **Key Methods**: buildContext, getSpecContent, getReferencedSpecs, resolveSpecPath
- **Dependencies**: File system

### ConversationManager (DES-1021)
- **Description**: Manages persistent AI conversations.
- **Type**: Class
- **Key Methods**: createConversation, getConversation, addMessage, getMessages, saveConversation, loadConversation
- **Dependencies**: VS Code ExtensionContext

### DiffHelper (DES-1022)
- **Description**: Detects changes between file versions.
- **Type**: Class
- **Key Methods**: compareContent, findModifiedSections, buildSectionMap, generateChangeSummary
- **Dependencies**: None

### FileStructureParser (DES-1023)
- **Description**: Parses project file structures.
- **Type**: Class
- **Key Methods**: parseFileStructure, parseDirectory
- **Dependencies**: File system

### GitHelper (DES-1024)
- **Description**: Handles git operations for change management.
- **Type**: Class
- **Key Methods**: getUnstagedChanges, stageAll, commit, getStatus
- **Dependencies**: Git command line

### ImplParser (DES-1025)
- **Description**: Parses implementation specs to generate code.
- **Type**: Class
- **Key Methods**: parseAndGenerate
- **Dependencies**: MarkdownParser, XAIClient, FileStructureParser

### PromptService (DES-1026)
- **Description**: Service for executing predefined prompts.
- **Type**: Class
- **Key Methods**: executePrompt
- **Dependencies**: PromptServiceCore

### PromptServiceCore (DES-1027)
- **Description**: Core functionality for prompt execution.
- **Type**: Class
- **Key Methods**: executePrompt
- **Dependencies**: File system for prompts

### ScaffoldService (DES-1028)
- **Description**: Service for scaffolding new spec files.
- **Type**: Class
- **Key Methods**: createRequirementSpec, syncImplementationSpecSpec, syncImplementationSpec, syncConOps
- **Dependencies**: XAIClient

### SpecFileProcessor (DES-1029)
- **Description**: Processes and validates spec files.
- **Type**: Class
- **Key Methods**: processSpecFile, validateSpecFile, extractReferences, updateMetadata, checkCircularReferences
- **Dependencies**: Workspace root

### SpecReferenceManager (DES-1030)
- **Description**: Manages references between spec files.
- **Type**: Class
- **Key Methods**: getAllSpecRefs, getSpecRefsForFile, addSpecRef, removeSpecRef
- **Dependencies**: Workspace root

### ChatPanelProvider (DES-1031)
- **Description**: Provides the UI chat panel for AI interactions.
- **Type**: Class
- **Key Methods**: show, createWebviewPanel, setupWebview, handleMessage
- **Dependencies**: VS Code Webview API, XAIClient, ConversationManager, ContextBuilder

### PromptLogger (DES-1032)
- **Description**: Logs AI prompts and responses.
- **Type**: Class
- **Key Methods**: logRequest, logResponse
- **Dependencies**: File system

### SpecFileWatcher (DES-1033)
- **Description**: Watches spec files for changes and validates them.
- **Type**: Class
- **Key Methods**: toggleMonitoring, validateFile, onFileChange, onFileDelete
- **Dependencies**: VS Code FileSystemWatcher

## Dependencies
- **External Libraries**: VS Code API (DES-1034) - Provides extension framework and UI components; XAI API (DES-1035) - Enables AI chat completions.
- **Internal Dependencies**: Various services and parsers as listed in components.
- **System Requirements**: Node.js runtime, VS Code environment.

## Architecture
The extension follows a modular architecture with core services interacting through defined interfaces. The XAIClient (DES-1014) handles AI interactions, MarkdownParser (DES-1015) processes specs, CascadeCore (DES-1018) orchestrates changes, and UI components like ChatPanelProvider (DES-1031) provide user interface. Components communicate via dependency injection and event-driven patterns.

## Algorithms
- AI-driven spec refinement: Uses prompts to generate changes, applied via CascadeCore (DES-1018).
- Markdown parsing: Extracts structured data from specs, implemented in MarkdownParser (DES-1015).
- Change detection: Compares file contents, handled by DiffHelper (DES-1022).

## Error Handling
Errors are handled through try-catch in async operations, logged via Logger (DES-1007), and communicated to users through UI notifications in CascadeUI (DES-1006).

## Performance Considerations
API requests have timeouts, prompts are cached in CascadeCore (DES-1018), and file operations are asynchronous.

## Security Considerations
API keys are securely stored via VS Code configuration, inputs are validated in parsing components.

## Notes
The design emphasizes modularity and AI integration for prompt-driven development.