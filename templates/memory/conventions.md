# Conventions - {PROJECT_NAME}

## File Naming
<!-- Rules for naming source files, test files, config files -->
- Source files: <!-- e.g., kebab-case.ts -->
- Test files: <!-- e.g., [module].test.ts or test_[module].py -->
- Documentation: <!-- e.g., lower-case-kebab.md (exceptions: README.md, INDEX.md) -->
- Config files: <!-- e.g., .env, tsconfig.json -->

## Code Style Rules
<!-- Formatting and style rules beyond what the linter enforces -->
- Indentation: <!-- e.g., 2 spaces -->
- Line length: <!-- e.g., 100 characters -->
- Import order: <!-- e.g., stdlib -> external -> internal -> relative -->
- Trailing commas: <!-- e.g., always in multiline -->

## Comment Conventions
<!-- When and how to comment, using Human-AI collaboration prefixes -->
- `// WHY:` -- Non-obvious business reason
- `// CONTEXT:` -- Domain knowledge for AI
- `// CONSTRAINT:` -- External limitation
- `// AI-BOUNDARY:` -- Integration point marker
- `// AI-INVARIANT:` -- Must-hold condition
- `// AI-CAUTION:` -- Modification impact warning

## Git Workflow
- Branch naming: <!-- e.g., feature/[name], fix/[name], refactor/[name] -->
- Commit style: <!-- e.g., Conventional Commits: feat:, fix:, docs:, refactor:, test: -->
- PR process: <!-- e.g., require /quality-gate before merge -->
- Protected branches: <!-- e.g., main requires review -->

## PR / Review Conventions
<!-- How code reviews are conducted -->
- Review checklist: <!-- e.g., Clean Architecture compliance, types, error handling -->
- Report filing: <!-- e.g., docs/reports/code-review/ -->
- Approval requirements: <!-- e.g., 1 reviewer, all checks pass -->

## Documentation Conventions
<!-- How documentation is maintained -->
- Report location: `docs/reports/`
- Report format: <!-- e.g., timestamped markdown -->
- Index maintenance: <!-- e.g., docs/INDEX.md updated by documenter -->
- Archive policy: <!-- e.g., never delete, move to docs/archive/ -->

## Agent Coordination
<!-- Rules for multi-agent collaboration -->
- File ownership: <!-- e.g., which agent owns which files -->
- Handoff protocol: <!-- e.g., how agents pass work between each other -->
- Memory updates: <!-- e.g., when to update memory files -->
