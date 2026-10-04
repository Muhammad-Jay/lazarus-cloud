/**
 * `@lazarus/contracts` — the generated interaction and session contract.
 *
 * Everything re-exported here is generated from
 * `src/schema/*.json`. It is not hand-written, and it imports nothing
 * (`AGENTS.md` §4.7). Consumers import from the package, never from another
 * package's `src/`.
 */

export type {
  Action,
  ActionSet,
  ColorRole,
  CommandArgument,
  CommandDraft,
  CommandSuggestion,
  DocumentationRef,
  DraftConflict,
  ExecutionEvent,
  ExecutionRequest,
  InlineCode,
  InlineCommand,
  InlineContent,
  InlineEmphasis,
  InlineLink,
  InlineText,
  IsoTimestamp,
  PolicyDecision,
  RichOutput,
  SuggestionSet,
  TextStyle,
  Transcript,
  TranscriptBlock,
  Uuid,
  WorkspaceContext,
} from './generated/interaction.js';

export type {
  ReconnectionTicket,
  SessionDescriptor,
  SessionEvent,
  SessionLimits,
  SessionState,
  StartSessionRequest,
} from './generated/session.js';
