// ---------------------------------------------------------------------------
// GENERATED. DO NOT EDIT.
//
// Source of truth: packages/contracts/src/schema/interaction.schema.json
// Regenerate with `just codegen`. Fix the schema, not this file.
// ---------------------------------------------------------------------------

export interface Action {
  id: Uuid;
  kind: "openDocument" | "startTask" | "reuseCommand" | "clearTranscript" | "cancelExecution" | "endSession";
  label: string;
  documentId?: string | null;
  taskId?: string | null;
  executionId?: Uuid | null;
  /**
   * Why the action cannot be taken right now. A disabled action always carries a reason; a silently inert control is a bug.
   */
  disabledReason?: string | null;
}

export interface ActionSet {
  /**
   * @maxItems 100
   */
  items: Action[];
}
/**
 * One argument of a command. A command is a list of arguments, never a shell string (ADR-0013).
 */

export type ColorRole =
  "default" | "muted" | "accent" | "success" | "warning" | "danger" | "info" | "stdout" | "stderr";
/**
 * An RFC 3339 instant. Never a bare number, so two runtimes cannot disagree about the unit.
 */

export interface CommandArgument {
  value: string;
  /**
   * Whether the argument was entered as a quoted literal, so presentation can show it faithfully without re-parsing.
   */
  quoted?: boolean;
}
/**
 * What the reader has composed but not yet run. Plain data: the reducer takes and returns this, so any client can drive the same transitions (ADR-0014).
 */

export interface CommandDraft {
  executable: string;
  /**
   * @maxItems 128
   */
  arguments: CommandArgument[];
  /**
   * The documented command this draft started from, if any. Discovery provenance only; it is never treated as authorisation (ADR-0015).
   */
  sourceCommandId?: string | null;
  /**
   * Whether the reader has edited the draft. A context change replaces an unmodified draft and conflicts on a modified one, so this flag is the whole of that decision.
   */
  modified?: boolean;
}
/**
 * A candidate to put in the draft. Ranking is computed once, in packages/interaction, so no client re-implements it (ADR-0014).
 */

export interface CommandSuggestion {
  /**
   * A discriminated union, so a client never has to guess which fields are meaningful.
   */
  kind: "documentedCommand" | "executableName" | "taskStep" | "historyEntry";
  label: string;
  detail?: string;
  draft?: CommandDraft;
  score?: number;
  documentId?: string | null;
}
/**
 * A pointer to a published document.
 */

export interface DocumentationRef {
  documentId: string;
  title?: string;
  anchor?: string;
}
/**
 * Raised when a context change would replace a draft the reader has edited. The interaction core decides that this is a conflict; the client asks (ADR-0014).
 */

export interface DraftConflict {
  draft: CommandDraft;
  context: WorkspaceContext;
  raisedAt?: IsoTimestamp;
}
/**
 * Where the reader currently is: which experience, which document, and where in the reading order. A change to this can conflict with an edited draft (see DraftConflict).
 */

export type ExecutionEvent =
  | {
      kind: "executionStarted";
      executionId: Uuid;
      command: CommandDraft;
      decision?: PolicyDecision;
      at: IsoTimestamp;
    }
  | {
      kind: "executionOutput";
      executionId: Uuid;
      sequence: number;
      output: RichOutput;
      at?: IsoTimestamp;
    }
  | {
      kind: "executionCompleted";
      executionId: Uuid;
      exitCode: number;
      durationMs?: number;
      at: IsoTimestamp;
    }
  | {
      kind: "executionCancelled";
      executionId: Uuid;
      reason?: string;
      at: IsoTimestamp;
    }
  | {
      kind: "executionDenied";
      executionId: Uuid;
      decision: PolicyDecision;
      at: IsoTimestamp;
    }
  | {
      kind: "executionFailed";
      executionId?: Uuid | null;
      code?: string;
      message?: string;
      at: IsoTimestamp;
    };
/**
 * Content rendered inline within a transcript block or a document fragment. A discriminated union, so a renderer has a total switch rather than a guess (AGENTS.md §6).
 */

export interface ExecutionRequest {
  sessionId: Uuid;
  executable: string;
  /**
   * @maxItems 128
   */
  arguments: CommandArgument[];
  sourceCommandId?: string | null;
  clientTimestamp?: IsoTimestamp;
}

export interface InlineCode {
  kind: "code";
  value: string;
  language?: string | null;
}
/**
 * A reference to a documented command, rendered with its summary. Documentation and interaction are one feature, and this is the join between them.
 */

export interface InlineCommand {
  kind: "commandRef";
  commandId: string;
  label?: string;
  summary?: string;
}

export type InlineContent = InlineText | InlineEmphasis | InlineCode | InlineLink | InlineCommand;
/**
 * One entry in the transcript, produced exactly once, where an ExecutionEvent becomes a block. Presentation consumes blocks and never parses raw output or reorders them (ADR-0014).
 */

