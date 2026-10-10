# apps/cli

The `lazarus` command-line client. Go 1.26, part of the root `go.work`.

## What belongs here

- Command definitions
- Transport to the control-plane (HTTP + realtime)
- Local spec discovery and validation (`lazarus.yaml` / `lazarus.json`)
- Credential storage in the OS keyring

## What does not belong here

Any business rule. The CLI calls the API; it never re-implements policy
(`AGENTS.md` §3). If the CLI needs to know *whether* something is allowed, that
is a control-plane question and the answer must come from the server.

## Status

Build-wiring stub only. Lands in Phase 9+ (real execution integration) of `TODO.md`.

## Commands (planned)

| Command | Purpose |
|---|---|
| `lazarus auth login` | Authenticate with the control-plane |
| `lazarus auth logout` | Clear credentials |
| `lazarus spec validate` | Validate a local experience spec |
| `lazarus session create` | Create an execution session |
| `lazarus exec` | Submit a command to an existing session |
| `lazarus logs` | Stream/inspect session output |
| `lazarus session ls/rm` | Manage sessions |

## Build

```sh
go build ./...    # this module only
```
