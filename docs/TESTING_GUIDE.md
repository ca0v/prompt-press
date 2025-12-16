# PromptPress Testing Guide

## Overview

PromptPress includes a lightweight, bespoke test framework designed specifically for VS Code extension testing. No external test dependencies required - just TypeScript, Node.js, and our custom framework.

## Quick Start

```bash
# Compile TypeScript
npm run compile

# Run all tests
node out/test/runner.js
```

## Test Framework Architecture

### Core Components

```
src/test/
├── framework.ts       # Core test framework (TestRunner, Assert, it/describe)
├── xaiClient.test.ts  # XAI API client tests
└── runner.ts          # Main test runner entry point
```

### Framework Features

- **Simple API**: Familiar `describe()` and `it()` syntax
- **Zero Dependencies**: Pure TypeScript implementation
- **Async Support**: Native async/await handling
- **Rich Assertions**: Multiple assertion styles
- **Clear Output**: Emoji-based indicators (✅ ❌ ⏭️)
- **Performance Tracking**: Duration for each test

## Writing Tests

### Basic Structure

```typescript
import { TestRunner, Assert, it } from './framework';

export async function runMyTests(): Promise<void> {
    const runner = new TestRunner();
    
    runner.describe('Feature Name', () => {
        it('should do something specific', () => {
            const result = myFunction();
            Assert.equal(result, expectedValue);
        });
        
        it('should handle async operations', async () => {
            const result = await myAsyncFunction();
            Assert.ok(result);
        });
    });
    
    await runner.run();
    runner.printSummary();
}
```

### Assertion Methods

#### Basic Assertions
```typescript
Assert.equal(actual, expected, 'optional message');
Assert.deepEqual(obj1, obj2);
Assert.ok(value);              // truthy
Assert.notOk(value);           // falsy
Assert.includes(array, item);
Assert.match(str, /pattern/);
```

#### Error Assertions
```typescript
// Synchronous
Assert.throws(() => {
    throw new Error('test');
}, 'expected error message');

// Asynchronous
await Assert.rejects(async () => {
    throw new Error('test');
}, /error pattern/);
```

#### Fluent Style
```typescript
import { expect } from './framework';

expect.toBe(actual, expected);
expect.toEqual(obj1, obj2);
expect.toBeTruthy(value);
expect.toBeFalsy(value);
expect.toContain(array, item);
expect.toMatch(str, /pattern/);
```

## Mock Objects

### MockOutputChannel

Simulates VS Code's OutputChannel for testing logging:

```typescript
import { MockOutputChannel } from './test-file';

const output = new MockOutputChannel();
myService.logSomething(output);

// Verify logging
Assert.ok(output.lines.length > 0);
Assert.includes(output.lines.join(''), 'expected text');
```

### MockWorkspaceConfiguration

Simulates VS Code's WorkspaceConfiguration for testing settings:

```typescript
const config = new MockWorkspaceConfiguration({
    apiEndpoint: 'https://test.api.com',
    model: 'test-model'
});

const client = new MyClient(config);
```

## Test Organization

### Suite Structure

```typescript
runner.describe('Component Name', () => {
    // Group related tests
    
    runner.describe('Feature A', () => {
        it('should handle case 1', () => { ... });
        it('should handle case 2', () => { ... });
    });
    
    runner.describe('Feature B', () => {
        it('should validate input', () => { ... });
        it('should throw on invalid input', () => { ... });
    });
});
```

### Conditional Tests

```typescript
it('should make real API call', async () => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        console.log('      ⏭️  Skipping - no API key');
        return;
    }
    
    // Test code here...
});
```

## XAI Client Test Suite

### Coverage Areas

1. **Configuration**
   - Default endpoint and model
   - Custom configuration
   - Model selection

2. **API Integration**
   - Successful requests
   - Error handling
   - Model compatibility

3. **Error Logging**
   - Output channel integration
   - Request detail logging
   - Error formatting

### Example Test Output

```
📦 XAIClient Configuration
  ✅ should use correct default API endpoint (1ms)
  ✅ should accept custom API endpoint (0ms)
  ✅ should use correct model from config (0ms)

📦 XAIClient API Endpoint Issues
  ✅ should fail with 404 when endpoint is wrong (235ms)
  ✅ should construct correct URL path (179ms)

📦 XAIClient Real API Tests
  ✅ should successfully make API call with real key (6661ms)
  ⏭️  should test deprecated model (skipped - not applicable)

📊 Test Summary: 8/8 passed
```

## Adding New Test Suites

1. **Create Test File**: `src/test/myfeature.test.ts`

