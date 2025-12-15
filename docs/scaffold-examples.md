# Scaffold Command Examples

## Example 1: Simple Feature

**Command**: `PromptPress: Scaffold New Artifact`

**Input**:
- Artifact name: `shopping-cart`
- Description: `Shopping cart functionality with add/remove items, quantity updates, and price calculation. Should persist cart across sessions.`

**Generated**: 
- `specs/requirements/shopping-cart.req.md`
- `specs/design/shopping-cart.design.md`

## Example 2: Using README Context

**Setup**: Your README.md contains:
```markdown
# E-commerce Platform

We're building a modern e-commerce platform with:
- Microservices architecture
- React frontend
- Node.js backend
- PostgreSQL database
- Redis for caching
```

**Command**: `PromptPress: Scaffold New Artifact`

**Input**:
- Artifact name: `payment-processor`
- Description: `see README.md - payment processing service with Stripe integration`

**Result**: AI generates specs aligned with your microservices architecture using Node.js and integrating with your existing system.

## Example 3: Complex System Component

**Command**: `PromptPress: Scaffold New Artifact`

**Input**:
- Artifact name: `real-time-analytics`
- Description: `Real-time analytics engine that processes user events from Kafka, aggregates metrics using time windows, stores results in ClickHouse, and exposes metrics via WebSocket API. Should handle 10k+ events per second with < 100ms latency.`

**Generated**: Detailed specs with:
- Kafka consumer configuration
- Time window aggregation logic
- ClickHouse schema
- WebSocket API design
- Performance requirements
- Scalability considerations

## Example 4: Scaffolding a New Project

**Scenario**: Starting completely fresh

```bash
# 1. Create project directory
mkdir my-awesome-project
cd my-awesome-project
code .

# 2. In VS Code, run: PromptPress: Scaffold New Project
# Creates complete folder structure

# 3. Create README.md describing your project
cat > README.md << 'EOF'
# My Awesome Project
A task management system with teams, projects, and real-time collaboration.
EOF

# 4. Scaffold first artifact
# Command: PromptPress: Scaffold New Artifact
# Name: task-management-core
# Description: see README.md - core task CRUD operations

# 5. Review and refine generated specs

# 6. Scaffold more artifacts
# - team-collaboration
# - real-time-sync
# - notification-system
```

## Example 5: API Service

**Command**: `PromptPress: Scaffold New Artifact`

**Input**:
- Artifact name: `weather-api-client`
- Description: `TypeScript client for OpenWeather API with methods for current weather, 5-day forecast, and air quality. Include rate limiting, caching, error handling, and retry logic. Type-safe responses.`

**Generated specs include**:
- API interface definitions
- Rate limiting strategy
- Cache configuration
- Error handling approach
- TypeScript type definitions
- Retry policy details

## Example 6: Iterative Scaffolding

```bash
# Start with high-level component
Command: Scaffold New Artifact
Name: user-management
Desc: Complete user management system

# Review, then break down into smaller artifacts:

Command: Scaffold New Artifact  
Name: user-authentication
Desc: Authentication subsystem from @ref:user-management.req

Command: Scaffold New Artifact
Name: user-profile
Desc: User profile management from @ref:user-management.req

Command: Scaffold New Artifact
Name: user-permissions
Desc: Role-based permissions from @ref:user-management.req
```

## Tips from Examples

1. **Be specific about tech stack** if you have preferences
2. **Mention performance requirements** explicitly  
3. **Reference existing components** to maintain consistency
4. **Use README.md** for complex project context
5. **Break down large systems** into multiple artifacts
6. **Iterate**: Scaffold quickly, refine through chat

## What to Do After Scaffolding

1. ✅ **Review** AI-generated specs
2. ✅ **Open chat** and discuss improvements
3. ✅ **Add clarifications** with `[AI-CLARIFY:]` markers
4. ✅ **Link dependencies** using `@ref:`
5. ✅ **Update metadata** (depends-on, references)
6. ✅ **Create implementation** spec when ready
7. ✅ **Generate code** from implementation spec
