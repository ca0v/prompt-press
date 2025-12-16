# Bug Fix: 404 Error on xAI API Calls

## Problem Summary

**Issue**: Scaffold command was failing with 404 errors when making requests to the xAI API, despite using the correct API endpoint (`https://api.x.ai/v1/chat/completions`).

**Error Message**:
```
[XAI] API Request Failed:
{
  "status": 404,
  "statusText": "Not Found",
  "errorMessage": "Request failed with status code 404",
  "url": "/chat/completions",
  "method": "post"
}
```

## Root Cause Analysis

### Investigation Process

1. **Created Bespoke Test Framework**
   - Built lightweight test framework (no external dependencies)
   - Supports async operations, assertions, and error handling
   - See [TESTING.md](TESTING.md) for details

2. **Wrote Comprehensive Tests**
   - API endpoint configuration tests
   - Real API integration tests
   - Error handling and logging tests

3. **Reproduced the Error**
   - Tests successfully reproduced the 404 error
   - Confirmed API endpoint URL construction was correct
   - Eliminated endpoint configuration as the issue

4. **Tested with curl**
   ```bash
   curl -X POST https://api.x.ai/v1/chat/completions \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"grok-beta","messages":[...]}'
   ```
   
   Response:
   ```json
   {
     "code": "Some requested entity was not found",
     "error": "The model grok-beta was deprecated on 2025-09-15..."
   }
   ```

### The Real Problem

**The default model `grok-beta` was deprecated by xAI on September 15, 2025.**

When checking available models:
```bash
curl -X GET https://api.x.ai/v1/models \
  -H "Authorization: Bearer $API_KEY"
```

Result:
```json
{
  "data": [
    {
      "id": "grok-code-fast-1",
      "created": 1755993600,
      "object": "model",
      "owned_by": "xai"
    }
  ],
  "object": "list"
}
```

**Only `grok-code-fast-1` is currently available.**

## Solution

### Code Changes

1. **Updated Default Model** ([src/ai/xaiClient.ts](src/ai/xaiClient.ts#L44))
   ```typescript
   // Before
   this.model = config.get<string>('model', 'grok-beta');
   
   // After
   this.model = config.get<string>('model', 'grok-code-fast-1');
   ```

2. **Updated package.json Configuration** ([package.json](package.json))
   ```json
   {
     "promptpress.model": {
       "type": "string",
       "default": "grok-code-fast-1",
       "description": "AI Model to use (currently available: grok-code-fast-1; deprecated: grok-beta, grok-2-1212, grok-vision-beta)"
     }
   }
   ```

3. **Added Test for Deprecated Models**
   - Tests now verify graceful handling of deprecated models
   - Tests confirm successful API calls with `grok-code-fast-1`

### Documentation Updates

Updated all references to xAI models in:
- [docs/quick-start.md](docs/quick-start.md)
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- [BUILD_SUMMARY.md](BUILD_SUMMARY.md)
- [docs/debugging-api-errors.md](docs/debugging-api-errors.md)

## Test Results

After applying the fix, all tests pass:

```
🚀 PromptPress Test Suite

📦 XAIClient Configuration
  ✅ should use correct default API endpoint (1ms)
  ✅ should accept custom API endpoint (0ms)
  ✅ should use correct model from config (0ms)

📦 XAIClient API Endpoint Issues
  ✅ should fail with 404 when endpoint is wrong (235ms)
  ✅ should construct correct URL path (179ms)

📦 XAIClient Real API Tests
  ✅ should successfully make API call with real key and grok-code-fast-1 (6661ms)
  ✅ should work with grok-code-fast-1 model (3169ms)
  ✅ should fail gracefully with deprecated model (67ms)

📦 XAIClient Error Handling
  ✅ should log errors to output channel (243ms)
  ✅ should include request details in error logs (1740ms)

📊 Test Summary: 10/10 passed
```

## Impact

### Who's Affected
Users who:
- Used the default configuration (didn't explicitly set `promptpress.model`)
- Had `promptpress.model` set to `grok-beta`, `grok-2-1212`, or `grok-vision-beta`

### Who's Not Affected
Users who:
- Already configured `promptpress.model` to `grok-code-fast-1`
- Were not using the extension yet

### Migration Path

**For existing users:**
1. Update to the latest version
2. Check your settings:
   ```json
   {
     "promptpress.model": "grok-code-fast-1"
   }
   ```
3. Or remove the setting to use the new default

**For new users:**
- No action needed - the default is now correct

## Lessons Learned

1. **Test-Driven Debugging is Effective**
   - Building a test suite first helped isolate the problem
   - Reproducible tests made verification straightforward

2. **External API Changes Need Monitoring**
   - xAI deprecated models without warning in our codebase
   - Need to periodically verify model availability

3. **Good Logging is Critical**
   - Enhanced logging revealed the full error details
   - Output channel integration made debugging easier

4. **Documentation Must Stay Current**
   - Deprecated model references existed in multiple docs
   - Systematic update process needed

## Future Improvements

1. **Model Discovery**
   - Add command to list available models from API
   - Cache model list with periodic refresh

2. **Better Error Messages**
   - Detect "model not found" vs true 404 errors
   - Suggest available models in error message

3. **Configuration Validation**
   - Validate model selection against available models
   - Provide warnings for deprecated models

4. **Automated Testing**
   - Add CI/CD pipeline to run tests on every commit
   - Periodic tests against real API to catch deprecations

## References

- xAI API: https://api.x.ai/v1
- Test Framework: [src/test/framework.ts](src/test/framework.ts)
- Test Suite: [src/test/xaiClient.test.ts](src/test/xaiClient.test.ts)
- Testing Guide: [TESTING.md](TESTING.md)