```typescript
import { TestRunner, Assert, it } from './framework';

export async function runMyFeatureTests(): Promise<void> {
    const runner = new TestRunner();
    
    runner.describe('My Feature', () => {
        it('should work correctly', () => {
            Assert.ok(true);
        });
    });
    
    await runner.run();
    runner.printSummary();
}
```

2. **Update Runner**: Edit `src/test/runner.ts`

```typescript
import { runXAIClientTests } from './xaiClient.test';
import { runMyFeatureTests } from './myfeature.test';

async function main() {
    console.log('🚀 PromptPress Test Suite\n');
    
    await runXAIClientTests();
    await runMyFeatureTests();
    
    console.log('\n✅ All test suites completed\n');
}
```

3. **Compile and Run**

```bash
npm run compile
node out/test/runner.js
```

## Environment Variables

Tests respect these environment variables:

- `PROMPT_PRESS_XAI_API_KEY`: Required for real API integration tests
  - Tests skip gracefully if not set
  - Use for integration testing only

## Best Practices

### 1. Test Independence
Each test should be completely independent:
```typescript
// ❌ Bad - tests depend on each other
let sharedState;
it('test 1', () => { sharedState = 'value'; });
it('test 2', () => { Assert.equal(sharedState, 'value'); });

// ✅ Good - each test is independent
it('test 1', () => {
    const state = initializeState();
    Assert.ok(state);
});
```

### 2. Descriptive Names
Use clear, behavior-focused names:
```typescript
// ❌ Bad
it('test1', () => { ... });
it('works', () => { ... });

// ✅ Good
it('should return user data when ID is valid', () => { ... });
it('should throw error when ID is negative', () => { ... });
```

### 3. Async Handling
Always use async/await for async operations:
```typescript
// ❌ Bad - unhandled promise
it('fetches data', () => {
    fetchData().then(result => {
        Assert.ok(result);
    });
});

// ✅ Good - proper async/await
it('fetches data', async () => {
    const result = await fetchData();
    Assert.ok(result);
});
```

### 4. Error Testing
Test both success and failure paths:
```typescript
it('should succeed with valid input', async () => {
    const result = await myFunction('valid');
    Assert.ok(result);
});

it('should fail with invalid input', async () => {
    await Assert.rejects(
        () => myFunction('invalid'),
        'expected error message'
    );
});
```

### 5. Mock External Dependencies
Don't rely on real external services in unit tests:
```typescript
// ❌ Bad - real API dependency
it('should fetch user', async () => {
    const user = await api.fetchUser(123);
    Assert.ok(user);
});

// ✅ Good - mocked dependency
it('should fetch user', async () => {
    const mockApi = new MockApi();
    const user = await mockApi.fetchUser(123);
    Assert.ok(user);
});
```

## Debugging Tests

### Verbose Output
Add console.log statements for debugging:
```typescript
it('should process data', async () => {
    const input = generateTestData();
    console.log(`      Input: ${JSON.stringify(input)}`);
    
    const result = await process(input);
    console.log(`      Result: ${JSON.stringify(result)}`);
    
    Assert.ok(result);
});
```

### Isolate Failing Tests
Comment out other tests to focus on one:
```typescript
runner.describe('My Feature', () => {
    // it('test 1', () => { ... });
    // it('test 2', () => { ... });
    it('failing test', () => { ... });  // Focus here
    // it('test 4', () => { ... });
});
```

## Future Enhancements

Potential additions:
- [ ] Setup/teardown hooks (`beforeEach`, `afterEach`)
- [ ] Test fixtures and data builders
- [ ] Parallel test execution
- [ ] Code coverage reporting
- [ ] Test filtering by pattern
- [ ] Watch mode for continuous testing
- [ ] VS Code Test Explorer integration
- [ ] Snapshot testing
- [ ] Performance benchmarking

## Troubleshooting

### Tests won't compile
```bash
# Clean and rebuild
rm -rf out/
npm run compile
```

### Tests fail to import modules
Ensure all test files are in `src/test/` and follow naming convention `*.test.ts`

### Async tests timeout
Check for unhandled promises:
```typescript
// Add explicit async/await
it('should complete', async () => {
    await longRunningOperation();  // Don't forget await!
});
```

### Mock objects don't match interfaces
Update mock implementations when VS Code APIs change:
```typescript
class MockOutputChannel implements vscode.OutputChannel {
    // Ensure all interface methods are implemented
}
```

## References

- Test Framework: [src/test/framework.ts](../src/test/framework.ts)
- XAI Client Tests: [src/test/xaiClient.test.ts](../src/test/xaiClient.test.ts)
- Test Runner: [src/test/runner.ts](../src/test/runner.ts)
- Bug Fix Documentation: [BUG_FIX_404.md](BUG_FIX_404.md)
