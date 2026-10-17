# Development and verification

Use the Go version declared in `go.mod` (currently Go 1.26.0 or newer).
Desktop builds target Windows/amd64 with `CGO_ENABLED=0`; the server also builds
on other Go-supported platforms. Browser assets are embedded directly, without
a JavaScript build step. Node.js runs the translation check; CI uses Node 22.

## Windows desktop

Run from the repository root in PowerShell:

```powershell
.\build.ps1 -Test            # go vet ./..., go test ./..., then GUI build
.\build.ps1 -Dev             # console build for inspecting logs
.\build.ps1 -Test -Server    # tests, Windows GUI, Linux/amd64 server
.\build.ps1 -Version 1.2.3   # explicitly override the embedded version
node devtools/i18n_test.js
```

Builds go to `dist/`. The script restores the session's directory and
`GOOS`/`GOARCH`/`CGO_ENABLED` when it ends. `-Dev` changes the Windows subsystem, not the data
directory: use `--data-dir .\debug\desktop` when running a development binary.
The main package and `internal/winutil` depend on Windows APIs, so a native
macOS/Linux `go test ./...` cannot test the complete desktop application.

## Server on a development host

This uses disposable data, demo users and fake authentication. The explicit
loopback listener is necessary because the server otherwise listens on `:8080`.

```sh
go run ./cmd/rltracker-server --listen 127.0.0.1:8080 --public-url http://127.0.0.1:8080 --insecure-dev-login --demo --data-dir ./debug/server
```

For actual hosting and OIDC, follow [SELF_HOSTING.md](SELF_HOSTING.md).

```sh
go build -o ./dist/rltracker-server ./cmd/rltracker-server
go build -ldflags '-X main.Version=1.2.3' -o ./dist/rltracker-server ./cmd/rltracker-server
./dist/rltracker-server --version
```

Both main packages declare `var Version`, bumped together in each feature or
fix commit (see [AGENTS.md](../AGENTS.md)). `build.ps1 -Version` and the
release and tagged Docker builds override it with the tag minus its `v`. Plain
builds and Docker images built from `main` or `self-hosted` report the literal,
including for updater decisions. Check all these paths together when changing
version handling.

## Focused checks

Choose packages affected by the change. These example commands run on a
non-Windows host as well:

```sh
go test ./internal/tracker ./internal/statsapi
go test ./internal/store ./internal/agent ./internal/server
go test ./internal/update ./internal/config ./web
go vet ./internal/store ./internal/agent ./internal/server ./cmd/rltracker-server
node devtools/i18n_test.js
node -e 'const a = require("./web/app.js"); console.log(Object.keys(a).length > 0)'
```

The last command is an analytics import smoke check, not an assertion of
analytical correctness. Pure functions exported by `web/app.js` can be exercised
with Node's built-in assertion/test tools and synthetic match fixtures.

The broader portable-package suite is:

```sh
go test ./internal/... ./web ./cmd/rltracker-server
```

`TestEnableStatsAPIAtomicOnFailure` in `internal/setup` expects a read-only INI
file to reject an edit, which only happens on Windows; it skips elsewhere.

Where the host supports the Go race detector and its native toolchain:

```sh
go test -race ./internal/agent ./internal/config ./internal/server ./internal/statsapi ./internal/store ./internal/tilt ./internal/tracker ./internal/update ./web ./cmd/rltracker-server
```

The race detector finds Go memory races, not every SQL read/modify/write race.
Persistence changes also need concurrent and replay assertions on stored data.

## Cross-compilation and simulation

From a Unix shell:

```sh
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o ./dist/rltracker.exe .
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ./dist/rltracker-server-linux-amd64 ./cmd/rltracker-server
```

These verify compilation only. Run the desktop tests on Windows to check
registry, command-line and other platform behavior.

The Windows CLI's `simulate` command emits synthetic Stats API traffic; its
flags are in `main.go` (`cmdSimulate`) and `internal/sim/`. Use a separate test
port and data directory when connecting a tracker to it. Simulation does not
establish compatibility with a running Rocket League installation.

## Current publication workflow

- `.github/workflows/ci.yml` runs on pull requests and branch pushes: vet,
  tests and the Node check on Linux (portable packages) and Windows (`./...`).
- `.github/workflows/release.yml` runs vet/tests on Windows for `v*` tags, then
  builds desktop and Linux binaries and creates the GitHub release.
- `.github/workflows/docker.yml` runs the Linux tests, then builds and pushes the
  server image for `main`, `self-hosted` and `v*` tags. On a tag it is not
  gated by the release workflow's Windows tests.

Keep runtime data out of patches. Before committing, inspect `git diff --check`
and the complete diff, run the applicable checks above, and report any platform
or external-service coverage that is missing.
