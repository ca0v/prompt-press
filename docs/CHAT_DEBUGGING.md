# Chat Interaction Debugging Guide

## Overview

This document describes the comprehensive logging system added to PromptPress to trace chat interactions and file updates.

## Problem Being Debugged

**Issue**: AI responds to user messages in chat, but the markdown file doesn't get updated.

**Example Scenario**:
1. User modifies description in `game-board.req.md`
2. User asks AI to "update the requirements"
3. AI provides a valid response with updated specification
4. **Bug**: File is not updated with the new content

## Logging System

### Log Prefixes

All logs are prefixed for easy filtering:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `[Chat]` | Main chat flow | `[Chat] New user message received` |
| `[Chat:shouldUpdateFile]` | File update decision logic | `[Chat:shouldUpdateFile] User wants update? true` |
| `[Chat:updateMarkdownFile]` | File writing process | `[Chat:updateMarkdownFile] Writing 2048 bytes to file...` |
| `[Chat:extractMarkdownContent]` | Content extraction | `[Chat:extractMarkdownContent] Found YAML frontmatter` |
| `[Chat:handleRequestedDocuments]` | Document loading | `[Chat:handleRequestedDocuments] Loading 2 requested documents...` |

### Viewing Logs

**In VS Code:**
1. Open Output panel: `View → Output` (or `Ctrl+Shift+U` / `Cmd+Shift+U`)
2. Select "PromptPress" from dropdown
3. Logs appear in real-time as you interact with the chat

**Logs are automatically displayed** during extension operations.

## Complete Chat Interaction Trace

### 1. User Sends Message

```
[Chat] ========================================
[Chat] New user message received
[Chat] Artifact: game-board
[Chat] File path: /path/to/specs/game-board.req.md
[Chat] Message: update the requirements to include...
[Chat] ========================================
```

**What to Check:**
- ✅ `Artifact` is set correctly
- ✅ `File path` points to the right file
- ❌ If either is missing, the extension hasn't detected a file change

### 2. Context Building

```
[Chat] Building context...
[Chat] Context built: 1500 tokens (estimated)
[Chat] Context includes 1 file(s)
[Chat] Context formatted for AI
```

**What to Check:**
- ✅ Token count is reasonable (not 0, not excessive)
- ✅ File count matches expectations
- ❌ If 0 files, context building failed

### 3. AI Request

```
[Chat] Sending request to AI...
[XAI] Sending chat completion request: model=grok-code-fast-1, messages=3, temp=0.7, maxTokens=4000
[XAI] Received response: finishReason=stop, promptTokens=1234, completionTokens=567
```

**What to Check:**
- ✅ Model is `grok-code-fast-1` (not deprecated models)
- ✅ Response received successfully
- ❌ If error, check API key and model availability

### 4. AI Response Received

```
[Chat] ✅ Received AI response: 2048 characters
[Chat] Response preview: ---
artifact: game-board
phase: requirement
...
[Chat] Parsing AI response for structured markers...
[Chat] Parsed - Main content: 2048 chars
[Chat] Parsed - Questions: 0
[Chat] Parsed - Requested docs: 0
[Chat] Parsed - Validation status: undefined
[Chat] Saved AI message to conversation history
```

**What to Check:**
- ✅ Response length is substantial (not just a few characters)
- ✅ Response preview shows markdown structure (`---`, `##`, etc.)
- ❌ If very short, AI may have refused or had an error

### 5. File Update Decision (KEY STEP)

```
[Chat] Checking if response contains file updates...
[Chat:shouldUpdateFile] Analyzing user message and AI response...
[Chat:shouldUpdateFile] User wants update? true
[Chat:shouldUpdateFile] Response has markdown structure? true
[Chat:shouldUpdateFile] Response is conversational? false
[Chat:shouldUpdateFile] Final decision: true
[Chat] Should update file? true
```

**What to Check:**
- ✅ `User wants update?` should be `true` if message contains update keywords
- ✅ `Response has markdown structure?` should be `true` if AI provided a spec
- ✅ `Response is conversational?` should be `false` for spec updates
- ❌ If `Final decision: false`, file won't be updated

**Common Reasons for `false` Decision:**
1. User message doesn't contain update keywords (update, change, modify, etc.)
2. AI response is purely conversational (no markdown structure)
3. AI response is wrapped in conversational text

### 6. File Update Execution

```
[Chat] 🔄 Attempting to update file: /path/to/specs/game-board.req.md
[Chat:updateMarkdownFile] Starting file update...
[Chat:updateMarkdownFile] Target file: /path/to/specs/game-board.req.md
[Chat:updateMarkdownFile] Content length: 2048
[Chat:extractMarkdownContent] Extracting markdown from response...
[Chat:extractMarkdownContent] Found YAML frontmatter at position 0
[Chat:updateMarkdownFile] Extracted markdown length: 2048
[Chat:updateMarkdownFile] Writing 2048 bytes to file...
[Chat:updateMarkdownFile] ✅ File write successful
[Chat] ✅ File updated successfully
```

**What to Check:**
- ✅ File path is correct
- ✅ Content length is reasonable
- ✅ YAML frontmatter was found
- ✅ Write operation succeeded
- ❌ If write fails, check file permissions

### 7. Completion

```
[Chat] Sending response to webview...
[Chat] Response sent to webview
[Chat] Request complete. Hiding loading state.
[Chat] ========================================
```

## Update Keywords

The system detects these keywords in user messages to determine update intent:

