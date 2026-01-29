# Validate Command

Run comprehensive validation checks on the codebase.

```bash
pnpm verify
```

This runs `scripts/verify.sh` which performs all validation steps:

1. **Dependencies** - Install and sync (pnpm + uv)
2. **Web build** - Next.js production build
3. **Web lint** - Biome linting
4. **Web typecheck** - TypeScript type checking
5. **Web tests** - Jest with coverage reporting
6. **Web audit** - npm security audit
7. **Python lint** - Ruff linting for api and worker
8. **API tests** - pytest with 95% coverage requirement
9. **Worker tests** - pytest with 95% coverage requirement
10. **Python audit** - pip-audit for vulnerabilities

The script displays a summary table showing pass/fail status and coverage percentages.

## If checks fail

- **Build errors**: Fix the compilation issues before proceeding
- **Lint errors**: Run `pnpm web:lint --apply` or `uv run ruff check --fix`
- **Test failures**: Fix failing tests or update expectations
- **Coverage below 95%**: Add tests for uncovered code paths

## Notes

- Run this before committing code
- Run from repo root (not from `apps/web/`) to use the single root lockfile
- SonarQube analysis is separate: `pnpm sonar`