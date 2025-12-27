---
artifact: promptpress
phase: implementation
depends-on: []
references: ["promptpress.design"]
last-updated: 2025-12-27
---

# Implementation Specification for promptpress

## Overview
PromptPress is a VS Code extension that facilitates prompt-driven development by managing AI prompts as persistent, versioned specifications. It integrates with AI providers, parses markdown specs, and provides tools for scaffolding, validation, and synchronization of code with specs.

## Design Requirements

### DES-1014: XAIClient
- IMP-1000: chat
- IMP-1001: listModels
- IMP-1002: testConnection
- IMP-1003: parseResponse

### DES-1015: MarkdownParser
- IMP-1004: parseFile
- IMP-1005: parse
- IMP-1006: validate
- IMP-1007: getOverview
- IMP-1008: setOverview
- IMP-1009: getSection
- IMP-1010: setSection
- IMP-1011: parseChangeTable
- IMP-1012: groupChangesByDocument
- IMP-1015: parseMarkdownTable

### DES-1016: SpecCompletionProvider
- IMP-1016: provideDocumentLinks

### DES-1036: SpecReferenceFinder
- IMP-1077: findAllReferences

### DES-1037: SpecImplementationFinder
- IMP-1078: findAllImplementations

### DES-1038: OutputLogger
- IMP-1079: log
- IMP-1080: setOutputChannel

### DES-1039: SpecHoverProvider
- IMP-1081: provideHover

### DES-1017: TersifyActionParser
- IMP-1017: isRemoveFromAction
- IMP-1018: isAddToAction
- IMP-1019: isNoneAction
- IMP-1020: isKnownAction
- IMP-1021: getActionName
- IMP-1022: getActionTarget

### DES-1018: CascadeCore
- IMP-1023: refactorSpec
- IMP-1024: tersifySpec
- IMP-1025: syncImplementationSpec
- IMP-1026: syncConOps
- IMP-1027: syncTOC

### DES-1019: CascadeServiceCommands
- IMP-1028: refactorSpec
- IMP-1029: tersifySpec

### DES-1020: ContextBuilder
- IMP-1030: buildContext
- IMP-1031: getSpecContent
- IMP-1032: getReferencedSpecs
- IMP-1033: resolveSpecPath

### DES-1021: ConversationManager
- IMP-1034: createConversation
- IMP-1035: getConversation
- IMP-1036: addMessage
- IMP-1037: getMessages
- IMP-1038: saveConversation
- IMP-1039: loadConversation

### DES-1022: DiffHelper
- IMP-1040: compareContent
- IMP-1041: findModifiedSections
- IMP-1042: buildSectionMap
- IMP-1043: generateChangeSummary

### DES-1023: FileStructureParser
- IMP-1044: parseFileStructure
- IMP-1045: parseDirectory

### DES-1024: GitHelper
- IMP-1046: getUnstagedChanges
- IMP-1047: stageAll
- IMP-1048: commit
- IMP-1049: getStatus

### DES-1025: ImplParser
- IMP-1050: parseAndGenerate

### DES-1026: PromptService
- IMP-1051: executePrompt

### DES-1027: PromptServiceCore
- IMP-1052: executePrompt

### DES-1028: ScaffoldService
- IMP-1053: createRequirementSpec
- IMP-1054: syncImplementationSpecSpec
- IMP-1055: syncImplementationSpec
- IMP-1056: syncConOps

### DES-1029: SpecFileProcessor
- IMP-1057: processSpecFile
- IMP-1058: validateSpecFile
- IMP-1059: extractReferences
- IMP-1060: updateMetadata
- IMP-1061: checkCircularReferences

### DES-1030: SpecReferenceManager
- IMP-1062: getAllSpecRefs
- IMP-1063: getSpecRefsForFile
- IMP-1064: addSpecRef
- IMP-1065: removeSpecRef

### DES-1031: ChatPanelProvider
- IMP-1066: show
- IMP-1067: createWebviewPanel
- IMP-1068: setupWebview
- IMP-1069: handleMessage

### @promptpress.design/DES-1032: PromptLogger
- IMP-1070: logRequest
- IMP-1071: logResponse

### DES-1033: SpecFileWatcher
- IMP-1073: toggleMonitoring
- IMP-1074: validateFile
- IMP-1075: onFileChange
- IMP-1076: onFileDelete

## Files Summary
- **src/extension.ts** - Main extension activation and command registration.
- **src/ai/xaiClient.ts** - Client for interacting with XAI API for chat completions.
- **src/parsers/markdownParser.ts** - Parser for markdown spec files.
- **src/providers/specCompletionProvider.ts** - Provides completion and link support for spec files.
- **src/providers/specReferenceFinder.ts** - Implements "Find all References" feature.
- **src/providers/specImplementationFinder.ts** - Implements "Find all Implementations" feature.
- **src/services/TersifyActionParser.ts** - Parses tersify actions.
- **src/services/CascadeCore.ts** - Core logic for cascading operations on specs.
- **src/services/CascadeService.ts** - Commands for cascading spec operations.
- **src/services/ContextBuilderCore.ts** - Core logic for building context for AI prompts.
- **src/services/ContextBuilder.ts** - Adapter for context building with VS Code dependencies.
- **src/services/ConversationManagerCore.ts** - Core logic for managing conversations with AI.
- **src/services/ConversationManager.ts** - Adapter for conversation management with VS Code dependencies.
- **src/services/DiffHelper.ts** - Helper for detecting changes in files.
- **src/services/FileStructureParserCore.ts** - Core logic for parsing file structures.
- **src/services/FileStructureParser.ts** - Adapter for file structure parsing with VS Code dependencies.
- **src/services/GitHelper.ts** - Helper for git operations.
- **src/services/ImplParserCore.ts** - Core logic for parsing implementation specs to generate code.
- **src/services/ImplParser.ts** - Adapter for implementation parsing with VS Code dependencies.
- **src/services/PromptService.ts** - Service for executing prompts (merged core and adapter).
- **src/services/ScaffoldServiceCore.ts** - Core logic for scaffolding new specs.
- **src/services/ScaffoldService.ts** - Adapter for scaffolding with VS Code dependencies.
- **src/services/SpecFileProcessor.ts** - Processes and validates spec files.
- **src/spec/SpecReferenceManager.ts** - Manages references between specs.
- **src/ui/chatPanelProvider.ts** - Provides the chat panel UI.
- **src/utils/PromptLogger.ts** - Logger utility.
- **src/utils/OutputLogger.ts** - Logger that always writes to console and optionally to VS Code output channel.
- **src/providers/specHoverProvider.ts** - Provides hover tooltips for spec references in documents.
- **src/utils/dirname.ts** - Provides __dirname for ES modules.
- **src/utils/impInjector.ts** - Script to inject IMP comments.
- **src/utils/markdownFormatter.ts** - Formats markdown.
- **src/watchers/specFileWatcher.ts** - Watches spec files for changes.

