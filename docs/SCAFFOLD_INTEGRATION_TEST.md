# Scaffold Integration Test with Response Caching

## Overview

This integration test generates a complete Game of Life project (requirement, design, and implementation specifications) using the xAI API, with intelligent response caching to avoid redundant API calls.

## Files

- **Test**: [src/test/scaffold-integration.test.ts](../src/test/scaffold-integration.test.ts)
- **Cache**: `test-cache.json` (auto-generated)
- **Output**: `test-output/` directory (auto-generated)

## Running the Test

```bash
# Run standard tests only
npm test

# Run scaffold integration test
node out/test/runner.js scaffold

# Or compile and run
npm run compile && node out/test/runner.js scaffold
```

## How It Works

### Response Caching System

The test implements a simple but effective caching system:

```typescript
class ResponseCache {
    - Stores API request/response pairs in test-cache.json
    - Generates stable keys from model + message content hash
    - Loads cache on startup, saves after each new response
    - Provides size() method to check cache status
}
```

### Cache Key Generation

```typescript
generateKey(model, messages) {
    // Create stable hash from model and first 100 chars of each message
    const content = messages.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
    return `${model}:${hashString(content)}`;
}
```

### Test Flow

```
1. Load cache from test-cache.json
2. Generate Requirement Spec
   ├─ Check cache → Cache miss → Make API call → Save to cache
   └─ Save to test-output/game-of-life.req.md
3. Generate Design Spec (uses requirement as context)
   ├─ Check cache → Cache miss → Make API call → Save to cache
   └─ Save to test-output/game-of-life.design.md
4. Generate Implementation Spec (uses requirement + design)
   ├─ Check cache → Cache miss → Make API call → Save to cache
   └─ Save to test-output/game-of-life.impl.md
5. Second test run: All responses from cache (no API calls!)
```

## Test Output

### First Run (No Cache)
```
[Cache] No existing cache found, starting fresh
[Test] Step 1: Generating requirement specification...
[Cache] ❌ Cache miss - making real API call
[XAI] Sending chat completion request: model=grok-code-fast-1, messages=2
[XAI] Received response: finishReason=stop, promptTokens=409, completionTokens=936
[Cache] Saved 1 responses to cache
[Test] ✅ Requirement generated: 4324 characters

[Test] Step 2: Generating design specification...
[Cache] ❌ Cache miss - making real API call
[XAI] Sending chat completion request: model=grok-code-fast-1, messages=2
[Cache] Saved 2 responses to cache
[Test] ✅ Design generated: 8320 characters

[Test] Step 3: Generating implementation specification...
[Cache] ❌ Cache miss - making real API call
[Cache] Saved 3 responses to cache
[Test] ✅ Implementation generated: 8259 characters

[Test] ✅ Complete scaffold generated successfully!
  ✅ should scaffold complete game-of-life project with caching (58808ms)
```

**Cost**: 3 API calls, ~60 seconds

### Second Run (With Cache)
```
[Cache] Loaded 3 cached responses
[Test] Step 1: Generating requirement specification...
[Cache] ✅ Cache hit - returning cached response
[Test] ✅ Requirement generated: 4324 characters

[Test] Step 2: Generating design specification...
[Cache] ✅ Cache hit - returning cached response
[Test] ✅ Design generated: 8320 characters

[Test] Step 3: Generating implementation specification...
[Cache] ✅ Cache hit - returning cached response
[Test] ✅ Implementation generated: 8259 characters

[Test] ✅ Complete scaffold generated successfully!
  ✅ should scaffold complete game-of-life project with caching (5ms)
```

**Cost**: 0 API calls, ~5 milliseconds

## Generated Files

### Structure
```
test-output/
├── game-of-life.req.md        # 4.3 KB - Requirement specification
├── game-of-life.design.md     # 8.2 KB - Design specification
└── game-of-life.impl.md       # 8.1 KB - Implementation specification

test-cache.json                 # 21 KB - Cached API responses
```

### Requirement Spec (Preview)
```yaml
---
artifact: game-of-life
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-16
---

# Game of Life - Requirements

## Overview
Web-based implementation of Conway's Game of Life...

## Functional Requirements
- FR-1: Grid Visualization
- FR-2: Simulation Controls
- FR-3: Cell Interaction
- FR-4: Pattern Library
- FR-5: Grid Size Configuration
- FR-6: Save/Load Functionality
- FR-7: Rule Customization
- FR-8: Performance Monitoring

## Non-Functional Requirements
- NFR-1: Performance (30+ FPS on 1000x1000 grids)
- NFR-2: Scalability
- NFR-3: Usability
- NFR-4: Accessibility (WCAG 2.1 AA)
- NFR-5: Security
```

