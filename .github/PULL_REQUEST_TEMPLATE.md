<!--
Keep this template short. A long form gets filled in with noise, and noise hides
the two things a reviewer actually needs.

If any section does not apply, delete it rather than writing "N/A".
-->

## What

<!-- One or two sentences. What changes, for whom. -->

## Why

<!-- The problem, not the solution. If you cannot state the problem, the change may not be needed. -->

Closes `TODO.md` `<phase>.<seq>`
ADR: <!-- link, or "none" -->

## How it was verified

<!--
Actual output, not expected output. Paste the relevant lines.

    $ just check
    ...

A bug fix MUST say which test failed before the fix (AGENTS.md §10). If you could
not write a failing test, say so and explain what you did instead.
-->

## Review checklist

- [ ] `just check` passes
- [ ] New logic has tests at the layer that owns it
- [ ] A fix has a test that **failed before** the fix
- [ ] No `any`, no `@ts-ignore`, no `eslint-disable`, no empty `catch`
- [ ] No new hardcoded URL, port, hostname, ID, email, or path
- [ ] Tenant scope comes from the token, and the query filters by it
- [ ] Any container/process/network path goes through `PolicyEvaluator`
- [ ] Generated code regenerated and committed, if its source changed
- [ ] Boundary move reflected in `docs/modules/<name>.md`
- [ ] Cancellation flows end to end; external calls have timeouts
- [ ] Privilege-affecting actions are audited
- [ ] No secrets in the diff

## Notes for the reviewer

<!--
Anything a reviewer would otherwise have to ask for:

- Trade-offs you considered and rejected
- Where you were uncertain, and what would settle it
- Parts you deliberately left out of scope

Naming what you did NOT do is more useful than a longer diff.
-->