## Files
### File: src/extension.ts
- **Purpose**: Main entry point for the VS Code extension, handles activation and registration of commands, providers, and services.
- **Classes**: None
- **Interfaces**: None
- **Other Elements**: Exported functions: activate, deactivate

### File: src/ai/xaiClient.ts
- **Purpose**: Client for interacting with the xAI API to perform chat completions and related operations.
- **Classes**: XAIClient
- **Interfaces**: ChatMessage, ChatCompletionRequest, ChatCompletionResponse
- **Other Elements**: None

### File: src/parsers/markdownParser.ts
- **Purpose**: Parses markdown spec files, extracts metadata, sections, clarifications, and references.
- **Classes**: MarkdownParser
- **Interfaces**: SpecMetadata, ParsedSpec
- **Other Elements**: None

### File: src/providers/specCompletionProvider.ts
- **Purpose**: Provides document links for @mentions and frontmatter references to spec documents, enabling navigation.
- **Classes**: SpecCompletionProvider
- **Interfaces**: None
- **Other Elements**: None

### File: src/providers/specReferenceFinder.ts
- **Purpose**: Implements "Find all References" feature to find all places that mention the REFID.
- **Classes**: SpecReferenceFinder
- **Interfaces**: None
- **Other Elements**: None

### File: src/providers/specImplementationFinder.ts
- **Purpose**: Implements "Find all Implementations" feature following specific rules for scanning.
- **Classes**: SpecImplementationFinder
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/TersifyActionParser.ts
- **Purpose**: Parses tersify actions to determine type and target.
- **Classes**: TersifyActionParser
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/CascadeCore.ts
- **Purpose**: Core logic for cascading operations on specs.
- **Classes**: CascadeCore
- **Interfaces**: CascadeResult, CascadeUI, Logger, ReferencedArtifact
- **Other Elements**: None

### File: src/services/CascadeService.ts
- **Purpose**: Commands for cascading spec operations.
- **Classes**: CascadeServiceCommands
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/ContextBuilderCore.ts
- **Purpose**: Core logic for building context for AI prompts.
- **Classes**: ContextBuilderCore
- **Interfaces**: ContextItem
- **Other Elements**: None

### File: src/services/ContextBuilder.ts
- **Purpose**: Adapter for building context with VS Code dependencies.
- **Classes**: ContextBuilder
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/ConversationManagerCore.ts
- **Purpose**: Core logic for managing conversations with AI.
- **Classes**: ConversationManagerCore
- **Interfaces**: Conversation
- **Other Elements**: None

### File: src/services/ConversationManager.ts
- **Purpose**: Adapter for managing conversations with VS Code dependencies.
- **Classes**: ConversationManager
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/DiffHelper.ts
- **Purpose**: Helper for detecting changes in files.
- **Classes**: DiffHelper
- **Interfaces**: ChangeDetectionResult
- **Other Elements**: None

### File: src/services/FileStructureParserCore.ts
- **Purpose**: Core logic for parsing file structures.
- **Classes**: FileStructureParserCore
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/FileStructureParser.ts
- **Purpose**: Adapter for parsing file structures with VS Code dependencies.
- **Classes**: FileStructureParser
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/GitHelper.ts
- **Purpose**: Helper for git operations.
- **Classes**: GitHelper
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/ImplParserCore.ts
- **Purpose**: Core logic for parsing implementation specs to generate code.
- **Classes**: ImplParserCore
- **Interfaces**: FileInfo
- **Other Elements**: None

### File: src/services/ImplParser.ts
- **Purpose**: Adapter for parsing implementation specs with VS Code dependencies.
- **Classes**: ImplParser
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/PromptService.ts
- **Purpose**: Service for executing prompts (merged core and adapter).
- **Classes**: PromptService
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/ScaffoldServiceCore.ts
- **Purpose**: Core logic for scaffolding new specs.
- **Classes**: ScaffoldServiceCore
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/ScaffoldService.ts
- **Purpose**: Adapter for scaffolding with VS Code dependencies.
- **Classes**: ScaffoldService
- **Interfaces**: None
- **Other Elements**: None

### File: src/services/SpecFileProcessor.ts
- **Purpose**: Processes and validates spec files.
- **Classes**: SpecFileProcessor
- **Interfaces**: ValidationError
- **Other Elements**: None

### File: src/spec/SpecReferenceManager.ts
- **Purpose**: Manages references between specs.
- **Classes**: SpecReferenceManager
- **Interfaces**: None
- **Other Elements**: None

### File: src/ui/chatPanelProvider.ts
- **Purpose**: Provides the chat panel UI.
- **Classes**: ChatPanelProvider
- **Interfaces**: None
- **Other Elements**: None

### File: src/utils/PromptLogger.ts
- **Purpose**: Logger utility for logging AI prompts and responses.
- **Classes**: PromptLogger
- **Interfaces**: None
- **Other Elements**: None

### File: src/utils/OutputLogger.ts
- **Purpose**: Logger that wraps console or VS Code output channel for logging messages.
- **Classes**: OutputLogger
- **Interfaces**: None
- **Other Elements**: Exported logger instance

### File: src/providers/specHoverProvider.ts
- **Purpose**: Provides hover tooltips for spec references in documents.
- **Classes**: SpecHoverProvider
- **Interfaces**: None
- **Other Elements**: None

### File: src/utils/dirname.ts
- **Purpose**: Provides __dirname for ES modules.
- **Classes**: None
- **Interfaces**: None
- **Other Elements**: Exported constant: __dirname

### File: src/utils/impInjector.ts
- **Purpose**: Script to inject IMP comments into source files.
- **Classes**: None
- **Interfaces**: None
- **Other Elements**: Functions: getTsFiles, findExistingImpIds, getIndent, findPublicMethods, isDecorated, injectImpComments

### File: src/utils/markdownFormatter.ts
- **Purpose**: Formats markdown.
- **Classes**: None
- **Interfaces**: None
- **Other Elements**: Functions

### File: src/watchers/specFileWatcher.ts
- **Purpose**: Watches spec files for changes.
- **Classes**: SpecFileWatcher
- **Interfaces**: None
- **Other Elements**: None

## Classes
### XAIClient
- **Description**: Client for interacting with the xAI API to perform chat completions and related operations.
- **Inheritance**: None
- **Properties**: 
  - baseURL: string
  - headers: Record<string, string>
  - model: string
  - apiKey: string
  - outputChannel: vscode.OutputChannel | undefined
