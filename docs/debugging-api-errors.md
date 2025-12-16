# Debugging API Errors

## Viewing Logs

All PromptPress activity is logged to the Output panel:

1. **Open Output Panel**: View → Output (or `Ctrl+Shift+U`)
2. **Select Channel**: Choose "PromptPress" from dropdown
3. **See detailed logs**: All API requests, responses, and errors

## Common Errors

### "Request failed with status"

This means the API returned an error. Check the Output panel for:

```
[XAI] API Request Failed: {
  status: 401,
  statusText: "Unauthorized",
  data: { error: { message: "Invalid API key" } }
}
[XAI] Request payload: { ... }
```

**Solutions**:
- **401 Unauthorized**: API key is invalid or expired
- **403 Forbidden**: API key doesn't have access to the endpoint
- **429 Too Many Requests**: Rate limit exceeded, wait and retry
- **500 Server Error**: xAI service issue, retry later

### Invalid API Key

```
[WARN] PromptPress: No API key configured
```

**Fix**:
```bash
# Check environment variable
echo $PROMPT_PRESS_XAI_API_KEY

# Or set in VS Code settings
Ctrl+, → Search "PromptPress" → Set API Key
```

### Network/Timeout Errors

```
[ERROR] [XAI] Unexpected error: timeout of 60000ms exceeded
```

**Fix**:
- Check internet connection
- Verify xAI API is accessible: https://api.x.ai
- Try again (may be temporary network issue)

## Detailed Request Logging

When a request fails, you'll see:

```
[Scaffold] Generating requirement for artifact: my-feature
[Scaffold] Description length: 150 chars
[Scaffold] Sending 2 messages to AI for requirement generation
[XAI] Sending chat completion request: {
  model: "grok-beta",
  messageCount: 2,
  temperature: 0.7,
  maxTokens: 4000
}
[XAI] API Request Failed: {
  status: 400,
  statusText: "Bad Request",
  data: {
    error: {
      message: "Invalid request: model not found",
      type: "invalid_request_error"
    }
  },
  requestUrl: "/chat/completions",
  requestMethod: "post"
}
[XAI] Request payload: {
  "model": "grok-beta",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert..."
    },
    {
      "role": "user",
      "content": "Generate a requirement..."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 4000,
  "stream": false
}
[Scaffold] Requirement generation failed: Error: xAI API Error: Invalid request: model not found (Status: 400)
```

## Testing API Connectivity

### Manual curl test
```bash
curl -X POST https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $PROMPT_PRESS_XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-beta",
    "messages": [{"role": "user", "content": "test"}]
  }'
```

### Check available models
```bash
curl https://api.x.ai/v1/models \
  -H "Authorization: Bearer $PROMPT_PRESS_XAI_API_KEY"
```

## Log Interpretation

### Successful Request
```
[XAI] Sending chat completion request: { model: "grok-beta", ... }
[XAI] Received response: {
  finishReason: "stop",
  promptTokens: 450,
  completionTokens: 1200
}
[Scaffold] Requirement spec generated (5432 chars)
```

### Failed Request - API Key Issue
```
[XAI] API Request Failed: {
  status: 401,
  statusText: "Unauthorized"
}
```
→ Check your API key

### Failed Request - Model Issue
```
[XAI] API Request Failed: {
  status: 404,
  data: { error: { message: "model not found" } }
}
```
→ Check model name in settings. Currently available: `grok-code-fast-1`. Deprecated (as of 2025-09-15): `grok-beta`, `grok-2-1212`, `grok-vision-beta`

### Failed Request - Rate Limit
```
[XAI] API Request Failed: {
  status: 429,
  data: { error: { message: "Rate limit exceeded" } }
}
```
→ Wait a few minutes and try again

## Enabling More Verbose Logging

The extension now logs:
- ✅ Extension activation
- ✅ Configuration loading
- ✅ File watcher events
- ✅ Scaffold operations start/end
- ✅ API requests (metadata only, not full messages)
- ✅ API responses (success/failure)
- ✅ Full error details including payloads
- ✅ Token usage

## Configuration Check

View current configuration in Output panel:
```
[INFO] API key configured
[INFO] API endpoint: https://api.x.ai/v1
[INFO] Model: grok-beta
[INFO] Max context tokens: 8000
```

## Reporting Issues

If you encounter persistent errors:

1. ✅ Check Output panel (View → Output → PromptPress)
2. ✅ Copy the relevant log section showing the error
3. ✅ Note what command you ran
4. ✅ Note what input you provided
5. ✅ Include the full error message

Example bug report:
```
Command: Scaffold New Artifact
Input: artifact-name: "test-feature", description: "A test feature"

Error from Output panel:
[XAI] API Request Failed: {
  status: 500,
  statusText: "Internal Server Error",
  data: { error: { message: "Service temporarily unavailable" } }
}

Expected: Should generate requirement and design specs
Actual: Failed with 500 error
```

## Quick Fixes

### Clear state and retry
```
1. Close VS Code
2. Delete .vscode/ folder (if exists)
3. Reopen workspace
4. Try again
```

### Verify API key format
```bash
# Should be a long string starting with "xai-"
echo $PROMPT_PRESS_XAI_API_KEY | head -c 10
# Output should be: xai-...
```

### Test with minimal example
```
Command: Scaffold New Artifact
Name: test
Description: A simple test feature

If this works, your API is fine.
If this fails, check API key and network.
```

## Advanced: Enable TypeScript Source Maps

For development debugging:
```bash
# In launch.json
{
  "outFiles": ["${workspaceFolder}/out/**/*.js"],
  "sourceMaps": true
}
```

This lets you set breakpoints in TypeScript source files.
