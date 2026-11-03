# StayElite final test and regression results

| Command | Environment | Result |
|---|---|---|
| `pnpm test:stayelite` | local deterministic fixtures; no DB mutation opt-in | 31 passed, 1 skipped, 0 failed. Skipped Phase 2 DB test requires `STAYELITE_DB_TESTS=true` and an approved isolated database. |
| `npx tsc --noEmit` | local | passed. |
| `npx prisma validate` | local schema | passed. |
| `git diff --check` | working tree | passed. |
| `npx prisma migrate status` | read-only configured remote | blocked: five remote migrations are absent locally; `20261029110000_add_stayelite_points_rewards_campaigns` is unapplied. |
| `pnpm security:scan` | local | passed, exit 0: `safe=true`, 0 high findings. Two medium invisible-Unicode warnings were limited to vendored Next.js files under `node_modules`; oversized build/dependency binaries were not scanned. |
| `pnpm build:ci` | local | passed: compile, TypeScript, page generation and final build exit code 0. |
| Browser E2E, accessibility, performance, backup/restore | unavailable | BLOCKED_BY_ENVIRONMENT. |

No live payment, refund, production migration, deployment, feature activation, historical award, or points backfill was run.
