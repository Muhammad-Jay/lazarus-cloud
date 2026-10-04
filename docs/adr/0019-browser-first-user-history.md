# 0019 — Browser-first user history

**Status:** Accepted
**Date:** 2026-10-04

## Context

A user works through an experience over time. Their transcript — the commands
they ran, the output they got, which documents they read — accumulates into
something genuinely useful: a record of what they actually did, which is often the
answer to the question they came with ("what did *I* run that showed this?").

The obvious place to put that is the server, alongside everything else. Sessions
are multi-tenant, audited, and rate-limited; transcript persistence looks like it
belongs with them.

Several properties argue against it:

- **The server does not need it.** Nothing in the product queries a user's
  history. No feature reads it back, no analytics depend on it, no support flow
  requires it.
- **The data is sensitive.** A transcript is a record of commands a person ran
  and whatever those commands printed. It will include paths, arguments, and
  output the user did not intend to retain. Storing it centrally makes it
  something we must protect, retain, and eventually delete on request.
- **It makes sessions durable when they must not be.** The product promise is
  that a session is temporary and expires. Persisting transcripts server-side
  pulls in retention, export, and deletion obligations across every tenant, for
  no product benefit.
- **Multi-user experiences are collaborative-adjacent**, and collaborative
  document storage is an explicit anti-goal.

The counter-argument is real: browser-local history is lost when a user clears
storage, is per-device, and cannot be shared. That is acceptable. It is a
convenience, not a guarantee.

One thing genuinely does need the server: **routing**. A tenant-scoped session
descriptor with a TTL, so a reconnecting client can find its session, and so
cleanup knows what to reap.

## Decision

**User history lives in browser IndexedDB. The server stores only temporary,
TTL-bound session metadata for routing and cleanup.**

- The **transcript**, the command history, and the read state live in the
  client's IndexedDB, keyed locally.
- The server stores a **session descriptor only**: session id, tenant, expiry,
  and reconnection metadata. It holds no command text and no output.
- The descriptor is **TTL-bound** and expires on a schedule enforced by the
  platform, not by the client.
- **History never crosses tenants or users.** A client's history is not readable by
  another user, and the API exposes no endpoint that returns another party's
  transcript.
- "Export" means the client serialises its own IndexedDB contents. There is no
  server-side export because there is no server-side copy.
- Clearing browser storage is a supported and expected way to clear history, not a
  data-loss incident.

## Consequences

### Positive

- The sensitive record never leaves the device, so there is no central copy to
  breach, retain, or honour a deletion request for.
- Server-side retention stays genuinely short and uniform.
- Offline and flaky-network behaviour improves: history renders without a round
  trip.
- No database schema for user content, which keeps the tenancy surface small.

### Negative

- History is per-browser. A user on a second device sees nothing, and a user who
  clears site data loses it. Accepted.
- There is no cross-user search or "what did everyone hit" analysis. Also
  accepted — it would require central storage of the exact data we just decided
  not to keep.
- Storage quota and eviction are browser behaviours we do not control, so history
  can vanish without warning. The UI must not imply durability.
- If a future feature genuinely needs server-side history, it needs its own ADR
  addressing retention, export, deletion, and per-tenant isolation.

### Neutral

- The session descriptor is not "history". Keeping the two separate is the point;
  collapsing them is how this decision gets lost.

## Alternatives considered

**Persist transcripts server-side.** Rejected: no product feature needs it, it
stores the most sensitive data we hold, and it converts "sessions are temporary"
into a retention programme.

**Keep history in memory / component state only, no IndexedDB.** Rejected: it
makes the transcript vanish on navigation, which defeats the point of a
transcript. IndexedDB is the minimum that works.

**IndexedDB plus server sync.** Rejected: sync reintroduces central storage, a
merge-conflict problem, and a second copy of the sensitive data. The only thing
that genuinely needs the server is routing, and routing is not history.

**Encrypt transcripts server-side so the server "can't read them".** Rejected:
encryption at rest does not change who holds the key, and a server that can
decrypt is a server that stores the data. Control is by custody, not by
ciphertext.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — anti-goal: a long-lived document
  store
- [`../../AGENTS.md`](../../AGENTS.md) §5 — user history is browser IndexedDB
- [`0016-three-versioned-schemas.md`](./0016-three-versioned-schemas.md)
- [`0012-sessions-are-not-published.md`](./0012-sessions-are-not-published.md)
