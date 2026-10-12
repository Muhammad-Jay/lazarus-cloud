/**
 * `@lazarus/interaction` — the Lazarus interaction model, implemented once.
 *
 * Framework-free. This package imports nothing but `@lazarus/contracts` and reaches
 * for no React, DOM, fetch, storage, timer or clock. It is a leaf in the frontend
 * package graph (§4.7) and the only place the interaction model is implemented
 * (§4.8), which is what makes a desktop shell a new client rather than a rewrite.
 *
 * Start at `interactionReducer`. Everything else exists because the reducer needs
 * it, and each module documents why it cannot be somewhere else.
 *
 * @see AGENTS.md §4.8
 * @see docs/adr/0014-framework-free-interaction-core.md
 */

export type {
  CommandSuggestionCandidate,
  InteractionAction,
  NoticeLevel,
} from './actions.js';

export {
  containsAnsi,
  interpretOutput,
  MAX_SPANS,
  type InterpretOptions,
} from './ansi.js';

export { syntheticId } from './ids.js';

export { rankSearchResults, rankSuggestions } from './ranking.js';

export {
  initialState,
  interactionReducer,
  resolveDraftOnContextChange,
  typedText,
  type DraftTransition,
} from './reducer.js';

export {
  appendEvent,
  blockForEvent,
  eventIdentity,
} from './transcript.js';