# Apply Changes Feature

## Overview

The "Apply Changes" feature automatically detects modifications in specification files and cascades them through the SDLC phases (requirement → design → implementation), using AI to regenerate dependent specifications while preserving structure and incorporating the changes.

## Purpose

When working with PromptPress specs, requirements evolve. Rather than manually regenerating design and implementation files, the Apply Changes feature:
- Detects what changed in your spec file
- Summarizes the modifications
- Regenerates dependent specs with AI, emphasizing the changes
- Maintains proper YAML frontmatter and markdown structure
- Preserves conversation history and traceability

## How It Works

### Change Detection

The service uses **baseline caching** to detect changes:

1. **First Time**: When you first use Apply Changes on a file, it creates a baseline in `.promptpress/cache/<filename>.baseline`
2. **Subsequent Uses**: Compares current file content with baseline to detect changes
3. **Fallback**: If no baseline exists, attempts to use `git diff` against HEAD
4. **Section-Level Detection**: Identifies which markdown sections (## headings) were modified

### Cascading Logic

Changes cascade based on the phase of the modified file:

#### From Requirement → Design → Implementation
When you modify a **requirement** file:
1. Detects which sections changed (e.g., "Functional Requirements", "Overview")
2. Regenerates **design** spec with prompts emphasizing the changes
3. If implementation exists, regenerates it based on updated design
4. Updates both files automatically

#### From Design → Implementation
When you modify a **design** file:
1. Detects which sections changed (e.g., "Architecture Overview", "Component Design")
2. Reads the corresponding requirement file for context
3. Regenerates **implementation** spec with emphasis on design changes
4. Updates implementation file automatically

### AI Prompts

The service uses prompts similar to the integration test:

**For Design Generation**:
```
IMPORTANT: The requirements have been updated. Changes: <summary>
Modified sections: <list>

Your design MUST address these changes and integrate them properly.

Generate an updated design specification that incorporates these changes...
```

**For Implementation Generation**:
```
IMPORTANT: The design has been updated. Changes: <summary>
Modified sections: <list>

Your implementation MUST include precise instructions for implementing these changes.

Generate complete implementation specification...
```

These prompts ensure the AI focuses on integrating changes while preserving existing functionality.

## Usage

### Command Palette

1. Open a `.req.md` or `.design.md` file
2. Make your changes (modify sections, add requirements, etc.)
3. Save the file
4. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
5. Run: **"PromptPress: Apply Changes"**

### What Happens Next

1. **Change Detection Dialog**:
   ```
   Cascade changes from game-of-life.requirement?
   
   Changes: Modified 2 section(s), added 15 line(s)
   Modified sections: Overview, Functional Requirements
   
   This will regenerate dependent specifications.
   
   [Proceed] [Cancel]
   ```

2. **Processing**:
   - Service calls xAI API to regenerate specs
   - Shows progress in Output panel (View → Output → PromptPress)
   - Logs all operations with `[Cascade]` prefix

3. **Completion**:
   ```
   Successfully cascaded changes to 2 file(s)
   ```

4. **Output**:
   - Updated design file (if exists)
   - Updated implementation file (if exists)
   - Baseline cache updated
   - Files open in editor for review

### Example Workflow

**Scenario**: Adding multiplayer feature to Game of Life

1. **Modify Requirement**:
   ```markdown
   ## Overview
   This requirement specification outlines the development of a web-based 
   implementation of Conway's Game of Life with **multiplayer collaboration 
   and real-time synchronization** features...
   ```

2. **Run Apply Changes** → Service detects:
   - Modified section: "Overview"
   - Summary: "Modified 1 section(s), added 12 line(s)"

3. **AI Regenerates Design**:
   - Updates Architecture Overview for client-server model
   - Adds new components: `MultiplayerSync`, `ServerSessionManager`
   - Includes WebSocket APIs for real-time sync

4. **AI Regenerates Implementation**:
   - Adds server directory with Express + Socket.IO
   - Includes `useMultiplayer` hook, `socketService`
   - Provides detailed implementation instructions

5. **Review Changes**: All files updated, structure preserved, multiplayer integrated

## File Structure

The service creates a cache directory for change tracking:

```
.promptpress/
└── cache/
    ├── game-of-life.req.md.baseline
    ├── game-of-life.design.md.baseline
    └── game-of-life.impl.md.baseline
```

**Note**: Add `.promptpress/cache/` to `.gitignore` - these are local working files.

## Output Channel Logs

All operations are logged to the "PromptPress" output channel:

```
[Cascade] Starting change detection for game-of-life.req.md
[Cascade] Changes detected in sections: Overview, Functional Requirements
[Cascade] Summary: Modified 2 section(s), added 15 line(s)
[Cascade] Regenerating design specification...
[Cascade] Calling AI to generate updated design...
[XAI] Sending chat completion request: model=grok-code-fast-1, messages=2
[XAI] Received response: finishReason=stop, promptTokens=858, completionTokens=1483
[Cascade] ✅ Updated game-of-life.design.md
[Cascade] Regenerating implementation specification...
[Cascade] Calling AI to generate updated implementation...
[XAI] Sending chat completion request: model=grok-code-fast-1, messages=2
[XAI] Received response: finishReason=stop, promptTokens=833, completionTokens=2430
[Cascade] ✅ Updated game-of-life.impl.md
[Cascade] Updated baseline cache for game-of-life.req.md
```

## Configuration

Uses existing PromptPress settings:

- `promptpress.apiKey`: xAI API key
- `promptpress.model`: AI model (default: `grok-code-fast-1`)
- `promptpress.apiEndpoint`: API endpoint (default: `https://api.x.ai/v1`)

## Limitations

### Current Version

1. **Phase Restriction**: Only cascades from requirement or design phases
   - Cannot cascade from implementation (leaf node)
   - Cannot cascade backwards (impl → design)

2. **File Discovery**: Expects standard naming convention:
   - `<artifact>.req.md` - Requirement
   - `<artifact>.design.md` - Design
   - `<artifact>.impl.md` - Implementation

3. **No Diff Preview**: Overwrites files directly after confirmation
   - Future: Show side-by-side diff before writing
   - Workaround: Use git to review changes after

4. **Single File Focus**: Operates on one artifact at a time
   - Does not cascade across multiple artifacts
   - Future: Support multi-artifact cascades via dependency graph

5. **No Undo**: Once confirmed, changes are written
   - Workaround: Use git to revert
   - Future: Maintain local history

### Known Issues

1. **First-Run Behavior**: If no baseline exists and not in git:
   - Treats entire file as changes
   - May generate verbose "what changed" prompts
   - Workaround: Run Apply Changes once to establish baseline

2. **Large Changes**: If many sections modified:
   - AI may not emphasize all changes equally
   - Context window limits may truncate requirement/design text
   - Workaround: Make incremental changes

3. **Concurrent Edits**: If file changes during cascade:
   - May overwrite unsaved changes
   - Workaround: Save all files before running command

## Comparison to Manual Workflow

### Before (Manual)

1. Modify `game-of-life.req.md`
2. Open Command Palette → "Scaffold Artifact" → Manually type changes
3. Regenerate design (loses previous content)
4. Repeat for implementation
5. **Time**: 5-10 minutes per artifact

### After (Apply Changes)

1. Modify `game-of-life.req.md`
2. Run "Apply Changes" → Confirm
3. **Time**: 30-60 seconds (automated)

**Efficiency Gain**: 10x faster, preserves structure, maintains traceability

## Integration with Testing

The Apply Changes feature uses the same prompt engineering as the integration test:

- **Test**: [src/test/scaffold-integration.test.ts](../src/test/scaffold-integration.test.ts) - `"should cascade requirement changes through design and implementation"`
- **Service**: [src/services/cascadeService.ts](../src/services/cascadeService.ts)
- **Helpers**: `generateDesignWithModification()`, `generateImplementationWithModification()`

This ensures consistency between test validation and production behavior.

## Future Enhancements

### Planned Features

1. **Diff Preview**:
   - Show side-by-side comparison before writing
   - Allow selective acceptance of changes (section-by-section)

2. **Multi-Artifact Cascade**:
   - Detect dependency graph from `depends-on` YAML field
   - Cascade changes across multiple related artifacts
   - Example: Update core-lib.req → cascade to all dependent apps

3. **Smart Baseline Management**:
   - Auto-update baseline after successful cascade
   - Provide "Reset Baseline" command
   - Sync baselines across team via git

4. **Change Analytics**:
   - Track which sections change most frequently
   - Identify unstable requirements
   - Generate change reports

5. **Undo/Redo**:
   - Maintain local history of cascaded changes
   - Provide "Revert Last Cascade" command

6. **Partial Cascade**:
   - Cascade to design only (skip implementation)
   - Cascade specific sections only
   - Ask before each phase

## Troubleshooting

### "No changes detected"

**Cause**: Current content matches baseline
**Solution**: 
- Make substantive changes to markdown sections
- Or run with fresh baseline: Delete `.promptpress/cache/<file>.baseline`

### "Cannot cascade from design without requirement file"

**Cause**: Design file exists but corresponding requirement missing
**Solution**:
- Ensure `<artifact>.req.md` exists in same directory
- Or scaffold complete artifact first

### "Failed to parse metadata"

**Cause**: Invalid YAML frontmatter
**Solution**:
- Check YAML syntax (proper indentation, no tabs)
- Ensure required fields: `artifact`, `phase`
- Example:
  ```yaml
  ---
  artifact: my-artifact
  phase: requirement
  depends-on: []
  references: []
  version: 1.0.0
  ---
  ```

### API Errors

**Cause**: xAI API issues (rate limit, invalid key, network)
**Solution**:
- Check Output panel for `[XAI]` logs
- Verify API key in settings
- Check network connectivity
- See [docs/BUG_FIX_404.md](../docs/BUG_FIX_404.md) for model issues

## Related Documentation

- [Cascade Test Implementation](CASCADE_TEST.md) - Integration test details
- [Scaffold Integration Test](SCAFFOLD_INTEGRATION_TEST.md) - Complete scaffolding workflow
- [Testing Guide](TESTING_GUIDE.md) - Running tests
- [README](../README.md) - PromptPress overview

## API Reference

### CascadeService

**Constructor**:
```typescript
constructor(
    xaiClient: XAIClient,
    outputChannel: vscode.OutputChannel,
    workspaceRoot: string
)
```

**Main Method**:
```typescript
async applyChanges(filePath: string): Promise<CascadeResult>
```

**Result**:
```typescript
interface CascadeResult {
    success: boolean;
    updatedFiles: string[];
    errors: string[];
}
```

### Change Detection

**Internal Methods**:
- `detectChanges()` - Compare with baseline or git
- `compareContent()` - Section-level diff
- `findModifiedSections()` - Extract changed markdown sections
- `generateChangeSummary()` - Create human-readable summary

### Cascade Methods

- `cascadeFromRequirement()` - Req → Design → Impl
- `cascadeFromDesign()` - Design → Impl
- `generateDesignWithModification()` - AI call for design
- `generateImplementationWithModification()` - AI call for impl

## Summary

The Apply Changes feature brings the power of the cascade integration test to everyday development:

✅ **Automatic**: Detects changes, no manual prompting
✅ **Smart**: Section-level change detection
✅ **Fast**: 30-60 seconds vs 5-10 minutes manual
✅ **Consistent**: Uses proven prompt engineering from tests
✅ **Traceable**: Logs all operations, updates baselines
✅ **Structure-Preserving**: Maintains YAML frontmatter and phases

Use Apply Changes whenever you modify requirements or design specs to keep your entire artifact hierarchy synchronized!