## Cache File Format

```json
{
  "grok-code-fast-1:abc123def": "---\nartifact: game-of-life\nphase: requirement\n...",
  "grok-code-fast-1:xyz789ghi": "---\nartifact: game-of-life\nphase: design\n...",
  "grok-code-fast-1:mno456pqr": "---\nartifact: game-of-life\nphase: implementation\n..."
}
```

Each key is a hash of model + message content, ensuring stable caching across runs.

## Test Assertions

The test validates:

1. **Structure Validation**
   - ✅ Has YAML frontmatter (`---`)
   - ✅ Has `artifact:` field
   - ✅ Has correct `phase:` field
   - ✅ Has required sections (Functional Requirements, etc.)

2. **File Generation**
   - ✅ All three files created successfully
   - ✅ Files exist on disk
   - ✅ Files have substantial content

3. **Cache Effectiveness**
   - ✅ Cache size increases after first run
   - ✅ Cache size unchanged on subsequent runs
   - ✅ Cached responses are valid and complete

## Benefits

### 1. Cost Savings
- **First run**: 3 API calls (~$0.03 at current rates)
- **Subsequent runs**: 0 API calls ($0.00)
- **Total savings**: 100% after first run

### 2. Speed
- **First run**: ~60 seconds (limited by API latency)
- **Subsequent runs**: ~5 milliseconds (12,000x faster!)

### 3. Reliability
- Tests work offline after initial run
- No network dependency for repeated testing
- Consistent results across runs

### 4. Development Efficiency
- Rapid iteration during test development
- No waiting for API during debugging
- Easy to share test results (commit cache file)

## Advanced Usage

### Clear Cache
```bash
rm test-cache.json
```

### View Cache Contents
```bash
cat test-cache.json | jq .
```

### Cache Statistics
```bash
cat test-cache.json | jq 'to_entries | map(.value | length) | {count: length, total_bytes: add, avg_bytes: (add / length)}'
```

### Generate New Artifact
Modify the prompts in the test file to generate different artifacts:
```typescript
const userPrompt = `Generate a requirement specification for:

Your new artifact description here...`;
```

## Testing Different Scenarios

### Test Without API Key (Cache Required)
```bash
unset PROMPT_PRESS_XAI_API_KEY
node out/test/runner.js scaffold
```

Output:
```
[Cache] Loaded 3 cached responses
✅ All tests pass using only cached data
```

### Test With Fresh Cache
```bash
rm test-cache.json
node out/test/runner.js scaffold
```

Output:
```
[Cache] No existing cache found, starting fresh
[Cache] ❌ Cache miss - making real API call (x3)
[Cache] Saved 3 responses to cache
```

## Integration with CI/CD

### Commit Cache File
```bash
git add test-cache.json
git commit -m "Add test cache for CI/CD"
```

### CI Configuration
```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test
  env:
    # No API key needed - uses cache!
    SKIP_API_TESTS: false
```

Benefits:
- ✅ CI runs without API key
- ✅ No external dependencies
- ✅ Fast test execution
- ✅ Predictable results

## Limitations

1. **Cache Invalidation**: Cache persists forever unless manually deleted
2. **Prompt Changes**: Modifying prompts generates new cache keys
3. **Model Changes**: Different models create different cache keys
4. **Hash Collisions**: Extremely rare but theoretically possible

## Future Enhancements

Potential improvements:

- [ ] TTL (time-to-live) for cache entries
- [ ] Cache compression (gzip)
- [ ] Multiple cache files per artifact type
- [ ] Cache diff viewer
- [ ] Automatic cache cleanup (remove old entries)
- [ ] Cache warming (pre-populate common patterns)

## Troubleshooting

### Issue: "No API key and no cache"
```
⏭️ Skipping - no API key and no cache
```
**Solution**: Either set `PROMPT_PRESS_XAI_API_KEY` or ensure `test-cache.json` exists

### Issue: Test runs slowly despite cache
**Solution**: Check logs - if seeing "Cache miss", prompts may have changed

### Issue: Cache file is huge
**Solution**: This is normal - each response is 4-8KB. Consider committing compressed version:
```bash
gzip -k test-cache.json
git add test-cache.json.gz
```

## Related Documentation

- [TESTING_GUIDE.md](TESTING_GUIDE.md) - General testing guide
- [TEST_FRAMEWORK_SUMMARY.md](../TEST_FRAMEWORK_SUMMARY.md) - Test framework overview
- [BUG_FIX_404.md](BUG_FIX_404.md) - API configuration guide

---

**Pro Tip**: Commit `test-cache.json` to your repo for zero-cost CI/CD testing!
