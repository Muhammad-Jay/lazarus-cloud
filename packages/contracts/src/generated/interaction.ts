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
  doc?: DocumentationRef;
  taskId?: string | null;
  executionId?: Uuid | null;
  /**
   * Why the action cannot be taken right now. A disabled action always carries a reason; a silently inert control is a bug.
   */
  disabledReason?: string | null;
}
/**
 * The documentation this action leads to. Explicit rather than inferred, so an element never resolves its own target by parsing prose (§6.3).
 */

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
 * The program to run: an absolute path or a bare name resolved against the image's PATH by the runtime. The same shape the experience schema requires of a documented command, so a draft cannot carry something the contract would never have declared. No shell metacharacters, because there is no shell in the product to inject into (ADR-0013).
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
  executable: ExecutableName;
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
 * A pill-shaped element representing a command or a command fragment (§4.3). A pill may be a complete command or a fragment depending on context. Selecting one composes or reveals; it NEVER executes, because a suggestion that silently executes is explicitly not allowed (§4.3). `fragment` is display-only text and is never submitted as a command.
 */

export interface CommandPill {
  label: string;
  draft?: CommandDraft;
  fragment?: string;
  doc?: DocumentationRef1;
  /**
   * Whether this pill is part of a prepared sequence rather than something already run. The interface must distinguish a prepared sequence from commands that actually executed (§4.3).
   */
  prepared?: boolean;
}
/**
 * A pointer to a published document, and the join between documentation and interaction. A core interaction entity (LAZARUS_MODEL.md §5.1), not a convenience: documentation search, command suggestions, actions, pills and transcript blocks all carry one. Hover explanations are derived from this and the creator's documentation rather than from assumptions about the command (§4.5).
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
  doc?: DocumentationRef2;
}
/**
 * A pointer to a published document, and the join between documentation and interaction. A core interaction entity (LAZARUS_MODEL.md §5.1), not a convenience: documentation search, command suggestions, actions, pills and transcript blocks all carry one. Hover explanations are derived from this and the creator's documentation rather than from assumptions about the command (§4.5).
 */

export interface DocumentationRef {
  documentId: string;
  title?: string;
  anchor?: string;
  /**
   * One-line explanation shown in a popover without opening the document (§4.5). Bounded because a popover must not become a second copy of the document.
   */
  summary?: string;
  /**
   * Commands this document describes, for popovers and search results (§4.5, §6.3). A DISPLAY HINT ONLY: the authoritative command-to-document mapping lives in the experience contract, and the reverse index is derived from it rather than authored twice. Never a permission source.
   *
   * @maxItems 50
   */
  relatedCommandIds?: string[];
}

export interface DocumentationRef1 {
  documentId: string;
  title?: string;
  anchor?: string;
  /**
   * One-line explanation shown in a popover without opening the document (§4.5). Bounded because a popover must not become a second copy of the document.
   */
  summary?: string;
  /**
   * Commands this document describes, for popovers and search results (§4.5, §6.3). A DISPLAY HINT ONLY: the authoritative command-to-document mapping lives in the experience contract, and the reverse index is derived from it rather than authored twice. Never a permission source.
   *
   * @maxItems 50
   */
  relatedCommandIds?: string[];
}
/**
 * A candidate to put in the draft. Ranking is computed once, in packages/interaction, so no client re-implements it (ADR-0014).
 */

export interface DocumentationRef2 {
  documentId: string;
  title?: string;
  anchor?: string;
  /**
   * One-line explanation shown in a popover without opening the document (§4.5). Bounded because a popover must not become a second copy of the document.
   */
  summary?: string;
  /**
   * Commands this document describes, for popovers and search results (§4.5, §6.3). A DISPLAY HINT ONLY: the authoritative command-to-document mapping lives in the experience contract, and the reverse index is derived from it rather than authored twice. Never a permission source.
   *
   * @maxItems 50
   */
  relatedCommandIds?: string[];
}
/**
 * A search response. Selecting a result may populate a draft, change context, or reveal options, but it must never imply an operation happened (§4.4) — hence no execution state anywhere in this shape.
 */

export interface DocumentationSearch {
  query?: string;
  /**
   * @maxItems 50
   */
  results: DocumentationSearchResult[];
}
/**
 * One search hit. kind is a discriminated union so a client knows what selecting it means without inspecting the payload.
 */

