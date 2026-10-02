# docs/runbooks

Operational procedures. Written for someone who did not build the thing, at 3am,
without time to read source.

## Required properties

Every runbook has:

1. **Symptom** — what an operator observes, verbatim. Including the exact error
   text or log line.
2. **Impact** — who is affected and what is broken.
3. **Diagnosis** — numbered commands to run, and what each result means.
4. **Remediation** — numbered steps, each independently verifiable.
5. **Verification** — how to confirm it worked.
6. **Escalation** — when to stop and get a human.

## Rules

- No step may depend on state a previous reader would have. Assume nothing.
- Every command must be copy-pasteable, with no placeholders unless clearly
  marked `<service-id>`.
- Never include a destructive step without stating its blast radius and a way
  back.
- Prefer read-only diagnosis. Mutating first and observing second destroys
  evidence.
- Link to the module document for anything architectural.

## The list

Lands in Phase 21 (`TODO.md` 21.9):

| Runbook | Symptom |
|---|---|
| `failed-deploy.md` | A deployment is stuck or failed |
| `stuck-container.md` | A container is running but not serving |
| `leaked-subdomain.md` | An endpoint points at nothing |
| `tls-failure.md` | Certificate could not be obtained or renewed |
| `compromised-api-key.md` | A key may be leaked; revoke and rotate |
| `exhausted-quota.md` | Tenant is rate or concurrency limited |
| `restore-from-backup.md` | Recover Postgres and uploaded sources |
| `policy-denials.md` | Why the platform refused an operation |
| `github-app-uninstalled.md` | Deployments stopped after an install change |

## Test them

An untested runbook is fiction. `TODO.md` 21.9 requires each one to be followable
end to end by someone who did not write it. Walk them on a scratch install
periodically, and record what was wrong.