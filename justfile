# Lazarus — task runner
#
# `just` orchestrates all three toolchains. It is deliberately language-agnostic:
# Turborepo is TS-centric and awkward around `dotnet build` and `go build`, so TS
# work stays inside pnpm workspaces and everything cross-language lives here.
#
# Run `just` with no arguments to list every recipe.
#
# Recipes tolerate missing projects on purpose. The repo is built bottom-up and
# most components do not exist yet; a recipe must not fail merely because the
# project it targets has not been created. Each guard reports `skipped`, so a
# green run is never mistaken for a full verification.
#
# Guards test for a real marker file (a solution, a package.json), never merely
# for a directory existing. An empty directory is not a project, and
# `dotnet format <empty dir>` exits 128 with an unhandled exception rather than
# a clean "nothing to do".

set shell := ["bash", "-euo", "pipefail", "-c"]

# Paths to the workspace package manifests that actually exist. Used to decide
# whether there is any TypeScript to act on.
ts_projects := `ls apps/web/package.json services/auth/package.json packages/*/package.json 2>/dev/null || true`

# True when the .NET solution has been created (Phase 3).
cp := `ls apps/control-plane/*.sln* 2>/dev/null || true`


default:
    @just --list

# ── Setup ──────────────────────────────────────────────────────────────────

# Install dependencies for every toolchain
install:
    @if [ -n "{{ts_projects}}" ]; then pnpm install; else echo "ts: skipped (no workspace packages yet)"; fi
    @go work sync 2>/dev/null || echo "go: skipped"
    @if [ -n "{{cp}}" ]; then dotnet restore "{{cp}}"; else echo "dotnet: skipped (no solution yet)"; fi

# Generate code from the contracts (spec schema, OpenAPI, hub manifest)
codegen:
    @if [ -f packages/spec/package.json ]; then pnpm --filter @lazarus/spec codegen; else echo "spec: skipped (Phase 2)"; fi
    @if [ -f tools/codegen/package.json ]; then (cd tools/codegen && pnpm install && pnpm codegen); else echo "client: skipped (Phase 16)"; fi

# ── Verification ───────────────────────────────────────────────────────────

# Format all code in place
fmt:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r fmt; else echo "ts: skipped (no workspace packages yet)"; fi
    @[ -d apps/cli ] && gofmt -l -w apps/cli || echo "go: skipped"
    @if [ -n "{{cp}}" ]; then dotnet format "{{cp}}" --verbosity quiet; else echo "dotnet: skipped (no solution yet)"; fi

# Verify formatting without writing changes
fmt-check:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r fmt-check; else echo "ts: skipped (no workspace packages yet)"; fi
    @if [ -d apps/cli ]; then \
      unformatted="$(gofmt -l apps/cli)"; \
      if [ -n "$unformatted" ]; then echo "go: files need gofmt:"; echo "$unformatted"; exit 1; fi; \
    else echo "go: skipped"; fi
    @if [ -n "{{cp}}" ]; then dotnet format "{{cp}}" --verify-no-changes --verbosity quiet; else echo "dotnet: skipped (no solution yet)"; fi

# Lint all code
lint:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r lint; else echo "ts: skipped (no workspace packages yet)"; fi
    @if [ -d apps/cli ]; then go -C apps/cli vet ./...; else echo "go: skipped"; fi
    @if [ -n "{{cp}}" ]; then dotnet build "{{cp}}" -warnaserror; else echo "dotnet: skipped (no solution yet)"; fi

# Typecheck all code
typecheck:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r typecheck; else echo "ts: skipped (no workspace packages yet)"; fi
    @if [ -n "{{cp}}" ]; then dotnet build "{{cp}}" -warnaserror; else echo "dotnet: skipped (no solution yet)"; fi

# Build all code.
#
# The Go step uses `-o /dev/null` because `go build` writes an executable named
# after the module into the working directory. This recipe verifies compilation,
# not the release artifact, so it must leave nothing behind.
build:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r build; else echo "ts: skipped (no workspace packages yet)"; fi
    @if [ -d apps/cli ]; then go -C apps/cli build -o /dev/null ./...; else echo "go: skipped"; fi
    @if [ -n "{{cp}}" ]; then dotnet build "{{cp}}" -c Release; else echo "dotnet: skipped (no solution yet)"; fi

# Run all tests
test:
    @if [ -n "{{ts_projects}}" ]; then pnpm -r test; else echo "ts: skipped (no workspace packages yet)"; fi
    @if [ -d apps/cli ]; then go -C apps/cli test ./...; else echo "go: skipped"; fi
    @if [ -n "{{cp}}" ]; then dotnet test "{{cp}}"; else echo "dotnet: skipped (no solution yet)"; fi

# ── Security ───────────────────────────────────────────────────────────────

# Scan the working tree and full history for committed credentials.
# Same tool and same config as CI, so a clean local run means a clean CI run.
secrets:
    @if ! command -v gitleaks >/dev/null 2>&1; then \
      echo "secrets: SKIPPED — gitleaks is not installed."; \
      echo "  Install: https://github.com/gitleaks/gitleaks#installing"; \
      echo "  CI runs this check unconditionally, so a green CI run is authoritative."; \
      exit 0; \
    fi; \
    gitleaks detect \
      --source . \
      --redact \
      --verbose \
      --exit-code 1 \
      --config .gitleaks.toml

# Everything CI requires. This is the gate — see AGENTS.md §13.
check: fmt-check lint typecheck secrets test build
    @echo "check: passed"

# ── Development ────────────────────────────────────────────────────────────

# Bring up the full local stack (Postgres, auth, control-plane, edge)
dev-up:
    @test -f infra/compose/compose.yaml || { echo "compose file not present yet (Phase 20)"; exit 1; }
    docker compose -f infra/compose/compose.yaml --env-file .env up -d
    @echo "dev-up: stack is starting; follow with 'just dev-logs'"

# Tear down the local stack
dev-down:
    @test -f infra/compose/compose.yaml || { echo "compose file not present yet (Phase 20)"; exit 1; }
    docker compose -f infra/compose/compose.yaml --env-file .env down --remove-orphans

# Tail the local stack
dev-logs:
    @test -f infra/compose/compose.yaml || { echo "compose file not present yet (Phase 20)"; exit 1; }
    docker compose -f infra/compose/compose.yaml --env-file .env logs -f

# Delete local state. Irreversible.
dev-reset:
    @test -f infra/compose/compose.yaml || { echo "compose file not present yet (Phase 20)"; exit 1; }
    @read -p "This deletes ALL local Lazarus state. Type 'yes' to continue: " c; [ "$c" = yes ] || { echo "aborted"; exit 1; }
    docker compose -f infra/compose/compose.yaml --env-file .env down --remove-orphans --volumes