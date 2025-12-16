# Quick Debug Checklist - Chat File Updates

## 🔍 Is the file updating?

### Step 1: Check Output Panel
```
View → Output → Select "PromptPress" from dropdown
```

### Step 2: Look for this log sequence

```
✅ SUCCESSFUL UPDATE:
[Chat] New user message received
[Chat] Artifact: your-artifact-name              ← Has artifact name?
[Chat] File path: /path/to/file.req.md          ← Has file path?
[Chat:shouldUpdateFile] Final decision: true    ← Decision is TRUE?
[Chat:updateMarkdownFile] ✅ File write successful

❌ NO UPDATE - Missing Artifact/File:
[Chat] ❌ Error: No artifact or file path available
→ SOLUTION: Open or modify a spec file first

❌ NO UPDATE - Decision is False:
[Chat:shouldUpdateFile] Final decision: false
→ CHECK WHY:
  [Chat:shouldUpdateFile] User wants update? false    ← Add update keyword!
  [Chat:shouldUpdateFile] Response has markdown structure? false  ← Ask for complete spec!
  [Chat:shouldUpdateFile] Response is conversational? true  ← Ask for raw spec!
```

## 💬 Message Examples

### ✅ GOOD - Will Update File
```
"update the requirements"
"modify the design to include X"
"change FR-1 to say Y"
"add a new section about Z"
"fix the implementation"
"rewrite the overview"
```

### ❌ BAD - Won't Update File
```
"what are the requirements?"
"can you help me with the design?"
"is this correct?"
"explain the architecture"
```

## 🔧 Quick Fixes

### Problem: `User wants update? false`
**Fix**: Add an update keyword to your message:
- "update the spec to..."
- "modify section X"
- "change the requirements"

### Problem: `Response has markdown structure? false`
**Fix**: Ask AI for complete specification:
- "Provide the complete updated specification"
- "Give me the full markdown file"
- "Output the entire spec with YAML frontmatter"

### Problem: `Response is conversational? true`
**Fix**: Ask AI for raw spec without explanation:
- "Just give me the spec, no explanation"
- "Output only the markdown"
- "Provide the specification without commentary"

### Problem: No artifact or file path
**Fix**: 
1. Open a spec file from `specs/` directory
2. Or create a new one and save it
3. Then open chat and try again

## 📝 Log Template

Copy this and fill in what you see:

```
Artifact: ________________
File path: ________________
User wants update? ________________
Response has markdown structure? ________________
Response is conversational? ________________
Final decision: ________________
File write successful? ________________
```

If Final decision = false, fix the issue above it.

## 🎯 Expected Flow

```
1. Open spec file                    ← File must be in specs/ directory
2. Open PromptPress Chat            ← Command Palette
3. Type message with update keyword  ← "update", "modify", "change", etc.
4. Wait for AI response             ← Watch Output panel
5. File automatically updates       ← Check file content changed
6. See notification                 ← "Updated [filename]"
7. See chat message                 ← "✅ File updated: [artifact]"
```

## 🚨 Common Mistakes

1. **Forgetting update keyword** → "Can you make it 5x5?" ❌
   - Fix: "Update the board to 5x5" ✅

2. **Asking questions** → "What should the size be?" ❌
   - Fix: "Change the size to 10x10" ✅

3. **No file open** → Chat works but no artifact ❌
   - Fix: Open a spec file first ✅

4. **AI is too chatty** → Response is conversational ❌
   - Fix: "Give me just the spec" ✅

## 📊 Success Indicators

Look for these in Output panel:

```
✅ [Chat] Artifact: your-artifact
✅ [Chat] File path: /path/to/file.md
✅ [Chat:shouldUpdateFile] Final decision: true
✅ [Chat:updateMarkdownFile] ✅ File write successful
✅ [Chat] ✅ File updated successfully
```

Look for these in VS Code:

```
✅ Notification: "Updated your-artifact.req.md"
✅ Chat message: "✅ File updated: your-artifact"
✅ File content actually changed (check the file!)
```

## 🆘 Still Not Working?

1. **Copy entire log output** from Output panel
2. **Check file permissions** - can you manually edit the file?
3. **Check file location** - is it in `specs/` directory?
4. **Restart VS Code** - reload window
5. **Check API key** - is it configured?

## 📚 Full Documentation

- [CHAT_DEBUGGING.md](docs/CHAT_DEBUGGING.md) - Complete debugging guide
- [FILE_UPDATE_IMPLEMENTATION.md](FILE_UPDATE_IMPLEMENTATION.md) - Technical details

---

**Quick Test**: Send "update the requirements to add a test item" and watch Output panel!