export interface DocumentationSearchResult {
  kind: "document" | "task" | "command" | "concept";
  ref: DocumentationRef1;
  taskId?: string | null;
  /**
   * For a command hit: the documented command this result names.
   */
  commandId?: string | null;
  score: number;
  /**
   * Matched text for display. Bounded, because a result list is not a place to render a whole document.
   */
  excerpt?: string;
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

export type ExecutableName = string;
/**
 * An RFC 3339 instant. Never a bare number, so two runtimes cannot disagree about the unit.
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
 * Output recognised as structured content (§4.6). A discriminated union of component types a renderer knows how to instantiate — never arbitrary content, and never a component the renderer has to trust. EVERY branch requires `raw`, carrying the text the program actually printed, for two reasons the model is explicit about: a rich renderer must not fabricate or silently alter the execution result, and anything unrecognised must fall back to that text rather than disappear (§4.6, §10.3). Presentation is therefore layered on top of real output and is never a replacement for it.
 */

export interface ExecutionRequest {
  sessionId: Uuid;
  executable: ExecutableName;
  /**
   * @maxItems 128
   */
  arguments: CommandArgument[];
  sourceCommandId?: string | null;
  clientTimestamp?: IsoTimestamp;
}
/**
 * A reader-side pointer to a runtime session. Coordination and expiry stay the backend's responsibility; the browser is never trusted to close a session correctly (§8.5).
 */

export interface InlineCode {
  kind: "code";
  value: string;
  language?: string | null;
}
/**
 * A link inside a document. Destination origin was checked at publish time, so a reader is never fetched a remote resource the publisher did not declare (ADR-0017).
 */

export interface InlineCommand {
  kind: "commandRef";
  commandId: string;
  label?: string;
  summary?: string;
}
/**
 * A documentation reference inside a transcript block, so output can explain itself with the creator's documentation rather than with invented prose (§4.5, §4.6).
 */

export type InlineContent =
  | InlineText
  | InlineEmphasis
  | InlineCode
  | InlineLink
  | InlineCommand
  | InlineDocumentation
  | InlineControl
  | InlinePill;
/**
 * @maxItems 512
 */

export type InlineContentList = InlineContent[];
/**
 * One entry in the transcript, produced exactly once, where an ExecutionEvent becomes a block. Presentation consumes blocks and never parses raw output or reorders them (ADR-0014).
 */

export interface InlineControl {
  kind: "control";
  label?: string;
  /**
   * @minItems 1
   * @maxItems 20
   */
  actionIds:
    | [Uuid]
    | [Uuid, Uuid]
    | [Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
    | [
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid,
        Uuid
      ];
  value?: string | number | boolean | null;
}
/**
 * A command pill inside documentation or a transcript (§4.3). Selecting it composes a draft or reveals options; it never executes.
 */

export interface InlineDocumentation {
  kind: "documentationRef";
  doc: DocumentationRef1;
}
/**
 * A supported interactive control inline in content (§10.2). It names DECLARED actions rather than carrying behaviour, so no document or output can introduce new frontend behaviour (§5.3, §13).
 */

export interface InlineEmphasis {
  kind: "emphasis";
  value: string;
  tone?: "neutral" | "strong";
}

export interface InlineLink {
  kind: "link";
  href: string;
  label: string;
  external?: boolean;
}
/**
 * A reference to a documented command, rendered with its summary. Documentation and interaction are one feature, and this is the join between them.
 */

export interface InlinePill {
  kind: "pill";
  pill: CommandPill;
}
/**
 * One choice in an options component (§4.2). Selecting one composes into the draft; it never executes anything (§4.3).
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
  search: DocumentationSearch;
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

export interface LocalRuntimeLink {
  sessionId: Uuid;
  /**
   * The last known runtime state, mirroring the server-side descriptor's vocabulary so restoration cannot invent a state the server would not recognise.
   */
  state: "starting" | "ready" | "ended" | "expired" | "failed" | "unknown";
  expiresAt?: IsoTimestamp | null;
  /**
   * When the client last heard from the runtime. Absence of confirmation is why `unknown` exists: the honest state after a tab has been closed for a while is not `ready`.
   */
  lastConfirmedAt?: IsoTimestamp | null;
}
/**
 * The reader's own record of their temporary experience, persisted in browser storage (§8.1, §8.2). NOT the runtime session and NOT the server's coordination descriptor: §8.3 says those three have different lifecycles and must not be conflated. This is the browser-side one, and it deliberately has no tenant, no routing metadata and no credentials — sensitive values must not be placed in browser storage for convenience (§8.1). The server-side descriptor lives in session.schema.json.
 */

export interface LocalSession {
  /**
   * Version of THIS record, for migration. The model calls schema migrations out as something this design must account for (§8.2), so it is a required field rather than something inferred from the presence of other keys.
   */
  schemaVersion: number;
  id: Uuid;
  /**
   * The experience this record belongs to. The model calls this workspaceId (§8.2); one concept, one name, so the interaction contract's name wins.
   */
  experienceId: string;
  context: WorkspaceContext;
  /**
   * The reader's current or most recent draft. Structured rather than a raw string, so it restores with the same shape the reducer reads.
   */
  draft?: CommandDraft | null;
  transcript: Transcript;
  /**
   * The runtime session this record was last associated with, or null when there is none. Carries the server's state so a restored transcript can be honest about whether the environment still exists — §8.4 is explicit that a restored transcript must not imply the old runtime is still active. A reader can inspect local history long after the session expired (§8.3).
   */
  runtimeSession?: LocalRuntimeLink | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  /**
   * An RFC 3339 instant. Never a bare number, so two runtimes cannot disagree about the unit.
   */
  expiresAt?: string;
}
/**
 * The ordered record of the session. Blocks are appended in event order and never reordered by presentation (ADR-0014).
 */

export interface OutputLink {
  href: string;
  label: string;
  external?: boolean;
}
/**
 * A request to run a command. Every execution passes a PolicyEvaluator decision first, whether or not the command was declared by the experience (ADR-0015).
 */

export interface OutputOption {
  label: string;
  detail?: string;
  draft?: CommandDraft;
  selected?: boolean;
  disabledReason?: string | null;
}
/**
 * A link surfaced by output. Destination origin is checked when the output is recognised, and `external` is a fact about what was checked rather than a hint to the renderer (§13).
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

export type RawText = string;
/**
 * Content rendered inline within a transcript block or a document fragment. A discriminated union, so a renderer has a total switch rather than a guess (AGENTS.md §6). Covers the inline kinds the model lists in §10.2: text, command tokens, links, documentation references, and supported interactive controls.
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
  structured?: StructuredOutput;
}
/**
 * Presentation of one span of output. Carries semantic roles, never literal colours (ADR-0018).
 */

export type StructuredOutput =
  | {
      kind: "data";
      raw: RawText;
      /**
       * A JSON object or array recognised by an explicitly defined protocol. Deliberately not scalars: structured data is structured, and a scalar has nothing to structure — it belongs in `raw`. The RENDERER validates what it will instantiate and falls back to raw for anything it does not recognise.
       */
      data?:
        | {
            [k: string]: unknown;
          }
        | unknown[];
      dataType?: string | null;
    }
  | {
      kind: "section";
      raw: RawText;
      label: string;
      expandedByDefault?: boolean;
      content?: InlineContentList;
    }
  | {
      kind: "options";
      raw: RawText;
      label?: string | null;
      /**
       * @maxItems 100
       */
      options: OutputOption[];
    }
  | {
      kind: "links";
      raw: RawText;
      /**
       * @maxItems 100
       */
      links: OutputLink[];
    }
  | {
      kind: "commandPills";
      raw: RawText;
      /**
       * @maxItems 100
       */
      pills: CommandPill[];
    }
  | {
      kind: "documentation";
      raw: RawText;
      doc: DocumentationRef1;
    }
  | {
      kind: "control";
      raw: RawText;
      label?: string;
      /**
       * Ids of DECLARED actions this control offers (§5.3). The element names what it can do and a central interaction layer decides how — so command output can never carry behaviour, only a request for behaviour the product already knows about. This is the boundary that stops output from becoming executable UI (§13).
       *
       * @minItems 1
       * @maxItems 20
       */
      actionIds:
        | [Uuid]
        | [Uuid, Uuid]
        | [Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid]
        | [
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid
          ]
        | [
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid,
            Uuid
          ];
      value?: string | number | boolean | null;
    };
/**
 * The text the program actually printed for this component. Always carried with structured output so the result can fall back to it (§4.6, §10.3).
 */

export interface SuggestionSet {
  /**
   * @maxItems 200
   */
  items: CommandSuggestion[];
  rankedAt?: IsoTimestamp;
}

export interface TextStyle {
  color?: ColorRole;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
}

export interface Transcript {
  /**
   * @maxItems 10000
   */
  blocks: TranscriptBlock[];
}
/**
 * Ranked suggestions for the current context. Ranking is computed once, in packages/interaction, so no client re-implements it (ADR-0014).
 */

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
      ref: DocumentationRef1;
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
