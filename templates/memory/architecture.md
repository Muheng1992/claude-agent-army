# Architecture Notes - {PROJECT_NAME}

## Architecture Pattern
<!-- e.g., Clean Architecture, Hexagonal, MVC, CQRS, Microservices -->
- Pattern: {ARCHITECTURE_PATTERN}
- Rationale: <!-- Why this pattern was chosen -->

## Layer Descriptions

### Domain Layer (Innermost)
<!-- Pure business logic, entities, value objects -->
- Location: `src/domain/`
- Dependencies: None (pure)
- Key entities:
  <!-- List main domain entities as they are created -->

### Application Layer
<!-- Use cases, ports/interfaces, DTOs -->
- Location: `src/application/`
- Dependencies: Domain only
- Key use cases:
  <!-- List main use cases as they are created -->

### Adapter Layer
<!-- Controllers, repository implementations, mappers -->
- Location: `src/adapters/`
- Dependencies: Application, Domain
- Inbound (driving): <!-- HTTP controllers, CLI handlers -->
- Outbound (driven): <!-- Repository implementations, API clients -->

### Infrastructure Layer (Outermost)
<!-- Frameworks, DI, config, server setup -->
- Location: `src/infrastructure/`
- Dependencies: All inner layers
- Components: <!-- Config, DI container, server -->

## Key Interfaces & Implementations
<!-- Record port interfaces and their concrete implementations -->
<!-- Format: [Port] --> [Implementation] (in [adapter location]) -->

## Data Flow
<!-- Describe or diagram the primary data flows -->
<!-- Use text-based diagrams or Mermaid syntax -->
```
Request --> Controller --> UseCase --> Port --> Repository --> DB
                                                    |
Response <-- Presenter <-- DTO <----- Result <------+
```

## External Service Integrations
<!-- APIs, databases, message queues, third-party services -->
| Service | Purpose | Adapter Location |
|---------|---------|-----------------|
<!-- | PostgreSQL | Primary data store | `src/adapters/outbound/persistence/` | -->

## Database Schema Notes
<!-- Key tables/collections, relationships, migration notes -->

## Architecture Decision Log
<!-- Significant decisions with date and rationale -->
<!-- Format: YYYY-MM-DD: [decision] — [why] — [alternatives considered] -->
