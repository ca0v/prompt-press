# PromptPress VS Code Extension

## Development

### Install Dependencies
```bash
npm run install-deps
```

### Compile TypeScript
```bash
npm run compile
```

### Watch Mode (auto-compile on save)
```bash
npm run watch
```

### Run Extension
1. Open this folder in VS Code
2. Press F5 to start debugging
3. A new VS Code window will open with the extension loaded

### Package Extension
```bash
npm run package
```

This creates a `.vsix` file that can be installed in VS Code.

## Testing the Extension

1. Create a workspace with the folder structure defined in README.md
2. Create spec files in `specs/requirements/`, `specs/design/`, or `specs/implementation/`
3. When you create or modify a spec file, the extension will prompt you to discuss with AI
4. Click "PromptPress" in the status bar to open the chat panel

## Configuration

Set your xAI API key either:
- In environment variable: `PROMPT_PRESS_XAI_API_KEY`
- In VS Code settings: `promptpress.apiKey`

## Features

- **File Monitoring**: Automatically detects changes to spec files
- **Context-Aware**: Loads related specs based on SDLC phase
- **AI Chat**: Conversational interface for spec refinement
- **History**: Persists conversations per artifact
- **Structured Parsing**: Understands markdown metadata and references
