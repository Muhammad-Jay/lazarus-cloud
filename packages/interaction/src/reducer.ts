import type {
  CommandDraft,
  DraftConflict,
  ExecutionEvent,
  IsoTimestamp,
  LazarusInteraction,
  TranscriptBlock,
  WorkspaceContext,
} from '@lazarus/contracts';

import type { InteractionAction, NoticeLevel } from './actions.js';
import { rankSearchResults, rankSuggestions } from './ranking.js';
import { appendEvent, blockForEvent } from './transcript.js';

/**
 * The reducer.
 *
 * A pure function of `(state, action)`. No React, no DOM, no fetch, no storage, no
 * timers, no clock. Input and output are the plain `LazarusInteraction` shape from
 * the contract, which is what lets the web app, the CLI and a desktop shell drive
 * identical transitions (ADR-0014). Anything a second client would otherwise
 * reimplement — draft-conflict resolution, ordering, transcript normalisation —
 * lives here, because two implementations would drift and only one would get fixed.
 *
 * Every branch returns a new object and never mutates its input, so a client can
 * hold a previous state for comparison or replay. A branch with nothing to do
 * returns the *same* reference, which lets a client skip re-rendering without
 * adding an equality check of its own.
 */

/** An empty interaction state for a starting context. */
export const initialState = (context: WorkspaceContext): LazarusInteraction => ({
  context,
  draft: null,
  suggestions: { items: [] },
  search: { results: [] },
  actions: { items: [] },
  blocks: { blocks: [] },
});

/** What a context change does to the current draft. */
export type DraftTransition = 'unchanged' | 'cleared' | 'conflict';

/**
 * How a context change interacts with the current draft.
 *
 * §5.2 requires an explicit and predictable rule rather than whatever the
 * implementation happens to do. Ours:
 *
 * - **no draft** — nothing to do.
 * - **unmodified draft** — replaced. A draft composed from a suggestion or a pill
 *   belongs to the context it came from, and carrying it across would silently run
 *   a command from a document the reader has left.
 * - **modified draft** — a conflict is raised and the draft is **kept**. Discarding
 *   it would lose typing. The interaction core decides this is a conflict; the
 *   client asks (§5.2, ADR-0014).
 *
 * The test is `modified !== true` rather than `modified === false` because an absent
 * flag means unmodified. A draft that arrived without the flag should not raise a
 * conflict over content the reader never edited.
 */
export function resolveDraftOnContextChange(
  draft: CommandDraft | null | undefined,
): DraftTransition {
  if (draft === null || draft === undefined) {
    return 'unchanged';
  }
  return draft.modified === true ? 'conflict' : 'cleared';
}

/** Apply one action. */
export function interactionReducer(
  state: LazarusInteraction,
  action: InteractionAction,
): LazarusInteraction {
  switch (action.type) {
    case 'contextChanged':
      return applyContextChange(state, action.context, action.at);

    case 'draftChanged':
      return {
        ...state,
        draft: action.draft,
        // Composing after a conflict settles it implicitly: the reader has chosen
        // to keep working, so the raised conflict is stale.
        ...(state.draftConflict == null ? {} : { draftConflict: null }),
      };

    case 'draftCleared':
      return { ...state, draft: null, draftConflict: null };

    case 'draftConflictResolved':
      return action.resolution === 'kept'
        ? { ...state, draftConflict: null }
        : { ...state, draft: null, draftConflict: null };

    case 'suggestionsProvided':
      return {
        ...state,
        suggestions: {
          items: rankSuggestions(action.candidates, typedText(state.draft)),
          rankedAt: action.at,
        },
      };

    case 'searchResultsProvided':
      return {
        ...state,
        search: {
          query: action.query,
          results: rankSearchResults(action.results, action.query),
        },
      };

    case 'actionsProvided':
      // Replaced wholesale rather than merged. An action set describes what is
      // available *now*; a merged set would keep offering a `reuseCommand` for an
      // execution the reader already cleared.
      return { ...state, actions: { items: [...action.actions] } };

    case 'executionEventReceived':
      return applyExecutionEvent(state, action.event, action.at);

    case 'noticeRaised':
      return appendNotice(state, action.level, action.message, action.at);

    case 'transcriptCleared':
      return { ...state, blocks: { blocks: [] } };
  }
}

/**
 * Move the reader to a new context.
 *
 * Suggestions are re-ranked rather than carried over: they were ordered for the
 * previous context, and leaving them would show commands from a document the reader
 * has left — which reads as the product suggesting the wrong thing. Search results
 * go for the same reason.
 *
 * Declared actions survive, because they come from the experience rather than the
 * document.
 */
const applyContextChange = (
  state: LazarusInteraction,
  context: WorkspaceContext,
  at: IsoTimestamp,
): LazarusInteraction => {
  const transition = resolveDraftOnContextChange(state.draft);
  const suggestions =
    state.suggestions.items.length === 0
      ? state.suggestions
      : { items: [], rankedAt: at };
  const search = { results: [] };

  switch (transition) {
    case 'unchanged':
      return { ...state, context, suggestions, search };
    case 'cleared':
      return { ...state, context, draft: null, draftConflict: null, suggestions, search };
    case 'conflict': {
      const draft: CommandDraft = state.draft ?? { executable: '', arguments: [] };
      const draftConflict: DraftConflict = { draft, context, raisedAt: at };
      return { ...state, context, draft, draftConflict, suggestions, search };
    }
  }
};

/**
 * Record an execution event.
 *
 * The draft clears on `executionStarted` rather than on completion: the reader
 * submitted it, the composed draft has become the `command` block, and leaving it
 * in the input invites a double submission.
 *
 * A replayed event returns the identical state reference, which is how a
 * reconnecting client ends up with one transcript rather than two (§8.4).
 */
const applyExecutionEvent = (
  state: LazarusInteraction,
  event: ExecutionEvent,
  at: IsoTimestamp,
): LazarusInteraction => {
  const blocks = appendEvent(state.blocks.blocks, event, at);
  if (blocks === state.blocks.blocks) {
    return state;
  }
  const next: LazarusInteraction = {
    ...state,
    blocks: { blocks: [...blocks] },
  };
  return event.kind === 'executionStarted' ? { ...next, draft: null } : next;
};

/**
 * Record a locally raised notice.
 *
 * Routed through `executionFailed` rather than building a block by hand so there
 * is one place that knows what a notice is. The `code` distinguishes a local
 * notice from a real execution failure in the block identity, which keeps the two
 * from de-duplicating against each other.
 */
const appendNotice = (
  state: LazarusInteraction,
  level: NoticeLevel,
  message: string,
  at: IsoTimestamp,
): LazarusInteraction => {
  const block: TranscriptBlock | null = blockForEvent(
    {
      kind: 'executionFailed',
      at,
      message,
      code: `local:${level}`,
    },
    at,
  );
  if (block === null) {
    return state;
  }
  return { ...state, blocks: { blocks: [...state.blocks.blocks, block] } };
};

/**
 * The text the reader has typed, for matching against suggestions.
 *
 * Built from the structured draft rather than a raw input string, because the draft
 * is the representation that survives a reload and the one a pill produces. There
 * is no raw string in the state for a reducer to read.
 */
export const typedText = (draft: CommandDraft | null | undefined): string => {
  if (draft === null || draft === undefined) {
    return '';
  }
  const rest = draft.arguments.map((argument) => argument.value).join(' ');
  return rest.length > 0 ? `${draft.executable} ${rest}` : draft.executable;
};