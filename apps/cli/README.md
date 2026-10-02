# apps/cli

The `lazarus` command-line client. Go 1.26, part of the root `go.work`.

## What belongs here

- Command definitions (cobra)
- Terminal UI and output formatting
- HTTP and realtime transport to the control-plane
- Local spec discovery and validation
- Source upload (gzipped tar)
- Credential storage in the OS keyring

## What does not belong here

Any business rule. The CLI calls the API; it never re-implements policy
(`AGENTS.md` §3). If the CLI needs to know *whether* something is allowed, that
is a control-plane question and the answer must come from the server.

## Status

Build-wiring stub only. The command surface is Phase 19 in `TODO.md`.

## Commands

| Command | Phase |
|---|---|
| `lazarus up` — launch an instant container, attach a terminal | 19.5 |
| `lazarus deploy` — submit a spec, stream the deployment | 19.6 |
| `lazarus logs` | 19.7 |
| `lazarus exec` | 19.8 |
| `lazarus ports` / `expose` | 19.9 |
| `lazarus ci watch` | 19.10 |
| `lazarus spec validate` | 19.4 |
| `lazarus auth login` | 19.3 |

## Build

```sh
just build        # builds every toolchain
go build ./...    # this module only
```