# Agent guide

This is the shared repository guide for coding agents. `CLAUDE.md` imports this
file; keep project instructions here rather than duplicating them per tool.

## Start here

1. Read [README.md](README.md) for the supported user workflows.
2. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for runtime ownership and
   domain vocabulary, then [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for commands
   and platform constraints.
3. For the affected surface, consult [docs/SPEC.md](docs/SPEC.md) for payloads
   and tracking rules, or [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for server
   configuration and operations. Verify examples against the owning source.
4. Inspect the working tree, callers and relevant tests before editing. Preserve
   unrelated changes. State consequential assumptions and compatibility effects.

## Find the owning code

| Change | Start with |
|---|---|
| Desktop startup, lifecycle, autostart | `main.go`, `desktop.go`, `internal/winutil/`, `internal/tray/` |
| Installation wizard and server connection | `wizard.go`, `internal/server/setup.go`, `web/setup.js` |
| Game transport and tolerant decoding | `internal/statsapi/` |
| Shared match types, normalization and profile identity | `internal/domain/`; compatibility aliases in `internal/store/model.go` |
| Match lifecycle, player detection, movement, training detection | `internal/tracker/` |
| Break and tilt rules using match history | `internal/tilt/` |
| SQLite schema, ingestion, profiles, imports and aggregates | `internal/store/` |
| Upload queue, heartbeat, device configuration | `internal/agent/`, `agent_cmd.go` |
| HTTP, user scope, OIDC, devices, Discord, file imports | `internal/server/`, `cmd/rltracker-server/` |
| Analytics, browser state and rendering | `web/app.js`, `web/index.html`, `web/style.css` |
| Translations | `web/i18n.js`, `internal/i18n/`, `web/tests/i18n.test.js` and `web/tests/analytics.test.js` |
| Artifact version, updater and publication | Both `main` packages, `internal/update/`, `build.ps1`, `Dockerfile`, `.github/workflows/` |

## Change rules

- Keep the existing Go module, SQLite store and embedded web assets. Introduce
  a dependency or architectural layer only to solve a demonstrated need.
- Keep shared match values and pure profile rules in `internal/domain`, game-event
  interpretation in the tracker, persistence/scoping/deduplication in the store,
  and HTTP/upload concerns in their adapters. Domain production imports are
  limited to `strings` and `time`; Tilt consumes domain matches. Training remains
  in the store, and the tracker still uses store aliases and Stats API DTOs.
  Preserve the store aliases and profile wrappers for source compatibility.
  Prefer narrow interfaces with injectable time and external effects when
  behavior varies.
- A server user, a Rocket League profile and a device are different identities.
  Review the relevant user/profile scope on every read, write and deduplication
  change. Do not reduce a match perspective to its GUID without considering
  its player, offline identity and reconnection behavior.
- Preserve tolerant Stats API decoding, partial-match handling and missing
  historical fields. Missing telemetry is not a measured zero.
- Treat replay, import order, concurrent ingestion and `abandoned` to final-result
  replacement as explicit test scenarios when changing persistence. Keep
  user-edited tags and training focus in mind. Do not assume existing tests
  establish all of these guarantees.
- An outbox delivery key is not the identity of a match. Preserve queued
  revisions until their own acknowledgements. The outbox records its server
  (`outbox/destination`); switching server sets pending entries aside instead
  of sending them to the new one. Local storage and upload are separate writes,
  not a bidirectional synchronization contract.
- Add schema changes as new ordered migrations in `internal/store/store.go`;
  do not rewrite migrations already applied to users' databases. Test upgrades
  from the relevant older schema using synthetic fixtures.
- Reuse the `module.exports` analytics interface in `web/app.js` for pure Node
  checks. Keep DOM and network effects out of new analytical functions. Preserve
  existing generation checks when changing the server player being viewed;
  test routes and in-game profile selection separately for stale responses.
- Add French and English text together in the existing translation modules.
- Each feature or fix commit bumps `var Version` in both `main.go` and
  `cmd/rltracker-server/main.go` to the next version and ends its title with it,
  e.g. `Add a training page (v0.18.0)`. Plain builds, `build.ps1` without
  `-Version` and Docker images built from a branch report this literal; release
  and tagged Docker builds inject the tag without its `v`. Documentation-only
  commits keep the version.

## Verification and delivery

- Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Run the smallest relevant
  checks during iteration, then the applicable platform checks before delivery.
  Add focused regression coverage for behavior changes; documentation-only
  changes need checked links, commands and a clean diff, not invented code tests.
- The desktop root package requires Windows. A cross-build is not execution of
  Windows tests. The Go wrapper fails if Node is missing: run
  `node web/tests/i18n.test.js` and `node web/tests/analytics.test.js`
  explicitly when changing browser text or analytics.
  The analytics script owns analytical assertions; add focused coverage for changed
  analytical rules rather than relying only on translation checks.
- Report exact commands, results and untested environments. Do not describe a
  green package test as proof of a real game, IdP, Docker or deployment scenario.
- Update the affected current documentation with behavior changes. Keep
  investigation logs and proposed redesigns out of these instruction files.
- Do not commit real databases, logs, `config.json`, `agent.json`, outboxes,
  tokens or OIDC/Discord secrets. Use temporary data directories and synthetic
  players. Never start a development server against a player's existing data.
- Bind fake-login development servers to loopback; never expose
  `--insecure-dev-login` on a shared or public interface.
- Preserve user scoping, origin checks, token hashing, OIDC validation, import
  bounds and CSV escaping. Do not treat a loopback bind as CSRF protection.
- Do not merge, release, deploy or publish artifacts without explicit user
  authorization. Building and testing do not authorize those actions.
