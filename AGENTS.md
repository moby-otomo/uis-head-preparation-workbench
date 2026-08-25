# Repository guidance

- Treat `schemas/v1/` as the contract source of truth.
- Keep core Workbench records independent of Character Switchboard packaging.
- Never overwrite source, candidate, review, or validation records.
- Never mirror a direction implicitly.
- Keep `TEST_` fixtures non-canon and production-export ineligible.
- Do not add production archive paths or assets to runtime code or fixtures.
- Quick Pixelize, AI adapters, cartridge export, GUI, and canon registration are
  outside Phase 1.
- Run `npm run check` before handoff.
