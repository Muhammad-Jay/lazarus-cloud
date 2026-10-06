import type {
  Action,
  CommandDraft,
  CommandSuggestion,
  DocumentationSearchResult,
  ExecutionEvent,
  IsoTimestamp,
  WorkspaceContext,
} from '@lazarus/contracts';

/**
 * The actions a client can dispatch.
 *
 * §5.3 says the interaction model is driven by "actions that change local
 * interface state", and the boundary is worth stating plainly: this union covers
 * *interface* state only. Submitting a command is not here — that is a request to
 * the platform, it is the transport's business, and its result arrives back as an
 * `executionEvent` like any other. A reducer that knew how to run things would not
 * be a reducer.
 *
 * Every action carries `at`, supplied by the caller. The reducer reads no clock:
 * §5's consistency rules require one injected time source in TypeScript and forbid
 * `Date.now()` in domain logic, and a reducer that called it would be
 * non-deterministic and untestable.
 *
 * Timestamps are `IsoTimestamp`, so a client that passes a bare number fails to
 * typecheck rather than producing a transcript with an ambiguous time unit.
 */
export type InteractionAction =
  /** The reader moved: a different document, task, directory or session. */
  | { type: 'contextChanged'; context: WorkspaceContext; at: IsoTimestamp }
  /** The draft was composed or edited, including by selecting a suggestion or pill. */
  | { type: 'draftChanged'; draft: CommandDraft; at: IsoTimestamp }
  /** The draft was emptied. */
  | { type: 'draftCleared'; at: IsoTimestamp }
  /** The reader answered a raised draft conflict. */
  | { type: 'draftConflictResolved'; resolution: 'kept' | 'replaced'; at: IsoTimestamp }
  /** New suggestion candidates arrived; the reducer ranks them. */
  | { type: 'suggestionsProvided'; candidates: readonly CommandSuggestionCandidate[]; at: IsoTimestamp }
  /** New search results arrived; the reducer ranks them. */
  | { type: 'searchResultsProvided'; query: string; results: readonly DocumentationSearchResult[]; at: IsoTimestamp }
  /** The available non-command actions changed — a task, document or execution arrived. */
  | { type: 'actionsProvided'; actions: readonly Action[]; at: IsoTimestamp }
  /** One event from an execution's stream. */
  | { type: 'executionEventReceived'; event: ExecutionEvent; at: IsoTimestamp }
  /** The client raised a local notice — a validation message, say. */
  | { type: 'noticeRaised'; level: NoticeLevel; message: string; at: IsoTimestamp }
  /** The transcript was cleared at the reader's request. */
  | { type: 'transcriptCleared'; at: IsoTimestamp };

/** Severity of a locally raised notice. Mirrors the `notice` block's `level`. */
export type NoticeLevel = 'info' | 'warning' | 'error';

/**
 * A suggestion as supplied by the experience, before ranking.
 *
 * Structurally a `CommandSuggestion` minus `score`: the score is this package's
 * output, not an input. Declaring the input separately means a caller cannot
 * pre-rank its way past the single ranking implementation (§4.8).
 */
export type CommandSuggestionCandidate = Omit<CommandSuggestion, 'score'>;