- **Methods**: chat (IMP-1000), listModels (IMP-1001), testConnection (IMP-1002), parseResponse (IMP-1003)
- **Fields**: baseURL, headers, model, apiKey, outputChannel
- **Constructors**: constructor(apiKey: string, config: vscode.WorkspaceConfiguration, outputChannel?: vscode.OutputChannel)
- **Events**: None
- **Nested Types**: None

### MarkdownParser
- **Description**: Parses markdown spec files, extracts metadata, sections, clarifications, and references.
- **Inheritance**: None
- **Properties**: None
- **Methods**: parseFile (IMP-1004), parse (IMP-1005), validate (IMP-1006), getOverview (IMP-1007), setOverview (IMP-1008), getSection (IMP-1009), setSection (IMP-1010), parseChangeTable (IMP-1011), groupChangesByDocument (IMP-1012), parseMarkdownTable (IMP-1015)
- **Fields**: None
- **Constructors**: None (default)
- **Events**: None
- **Nested Types**: None

### SpecCompletionProvider
- **Description**: Provides document links for @mentions and frontmatter references to spec documents, enabling navigation.
- **Inheritance**: implements vscode.DocumentLinkProvider
- **Properties**: workspaceRoot: string
- **Methods**: provideDocumentLinks (IMP-1016)
- **Fields**: workspaceRoot
- **Constructors**: constructor(workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### SpecReferenceFinder
- **Description**: Implements "Find all References" feature to find all places that mention the REFID.
- **Inheritance**: None
- **Properties**: workspaceRoot: string
- **Methods**: findAllReferences (IMP-1077)
- **Fields**: workspaceRoot
- **Constructors**: constructor(workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### SpecImplementationFinder
- **Description**: Implements "Find all Implementations" feature following specific rules for scanning based on artifact names.
- **Inheritance**: None
- **Properties**: workspaceRoot: string
- **Methods**: findAllImplementations (IMP-1078)
- **Fields**: workspaceRoot
- **Constructors**: constructor(workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### OutputLogger
- **Description**: Logger that always writes to console and optionally to VS Code output channel.
- **Inheritance**: None
- **Properties**: None
- **Methods**: log (IMP-1079), setOutputChannel (IMP-1080)
- **Fields**: outputChannel
- **Constructors**: constructor()
- **Events**: None
- **Nested Types**: None

### SpecHoverProvider
- **Description**: Provides hover tooltips displaying feature descriptions for spec references in documents.
- **Inheritance**: implements vscode.HoverProvider
- **Properties**: workspaceRoot: string, parser: MarkdownParser
- **Methods**: provideHover (IMP-1081)
- **Fields**: workspaceRoot, parser
- **Constructors**: constructor(workspaceRoot: string, parser: MarkdownParser)
- **Events**: None
- **Nested Types**: None

### TersifyActionParser
- **Description**: Parses tersify actions to determine type and target.
- **Inheritance**: None
- **Properties**: action: string
- **Methods**: isRemoveFromAction (IMP-1017), isAddToAction (IMP-1018), isNoneAction (IMP-1019), isKnownAction (IMP-1020), getActionName (IMP-1021), getActionTarget (IMP-1022)
- **Fields**: action
- **Constructors**: constructor(private action: string)
- **Events**: None
- **Nested Types**: None

### CascadeCore
- **Description**: Core logic for cascading operations on specs.
- **Inheritance**: None
- **Properties**: parser: MarkdownParser, promptCache: Map<string, { system: string; user: string }>, promptLogger: PromptLogger
- **Methods**: refactorSpec (IMP-1023), tersifySpec (IMP-1024), syncImplementationSpec (IMP-1025), syncConOps (IMP-1026), syncTOC (IMP-1027)
- **Fields**: parser, promptCache, promptLogger
- **Constructors**: constructor(xaiClient: XAIClient, workspaceRoot: string, logger: Logger)
- **Events**: None
- **Nested Types**: None

### CascadeServiceCommands
- **Description**: VS Code-facing wrapper around CascadeCore.
- **Inheritance**: None
- **Properties**: core: CascadeCore, logger: Logger, outputChannel: vscode.OutputChannel
- **Methods**: refactorSpec (IMP-1028), tersifySpec (IMP-1029)
- **Fields**: core, logger, outputChannel
- **Constructors**: constructor(xaiClient: XAIClient, outputChannel: vscode.OutputChannel, workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### ContextBuilder
- **Description**: Builds context for AI prompts.
- **Inheritance**: None
- **Properties**: None
- **Methods**: buildContext (IMP-1030), getSpecContent (IMP-1031), getReferencedSpecs (IMP-1032), resolveSpecPath (IMP-1033)
- **Fields**: None
- **Constructors**: None (default)
- **Events**: None
- **Nested Types**: None

### ConversationManager
- **Description**: Manages conversations with AI.
- **Inheritance**: None
- **Properties**: conversations: Map<string, Conversation>, context: vscode.ExtensionContext
- **Methods**: createConversation (IMP-1034), getConversation (IMP-1035), addMessage (IMP-1036), getMessages (IMP-1037), saveConversation (IMP-1038), loadConversation (IMP-1039)
- **Fields**: conversations, context
- **Constructors**: constructor(context: vscode.ExtensionContext)
- **Events**: None
- **Nested Types**: None

### DiffHelper
- **Description**: Helper for detecting changes in files.
- **Inheritance**: None
- **Properties**: None
- **Methods**: compareContent (IMP-1040), findModifiedSections (IMP-1041), buildSectionMap (IMP-1042), generateChangeSummary (IMP-1043)
- **Fields**: None
- **Constructors**: None (static methods)
- **Events**: None
- **Nested Types**: None

### FileStructureParser
- **Description**: Parses file structures.
- **Inheritance**: None
- **Properties**: outputChannel: vscode.OutputChannel
- **Methods**: parseFileStructure (IMP-1044), parseDirectory (IMP-1045)
- **Fields**: outputChannel
- **Constructors**: constructor(outputChannel: vscode.OutputChannel)
- **Events**: None
- **Nested Types**: None

### GitHelper
- **Description**: Helper for git operations.
- **Inheritance**: None
- **Properties**: workspaceRoot: string
- **Methods**: getUnstagedChanges (IMP-1046), stageAll (IMP-1047), commit (IMP-1048), getStatus (IMP-1049)
- **Fields**: workspaceRoot
- **Constructors**: constructor(workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### ImplParser
- **Description**: Parses implementation specs to generate code.
- **Inheritance**: None
- **Properties**: markdownParser: MarkdownParser, xaiClient: XAIClient, outputChannel: vscode.OutputChannel, fileStructureParser: FileStructureParser
- **Methods**: parseAndGenerate (IMP-1050)
- **Fields**: markdownParser, xaiClient, outputChannel, fileStructureParser
- **Constructors**: constructor(markdownParser: MarkdownParser, xaiClient: XAIClient, outputChannel: vscode.OutputChannel, fileStructureParser: FileStructureParser)
- **Events**: None
- **Nested Types**: None

### PromptService
- **Description**: Service for executing prompts.
- **Inheritance**: None
- **Properties**: core: PromptServiceCore
- **Methods**: executePrompt (IMP-1051)
- **Fields**: core
- **Constructors**: constructor()
- **Events**: None
- **Nested Types**: None

### PromptServiceCore
- **Description**: Core prompt service functionality.
- **Inheritance**: None
- **Properties**: None
- **Methods**: executePrompt (IMP-1052)
- **Fields**: None
- **Constructors**: None (default)
- **Events**: None
- **Nested Types**: None

### ScaffoldService
- **Description**: Service for scaffolding new specs.
- **Inheritance**: None
- **Properties**: xaiClient: XAIClient, outputChannel: vscode.OutputChannel
- **Methods**: createRequirementSpec (IMP-1053), syncImplementationSpecSpec (IMP-1054), syncImplementationSpec (IMP-1055), syncConOps (IMP-1056)
- **Fields**: xaiClient, outputChannel
- **Constructors**: constructor(xaiClient: XAIClient, outputChannel: vscode.OutputChannel)
- **Events**: None
- **Nested Types**: None

### SpecFileProcessor
- **Description**: Processes and validates spec files.
- **Inheritance**: None
- **Properties**: parser: MarkdownParser, workspaceRoot: string
- **Methods**: updateMetadata (IMP-1057), syncReferencesWithMentions (IMP-1058), validateReferences (IMP-1059), getAllDependencies (IMP-1060), convertOverspecifiedReferences (IMP-1061)
- **Fields**: parser, workspaceRoot
- **Constructors**: constructor(parser: MarkdownParser, workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### SpecReferenceManager
- **Description**: Manages references between specs.
- **Inheritance**: None
- **Properties**: workspaceRoot: string
- **Methods**: getAllSpecRefs (IMP-1062), getSpecRefsForFile (IMP-1063), addSpecRef (IMP-1064), removeSpecRef (IMP-1065)
- **Fields**: workspaceRoot
- **Constructors**: constructor(workspaceRoot: string)
- **Events**: None
- **Nested Types**: None

### ChatPanelProvider
- **Description**: Provides the chat panel UI.
- **Inheritance**: implements vscode.Disposable
- **Properties**: extensionUri: vscode.Uri, xaiClient: XAIClient, conversationManager: ConversationManager, contextBuilder: ContextBuilder, panel: vscode.WebviewPanel | undefined, disposables: vscode.Disposable[]
- **Methods**: show (IMP-1066), createWebviewPanel (IMP-1067), setupWebview (IMP-1068), handleMessage (IMP-1069)
- **Fields**: extensionUri, xaiClient, conversationManager, contextBuilder, panel, disposables
- **Constructors**: constructor(extensionUri: vscode.Uri, xaiClient: XAIClient, conversationManager: ConversationManager, contextBuilder: ContextBuilder)
- **Events**: None
- **Nested Types**: None

### PromptLogger
- **Description**: Logger utility for logging AI prompts and responses.
- **Inheritance**: None
- **Properties**: log: (msg: string) => void
- **Methods**: logRequest (IMP-1070), logResponse (IMP-1071)
- **Fields**: log
- **Constructors**: constructor(private log: (msg: string) => void)
- **Events**: None
- **Nested Types**: None

### SpecFileWatcher
- **Description**: Watches spec files for changes.
- **Inheritance**: implements vscode.Disposable
- **Properties**: enabled: boolean, workspaceRoot: string, diagnosticCollection: vscode.DiagnosticCollection, watcher: vscode.FileSystemWatcher | undefined, disposables: vscode.Disposable[]
- **Methods**: toggleMonitoring (IMP-1073), validateFile (IMP-1074), onFileChange (IMP-1075), onFileDelete (IMP-1076)
- **Fields**: enabled, workspaceRoot, diagnosticCollection, watcher, disposables
- **Constructors**: constructor(enabled: boolean, workspaceRoot: string, diagnosticCollection: vscode.DiagnosticCollection)
- **Events**: None
- **Nested Types**: None

## Interfaces
### ChatMessage
- **Description**: Represents a message in a chat conversation.
- **Methods**: None
- **Properties**: role: 'system' | 'user' | 'assistant', content: string
- **Events**: None

### ChatCompletionRequest
- **Description**: Request structure for chat completion API.
- **Methods**: None
- **Properties**: model: string, messages: ChatMessage[], temperature?: number, max_tokens?: number, stream?: boolean
- **Events**: None

### ChatCompletionResponse
- **Description**: Response structure from chat completion API.
- **Methods**: None
- **Properties**: id: string, object: string, created: number, model: string, choices: Array<{ index: number; message: ChatMessage; finish_reason: string; }>, usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; }
- **Events**: None

### SpecMetadata
- **Description**: Metadata extracted from spec frontmatter.
- **Methods**: None
- **Properties**: artifact: string, phase: 'requirement' | 'design' | 'implementation', dependsOn?: string[], references?: string[], version?: string, lastUpdated?: string
- **Events**: None

### ParsedSpec
- **Description**: Parsed representation of a spec file.
- **Methods**: None
- **Properties**: metadata: SpecMetadata, content: string, sections: Map<string, string>, clarifications: string[], references: string[]
- **Events**: None

### CascadeResult
- **Description**: Result of a cascade operation.
- **Methods**: None
- **Properties**: success: boolean, updatedFiles: string[], errors: string[]
- **Events**: None

### CascadeUI
- **Description**: UI interface for cascade operations.
- **Methods**: confirm(message: string): Promise<boolean>, confirmGitStatus(hasUnstaged: boolean): Promise<'stage' | 'continue' | 'cancel'>, notifyInfo(message: string): void, notifyError(message: string): void
- **Properties**: None
- **Events**: None

### Logger
- **Description**: Logging interface.
- **Methods**: log(message: string): void
- **Properties**: None
- **Events**: None

### ReferencedArtifact
- **Description**: Represents a referenced artifact.
- **Methods**: None
- **Properties**: name: string, requirement?: string, design?: string
- **Events**: None

### ContextItem
- **Description**: Item in the context for AI prompts.
- **Methods**: None
- **Properties**: type: string, content: string, source?: string
- **Events**: None

### Conversation
- **Description**: Represents a conversation.
- **Methods**: None
- **Properties**: id: string, messages: ChatMessage[], createdAt: Date, updatedAt: Date
- **Events**: None

### ChangeDetectionResult
- **Description**: Result of change detection.
- **Methods**: None
- **Properties**: hasChanges: boolean, modifiedSections: string[], summary: string, oldContent: string, newContent: string
- **Events**: None

### FileInfo
- **Description**: Information about a file.
- **Methods**: None
- **Properties**: path: string, content: string, language: string
- **Events**: None

### ValidationError
- **Description**: Represents a validation error.
- **Methods**: None
- **Properties**: file: string, line: number, message: string, severity: 'error' | 'warning'
- **Events**: None

## Other Types
None

## Methods
### activate (IMP-1013)
- **Belongs to**: extension.ts
- **Description**: Activates the PromptPress extension.
- **Parameters**: context: vscode.ExtensionContext
- **Return Type**: void
- **Algorithm**: Sets up output channel, diagnostic collection, redirects console logs, initializes services, registers commands and providers.
- **Exceptions**: None

### deactivate (IMP-1014)
- **Belongs to**: extension.ts
- **Description**: Deactivates the PromptPress extension.
- **Parameters**: None
- **Return Type**: void
- **Algorithm**: Logs deactivation.
- **Exceptions**: None

### chat (IMP-1000)
- **Belongs to**: XAIClient
- **Description**: Send a chat completion request
- **Parameters**: messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number; }
- **Return Type**: Promise<string>
- **Algorithm**: Constructs request, sends to API, handles response.
- **Exceptions**: Throws on API errors or timeouts.

### listModels (IMP-1001)
- **Belongs to**: XAIClient
- **Description**: List available models
- **Parameters**: None
- **Return Type**: Promise<string[]>
- **Algorithm**: Fetches models from API.
- **Exceptions**: Returns empty array on error.

### testConnection (IMP-1002)
- **Belongs to**: XAIClient
- **Description**: Test API connectivity
- **Parameters**: None
- **Return Type**: Promise<boolean>
- **Algorithm**: Sends a test message.
- **Exceptions**: Returns false on error.

### parseResponse (IMP-1003)
- **Belongs to**: XAIClient
- **Description**: Parse AI response for structured markers
- **Parameters**: response: string
- **Return Type**: { mainContent: string; questions: string[]; requestedDocs: string[]; validationStatus?: 'passed' | 'failed'; }
- **Algorithm**: Extracts markers from response.
- **Exceptions**: None

### parseFile (IMP-1004)
- **Belongs to**: MarkdownParser
- **Description**: Parse a markdown spec file
- **Parameters**: filePath: string
- **Return Type**: Promise<ParsedSpec>
- **Algorithm**: Reads file and parses content.
- **Exceptions**: Throws on read error.

### parse (IMP-1005)
- **Belongs to**: MarkdownParser
- **Description**: Parse markdown content
- **Parameters**: content: string
- **Return Type**: ParsedSpec
- **Algorithm**: Extracts metadata, sections, etc.
- **Exceptions**: None

### validate (IMP-1006)
- **Belongs to**: MarkdownParser
- **Description**: Validate spec structure
- **Parameters**: spec: ParsedSpec
- **Return Type**: { valid: boolean; errors: string[] }
- **Algorithm**: Checks metadata and sections.
- **Exceptions**: None

### getOverview (IMP-1007)
- **Belongs to**: MarkdownParser
- **Description**: Get the Overview section content
- **Parameters**: content: string
- **Return Type**: string
- **Algorithm**: Extracts overview section.
- **Exceptions**: None

### setOverview (IMP-1008)
- **Belongs to**: MarkdownParser
- **Description**: Set the Overview section content
- **Parameters**: content: string, newOverview: string
- **Return Type**: string
- **Algorithm**: Replaces overview section.
- **Exceptions**: None

### getSection (IMP-1009)
- **Belongs to**: MarkdownParser
- **Description**: Get a section content, optionally with a secondary subsection
- **Parameters**: content: string, primarySection: string, secondarySection?: string
- **Return Type**: string
- **Algorithm**: Extracts section content.
- **Exceptions**: None

### setSection (IMP-1010)
- **Belongs to**: MarkdownParser
- **Description**: Set a section content, optionally with a secondary subsection
- **Parameters**: content: string, primarySection: string, secondarySection: string | undefined, newBody: string
- **Return Type**: string
- **Algorithm**: Replaces section content.
- **Exceptions**: None

### parseChangeTable (IMP-1011)
- **Belongs to**: MarkdownParser
- **Description**: Parse a Markdown table of changes for tersify
- **Parameters**: content: string
- **Return Type**: { document: string; action: string; details: string; reason: string }[]
- **Algorithm**: Parses table into changes.
- **Exceptions**: None

### groupChangesByDocument (IMP-1012)
- **Belongs to**: MarkdownParser
- **Description**: Group changes by document, filtering out 'None' and unknown actions
- **Parameters**: changes: { document: string; action: string; details: string; reason: string }[]
- **Return Type**: Map<string, { type: string; section: string; content: string }[]>
- **Algorithm**: Groups and filters changes.
- **Exceptions**: None

### parseMarkdownTable (IMP-1015)
- **Belongs to**: MarkdownParser
- **Description**: Generalized Markdown table parser
- **Parameters**: content: string
- **Return Type**: Record<string, string>[]
- **Algorithm**: Parses table into records.
- **Exceptions**: None

### provideDocumentLinks (IMP-1016)
- **Belongs to**: SpecCompletionProvider
- **Description**: Provides document links for @mentions and frontmatter references to spec documents.
- **Parameters**: document: vscode.TextDocument, token: vscode.CancellationToken
- **Return Type**: vscode.ProviderResult<vscode.DocumentLink[]>
- **Algorithm**: Finds @mentions and resolves to spec files.
- **Exceptions**: None

### findAllReferences (IMP-1077)
- **Belongs to**: SpecReferenceFinder
- **Description**: Finds all references to the given REFID across the workspace. If the REFID is qualified (contains '/'), uses it directly. If unqualified, prepends the artifact name from the current spec document (e.g., in Attacks.req, FR-1005 becomes Attacks/FR-1005).
- **Parameters**: refId: string
- **Return Type**: Promise<vscode.Location[]>
- **Algorithm**: Resolves the full REFID by checking if it contains '/' (qualified) or prepending the current artifact name. Uses workspace search to find occurrences of the resolved REFID.
- **Exceptions**: None

### findAllImplementations (IMP-1078)
- **Belongs to**: SpecImplementationFinder
- **Description**: Finds all implementations based on file type, REFID, and artifact following specific scanning rules.
- **Parameters**: fileType: 'req' | 'design' | 'impl', refId: string, artifact: string
- **Return Type**: Promise<vscode.Location[]>
- **Algorithm**: Scans files according to rules: for req scan design files for artifact.req/REFID, for design scan impl files for artifact.design/REFID, for impl scan all the source files for artifact/REFID and not the specs.
- **Exceptions**: None

### isRemoveFromAction (IMP-1017)
- **Belongs to**: TersifyActionParser
- **Description**: Checks if action is 'Remove from'
- **Parameters**: None
- **Return Type**: boolean
- **Algorithm**: Checks prefix.
- **Exceptions**: None

### isAddToAction (IMP-1018)
- **Belongs to**: TersifyActionParser
- **Description**: Checks if action is 'Add to'
- **Parameters**: None
- **Return Type**: boolean
- **Algorithm**: Checks prefix.
- **Exceptions**: None

### isNoneAction (IMP-1019)
- **Belongs to**: TersifyActionParser
- **Description**: Checks if action is 'None'
- **Parameters**: None
- **Return Type**: boolean
- **Algorithm**: Checks equality.
- **Exceptions**: None

### isKnownAction (IMP-1020)
- **Belongs to**: TersifyActionParser
- **Description**: Checks if action is known
- **Parameters**: None
- **Return Type**: boolean
- **Algorithm**: Checks against known types.
- **Exceptions**: None

### getActionName (IMP-1021)
- **Belongs to**: TersifyActionParser
- **Description**: Gets the action name
- **Parameters**: None
- **Return Type**: string
- **Algorithm**: Returns the type.
- **Exceptions**: None

### getActionTarget (IMP-1022)
- **Belongs to**: TersifyActionParser
- **Description**: Gets the action target
- **Parameters**: None
- **Return Type**: string
- **Algorithm**: Extracts target.
- **Exceptions**: None

### refactorSpec (IMP-1023)
- **Belongs to**: CascadeCore
- **Description**: Refines a spec document
- **Parameters**: filePath: string, ui: CascadeUI
- **Return Type**: Promise<CascadeResult>
- **Algorithm**: Loads prompt, sends to AI, applies changes.
- **Exceptions**: Throws on errors.

### tersifySpec (IMP-1024)
- **Belongs to**: CascadeCore
- **Description**: Tersifies a spec document
- **Parameters**: filePath: string, ui: CascadeUI
- **Return Type**: Promise<CascadeResult>
- **Algorithm**: Parses changes, applies tersify.
- **Exceptions**: Throws on errors.

### syncImplementationSpec (IMP-1025)
- **Belongs to**: CascadeCore
- **Description**: Syncs implementation spec
- **Parameters**: ui: CascadeUI
- **Return Type**: Promise<CascadeResult>
- **Algorithm**: Generates implementation spec.
- **Exceptions**: Throws on errors.

### syncConOps (IMP-1026)
- **Belongs to**: CascadeCore
- **Description**: Syncs ConOps
- **Parameters**: ui: CascadeUI
- **Return Type**: Promise<CascadeResult>
- **Algorithm**: Updates ConOps.
- **Exceptions**: Throws on errors.

### syncTOC (IMP-1027)
- **Belongs to**: CascadeCore
- **Description**: Syncs TOC
- **Parameters**: ui: CascadeUI
- **Return Type**: Promise<CascadeResult>
- **Algorithm**: Updates TOC.
- **Exceptions**: Throws on errors.

### refactorSpec (IMP-1028)
- **Belongs to**: CascadeServiceCommands
- **Description**: Main entry point for applying changes
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Calls core with UI.
- **Exceptions**: Throws on errors.

### tersifySpec (IMP-1029)
- **Belongs to**: CascadeServiceCommands
- **Description**: Tersifies spec
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Calls core with UI.
- **Exceptions**: Throws on errors.

### buildContext (IMP-1030)
- **Belongs to**: ContextBuilder
- **Description**: Builds context for AI prompts
- **Parameters**: specPath: string
- **Return Type**: Promise<ContextItem[]>
- **Algorithm**: Gathers related specs.
- **Exceptions**: None

### getSpecContent (IMP-1031)
- **Belongs to**: ContextBuilder
- **Description**: Gets spec content
- **Parameters**: specPath: string
- **Return Type**: Promise<string>
- **Algorithm**: Reads file.
- **Exceptions**: Throws on read error.

### getReferencedSpecs (IMP-1032)
- **Belongs to**: ContextBuilder
- **Description**: Gets referenced specs
- **Parameters**: specPath: string
- **Return Type**: Promise<string[]>
- **Algorithm**: Parses references.
- **Exceptions**: None

### resolveSpecPath (IMP-1033)
- **Belongs to**: ContextBuilder
- **Description**: Resolves spec path
- **Parameters**: ref: string
- **Return Type**: string | null
- **Algorithm**: Maps ref to path.
- **Exceptions**: None

### createConversation (IMP-1034)
- **Belongs to**: ConversationManager
- **Description**: Creates a new conversation
- **Parameters**: id: string
- **Return Type**: void
- **Algorithm**: Initializes conversation.
- **Exceptions**: None

### getConversation (IMP-1035)
- **Belongs to**: ConversationManager
- **Description**: Gets a conversation
- **Parameters**: id: string
- **Return Type**: Conversation | undefined
- **Algorithm**: Retrieves from map.
- **Exceptions**: None

### addMessage (IMP-1036)
- **Belongs to**: ConversationManager
- **Description**: Adds a message to conversation
- **Parameters**: id: string, message: ChatMessage
- **Return Type**: void
- **Algorithm**: Appends message.
- **Exceptions**: None

### getMessages (IMP-1037)
- **Belongs to**: ConversationManager
- **Description**: Gets messages from conversation
- **Parameters**: id: string
- **Return Type**: ChatMessage[]
- **Algorithm**: Returns messages.
- **Exceptions**: None

### saveConversation (IMP-1038)
- **Belongs to**: ConversationManager
- **Description**: Saves conversation to storage
- **Parameters**: id: string
- **Return Type**: Promise<void>
- **Algorithm**: Serializes and saves.
- **Exceptions**: Throws on save error.

### loadConversation (IMP-1039)
- **Belongs to**: ConversationManager
- **Description**: Loads conversation from storage
- **Parameters**: id: string
- **Return Type**: Promise<Conversation | null>
- **Algorithm**: Deserializes from storage.
- **Exceptions**: Returns null on error.

### compareContent (IMP-1040)
- **Belongs to**: DiffHelper
- **Description**: Compare two content strings and detect changes
- **Parameters**: oldContent: string, newContent: string
- **Return Type**: ChangeDetectionResult
- **Algorithm**: Compares and finds modified sections.
- **Exceptions**: None

### findModifiedSections (IMP-1041)
- **Belongs to**: DiffHelper
- **Description**: Find modified sections by comparing line-by-line
- **Parameters**: oldLines: string[], newLines: string[]
- **Return Type**: string[]
- **Algorithm**: Compares section maps.
- **Exceptions**: None

### buildSectionMap (IMP-1042)
- **Belongs to**: DiffHelper
- **Description**: Build section map from content lines
- **Parameters**: lines: string[]
- **Return Type**: Map<string, string>
- **Algorithm**: Parses sections.
- **Exceptions**: None

### generateChangeSummary (IMP-1043)
- **Belongs to**: DiffHelper
- **Description**: Generate change summary
- **Parameters**: oldLines: string[], newLines: string[], modifiedSections: string[]
- **Return Type**: string
- **Algorithm**: Summarizes changes.
- **Exceptions**: None

### parseFileStructure (IMP-1044)
- **Belongs to**: FileStructureParser
- **Description**: Parses file structure
- **Parameters**: rootPath: string
- **Return Type**: Promise<any>
- **Algorithm**: Recursively parses directory.
- **Exceptions**: Logs errors.

### parseDirectory (IMP-1045)
- **Belongs to**: FileStructureParser
- **Description**: Parses a directory
- **Parameters**: dirPath: string
- **Return Type**: Promise<any>
- **Algorithm**: Lists files and subdirs.
- **Exceptions**: Logs errors.

### getUnstagedChanges (IMP-1046)
- **Belongs to**: GitHelper
- **Description**: Gets unstaged changes
- **Parameters**: None
- **Return Type**: Promise<boolean>
- **Algorithm**: Runs git status.
- **Exceptions**: Returns false on error.

### stageAll (IMP-1047)
- **Belongs to**: GitHelper
- **Description**: Stages all changes
- **Parameters**: None
- **Return Type**: Promise<void>
- **Algorithm**: Runs git add .
- **Exceptions**: Throws on error.

### commit (IMP-1048)
- **Belongs to**: GitHelper
- **Description**: Commits changes
- **Parameters**: message: string
- **Return Type**: Promise<void>
- **Algorithm**: Runs git commit.
- **Exceptions**: Throws on error.

### getStatus (IMP-1049)
- **Belongs to**: GitHelper
- **Description**: Gets git status
- **Parameters**: None
- **Return Type**: Promise<string>
- **Algorithm**: Runs git status.
- **Exceptions**: Throws on error.

### parseAndGenerate (IMP-1050)
- **Belongs to**: ImplParser
- **Description**: Parses and generates code from impl spec
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Parses spec, generates code.
- **Exceptions**: Throws on errors.

### executePrompt (IMP-1051)
- **Belongs to**: PromptService
- **Description**: Executes a prompt
- **Parameters**: promptName: string
- **Return Type**: Promise<void>
- **Algorithm**: Calls core.
- **Exceptions**: Throws on errors.

### executePrompt (IMP-1052)
- **Belongs to**: PromptServiceCore
- **Description**: Executes a prompt
- **Parameters**: promptName: string
- **Return Type**: Promise<void>
- **Algorithm**: Loads prompt, executes.
- **Exceptions**: Throws on errors.

### createRequirementSpec (IMP-1053)
- **Belongs to**: ScaffoldService
- **Description**: Creates a requirement spec
- **Parameters**: None
- **Return Type**: Promise<void>
- **Algorithm**: Prompts user and creates spec.
- **Exceptions**: Throws on errors.

### syncImplementationSpecSpec (IMP-1054)
- **Belongs to**: ScaffoldService
- **Description**: Syncs implementation spec
- **Parameters**: None
- **Return Type**: Promise<void>
- **Algorithm**: Generates impl spec.
- **Exceptions**: Throws on errors.

### syncImplementationSpec (IMP-1055)
- **Belongs to**: ScaffoldService
- **Description**: Syncs implementation spec with design
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Updates impl spec.
- **Exceptions**: Throws on errors.

### syncConOps (IMP-1056)
- **Belongs to**: ScaffoldService
- **Description**: Syncs ConOps
- **Parameters**: None
- **Return Type**: Promise<void>
- **Algorithm**: Updates ConOps.
- **Exceptions**: Throws on errors.

### processSpecFile (IMP-1057)
- **Belongs to**: SpecFileProcessor
- **Description**: Write a VS Code extension in TypeScript that listens for workspace.onDidChangeTextDocument events. Whenever a file with YAML frontmatter is edited, extract the metadata from the top section, update it dynamically, then apply the edits via WorkspaceEdit to the in-memory text document only. Don't save to disk automatically; let the user decide that. Keep it lightweight and reactive.
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Listens for document change events, checks for YAML frontmatter, extracts and updates metadata, applies edits via WorkspaceEdit without saving.
- **Exceptions**: Throws on errors.

### validateSpecFile (IMP-1058)
- **Belongs to**: SpecFileProcessor
- **Description**: Validates a spec file
- **Parameters**: filePath: string
- **Return Type**: Promise<ValidationError[]>
- **Algorithm**: Checks structure.
- **Exceptions**: None

### updateMetadata (IMP-1057)
- **Belongs to**: SpecFileProcessor
- **Description**: Updates metadata in a spec document including last-updated date, enforces correct phase based on file extension, sets artifact name from filename if unknown, syncs references with content mentions, and applies the updated frontmatter to the document.
- **Parameters**: document: any (VS Code TextDocument)
- **Return Type**: Promise<void>
- **Algorithm**: Parses document content, updates last-updated to today's date, enforces phase from file extension (.req.md -> requirement, .design.md -> design, .impl.md -> implementation), sets artifact from filename if 'unknown', syncs references with mentions, reconstructs frontmatter, and applies WorkspaceEdit to update the document.
- **Exceptions**: Logs warnings on errors but doesn't throw.

### syncReferencesWithMentions (IMP-1058)
- **Belongs to**: SpecFileProcessor
- **Description**: Syncs the references metadata field with content mentions found in the document
- **Parameters**: document: any, parsed?: ParsedSpec
- **Return Type**: Promise<void>
- **Algorithm**: Extracts unique references from content, updates metadata.references to match, reconstructs frontmatter, applies WorkspaceEdit.
- **Exceptions**: Logs warnings on errors but doesn't throw.

### validateReferences (IMP-1059)
- **Belongs to**: SpecFileProcessor
- **Description**: Validates references in a spec file including dependencies, circular references, and mention consistency
- **Parameters**: filePath: string
- **Return Type**: Promise<ValidationError[]>
- **Algorithm**: Parses content, checks depends-on and references for existence, circular dependencies, over-specification, self-references, and ensures references match content mentions.
- **Exceptions**: Returns empty array on parsing errors.

### getAllDependencies (IMP-1060)
- **Belongs to**: SpecFileProcessor
- **Description**: Recursively gets all dependencies of a spec reference
- **Parameters**: specRef: string, visited?: Set<string>
- **Return Type**: Promise<Set<string>>
- **Algorithm**: Traverses dependency graph, collects all transitive dependencies, detects cycles.
- **Exceptions**: Returns empty set on errors.

### convertOverspecifiedReferences (IMP-1061)
- **Belongs to**: SpecFileProcessor
- **Description**: Converts overspecified references (artifact.phase.md) to standard format (@artifact.phase)
- **Parameters**: filePath: string
- **Return Type**: Promise<void>
- **Algorithm**: Uses regex to find and replace overspecified references in file content.
- **Exceptions**: Logs errors but doesn't throw.

### getAllSpecRefs (IMP-1062)
- **Belongs to**: SpecReferenceManager
- **Description**: Gets all spec refs
- **Parameters**: None
- **Return Type**: string[]
- **Algorithm**: Scans specs directory.
- **Exceptions**: None

### getSpecRefsForFile (IMP-1063)
- **Belongs to**: SpecReferenceManager
- **Description**: Gets refs for a file
- **Parameters**: filePath: string
- **Return Type**: string[]
- **Algorithm**: Parses file.
- **Exceptions**: None

### addSpecRef (IMP-1064)
- **Belongs to**: SpecReferenceManager
- **Description**: Adds a spec ref
- **Parameters**: ref: string
- **Return Type**: void
- **Algorithm**: Adds to list.
- **Exceptions**: None

### removeSpecRef (IMP-1065)
- **Belongs to**: SpecReferenceManager
- **Description**: Removes a spec ref
- **Parameters**: ref: string
- **Return Type**: void
- **Algorithm**: Removes from list.
- **Exceptions**: None

### show (IMP-1066)
- **Belongs to**: ChatPanelProvider
- **Description**: Shows the chat panel
- **Parameters**: None
- **Return Type**: void
- **Algorithm**: Creates or reveals panel.
- **Exceptions**: None

### createWebviewPanel (IMP-1067)
- **Belongs to**: ChatPanelProvider
- **Description**: Creates the webview panel
- **Parameters**: None
- **Return Type**: void
- **Algorithm**: Initializes panel.
- **Exceptions**: None

### setupWebview (IMP-1068)
- **Belongs to**: ChatPanelProvider
- **Description**: Sets up the webview
- **Parameters**: None
- **Return Type**: void
- **Algorithm**: Configures webview.
- **Exceptions**: None

### handleMessage (IMP-1069)
- **Belongs to**: ChatPanelProvider
- **Description**: Handles messages from webview
- **Parameters**: message: any
- **Return Type**: Promise<void>
- **Algorithm**: Processes message.
- **Exceptions**: Logs errors.

### logRequest (IMP-1070)
- **Belongs to**: PromptLogger
- **Description**: Logs a request
- **Parameters**: workspaceRoot: string, operation: string, systemPrompt: string, userPrompt: string
- **Return Type**: Promise<string>
- **Algorithm**: Writes to log file.
- **Exceptions**: Logs warning on error.

### logResponse (IMP-1071)
- **Belongs to**: PromptLogger
- **Description**: Logs a response
- **Parameters**: workspaceRoot: string, id: string, operation: string, response: string
- **Return Type**: Promise<void>
- **Algorithm**: Writes to log file.
- **Exceptions**: Logs warning on error.

### toggleMonitoring (IMP-1073)
- **Belongs to**: SpecFileWatcher
- **Description**: Toggles file monitoring
- **Parameters**: None
- **Return Type**: void
- **Algorithm**: Enables or disables watcher.
- **Exceptions**: None

### validateFile (IMP-1074)
- **Belongs to**: SpecFileWatcher
- **Description**: Validates a file
- **Parameters**: filePath: string
- **Return Type**: void
- **Algorithm**: Parses and validates.
- **Exceptions**: None

### onFileChange (IMP-1075)
- **Belongs to**: SpecFileWatcher
- **Description**: Handles file change
- **Parameters**: uri: vscode.Uri
- **Return Type**: void
- **Algorithm**: Validates file.
- **Exceptions**: None

### onFileDelete (IMP-1076)
- **Belongs to**: SpecFileWatcher
- **Description**: Handles file delete
- **Parameters**: uri: vscode.Uri
- **Return Type**: void
- **Algorithm**: Removes diagnostics.
- **Exceptions**: None

### log (IMP-1079)
- **Belongs to**: OutputLogger
- **Description**: Logs a message to console and optionally to the configured output channel.
- **Parameters**: message: string
- **Return Type**: void
- **Algorithm**: Always writes to console.log, and also to outputChannel.appendLine if channel is set.
- **Exceptions**: None

### setOutputChannel (IMP-1080)
- **Belongs to**: OutputLogger
- **Description**: Sets the output channel to use for logging.
- **Parameters**: channel: vscode.OutputChannel | null
- **Return Type**: void
- **Algorithm**: Stores the channel reference for future logging.
- **Exceptions**: None

### provideHover (IMP-1081)
- **Belongs to**: SpecHoverProvider
- **Description**: Provides hover tooltips for spec references by finding the source document and extracting descriptions.
- **Parameters**: document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken
- **Return Type**: vscode.ProviderResult<vscode.Hover>
- **Algorithm**: 
- Extract the SPEC_ID from the hover position (FR_nnnn, DES_nnnn, IMP_nnnn). 
- Determine the spec type (FR, DES, IMP) 
- Determine the source document path. 
- Parse the source document to find the section starting with "### SPEC_ID". 
- Extract the entire specification block (from "### SPEC_ID" to the next "###" or end of section). 
- Return a Hover with the extracted content.
- **Test Cases**:
- When `// PromptPress/IMP-1081`, SPEC_ID is `IMP-1081`
- When `// PromptPress/IMP-1081`, SPEC_ID is spec type is `IMP`
- When `// PromptPress/IMP-1081`, source path is `[root]/specs/implementation/PromptPress.impl.md`
- **Exceptions**: Returns null if no hover content found.

## Data Structures
- ChatMessage: Interface for chat messages.
- ParsedSpec: Structure for parsed spec data.
- CascadeResult: Result of cascade operations.
- Conversation: Structure for conversations.
- ChangeDetectionResult: Result of diff operations.

## Algorithms
- Markdown parsing: Extracts frontmatter, sections, references.
- AI chat completion: Sends requests to xAI API with retries and timeouts.
- Spec validation: Checks structure and references.
- Cascade operations: Applies AI-driven changes to specs.
- File watching: Monitors changes and validates specs.

## Dependencies
- **External Libraries**: vscode, xai API
- **Internal Dependencies**: Various services and parsers
- **System Requirements**: Node.js, VS Code

## Error Handling
- Try-catch blocks in async methods.
- Logging errors to output channel.
- Throwing errors for critical failures.

## Performance Considerations
- Timeout on API requests (60s).
- Caching of prompts.
- Asynchronous file operations.

## Security Considerations
- API key authentication for xAI.
- Input validation for spec parsing.

## Notes
- IMP comments are injected for public methods.
- Extension uses persistent storage for conversations.
- Supports cascading changes across spec phases.