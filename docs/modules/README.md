# docs/modules

One file per control-plane module. These are the boundary contracts.

## Why

`AGENTS.md` §3 and §4 define boundaries as rules. Rules that live only in a
document get violated, because the person violating them never read the section
they were in. These files sit next to the code and answer the questions a
developer actually has:

- What does this module own?
- What does it deliberately *not* own?
- What events does it publish, and what does it consume?
- Which tables does it own?
- Which policies apply to its operations?

## Required sections

Every module document contains:

```markdown
# <Module>

**Owns:** aggregates, value objects, tables, events published, events consumed.
**Does not own:** the neighbouring modules' concerns, listed explicitly.
**Depends on:** contracts in `Lazarus.Application`, nothing else.
**Policy gates:** which of its operations require a `PolicyEvaluator` decision.
**Tenant data:** how `tenant_id` is applied and enforced (app filter + RLS).
```

## The list

| Module | Document | Phase |
|---|---|---|
| Tenancy | `tenancy.md` | 3.6 |
| Identity | `identity.md` | 6.5 |
| Sources | `sources.md` | 12.7 |
| Specs | `specs.md` | 9.1 |
| Services | `services.md` | 9.2 |
| Releases | `releases.md` | 9.3 |
| Deployments | `deployments.md` | 9.4 |
| Endpoints | `endpoints.md` | 10.1 |
| Automation | `automation.md` | 13.1 |
| Exec | `exec.md` | 11.1 |
| Policy | `policy.md` | 7.1 |
| Secrets | `secrets.md` | 14.1 |
| Runtime | `runtime.md` | 8.1 |
| Edge | `edge.md` | 10.3 |
| Observability | `observability.md` | 3.4 |

## Rule

**Moving a boundary means updating the affected documents in the same PR**
(`AGENTS.md` §13.7). A boundary change that does not update these files is
incomplete — the code and the map have diverged, and the next person trusts the
map.
