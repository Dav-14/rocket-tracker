# L9 — Build, test and publish the same artifacts

## Execution contract

Input: integrated checkout `17c9fe71df7ac9a1d8d7ffda4d205e02c263bf87`, plus
coordinator-owned local integration changes. During this lane the coordinator
moved Windows composition/tests to `internal/desktopapp/*_windows*.go` and
added `web/tests/profiles.test.js`; those source changes are consumed, not
authored here. Linux package patterns exclude the Windows-only composition;
Windows `./...` includes it. The three Node scripts are explicit CI commands.
One writer owns `.github/workflows/*`, `Dockerfile`, `docs/RELEASING.md`
and this record. Runtime, `build.ps1`, `AGENTS.md` and `DEVELOPMENT.md`
are outside this lane. No Git mutations, remote CI operations or publication
are authorized during implementation.

- PRs start Build and package Tests independently. Linux server and Windows
  desktop candidates are transferred as immutable workflow artifacts and their
  version output is checked after download. Go vet/tests and all three Node 22
  scripts remain automatic.
- GitHub Release is a separate tag workflow. Its only writer job requires all
  build/test jobs and downloads their candidates without compiling again.
- Docker exports one Linux/amd64 Docker archive, transfers it to an offline
  version/health test, then loads/tags/pushes that same image without rebuilding.
  Archive SHA-256, image config digest and registry manifest digest are distinct
  identifiers. Registry manifest verification must bind back to the tested
  config digest.
- Only `KcivazB/rocket-tracker` may publish. GitHub releases require a numeric
  `vMAJOR.MINOR.PATCH` tag; image publication retains only upstream `main`,
  `self-hosted` and numeric version tags. Forks and work branches do not publish.
- One version variable remains `rocket-tracker/internal/buildinfo.Version`,
  default `dev`; tags inject their numeric version. No source bump.
- Deploy is N/A: this repository has no deployment workflow. Slow qualification
  (real game, browser, OIDC provider, upgrade/recovery) is outside PR gates.

## Handoff

The seven owned files are quiescent and ready for the coordinator's independent
review. This lane was authored and locally checked in one Codex session; the
three analytical lenses below are author review, not independent approval.
No Git mutation, remote CI operation, registry push, GitHub release or deploy
was performed.

| Lane | Owner / surface | Evidence / next event | State |
| --- | --- | --- | --- |
| Pipeline implementation | Codex, seven files listed below | Local patch frozen for review | handoff |
| Local verification | Codex, temporary fixtures and isolated Docker builder | Checks below executed; builder and smoke container removed | done |
| Independent review | Coordinator assigns a read-only reviewer | Review the same frozen files before integration | ready |

## Executed evidence

- `actionlint` **v1.7.12** passed on all four workflow files. ShellCheck and
  Pyflakes integrations were disabled because those tools are unavailable;
  every embedded Bash script separately passed `bash -n`, and embedded Python
  passed Python compilation. Dockerfile's RUN command passed `sh -n`.
- A temporary harness executed **81** structure/syntax/script checks, including
  the actual publisher guards against fork, work branch, PR, manual event,
  incorrect case and invalid version refs; all passed. Positive upstream tag
  and allowed image branches were admitted. It also checked permissions,
  dependency edges, no compiler in publishers, Node 22 and all three scripts.
- The actual image test shell ran against a simulated Docker CLI for altered
  archive, incorrect archive SHA, loaded config/version mismatch, unhealthy,
  early exit, event-stream EOF and final-healthcheck failure. Each was rejected;
  cleanup was exercised. Publisher digest comparison was tested against a fake
  CLI only, including a wrong registry config; no registry operation occurred.
- The actual reusable Build and downloaded-binary verification scripts passed
  for server `dev` and `1.2.3` on **Darwin/arm64, Go 1.27.2**. Plain/injected/
  legacy smokes printed `dev`/`1.2.3`/`dev`. Simulated artifact transfer removed
  executable bits before verification. An altered downloaded candidate failed
  its checksum before execution. This is host execution, not Linux execution.
- The actual Build script cross-compiled the Windows/amd64 GUI candidate and
  version smoke binaries. This does **not** execute Windows desktop tests or
  GUI version output; those remain hosted Windows CI checks.
- `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go vet ./internal/... ./cmd/... ./web`
  passed against the current integrated source. An earlier attempt to run that
  entire pattern on Darwin with CGO disabled failed in the pre-existing Darwin
  systray implementation; it was not treated as a Linux CI failure.
- `CGO_ENABLED=0 go test ./internal/buildinfo ./internal/update ./cmd/... ./web`
  passed on the host (`buildinfo` and cmd have no test files). No full Windows
  or complete Linux package suite execution is claimed by this lane.
- All three scripts passed under **Node 22.23.3** installed in a temporary npm
  cache: `node web/tests/i18n.test.js`, `node web/tests/analytics.test.js`,
  `node web/tests/profiles.test.js`. The host's default Node is 26.11.0.
- **Real Docker build and offline smoke passed.** Docker server **29.8.2** runs
  Linux/aarch64 in OrbStack on Darwin/arm64. A dedicated `docker-container`
  builder compiled the actual Dockerfile for **Linux/amd64 under emulation**,
  with `VERSION=1.2.3`, and exported a Docker archive. The unchanged workflow
  sealing and image test scripts then loaded it, checked config/version,
  observed a healthy event, executed healthcheck and rechecked hashes, with no
  network or published ports in the smoke container. Builder and smoke
  container were removed; the local image/archive remain evidence.
  The initial default Docker driver rejected archive export before compilation;
  the dedicated builder matches `setup-buildx-action`'s driver model.

