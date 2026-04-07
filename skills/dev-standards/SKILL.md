---
name: dev-standards
description: >
  Human-AI collaborative development standards and Clean Architecture conventions.
  This skill is automatically loaded when writing, reviewing, or modifying code.
  Defines coding standards, comment conventions, architecture patterns, and quality
  criteria optimized for AI-assisted software development.
user-invocable: false
---

# Development Standards for Human-AI Collaboration

These standards ensure code produced by AI agents is maintainable by both humans and future AI sessions.

## Clean Architecture Principles

### Layer Separation (Mandatory)

```
┌─────────────────────────────────────────┐
│           Frameworks & Drivers           │  ← UI, Web, DB, External
│  ┌─────────────────────────────────────┐ │
│  │        Interface Adapters           │ │  ← Controllers, Gateways, Presenters
│  │  ┌─────────────────────────────────┐│ │
│  │  │        Application Layer        ││ │  ← Use Cases, Application Services
│  │  │  ┌─────────────────────────────┐││ │
│  │  │  │      Domain/Entities        │││ │  ← Business Rules, Value Objects
│  │  │  └─────────────────────────────┘││ │
│  │  └─────────────────────────────────┘│ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Dependency Rule**: Dependencies point INWARD only. Inner layers know nothing about outer layers.

### Layer Responsibilities

| Layer | Contains | Depends On | Never Depends On |
|-------|----------|------------|------------------|
| **Domain** | Entities, Value Objects, Domain Events | Nothing | Any outer layer |
| **Application** | Use Cases, DTOs, Ports (interfaces) | Domain | Adapters, Frameworks |
| **Adapters** | Controllers, Repositories, Mappers | Application, Domain | Frameworks |
| **Frameworks** | Express/FastAPI, ORM, DB drivers | Adapters, Application | — |

### Directory Structure Convention

```
src/
├── domain/                    # Inner core — pure business logic
│   ├── entities/              # Business objects
│   ├── value-objects/         # Immutable value types
│   ├── events/                # Domain events
│   └── errors/                # Domain-specific errors
├── application/               # Use cases and ports
│   ├── use-cases/             # Application business rules
│   ├── ports/                 # Interfaces for external services
│   │   ├── inbound/           # Driving ports (API contracts)
│   │   └── outbound/          # Driven ports (DB, external APIs)
│   └── dto/                   # Data Transfer Objects
├── adapters/                  # Interface adapters
│   ├── inbound/               # Controllers, CLI handlers
│   │   ├── http/              # REST/GraphQL controllers
│   │   └── cli/               # Command handlers
│   └── outbound/              # Repository implementations
│       ├── persistence/       # Database implementations
│       └── external/          # External API clients
└── infrastructure/            # Frameworks and drivers
    ├── config/                # Configuration
    ├── di/                    # Dependency injection
    └── server/                # Server setup
```

## Coding Standards

### File Size Limits
- **Maximum file length**: 300 lines (split if larger)
- **Maximum function length**: 50 lines
- **Maximum parameters**: 4 (use object parameter for more)
- **Maximum nesting depth**: 3 levels

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `user-repository.ts` |
| Classes/Types | PascalCase | `UserRepository` |
| Functions | camelCase, verb+noun | `createUser()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Booleans | is/has/should/can prefix | `isActive`, `hasPermission` |
| Interfaces | PascalCase (no I prefix) | `UserPort` not `IUserPort` |
| Type files | `.types.ts` / `.d.ts` | `user.types.ts` |

### Import Order
```typescript
// 1. Standard library
import { readFile } from 'fs/promises';
// 2. External packages
import express from 'express';
// 3. Internal — domain
import { User } from '@/domain/entities/user';
// 4. Internal — application
import { CreateUserUseCase } from '@/application/use-cases/create-user';
// 5. Internal — adapters
import { UserController } from '@/adapters/inbound/http/user-controller';
// 6. Relative
import { validate } from './validate';
```

## Comment Strategy for Human-AI Collaboration

### When to Comment

Comment the **WHY**, never the **WHAT**. Code should be self-documenting for the WHAT.

### Comment Prefixes (Team Convention)

```typescript
// WHY: Business reason for this non-obvious approach
// CONTEXT: Domain knowledge an AI agent might not know
// CONSTRAINT: External limitation (API rate limit, legacy system)
// PERF: Performance consideration for this choice
// SECURITY: Security-relevant design decision
// TODO(scope): Specific actionable item with clear scope
// HACK: Temporary workaround — include ticket/issue reference
```

### AI Collaboration Markers

```typescript
// AI-BOUNDARY: This file is the integration point between Module A and B
// AI-INVARIANT: This condition must ALWAYS be true: [condition]
// AI-CAUTION: Modifying this affects [list of dependent systems]
// AI-CONTEXT: [domain concept] means [explanation in plain language]
```

### What NOT to Comment
- Obvious code (`// increment counter` on `count++`)
- Framework boilerplate
- Self-documenting function names
- Type information already in the type system

## Error Handling Standards

### Boundary Validation Pattern
```typescript
// Validate at system boundaries ONLY
// Internal code trusts internal types

// GOOD: Validate at controller (boundary)
class UserController {
  async createUser(req: Request) {
    const input = validateCreateUserInput(req.body); // boundary validation
    return this.useCase.execute(input); // trusted from here
  }
}

// BAD: Validate inside domain logic
class User {
  setName(name: string) {
    if (typeof name !== 'string') throw new Error(); // unnecessary — type system handles this
  }
}
```

### Error Types
```typescript
// Domain errors (expected business failures)
class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// Application errors (use case failures)
class ApplicationError extends Error {
  constructor(public code: string, message: string, public cause?: Error) { super(message); }
}

// Infrastructure errors (external system failures)
class InfrastructureError extends Error {
  constructor(message: string, public cause: Error) { super(message); }
}
```

## Testing Standards

### Test File Placement
- Co-located: `user.ts` → `user.test.ts` (same directory)
- OR: `src/user.ts` → `tests/user.test.ts` (mirror structure)
- Follow the project's existing convention

### Test Naming
```
describe('[ModuleName]', () => {
  describe('[methodName]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### What to Test by Layer
| Layer | Test Type | Mock Strategy |
|-------|-----------|---------------|
| Domain | Unit tests | No mocks (pure logic) |
| Application | Unit tests | Mock outbound ports |
| Adapters | Integration tests | Mock external services |
| Infrastructure | E2E tests | Real dependencies |

## Code Review Criteria (for tester agent)

### Must Pass (Critical)
1. Clean Architecture dependency rule respected
2. No security vulnerabilities
3. Types are correct and complete
4. Error handling at boundaries
5. Tests cover happy path + main error cases

### Should Pass (High)
1. Naming follows conventions
2. File size within limits
3. No code duplication
4. Performance considerations addressed

### Nice to Have (Medium)
1. Strategic comments present
2. AI collaboration markers where helpful
3. Consistent formatting

For detailed code conventions, see [references/code-conventions.md](references/code-conventions.md).
