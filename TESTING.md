# Testing the PromptPress Extension

## Quick Test

### 1. Launch Extension
```bash
# In VS Code, press F5
# Or run:
code --extensionDevelopmentPath=/home/ca0v/code/prompt-press
```

A new VS Code window opens with the extension loaded.

### 2. Verify Extension is Active
- Look for "PromptPress" in the status bar (bottom right)
- Open Command Palette (Ctrl+Shift+P)
- Type "PromptPress" - you should see 4 commands

### 3. Test File Monitoring

Create a test spec file:

```bash
cat > specs/requirements/hello-world.req.md << 'EOF'
---
artifact: hello-world
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# Hello World - Requirements

## Overview
A simple hello world application.

## Functional Requirements
- FR-1: Display "Hello, World!" message
- FR-2: Accept user name as input
- FR-3: Personalize greeting

## Questions & Clarifications
[AI-CLARIFY: Should we support multiple languages?]

## AI Interaction Log
<!-- Auto-maintained -->
EOF
```

Save the file. You should see:
- ✅ Notification: "PromptPress: hello-world.req.md was created. Discuss with AI?"

### 4. Test Chat Interface

1. Click "Yes" on the notification (or click "PromptPress" in status bar)
2. Chat panel opens to the side
3. Type a message: "Help me refine these requirements"
4. Click "Send" or press Enter
5. Watch for AI response

Expected behavior:
- "Thinking..." indicator appears
- AI response appears in chat
- Conversation is saved to history

### 5. Test Context Loading

Create a design file:

```bash
cat > specs/design/hello-world.design.md << 'EOF'
---
artifact: hello-world
phase: design
depends-on: []
references: [@ref:hello-world.req]
version: 1.0.0
last-updated: 2025-12-15
---

# Hello World - Design

## Overview
Simple CLI application.

## Architecture
Single TypeScript file with main function.

## API
```typescript
function greet(name: string): string
```

## Questions
[AI-CLARIFY: Should we validate name input?]

## Cross-References
- @ref:hello-world.req - Requirements

## AI Interaction Log
<!-- Auto-maintained -->
EOF
```

When you save this file and discuss with AI:
- ✅ Extension should load BOTH hello-world.req.md and hello-world.design.md
- ✅ Check Output panel (View → Output → PromptPress) to see context loading

### 6. Test Commands

#### Open Chat
- Press Ctrl+Shift+P
- Type "PromptPress: Open Chat"
- ✅ Chat panel should open

#### Toggle Monitoring
- Press Ctrl+Shift+P
- Type "PromptPress: Toggle File Monitoring"
- ✅ See notification about monitoring status

## Debugging

### Enable Debug Output

1. Open Output panel: View → Output
2. Select "PromptPress" from dropdown
3. Watch for debug messages

### Common Issues

#### Extension not activating
**Symptom**: No status bar item, commands not available

**Fix**:
- Check that `specs/` folder exists in workspace
- Reload window: Ctrl+Shift+P → "Developer: Reload Window"

#### No AI response
**Symptom**: "Thinking..." never completes

**Check**:
1. API key is set:
   ```bash
   echo $PROMPT_PRESS_XAI_API_KEY
   ```
2. Output panel for error messages
3. Network connectivity

**Test API manually**:
```bash
curl -X POST https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $PROMPT_PRESS_XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-beta",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

#### Chat panel blank
**Symptom**: Chat opens but shows nothing

**Fix**:
- Open Developer Tools: Help → Toggle Developer Tools
- Check Console for JavaScript errors
- Reload window

### Inspect Extension State

Open Developer Tools (Help → Toggle Developer Tools) and run:

```javascript
// Check if extension is active
vscode.extensions.getExtension('promptpress.promptpress')

// Check configuration
vscode.workspace.getConfiguration('promptpress')
```

## Manual Testing Checklist

- [ ] Extension activates on workspace with specs/ folder
- [ ] Status bar shows "PromptPress" button
- [ ] File watcher detects .req.md creation
- [ ] File watcher detects .design.md modification
- [ ] File watcher detects .impl.md deletion
- [ ] Notification appears on file change
- [ ] Chat panel opens via status bar click
- [ ] Chat panel opens via command
- [ ] User can type and send messages
- [ ] AI responds to messages
- [ ] Loading indicator shows during AI request
- [ ] Context includes related files (phase-aware)
- [ ] @ref: references are loaded
- [ ] [AI-CLARIFY:] markers are parsed
- [ ] Conversation history persists
- [ ] Clear history button works
- [ ] Toggle monitoring command works
- [ ] Error messages display in chat on API failure

## Performance Testing

### Context Size
Create a large spec file:
```bash
# Generate ~5000 line spec
for i in {1..100}; do
  echo "## Section $i" >> specs/requirements/large-test.req.md
  echo "Content for section $i..." >> specs/requirements/large-test.req.md
  echo "" >> specs/requirements/large-test.req.md
done
```

Check:
- [ ] Extension handles large files
- [ ] Token estimation is reasonable
- [ ] Context truncation works if needed

### Multiple Files
Create 10+ spec files and verify:
- [ ] File watcher tracks all files
- [ ] No performance degradation
- [ ] Memory usage is reasonable

## Integration Testing

### Full Workflow Test

1. Create requirement
2. Discuss with AI
3. Refine based on feedback
4. Create design (should auto-load requirement)
5. Discuss design with AI
6. Create implementation (should auto-load req + design)
7. Discuss implementation with AI
8. Verify conversation history persists
9. Close and reopen VS Code
10. Verify history loaded

Expected result: ✅ Smooth workflow, no errors

## Next Steps After Testing

1. Fix any bugs found
2. Improve error messages
3. Add more validation
4. Enhance AI prompts
5. Build code generation feature

## Reporting Issues

If you find issues:

1. **Reproduce**: Can you make it happen again?
2. **Logs**: Check Output panel (View → Output → PromptPress)
3. **State**: What was the extension doing before the issue?
4. **Expected**: What should have happened?
5. **Actual**: What actually happened?

Document in GitHub issues or fix directly in code!
