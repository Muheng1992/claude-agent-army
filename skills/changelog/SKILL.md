---
name: changelog
description: >
  Automatic changelog generation from git history and development reports.
  Parses conventional commits, reads sprint/fix/feature reports from docs/reports/,
  groups changes by type, and generates Keep a Changelog format output.
  Supports version bumping and release notes.
---

# Changelog Generation

You are generating a structured changelog from git history and development reports. Your goal is to produce a well-organized, human-readable changelog in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## Phase 1: Data Collection

Gather all change data from the project.

### 1.1 Determine Version Range

Parse the user's argument to determine the commit range:

- **`since [tag]`**: Use `git log [tag]..HEAD --format="%H|%s|%an|%aI"` to collect commits since the specified tag.
- **`unreleased`** (or no argument): Use `git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --format="%H|%s|%an|%aI"` to collect commits since the last tag. If no tags exist, collect all commits.
- **`release [major|minor|patch]`**: Same as `unreleased` for data collection, but additionally calculate the next version number in Phase 3.

### 1.2 Parse Git Log

Collect structured commit data using `--format="%H|%s|%an|%aI"`:

| Field | Description |
|-------|-------------|
| `%H` | Full commit hash |
| `%s` | Commit subject line |
| `%an` | Author name |
| `%aI` | Author date (ISO 8601) |

### 1.3 Read Development Reports

Scan `docs/reports/` for supplementary context:

| Directory | Purpose |
|-----------|---------|
| `docs/reports/plans/` | Feature descriptions and sprint plans |
| `docs/reports/fix/` | Bug fix details and root cause analysis |
| `docs/reports/code-review/` | Review summaries and findings |
| `docs/reports/quality-gate/` | Quality gate pass/fail results |

Match reports to commits by date range and content keywords to enrich changelog entries.

## Phase 2: Classification

### 2.1 Parse Conventional Commits

Classify each commit by its conventional commit prefix:

| Prefix | Changelog Category |
|--------|--------------------|
| `feat:` | **Added** |
| `fix:` | **Fixed** |
| `docs:` | **Documentation** |
| `refactor:` | **Changed** |
| `perf:` | **Performance** |
| `test:` | **Testing** |
| `chore:` | **Maintenance** |
| `style:` | **Maintenance** |
| `ci:` | **Maintenance** |
| `build:` | **Maintenance** |
| `BREAKING CHANGE:` in body or `!:` suffix | **Breaking Changes** |

Commits that do not follow conventional commit format should be placed in **Other** with a note suggesting the author adopt conventional commits.

### 2.2 Enrich with Reports

For each commit, search for matching reports:

1. Check if the commit message references a report filename or issue number.
2. Check if a report's date falls within the commit's timeframe.
3. If a match is found, use the report's description to provide richer context in the changelog entry.

### 2.3 Group and Sort

- Group entries by changelog category (Added, Fixed, Changed, etc.).
- Within each category, sort entries by date (newest first).
- Remove empty categories from the output.

## Phase 3: Generation

### 3.1 Changelog Format

Generate `CHANGELOG.md` in Keep a Changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Description of new feature ([`abcdef1`](commit-url))

### Fixed
- Description of bug fix ([`abcdef2`](commit-url))

### Changed
- Description of change ([`abcdef3`](commit-url))

### Breaking Changes
- Description of breaking change ([`abcdef4`](commit-url))

### Documentation
- Description of docs change ([`abcdef5`](commit-url))

### Performance
- Description of perf improvement ([`abcdef6`](commit-url))

### Testing
- Description of test change ([`abcdef7`](commit-url))

### Maintenance
- Description of chore/style/ci change ([`abcdef8`](commit-url))

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...
```

### 3.2 Version Bumping

If the user provides a `release [level]` argument:

1. **Detect current version**: Check the latest git tag matching `vX.Y.Z` or `X.Y.Z` pattern. If no tags exist, assume `0.0.0`.
2. **Calculate next version** based on the level argument:
   - `major`: Increment major, reset minor and patch (e.g., `1.2.3` -> `2.0.0`)
   - `minor`: Increment minor, reset patch (e.g., `1.2.3` -> `1.3.0`)
   - `patch`: Increment patch (e.g., `1.2.3` -> `1.2.4`)
3. **Replace** `## [Unreleased]` with `## [X.Y.Z] - YYYY-MM-DD` using today's date.
4. **Add** a new empty `## [Unreleased]` section above it.

### 3.3 Preserve Existing Content

If `CHANGELOG.md` already exists:

1. Read the existing file.
2. Preserve all content below the current `## [Unreleased]` section.
3. Replace only the `## [Unreleased]` section with the newly generated content.
4. If releasing a version, insert the new version section between `## [Unreleased]` and the previous version.

### 3.4 Report References

Where a changelog entry has a matching report, include a link:

```markdown
- Add user authentication feature ([`abcdef1`](commit-url)) — [Sprint Report](docs/reports/plans/2024-01-15-auth-sprint.md)
```

## Phase 4: Filing

### 4.1 Write Changelog

- Write the generated content to `CHANGELOG.md` at the project root.
- If the file already exists, merge with existing content as described in Phase 3.3.

### 4.2 Version Tag Suggestion

If a version release was generated, output the suggested git tag command:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Do NOT execute the tag command automatically. Only suggest it for the user to confirm.

### 4.3 Update Index

Update `docs/INDEX.md` with a reference to the changelog:

```markdown
## Changelog
- [CHANGELOG.md](../CHANGELOG.md) — Project changelog (Keep a Changelog format)
```

## Usage

```
/agent-army:changelog                    # Generate unreleased changes
/agent-army:changelog since v1.0.0       # Changes since specific tag
/agent-army:changelog release minor      # Generate + bump minor version
/agent-army:changelog release major      # Generate + bump major version
/agent-army:changelog release patch      # Generate + bump patch version
```

## Output Format

```markdown
# Changelog Generation Report

**Date**: YYYY-MM-DD
**Range**: [tag]..HEAD (N commits)
**Version**: [Unreleased | vX.Y.Z]

## Summary
| Category | Count |
|----------|-------|
| Added | N |
| Fixed | N |
| Changed | N |
| Breaking Changes | N |
| Documentation | N |
| Performance | N |
| Testing | N |
| Maintenance | N |

## Generated File
- Path: `CHANGELOG.md`
- Action: [Created | Updated]

## Version Tag (if release)
Suggested command:
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Display the generated changelog preview in the response, then confirm the file has been written.
