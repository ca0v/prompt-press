# PromptPress Extension - Quick Start

## Installation

### From Source (Development)

1. **Install dependencies**:
   ```bash
   npm run install-deps
   ```

2. **Compile the extension**:
   ```bash
   npm run compile
   ```

3. **Run in development mode**:
   - Open this folder in VS Code
   - Press `F5` to launch Extension Development Host
   - A new VS Code window opens with PromptPress loaded

### From Package

```bash
npm run package
code --install-extension promptpress-0.1.0.vsix
```

## Configuration

### Set API Key

Option 1 - Environment variable (recommended):
```bash
export PROMPT_PRESS_XAI_API_KEY="your-api-key"
```

Option 2 - VS Code settings:
1. Open Settings (Ctrl+,)
2. Search for "PromptPress"
3. Set "Promptpress: Api Key"

### Configure Extension

Available settings:
- `promptpress.apiKey`: xAI API key (if not using env var)
- `promptpress.apiEndpoint`: API base URL (default: https://api.x.ai/v1)
- `promptpress.model`: AI model to use (default: grok-beta)
- `promptpress.autoMonitor`: Auto-detect file changes (default: true)
- `promptpress.maxContextTokens`: Max tokens in context (default: 8000)

## Usage

### 1. Create Project Structure

The extension expects this folder structure (created automatically when you run the setup):

```
your-project/
├── specs/
│   ├── requirements/   # .req.md files
│   ├── design/         # .design.md files
│   └── implementation/ # .impl.md files
├── artifacts/          # Generated code
└── templates/          # Spec templates
```

### 2. Create a Spec File

Create a new file in the appropriate directory:

**Example**: `specs/requirements/my-feature.req.md`

```markdown
---
artifact: my-feature
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# My Feature - Requirements

## Overview
Description of what this feature should do.

## Functional Requirements
- What it should accomplish

## Questions & Clarifications
[AI-CLARIFY: Any questions for AI?]
```

### 3. Trigger AI Conversation

When you save the file, PromptPress will:
1. Detect the change
2. Show a notification: "Discuss with AI?"
3. Click "Yes" to open the chat panel

Alternatively:
- Click "PromptPress" in the status bar
- Run command: `PromptPress: Open Chat` (Ctrl+Shift+P)

### 4. Interact with AI

In the chat panel:
- Ask questions about your spec
- Request improvements or clarifications
- Get suggestions for design decisions
- Validate completeness

The AI has context of:
- Your current spec file
- Related specs (based on phase)
- Referenced files (via `@ref:` markers)

### 5. Refine and Iterate

- AI responses are saved to conversation history
- Edit your spec based on feedback
- Each change triggers new AI interaction opportunity
- Iterate until spec is precise and complete

## Commands

Access via Command Palette (Ctrl+Shift+P):

- **PromptPress: Open Chat** - Open chat panel
- **PromptPress: Generate Code** - Generate code from implementation spec
- **PromptPress: Validate Spec** - Check spec structure and completeness
- **PromptPress: Toggle File Monitoring** - Enable/disable auto-detection

## Workflow Example

### Step 1: Requirements
```bash
# Create requirement file
code specs/requirements/user-login.req.md
```

Write what you need, save, discuss with AI.

### Step 2: Design
```bash
# Create design file
code specs/design/user-login.design.md
```

The extension automatically loads `user-login.req.md` for context.
Collaborate with AI on architecture, APIs, data models.

### Step 3: Implementation
```bash
# Create implementation file
code specs/implementation/user-login.impl.md
```

The extension loads both `.req.md` and `.design.md` for full context.
AI helps create precise, code-ready specifications.

### Step 4: Generate Code
```bash
# Use AI or custom generators
# (Code generation feature coming soon)
```

## Tips

1. **Use templates**: Copy from `templates/` directory for consistent structure

2. **Link specs**: Use `@ref:artifact-name.phase` to connect related specs
   ```markdown
   ## Dependencies
   Requires @ref:auth-service.design for authentication.
   ```

3. **Ask questions**: Use `[AI-CLARIFY: question]` to mark ambiguities
   ```markdown
   [AI-CLARIFY: Should we use JWT or session cookies?]
   ```

4. **Review context**: Check the chat panel to see what files AI is using

5. **Iterate specs, not code**: When something's wrong, fix the spec and regenerate

## Troubleshooting

### Extension not activating
- Check that you have a `specs/` directory in your workspace
- Verify folder structure matches expected layout

### No AI response
- Verify API key is set: Check environment variable or VS Code settings
- Test connection: Check VS Code Output panel (PromptPress channel)
- Check API endpoint configuration

### Chat panel not showing
- Click "PromptPress" in status bar (bottom right)
- Or run command: "PromptPress: Open Chat"

### File changes not detected
- Check that auto-monitoring is enabled in settings
- Manually trigger with "PromptPress: Open Chat" after editing
- Verify file has correct extension (.req.md, .design.md, .impl.md)

## Advanced Features

### Conversation History
- Conversations persist across VS Code restarts
- Stored in VS Code global storage
- Clear with "Clear" button in chat panel

### Context Management
- Extension automatically determines what context to send
- Based on file phase (requirement → design → implementation)
- Includes explicit `@ref:` references
- Respects token limits (configurable)

### AI Response Parsing
- Extension understands structured markers in AI responses
- `[QUESTION:]` - AI needs clarification
- `REQUEST-DOC:` - AI needs additional files
- `[VALIDATION:]` - Completeness check result

## What's Next?

1. Create your first spec file
2. Discuss with AI to refine it
3. Progress through requirement → design → implementation
4. Generate code (feature in development)
5. Iterate and improve specs as needed

Remember: **Specs are source code, generated code is binary**. When you need to change something, change the spec and regenerate!
