# Validate Command

Run comprehensive validation checks on the codebase based on affected modules.

## Workflow

### Step 1: Detect Affected Modules

Analyze git status and recent changes to determine which modules are affected:
- `apps/web/` - Next.js frontend
- `apps/api/` - FastAPI backend
- `apps/worker/` - Temporal workflows (when implemented)
- `apps/mcp-server/` - Custom MCP tools (when implemented)
- Root-level files (package.json, pyproject.toml, etc.)

Run:
```bash
git status --porcelain
git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached
```

### Step 2: Run Module-Specific Checks

#### For `apps/web/` (Frontend - pnpm/Biome)

**Always run:**
```bash
cd apps/web && pnpm install --frozen-lockfile
cd apps/web && pnpm build
cd apps/web && pnpm lint
```

**If dependencies changed (package.json or pnpm-lock.yaml modified):**
```bash
cd apps/web && pnpm audit
```

**If lint has fixable issues:**
```bash
cd apps/web && pnpm lint --apply
cd apps/web && pnpm format --write
```

#### For `apps/api/` (Backend - Python/uv)

**Always run:**
```bash
uv sync --extra dev
uv run ruff check apps/api/app/ --fix
uv run ruff format apps/api/app/
uv run pytest apps/api/tests/ -v
```

**If dependencies changed (pyproject.toml or uv.lock modified):**
```bash
uv run pip-audit --ignore-vuln CVE-2024-23342 --ignore-vuln CVE-2026-0994
```

**Type checking (optional but recommended):**
```bash
uv run mypy apps/api/app/
```

### Step 3: Run SonarQube Analysis

If sonar-scanner is available and `sonar-project.properties` exists:

```bash
sonar-scanner
```

Review the output for:
- **Critical/Major issues**: Attempt to fix automatically or ask user for guidance on large refactors
- **Minor/Info issues**: Document recommendations but don't auto-fix

### Step 4: Generate Summary Report

Provide a structured summary:

1. **Modules Affected**: List which modules had changes
2. **Build Status**: Pass/Fail for each module
3. **Test Results**: Summary of test outcomes
4. **Lint Issues**:
   - Fixed automatically
   - Require manual attention
5. **Security Audit**:
   - Vulnerabilities found (if any)
   - Recommendations
6. **SonarQube Findings**:
   - Critical/Major issues (fixed or need attention)
   - Minor recommendations
7. **Overall Status**: Ready to commit or needs attention

## Error Handling

- If a build fails, stop and report the error clearly
- If tests fail, continue with other checks but flag the failures
- If lint auto-fix changes files, report which files were modified
- If unclear about intent of changes, ask the user before making fixes

## Notes

- This command should be run before committing code
- It integrates with the existing pre-commit checklist in DEVELOPMENT_SETUP.md
- SonarQube analysis requires sonar-scanner CLI to be installed and configured