export interface InlineEmphasis {
  kind: "emphasis";
  value: string;
  tone?: "neutral" | "strong";
}
/**
 * A link inside a document. Destination origin was checked at publish time, so a reader is never fetched a remote resource the publisher did not declare (ADR-0017).
 */

export interface InlineLink {
  kind: "link";
  href: string;
  label: string;
  external?: boolean;
}
/**
 * Ranked suggestions for the current context. Ranking is computed once, in packages/interaction, so no client re-implements it (ADR-0014).
 */

export interface InlineText {
  kind: "text";
  value: string;
}

export type IsoTimestamp = string;
/**
 * One event in an execution's stream. Structured events rather than a byte stream: a transcript has to be orderable, searchable, and testable, and none of those is true of bytes (ADR-0013).
 */

export interface LazarusInteraction {
  context: WorkspaceContext;
  /**
   * What the reader has composed, or null when the draft is empty. The same value shape the reducer reads and returns, so a client and the reducer cannot disagree about it.
   */
  draft?: CommandDraft | null;
  suggestions: SuggestionSet;
  actions: ActionSet;
  blocks: Transcript;
  /**
   * Present only when a context change would replace a draft the reader has edited. The interaction core decides that this is a conflict; the client asks.
   */
  draftConflict?: DraftConflict | null;
}
/**
 * Where the reader currently is: which experience, which document, and where in the reading order. A change to this can conflict with an edited draft (see DraftConflict).
 */

export interface PolicyDecision {
  outcome: "allowed" | "denied";
  /**
   * Stable, machine-readable denial code. Presentation maps it to prose; the code never embeds user-facing wording.
   */
  code?: string;
  message?: string;
  evaluatedAt?: IsoTimestamp;
}
/**
 * Output after ANSI interpretation. This is a FILTER, not an emulator: cursor movement, erase, and other control semantics are stripped rather than emulated, because a transcript is a record rather than a screen (ADR-0013).
 */

export interface RichOutput {
  /**
   * @maxItems 4096
   */
  spans: {
    text: string;
    style?: TextStyle;
    /**
     * Which stream produced the text. Preserved because interleaving is part of what the program actually printed.
     */
    stream?: "stdout" | "stderr";
  }[];
  /**
   * Whether output was cut at a platform limit. Truncation is always disclosed; output is never silently shortened.
   */
  truncated?: boolean;
  byteCount?: number;
}
/**
 * Presentation of one span of output. Carries semantic roles, never literal colours (ADR-0018).
 */

export interface SuggestionSet {
  /**
   * @maxItems 200
   */
  items: CommandSuggestion[];
  rankedAt?: IsoTimestamp;
}
/**
 * The ordered record of the session. Blocks are appended in event order and never reordered by presentation (ADR-0014).
 */

export interface TextStyle {
  color?: ColorRole;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}
/**
 * A request to run a command. Every execution passes a PolicyEvaluator decision first, whether or not the command was declared by the experience (ADR-0015).
 */

export interface Transcript {
  /**
   * @maxItems 10000
   */
  blocks: TranscriptBlock[];
}

export type TranscriptBlock =
  | {
      kind: "command";
      id: Uuid;
      executionId?: Uuid | null;
      command?: CommandDraft;
      at: IsoTimestamp;
    }
  | {
      kind: "output";
      id: Uuid;
      executionId: Uuid;
      sequence?: number;
      output: RichOutput;
      at: IsoTimestamp;
    }
  | {
      kind: "result";
      id: Uuid;
      executionId: Uuid;
      exitCode: number;
      durationMs?: number;
      at: IsoTimestamp;
    }
  | {
      kind: "notice";
      id: Uuid;
      level: "info" | "warning" | "error";
      message: string;
      at: IsoTimestamp;
    }
  | {
      kind: "policyDenied";
      id: Uuid;
      executionId: Uuid;
      decision: PolicyDecision;
      at: IsoTimestamp;
    }
  | {
      kind: "documentation";
      id: Uuid;
      ref: DocumentationRef;
      at: IsoTimestamp;
    };

export type Uuid = string;
/**
 * A semantic colour role, never a literal colour value. The presentation layer maps a role to a token from packages/tokens (ADR-0018), so a raw colour cannot reach a component and contrast stays checkable in one place.
 */

export interface WorkspaceContext {
  experienceId: Uuid;
  experienceVersion: number;
  documentId?: string | null;
  sessionId?: Uuid | null;
  workingDirectory?: string | null;
  taskId?: string | null;
}
/**
 * The outcome of one PolicyEvaluator evaluation. A denial is as auditable as an allow, and carries a reason a reader can act on: free-form commands mean the deny path is common, not exceptional.
 */
