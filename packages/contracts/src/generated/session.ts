// ---------------------------------------------------------------------------
// GENERATED. DO NOT EDIT.
//
// Source of truth: packages/contracts/src/schema/session.schema.json
// Regenerate with `just codegen`. Fix the schema, not this file.
// ---------------------------------------------------------------------------

export type IsoTimestamp = string;

export interface LazarusSession {
  descriptor: SessionDescriptor;
  limits: SessionLimits;
  /**
   * Present on start and on reissue. Absent once a ticket has been redeemed, so a reconnected client cannot retain a usable credential.
   */
  ticket?: ReconnectionTicket | null;
  /**
   * Where to subscribe for events. Relative to the operator-configured base address, never an absolute host, so no code path can hardcode an endpoint.
   */
  hubUrl?: string;
}
/**
 * Everything the server stores about a session. If a field is not here, the server does not have it.
 */

export interface ReconnectionTicket {
  ticket: string;
  sessionId: Uuid;
  expiresAt: IsoTimestamp;
}
/**
 * Everything the server stores about a session. If a field is not here, the server does not have it.
 */

export interface SessionDescriptor {
  sessionId: Uuid;
  /**
   * Derived from the validated token at session start. Never from a request body, query parameter, or URL segment, so a caller can never choose their tenant.
   */
  tenantId: string;
  experienceId: Uuid;
  experienceVersion: number;
  state: SessionState;
  createdAt: IsoTimestamp;
  /**
   * Server-enforced expiry. The client does not decide when a session ends, and expiry is reaped by the platform rather than by whoever is still connected.
   */
  expiresAt: string;
  endedAt?: IsoTimestamp | null;
  /**
   * The digest-pinned image this session resolved to. Recorded for audit and reproducibility; a tag is not an identity.
   */
  environmentImage?: string;
  /**
   * Present when state is 'failed'. A stable code, never an internal exception message.
   */
  failureCode?: string | null;
}
/**
 * The bounds a session was admitted under. Returned so a client can explain a refusal before it happens rather than after.
 */

export type SessionEvent =
  | {
      kind: "sessionStateChanged";
      sessionId: Uuid;
      state: SessionState;
      failureCode?: string | null;
      at: IsoTimestamp;
    }
  | {
      kind: "sessionClosing";
      sessionId: Uuid;
      reason?: string;
      at: IsoTimestamp;
    };

export interface SessionLimits {
  maxDurationSeconds: number;
  maxExecutions: number;
  maxConcurrent: number;
  remainingExecutions?: number | null;
}

export type SessionState = "starting" | "ready" | "ended" | "expired" | "failed";
/**
 * A lifecycle transition delivered to subscribers. Execution output is a separate stream: this one carries state changes and lets a client stop listening.
 */

export interface StartSessionRequest {
  experienceId: Uuid;
  experienceVersion?: number | null;
}

export type Uuid = string;
/**
 * A discriminated union rather than a state string plus nullable fields, so an exhaustive switch is the only way to read it and a missed case is a compile error.
 */
