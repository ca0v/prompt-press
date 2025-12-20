# PromptPress Quick Reference

## 🚀 Getting Started

### 1. New Project
```
Command: PromptPress: Scaffold New Project
```
Creates complete folder structure.

### 2. New Artifact (AI-Generated)
```
Command: PromptPress: Scaffold New Artifact
Name: my-feature
Description: What you want to build (or "see README.md")
```
AI generates requirement + design specs automatically!

### 3. Manual Spec Creation
```
specs/requirements/my-feature.req.md
specs/design/my-feature.design.md
specs/implementation/my-feature.impl.md
```

## 📋 Commands

| Command | What It Does |
|---------|-------------|
| `Scaffold New Project` | Create folder structure |
| `Scaffold New Artifact` | AI-generate req + design specs |
| `Open Chat` | Open AI conversation panel |
| `Generate Code` | Generate code from impl spec |
| `Validate Spec` | Check spec completeness |
| `Toggle File Monitoring` | Enable/disable auto-detection |

## 📁 File Structure

```
project/
├── specs/
│   ├── requirements/    ← .req.md files
│   ├── design/          ← .design.md files
│   └── implementation/  ← .impl.md files
├── artifacts/           ← Generated code
└── templates/           ← Spec templates
```

## 📝 Spec File Format

```markdown
---
artifact: my-feature
phase: requirement | design | implementation
depends-on: [other-artifacts]
references: [@ref:other-artifact.phase]
version: 1.0.0
last-updated: 2025-12-15
---

# My Feature - [Phase]

## Overview
...

## [Phase-Specific Sections]
...

## Questions & Clarifications
[AI-CLARIFY: What about X?]

## Cross-References
- @ref:other-feature.req - Description

```

## 🔑 Special Markers

| Marker | Purpose | Example |
|--------|---------|---------|
| `@ref:name.phase` | Reference other spec | `@ref:auth.design` |
| `[AI-CLARIFY: ?]` | Mark question for AI | `[AI-CLARIFY: Use JWT or sessions?]` |
| `REQUEST-DOC:` | AI requests document | AI uses this in responses |
| `[QUESTION:]` | AI asks question | AI uses this in responses |

## ⚙️ Configuration

Set in VS Code settings or environment variable:

```json
{
  "promptpress.apiKey": "your-key",
  "promptpress.apiEndpoint": "https://api.x.ai/v1",
  "promptpress.model": "grok-code-fast-1",
  "promptpress.autoMonitor": true,
  "promptpress.maxContextTokens": 8000
}
```

**Available models**: `grok-code-fast-1` (current); **deprecated**: `grok-beta`, `grok-2-1212`, `grok-vision-beta`

Or use environment variable:
```bash
export PROMPT_PRESS_XAI_API_KEY="your-key"
```

## 🔄 Workflow

### Quick Start (Scaffold)
1. `Scaffold New Project` → Creates structure
2. `Scaffold New Artifact` → AI generates req + design
3. Review & refine via chat
4. Create implementation spec
5. Generate code

### Traditional Flow
1. Create requirement manually
2. Save → Notification → Discuss with AI
3. Create design (AI loads requirement automatically)
4. Create implementation (AI loads req + design)
5. Generate code

## 💬 Using Chat

1. **Open**: Click "PromptPress" in status bar or use command
2. **Ask**: Type questions about your spec
3. **Refine**: AI suggests improvements
4. **Context**: AI automatically loads related specs
5. **History**: Conversations persist across sessions

## 🎯 Best Practices

✅ **DO**:
- Use scaffold for quick starts
- Be specific in descriptions
- Reference README.md for context
- Use `@ref:` to link specs
- Mark questions with `[AI-CLARIFY:]`
- Iterate specs, not code

❌ **DON'T**:
- Edit generated code directly
- Skip the requirement phase
- Use spaces in artifact names (use kebab-case)
- Forget to review AI-generated specs

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not active | Check `specs/` folder exists |
| No AI response | Verify API key is set |
| Chat panel blank | Check Developer Tools console |
| File changes not detected | Check auto-monitoring is enabled |

## 📚 Documentation

- `README.md` - Complete requirements
- `docs/quick-start.md` - User guide
- `docs/scaffolding.md` - Scaffold feature details
- `docs/scaffold-examples.md` - Usage examples
- `docs/markdown-schema.md` - Spec format reference
- `TESTING.md` - How to test extension

## 🎓 Examples

### Simple Feature
```
Scaffold Artifact
Name: email-validation
Desc: Validate email addresses with regex and DNS lookup
```

### With Context
```
Scaffold Artifact
Name: payment-api
Desc: see README.md - Stripe payment integration
```

### Complex System
```
Scaffold Artifact
Name: real-time-sync
Desc: WebSocket-based real-time data synchronization 
      with conflict resolution and offline support
```

## 🚦 Status Indicators

| Location | What It Shows |
|----------|---------------|
| Status bar | "PromptPress" button - click to open chat |
| Notifications | File change detection prompts |
| Output panel | Debug logs and API responses |
| Chat panel | AI conversation and responses |

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Ctrl+Shift+P` |
| Open Settings | `Ctrl+,` |
| Toggle Panel | `Ctrl+J` |
| Run Extension | `F5` (in dev mode) |

## 🔗 Quick Links

- **xAI API**: https://api.x.ai
- **VS Code Extension API**: https://code.visualstudio.com/api
- **Markdown Guide**: https://www.markdownguide.org

---

**Remember**: Specs are source code. Generated code is binary. When you need changes, change the specs and regenerate! 🎯
