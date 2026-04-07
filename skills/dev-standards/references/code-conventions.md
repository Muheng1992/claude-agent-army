# Detailed Code Conventions

## TypeScript/JavaScript Conventions

### Type Definitions
```typescript
// GOOD: Explicit types for public APIs
interface CreateUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
}

// GOOD: Union types for finite options
type UserRole = 'admin' | 'editor' | 'viewer';

// GOOD: Branded types for domain concepts
type UserId = string & { readonly __brand: 'UserId' };
type Email = string & { readonly __brand: 'Email' };

// BAD: avoid any, unknown at boundaries is acceptable
function process(data: any) { } // Never do this
```

### Function Design
```typescript
// GOOD: Pure function, clear input/output
function calculateDiscount(price: number, tier: CustomerTier): number {
  const rates: Record<CustomerTier, number> = {
    standard: 0,
    premium: 0.1,
    enterprise: 0.2,
  };
  return price * (1 - rates[tier]);
}

// GOOD: Object parameter for 3+ params
function createUser(params: {
  name: string;
  email: string;
  role?: UserRole;
}): User {
  // ...
}

// BAD: Too many positional parameters
function createUser(name: string, email: string, role: string, age: number) { }
```

### Async/Error Handling
```typescript
// GOOD: Result type pattern
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function findUser(id: UserId): Promise<Result<User, UserNotFoundError>> {
  const user = await this.repo.findById(id);
  if (!user) return { success: false, error: new UserNotFoundError(id) };
  return { success: true, data: user };
}

// GOOD: Error boundary at adapter level
class UserController {
  async getUser(req: Request, res: Response) {
    const result = await this.findUserUseCase.execute(req.params.id);
    if (!result.success) {
      return res.status(404).json({ error: result.error.message });
    }
    return res.json(result.data);
  }
}
```

## Python Conventions

### Type Hints
```python
from dataclasses import dataclass
from typing import Protocol

# Domain entity
@dataclass(frozen=True)
class User:
    id: str
    name: str
    email: str
    role: UserRole

# Port (interface)
class UserRepository(Protocol):
    async def find_by_id(self, user_id: str) -> User | None: ...
    async def save(self, user: User) -> None: ...

# Use case
class CreateUserUseCase:
    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, input: CreateUserInput) -> User:
        # WHY: Check uniqueness before creating to prevent duplicate accounts
        existing = await self._user_repo.find_by_email(input.email)
        if existing:
            raise DuplicateEmailError(input.email)
        user = User.create(input)
        await self._user_repo.save(user)
        return user
```

### File Structure
```python
# module.py
"""Module docstring — one line description.

Extended description if needed for domain context.
"""

# Standard library
from pathlib import Path

# Third party
from fastapi import APIRouter

# Internal
from domain.entities.user import User

# Constants
MAX_RETRY_COUNT = 3

# Types (if small, inline; if complex, separate file)

# Main code

# Private helpers (underscore prefix)
```

## Go Conventions

### Package Structure
```go
// domain/user.go — Entity
type User struct {
    ID    UserID
    Name  string
    Email Email
}

// application/ports/user_repository.go — Port
type UserRepository interface {
    FindByID(ctx context.Context, id UserID) (*User, error)
    Save(ctx context.Context, user *User) error
}

// application/usecases/create_user.go — Use Case
type CreateUserUseCase struct {
    repo ports.UserRepository
}

func (uc *CreateUserUseCase) Execute(ctx context.Context, input CreateUserInput) (*User, error) {
    // WHY: Validate email uniqueness at use case level, not domain
    existing, err := uc.repo.FindByEmail(ctx, input.Email)
    if err != nil {
        return nil, fmt.Errorf("checking email uniqueness: %w", err)
    }
    if existing != nil {
        return nil, ErrDuplicateEmail
    }
    // ...
}
```

## Universal Anti-Patterns (All Languages)

1. **God Object**: Class/module with too many responsibilities → Split into focused modules
2. **Circular Dependencies**: A → B → A → ... → Break cycle with interfaces
3. **Primitive Obsession**: Using `string` for email, ID, etc. → Use branded/value types
4. **Feature Envy**: Method uses more of another class's data → Move to that class
5. **Shotgun Surgery**: One change requires touching many files → Better abstraction
6. **Speculative Generality**: Building for hypothetical futures → YAGNI — build for now
7. **Boolean Parameters**: `createUser(name, true, false)` → Use object/enum parameters