Real Docker image config digest:
`sha256:c6699a5bbe4ebc9ee3f1a0cf7c463f7e581eeae0aa26d9ea44b25796e7cb8b46`.
Archive SHA-256:
`8a5acb44e4df66343e5e0600537354fead187863d2fbb302aaa803087f53c929`.
These are local artifact identifiers, not a published registry manifest digest.

Temporary evidence/reproduction helpers (outside the repository):
`/tmp/rocket-l9-checks.py`, `/tmp/rocket-l9-binaries.py`, and
`/tmp/rocket-l9-docker.py`. The binary helper completed its Build, transfer,
version and cross-build checks before its Darwin-wide vet failed as described
above; subsequent targeted commands passed separately. Helpers are evidence
from this run, not maintained repository test tooling. Docker fixture and
archive live at
`/var/folders/6z/f46tllln6396f15rnh2qmk1h0000gn/T/rocket-l9-docker-_kq5l451/`.

## Three analytical lenses

| Lens | Author assessment | Strongest objection / disposition | Evidence and remaining gate |
| --- | --- | --- | --- |
| Principal Engineer | PASS for local implementation; independent review required | Rebuilding in a publisher could ship another candidate. Removed: publishers only download/check/copy or load/tag/push. Archive checksum, config identity and manifest digest are distinct. | Workflow graph, real archive transfer/load and host binary transfer checks. Hosted artifact-service handoff and native Windows candidate output remain CI gates. |
| Product Engineer | PASS for local implementation; documentation routing follow-up named | Users need predictable asset names and version behavior. Existing executable names remain; checksums are additive, version remains dev or injected with the shared path. | Real server/legacy smokes and all three Node scripts pass. Coordinator must realign DEVELOPMENT's old publication section and link RELEASING before PR. |
| SRE | Local offline smoke PASS; publication readiness BLOCKED on external evidence | A tested file alone does not establish registry identity or least-privilege deployment. Publisher verifies config through immutable registry manifest; guards deny forks/work refs. No deploy stage exists. | Real emulated-amd64 image health/version test and negative fixtures pass. Hosted Windows/Actions gates, owner-managed protections/credentials and authorized publication remain unexecuted. |

No unresolved local code objection was identified in author review. This is a
handoff, not independent approval or publication readiness. Slow real-game,
browser, OIDC and updater installation qualification remains outside PR gates;
Chromium availability does not establish that qualification. Deploy is N/A:
the exhaustive workflow inventory is CI, reusable Build/Tests, Release and
Docker image, with no command that deploys to a running environment.

## Coordinator follow-up and limits

- Independent cross-review uses this frozen scope. Actual Actions upload/
  download, native Windows execution and registry manifest verification must
  be observed in their proper CI/publication environments; local mocks cannot
  supply that evidence. No test tag or image was published to obtain it.
- `docs/DEVELOPMENT.md:140-148` still describes the former serial publication
  flow. That file is explicitly outside this writer's scope: replace that
  section with a link to `docs/RELEASING.md` during coordinator integration.
  Its simulation pointer to root `main.go` also needs to follow the separately
  owned desktop composition move. These are named integration follow-ups,
  not changes silently made by this lane.
- The coordinator updated the Go web runner to include `profiles.test.js` while
  this lane was active; the explicit workflow commands already include it.
- Repository branch protection/check names and Harbor access policies were not
  inspected or modified. Configure the new Build/Tests jobs as intended;
  ownership/ref allowlists intentionally prevent this work fork publishing.
- Binary downstream-only retries fail closed across attempts: rerun all jobs,
  as described in RELEASING. Publication is not transactional across services
  or image tags; partial external writes require inspection before retry.
- Build and package Tests are parallel. There are six binary matrix jobs and
  three image validation jobs on a PR; Linux package checks overlap between CI
  and Docker. Seven-day artifact retention bounds storage; four binary files
  per target preserve explicit compatibility smokes. No caching redesign or
  slow qualification was added to the required path.

## Frozen file inventory

Only these files were written by this lane. Other local integration changes
were authored by their coordinating lanes and were preserved.

| File | SHA-256 |
| --- | --- |
| `.github/workflows/ci.yml` | `ca219a64dffd277f5eaf2dcbdc8ba281999dd8b7ddd5767f9bd239c411e4859e` |
| `.github/workflows/binaries.yml` | `1c0c7e5fcac7d8851170d62f5362f58ea6af8590a45aca6ceb292b3357f88682` |
| `.github/workflows/release.yml` | `84339fccffc6f6e1749e750b803903aba842f52fd496c5181ed1f13c32d9e9ad` |
| `.github/workflows/docker.yml` | `e3c3ca6ddf2e7ed4a110062be085cd7d77e5e2e7be42b783421a1e74cde41fe2` |
| `Dockerfile` | `3c551f13472a9c54069493c6bbb50a3b107740820424ec2a2e86e4ea597913c3` |
| `docs/RELEASING.md` | `c16f41dfe86020633439e11adbf6b8bc97964495600d63165ac4e758e0d78695` |

The seventh file is this evidence record; its hash is supplied in the handoff
snapshot, outside itself. No source version bump or runtime Go change was made
by this lane.
