# 0008 — Greenfield rewrite, with no legacy salvage

**Status:** Accepted
**Date:** 2026-10-02

## Date of decision

2026-10-02, before the repository was initialised.

## Context

The previous repository contained roughly 1.6 GB and five top-level projects:

| Project | State |
|---|---|
| `front-end/` | Next.js. 16,589 LOC, including a React Flow graph editor and Dexie workflow models |
| `main-backend/` | NestJS, largely empty, Supabase auth |
| `lazarus-cli/` | A TypeScript CLI, not Go |
| `backend/` | Express + in-process `localDataStore`, no auth, no RLS |
| `.idea/` | IDE state |

The audit that preceded this decision found:

- **An unauthenticated remote code execution path.** A client-supplied source path
  was written and then executed through a shell command, with no authentication, no
  path containment, and `cors: '*'`.
- **A committed GitHub personal access token** in `front-end/lib/github.test.ts`.
- **Duplicated domain logic** across `main-backend` and `backend`, with the weaker
  copy reachable in production. Two implementations of policy, tenancy, and
  validation, disagreeing.
- **No tenant isolation.** `tenant_id` existed on some tables and was enforced on
  none.
- **A partially-implemented Kubernetes path** with no tests and no design, never
  completed.
- **A graph/flow editor** for building Dockerfiles visually. This was a large
  fraction of the front-end's effort and, on reflection, not what anyone wanted.
- **A document/collaborative-editing model** (`Document*` types, Dexie schemas)
  belonging to a product line that had been closed. The code was still there.

Refactoring this would have required understanding five projects, undoing a
committed credential, and untangling duplication across two backends, before any
new product capability could be built. The security defects were in the parts that
were hardest to reach and most entangled.

The decisive question was whether anything was worth keeping. The honest answer was
no. What existed was a prototype whose structure encoded the wrong product, plus a
security posture that would have to be redone from the ground up anyway.

## Decision

**Delete everything and rebuild.**

- All five directories removed. Nothing carried forward.
- **The Git history is discarded.** A single new repository, a single initial
  commit. No salvage, no `git mv` archaeology, no reference to the old lineage.
- **Concepts are rejected, not just code.** The flow/node editor, the document
  editing model, the Docker/Kubernetes orchestrator ambition, and the general CI
  provider ambition are all written down as anti-goals (`AGENTS.md` §1) so they
  cannot be reintroduced as "just a small feature".
- **Lessons are carried forward, implementation is not.** The security findings
  became hard rules: path containment before every write (`AGENTS.md` §7), no
  interpolated shell commands, tenant scope from the token only, secrets never in
  source. Those lessons are in `AGENTS.md` and `docs/threat-model.md`; the code
  that taught them is gone.
- The `.gitignore`, `.editorconfig`, and toolchain pins from the old repository were
  **re-examined rather than copied**, and rewritten where the old rules no longer
  fit a three-language monorepo.
- The user must **revoke the leaked GitHub token** and **rotate the Supabase key**
  out-of-band. Deleting the file does not invalidate a credential.

## Consequences

### Positive

- **A coherent structure from commit one.** No layer to untangle, no dead code, no
  second implementation of anything to choose between.
- **Boundaries hold because nothing predates them.** Every module boundary is real
  rather than aspirational, because there was never a boundary to violate.
- **Security properties are designed in, not retrofitted.** Tenant isolation and the
  Policy chokepoint were never absent-then-added, so there is no window in which
  they were missing.
- **No credential history.** A fresh repository has no deleted secrets, no stale
  tokens, no old objects to worry about.
- **Anti-goals are documented,** so the closed product lines are closed on paper and
  not only in the absence of code.
- **Tooling is consistent** across three languages from the start.

### Negative

- **Everything is rebuilt.** Every working line is rewritten, including parts that
  probably worked.
- **The history is gone.** No archaeology, no `git log` explaining why something is
  the way it is. The ADRs replace it going forward, and they are better — but they
  do not describe the old code.
- **Elapsed time.** The old code was a head start on the parts that did work, and
  that head start is spent.
- **Lessons are recorded from memory and from the audit,** not from living with the
  code. An audit finds the defects that are visible; the ones that only appear after
  a year of maintenance are not recoverable.

### Neutral

- 1.6 GB freed and a 64 KB starting point.
- No backward compatibility with existing users. There were none to speak of; this
  was unreleased.
- The old repository remains available elsewhere, if anyone needs to consult it.

## Alternatives considered

**Refactor in place.** Rejected: the security defects were in the least testable,
most entangled code; the duplicated domain logic across two backends would have to
be resolved before any feature work; and the structure encoded the wrong product.
The result would have been a slower rewrite with a working tree at every step,
which is a worse risk profile than a clean start.

**Salvage the front-end, rewrite the backends.** Rejected: the front-end contained
the flow editor and the document model — the two things explicitly decided against.
Separating those out of a 16,589 LOC application is most of the work of writing a
new one.

**Keep the git history with a `git rm` of the old trees.** Rejected: a fresh history
makes it unambiguous that there is no supported path from the old code. Preserving
history across a total rewrite invites exactly the "why is this function still
here" archaeology that a clean start avoids.

**Port the CLI to Go and keep the rest.** Rejected: the CLI was TypeScript in a
monorepo with no cross-language tooling, which is precisely the setup we are
replacing. Porting it separately would mean building the Go workspace twice.

**Incremental strangler-fig migration.** Rejected: it is the right strategy for a
system with real users and real data. This had neither, and it is the strategy that
would have left the unauthenticated RCE path in production during the migration.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — what Lazarus is, and the anti-goals
- [`../../AGENTS.md`](../../AGENTS.md) §7 — security rules
- [`../../SECURITY.md`](../../SECURITY.md) — credential rotation requirements
- [`../../CHANGELOG.md`](../../CHANGELOG.md) — what was removed
- [`../../TODO.md`](../../TODO.md) §0 — post-wipe actions