- `update`
- `change`
- `modify`
- `edit`
- `rewrite`
- `revise`
- `add`
- `remove`
- `delete`
- `improve`
- `fix`
- `correct`

**Example Messages That Trigger Updates:**
- ✅ "update the requirements"
- ✅ "please modify the design to include..."
- ✅ "add a new functional requirement"
- ✅ "fix the implementation spec"

**Example Messages That DON'T Trigger Updates:**
- ❌ "what are the requirements?"
- ❌ "explain the design"
- ❌ "is this correct?"
- ❌ "help me understand"

## Markdown Detection

The system looks for these markers in AI responses to identify specification content:

1. **YAML Frontmatter**: `---\n` at start
2. **Headers**: `##` or `# ` followed by double newline
3. **Code Blocks**: ` ```markdown\n...\n``` `

## Conversational Phrases

The system identifies conversational responses that shouldn't update files:

- "here's"
- "i've"
- "i can"
- "let me"
- "would you like"
- "sure"
- "certainly"
- "of course"
- "happy to help"

**Note**: If AI wraps the spec in conversational text, the extraction logic will try to isolate the spec content.

## Troubleshooting

### Issue: File Not Updating

**Check Logs For:**

1. **No Artifact/File Path**
   ```
   [Chat] ❌ Error: No artifact or file path available
   ```
   **Solution**: Open or modify a spec file first to activate the extension

2. **Update Decision is False**
   ```
   [Chat:shouldUpdateFile] Final decision: false
   [Chat] ℹ️ No file update needed - response is conversational
   ```
   **Solution**: 
   - Use update keywords in your message
   - Ask AI directly: "Please provide the complete updated specification"

3. **AI Response is Conversational**
   ```
   [Chat:shouldUpdateFile] Response is conversational? true
   ```
   **Solution**: Ask AI to provide the raw spec without conversational wrapper:
   - "Give me just the markdown spec"
   - "Output the complete specification without explanation"

4. **No Markdown Structure Detected**
   ```
   [Chat:shouldUpdateFile] Response has markdown structure? false
   ```
   **Solution**: AI didn't provide a complete spec. Ask more specifically:
   - "Provide the complete updated requirement specification"
   - "Rewrite the entire spec file with the changes"

5. **File Write Failed**
   ```
   [Chat:updateMarkdownFile] ❌ Error: ...
   ```
   **Solution**: Check file permissions, disk space, file not open elsewhere

### Issue: Logs Not Appearing

1. Make sure Output panel is open: `View → Output`
2. Select "PromptPress" from dropdown
3. Check extension is activated (modify a spec file)

### Issue: Wrong Content Extracted

```
[Chat:extractMarkdownContent] No special markers found, returning full response
```

**Solution**: Check if AI wrapped the spec in markdown code block or conversational text. Ask AI to format properly:
- "Provide the spec with YAML frontmatter"
- "Output in standard PromptPress format"

## Example Debug Session

### Scenario: User asks to update requirements but file doesn't change

```
[Chat] ========================================
[Chat] New user message received
[Chat] Artifact: game-board
[Chat] File path: /path/to/specs/game-board.req.md
[Chat] Message: can you make the board 10x10 instead?
[Chat] ========================================
[Chat] Building context...
[Chat] Context built: 1500 tokens (estimated)
[Chat] Sending request to AI...
[Chat] ✅ Received AI response: 85 characters
[Chat] Response preview: Sure! I can help you update the board size to 10x10...
[Chat] Checking if response contains file updates...
[Chat:shouldUpdateFile] Analyzing user message and AI response...
[Chat:shouldUpdateFile] User wants update? false  ← ❌ PROBLEM!
[Chat:shouldUpdateFile] Response has markdown structure? false
[Chat:shouldUpdateFile] Response is conversational? true
[Chat:shouldUpdateFile] Final decision: false
[Chat] Should update file? false
[Chat] ℹ️ No file update needed - response is conversational
```

**Diagnosis**: 
1. User message "can you make the board 10x10" doesn't contain update keywords
2. AI response is conversational, not a complete spec

**Solution**:
User should ask: "**Update** the requirements to change the board size to 10x10"

## Best Practices

### For Users

1. **Use explicit update keywords**:
   - ✅ "Update the requirements to..."
   - ✅ "Modify the design to include..."
   - ❌ "Can you change it to..."

2. **Request complete specs**:
   - ✅ "Provide the complete updated specification"
   - ❌ "Just change that one part"

3. **Monitor the Output panel** during interactions to see what's happening

### For Developers

1. **Always check logs first** before assuming a bug
2. **Look for the decision point** at `[Chat:shouldUpdateFile]`
3. **Verify file path and artifact** are set correctly
4. **Check AI response format** - is it a complete spec or just conversation?

## Future Improvements

Potential enhancements to the update system:

1. **User Confirmation**:
   - Show diff before applying update
   - Ask "Apply these changes?" button

2. **Smarter Detection**:
   - Machine learning to identify specs vs. conversation
   - Parse response structure more intelligently

3. **Partial Updates**:
   - Allow updating specific sections
   - Merge changes instead of replacing entire file

4. **Version History**:
   - Save previous versions before update
   - Allow rollback if update was incorrect

## Related Documentation

- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Running tests
- [debugging-api-errors.md](debugging-api-errors.md) - API troubleshooting
- [BUG_FIX_404.md](BUG_FIX_404.md) - Model deprecation issue

---

**Remember**: The Output panel is your friend! Always check `View → Output → PromptPress` when debugging.
