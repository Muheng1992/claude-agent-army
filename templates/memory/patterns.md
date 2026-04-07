# Code Patterns - {PROJECT_NAME}

## Naming Conventions
<!-- Project-specific naming patterns observed or established -->
- Files: <!-- e.g., kebab-case.ts -->
- Classes/Types: <!-- e.g., PascalCase -->
- Functions: <!-- e.g., camelCase, verb+noun -->
- Constants: <!-- e.g., UPPER_SNAKE_CASE -->
- Booleans: <!-- e.g., is/has/should prefix -->

## Error Handling Patterns
<!-- How errors are created, thrown, and caught in this project -->

### Domain Errors
<!-- Business rule violations -->

### Application Errors
<!-- Use case failures -->

### Infrastructure Errors
<!-- External system failures -->

### Error Propagation
<!-- How errors flow through the layers -->

## Testing Patterns
<!-- Testing conventions and patterns used -->

### Unit Tests
<!-- Arrange-Act-Assert, test doubles, fixtures -->

### Integration Tests
<!-- Setup/teardown, test databases, mocking -->

### Test Utilities
<!-- Shared helpers, factories, builders -->

## API Patterns
<!-- REST, GraphQL, RPC conventions used -->
- Endpoint naming: <!-- e.g., /api/v1/resources -->
- Request validation: <!-- e.g., Zod schemas at controller boundary -->
- Response format: <!-- e.g., { data, error, meta } -->
- Authentication: <!-- e.g., JWT in Authorization header -->

## Data Access Patterns
<!-- Repository pattern, query builders, ORM usage -->

## Dependency Injection
<!-- How DI is configured, container setup -->

## Logging Patterns
<!-- Log levels, structured logging, correlation IDs -->

## Code Organization Idioms
<!-- Recurring structural patterns in this codebase -->
<!-- e.g., barrel exports, feature modules, shared utilities -->
