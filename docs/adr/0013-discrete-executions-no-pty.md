# 0013 — Discrete command executions, no PTY

**Status:** Accepted
**Date:** 2026-10-04

## Context

Lazarus runs real software in a container: `ls`, `curl`, `git`, `grep`,
whatever the environment provides. The output is real, and a user needs to read
it. That is a superficially strong argument for giving them a terminal.

The tempting implementation is a pseudo-terminal: allocate a PTY, allocate a TTY,
stream bytes both ways, and render with `xterm.js` in the browser. It is the
default answer, it is a mature library, and it looks like less work.

It is also a different product, with a different risk profile, and it does not
fit what an *experience* is. An experience already knows the commands that
matter, what they mean, and what a good result looks like. Documentation can
therefore offer a curated, meaningful command set — but the user must also be
able to type something the experience never mentioned, because real exploration
means `| grep`, `> out.txt`, and a typo.

A PTY gives us a byte stream. What the product actually needs is a **record**:
which command ran, what it exited with, what it printed, and how it relates to
the documentation next to it. Those are different shapes of data.

## Decision

**Commands are discrete executions with structured results. There is no PTY, no
TtyAlloc, no `xterm.js`, no `node-pty`, no `xterm-addon-*`, and no shell.**

- An execution is submitted as a command plus an explicit argument list, or a
  single string interpreted by a documented, fixed parser. It is **never** a
  shell command line. There is no shell in the product to inject into.
- An execution streams **structured events**: started, output chunk, exit, or
  cancelled. It is not a byte stream and has no cursor, no scroll region, and no
  terminal control state.
- A transcript block records the command, its exit code, and its output. That
  record is the unit of history, search, and citation.
- ANSI escape sequences are interpreted as **colour and control-character
  filtering** in the presentation layer. They are never passed to `innerHTML`,
  and a sequence that carries cursor or erase semantics is stripped, not emulated.
- Execution lifecycle events (`SessionCreated`, `CommandSubmitted`,
  `ExecutionCompleted`) go through the durable outbox of ADR 0003, not
  at-most-once in-memory dispatch. A completed execution must not be able to
  vanish from the transcript because a process died.

## Consequences

### Positive

- The transcript is queryable, structured, and testable. A byte stream is none of
  those.
- No terminal emulator to keep patched in a product that takes untrusted input.
- Rendering is data-driven, so the same block renders identically in the web app
  and in a future desktop shell.
- Dropping shell removes an entire class of injection. There is no
  `sh -c "…"` anywhere in the execution path.
- Rich output is escaped by construction: it is text in a block, not markup.

### Negative

- Interactive programs do not work. `vim`, `top`, an interactive `psql`, and
  anything wanting a TTY are out of scope, permanently.
- Programs that detect a pipe behave differently than they would in a terminal,
  and their output may be less pretty. We do not fabricate the difference.
- Users cannot use arrow-key history, `Ctrl-R`, or job control in the browser.
  Command history is a transcript query instead.
- Streaming output is line-oriented rather than screen-oriented, which is the
  right trade for reading results and the wrong one for watching a progress bar.

### Neutral

- The container still runs a real shell for interactive *desktop* use later. The
  ban here is on the web execution protocol, not on the image's contents.

## Alternatives considered

**Use a PTY and render with `xterm.js`.** Rejected: it makes the product a
terminal emulator with documentation attached, which inverts the value
proposition. It also couples the transcript to terminal state that has no
meaning in a record, and adds a large dependency to the highest-risk code path.

**Stream raw stdout/stderr bytes over SignalR and parse in the client.** Rejected:
it makes every client re-implement ordering, interleaving, and normalisation —
the exact duplication ADR 0001 identifies as this repository's main source of
bugs. Structured events keep that logic in one place.

**Shell out with `sh -c` for convenience.** Rejected: a command line is a string,
and a string is an injection surface. It also reintroduces the byte stream in
disguise.

**Render with `<pre>` and never interpret ANSI.** Rejected: real tools emit
colour that carries meaning. Suppressing it entirely loses information; the
requirement is to filter control sequences, not to display raw escapes.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — anti-goal: a terminal emulator
- [`../../AGENTS.md`](../../AGENTS.md) §4.8 — the interaction model is
  implemented once
- [`0014-framework-free-interaction-core.md`](./0014-framework-free-interaction-core.md)
- [`0015-policy-adjudicates-every-command.md`](./0015-policy-adjudicates-every-command.md)
- [`0003-in-memory-domain-events.md`](./0003-in-memory-domain-events.md)
