import type {
  CommandDraft,
  DocumentationSearchResult,
  ExecutionEvent,
  LazarusInteraction,
  WorkspaceContext,
} from '@lazarus/contracts';
import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import type { CommandSuggestionCandidate, InteractionAction } from '../src/actions.js';
import { interpretOutput } from '../src/ansi.js';
import {
  initialState,
  interactionReducer,
  resolveDraftOnContextChange,
  typedText,
  type DraftTransition,
} from '../src/reducer.js';

/**
 * Reducer behaviour, table-driven over every action (§10: a table-driven case for
 * each action and each event).
 *
 * ## The schema check is the real point of this file
 *
 * §4.8 claims reducer input and output are "plain values" so a client and the
 * reducer cannot disagree. That claim is only worth anything if the output is
 * actually valid, and the failure mode is subtle: an explicit `undefined` property
 * is *present* as a key, and the contract's `additionalProperties: false` plus a
 * `required` list means that can fail validation while looking fine in a unit test
 * using `toEqual`, which ignores undefined-valued keys.
 *
 * So every resulting state is validated against the authoritative schema rather
 * than asserted against an expectation. A drifting reducer fails here.
 */

const require = createRequire(import.meta.url);
const schemaPath = require.resolve('@lazarus/contracts/schema/interaction.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;

/**
 * The one justified interop boundary: `ajv-formats` is CommonJS, so its callable
 * plugin sits on `.default`. Cast to the plugin type rather than `any`.
 */
const addFormats = formatsModule.default as FormatsPlugin;

const ajv = new Ajv2020({ strict: false, allErrors: true });
// `format` assertions are off by default in Ajv. Without this the schema's
// `format: 'uuid'` constraints would be silently unenforced, and the point of
// validating is to catch exactly that kind of drift.
addFormats(ajv);
const validate = ajv.compile(schema);

const assertValid = (state: LazarusInteraction, label: string): void => {
  const valid = validate(state);
  if (!valid) {
    throw new Error(
      `${label} produced state the contract rejects: ${ajv.errorsText(validate.errors)}`,
    );
  }
};

const EXPERIENCE_ID = '33333333-3333-4333-8333-333333333333';
const EXECUTION_ID = '44444444-4444-4444-8444-444444444444';
const AT = '2026-01-01T00:00:00.000Z';

const context: WorkspaceContext = {
  experienceId: EXPERIENCE_ID,
  experienceVersion: 1,
  documentId: 'intro',
};

const otherContext: WorkspaceContext = { ...context, documentId: 'usage' };

const draft = (modified: boolean): CommandDraft => ({
  executable: 'ls',
  arguments: [{ value: '-la' }],
  ...(modified ? { modified: true } : {}),
});

const candidate = (
  overrides: Partial<CommandSuggestionCandidate> & Pick<CommandSuggestionCandidate, 'label' | 'kind'>,
): CommandSuggestionCandidate => ({ ...overrides });

const executionEvents: readonly ExecutionEvent[] = [
  { kind: 'executionStarted', executionId: EXECUTION_ID, command: draft(false), at: AT },
  {
    kind: 'executionOutput',
    executionId: EXECUTION_ID,
    sequence: 1,
    output: interpretOutput('total 4\n', { stream: 'stdout' }),
    at: AT,
  },
  { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, durationMs: 9, at: AT },
  { kind: 'executionCancelled', executionId: EXECUTION_ID, at: AT },
  {
    kind: 'executionDenied',
    executionId: EXECUTION_ID,
    decision: { outcome: 'denied', code: 'image_not_allowed' },
    at: AT,
  },
  { kind: 'executionFailed', message: 'boom', at: AT },
];

const searchResults: readonly DocumentationSearchResult[] = [
  { kind: 'document', ref: { documentId: 'intro', title: 'Intro' }, score: 0.5 },
  { kind: 'command', ref: { documentId: 'usage', title: 'List files' }, commandId: 'ls', score: 0.9 },
];

const actions: readonly (readonly [string, InteractionAction])[] = [
  ['contextChanged', { type: 'contextChanged', context: otherContext, at: AT }],
  ['draftChanged', { type: 'draftChanged', draft: draft(true), at: AT }],
  ['draftCleared', { type: 'draftCleared', at: AT }],
  ['draftConflictResolved/kept', { type: 'draftConflictResolved', resolution: 'kept', at: AT }],
  ['draftConflictResolved/replaced', { type: 'draftConflictResolved', resolution: 'replaced', at: AT }],
  [
    'suggestionsProvided',
    {
      type: 'suggestionsProvided',
      at: AT,
      candidates: [
        candidate({ kind: 'documentedCommand', label: 'ls', draft: { executable: 'ls', arguments: [] } }),
        candidate({ kind: 'executableName', label: 'cat' }),
      ],
    },
  ],
  ['searchResultsProvided', { type: 'searchResultsProvided', query: 'list', results: searchResults, at: AT }],
  ['executionEventReceived', { type: 'executionEventReceived', event: executionEvents[0] as ExecutionEvent, at: AT }],
  ['noticeRaised', { type: 'noticeRaised', level: 'info', message: 'Copied', at: AT }],
  ['transcriptCleared', { type: 'transcriptCleared', at: AT }],
];

describe('every action produces contract-valid state', () => {
  it.each(actions)('%s', (_name, action) => {
    // From a bare state, and from a busy one, since an action that only holds up
    // on an empty transcript is not much of a reducer.
    assertValid(interactionReducer(initialState(context), action), `empty + ${action.type}`);
    const busy = actions.reduce(
      (state, [, step]) => interactionReducer(state, step),
      initialState(context),
    );
    assertValid(interactionReducer(busy, action), `busy + ${action.type}`);
  });
});

describe('every execution event produces contract-valid state', () => {
  it.each(executionEvents.map((event) => [event.kind, event] as const))(
    '%s',
    (_name, event) => {
      assertValid(
        interactionReducer(initialState(context), { type: 'executionEventReceived', event, at: AT }),
        event.kind,
      );
    },
  );

  it('records a whole execution in order', () => {
    const final = executionEvents
      .slice(0, 3)
      .reduce(
        (state, event) => interactionReducer(state, { type: 'executionEventReceived', event, at: AT }),
        initialState(context),
      );
    expect(final.blocks.blocks.map((block) => block.kind)).toEqual(['command', 'output', 'result']);
    assertValid(final, 'full execution');
  });
});

describe('initialState', () => {
  it('starts empty and contract-valid', () => {
    const state = initialState(context);
    expect(state.draft).toBeNull();
    expect(state.blocks.blocks).toEqual([]);
    assertValid(state, 'initialState');
  });
});

describe('resolveDraftOnContextChange', () => {
  it.each([
    ['no draft', null, 'unchanged'],
    ['an undefined draft', undefined, 'unchanged'],
    ['an unmodified draft', draft(false), 'cleared'],
    ['a draft with the flag absent', { executable: 'ls', arguments: [] }, 'cleared'],
    ['a modified draft', draft(true), 'conflict'],
  ] satisfies readonly (readonly [string, CommandDraft | null | undefined, DraftTransition])[])(
    'handles %s',
    (_name, input, expected) => {
      expect(resolveDraftOnContextChange(input)).toBe(expected);
    },
  );
});

describe('draft conflict', () => {
  const conflicted = interactionReducer(
    interactionReducer(initialState(context), { type: 'draftChanged', draft: draft(true), at: AT }),
    { type: 'contextChanged', context: otherContext, at: AT },
  );

  it('raises a conflict and keeps the draft', () => {
    expect(conflicted.draftConflict?.draft).toEqual(draft(true));
    expect(conflicted.draftConflict?.context).toEqual(otherContext);
    expect(conflicted.draft).toEqual(draft(true));
  });

  it('keeps the draft when the reader resolves by keeping it', () => {
    const resolved = interactionReducer(conflicted, {
      type: 'draftConflictResolved',
      resolution: 'kept',
      at: AT,
    });
    expect(resolved.draft).toEqual(draft(true));
    expect(resolved.draftConflict).toBeNull();
  });

  it('discards the draft when the reader resolves by replacing it', () => {
    const resolved = interactionReducer(conflicted, {
      type: 'draftConflictResolved',
      resolution: 'replaced',
      at: AT,
    });
    expect(resolved.draft).toBeNull();
    expect(resolved.draftConflict).toBeNull();
  });

  it('replaces an unmodified draft without asking', () => {
    const state = interactionReducer(
      interactionReducer(initialState(context), { type: 'draftChanged', draft: draft(false), at: AT }),
      { type: 'contextChanged', context: otherContext, at: AT },
    );
    expect(state.draft).toBeNull();
    expect(state.draftConflict).toBeNull();
  });

  it('settles the conflict implicitly when the reader composes again', () => {
    const resolved = interactionReducer(conflicted, {
      type: 'draftChanged',
      draft: { executable: 'pwd', arguments: [] },
      at: AT,
    });
    expect(resolved.draftConflict).toBeNull();
    expect(resolved.draft?.executable).toBe('pwd');
  });

  it('never executes anything on a context change', () => {
    // Changing context must not be a way to run something (ADR-0015).
    const state = interactionReducer(initialState(context), {
      type: 'contextChanged',
      context: otherContext,
      at: AT,
    });
    expect(state.blocks.blocks).toEqual([]);
  });
});

describe('execution events in state', () => {
  it('clears the draft once the command has started', () => {
    const state = interactionReducer(
      interactionReducer(initialState(context), { type: 'draftChanged', draft: draft(true), at: AT }),
      { type: 'executionEventReceived', event: executionEvents[0] as ExecutionEvent, at: AT },
    );
    expect(state.draft).toBeNull();
  });

  it('is idempotent under replay', () => {
    const once = executionEvents.reduce(
      (state, event) => interactionReducer(state, { type: 'executionEventReceived', event, at: AT }),
      initialState(context),
    );
    const twice = executionEvents.reduce(
      (state, event) => interactionReducer(state, { type: 'executionEventReceived', event, at: AT }),
      once,
    );
    expect(twice).toBe(once);
  });

  it('returns the same state reference for a replayed event', () => {
    const event = executionEvents[1] as ExecutionEvent;
    const once = interactionReducer(initialState(context), {
      type: 'executionEventReceived',
      event,
      at: AT,
    });
    expect(
      interactionReducer(once, { type: 'executionEventReceived', event, at: AT }),
    ).toBe(once);
  });

  it('records a denial in the transcript rather than dropping it', () => {
    const state = interactionReducer(initialState(context), {
      type: 'executionEventReceived',
      event: executionEvents[4] as ExecutionEvent,
      at: AT,
    });
    expect(state.blocks.blocks.map((block) => block.kind)).toEqual(['policyDenied']);
  });
});

describe('suggestions and search', () => {
  it('ranks suggestions and records when', () => {
    const state = interactionReducer(initialState(context), {
      type: 'suggestionsProvided',
      at: AT,
      candidates: [
        candidate({ kind: 'historyEntry', label: 'ls' }),
        candidate({ kind: 'documentedCommand', label: 'ls', draft: { executable: 'ls', arguments: [] } }),
      ],
    });
    expect(state.suggestions.rankedAt).toBe(AT);
    expect(state.suggestions.items[0]?.kind).toBe('documentedCommand');
    expect(state.suggestions.items[0]?.score).toBeGreaterThan(
      state.suggestions.items[1]?.score ?? 0,
    );
  });

  it('clears stale suggestions on a context change', () => {
    const ranked = interactionReducer(initialState(context), {
      type: 'suggestionsProvided',
      at: AT,
      candidates: [candidate({ kind: 'documentedCommand', label: 'ls' })],
    });
    const moved = interactionReducer(ranked, { type: 'contextChanged', context: otherContext, at: AT });
    expect(moved.suggestions.items).toEqual([]);
  });

  it('clears search results on a context change', () => {
    const searched = interactionReducer(initialState(context), {
      type: 'searchResultsProvided',
      query: 'list',
      results: searchResults,
      at: AT,
    });
    const moved = interactionReducer(searched, { type: 'contextChanged', context: otherContext, at: AT });
    expect(moved.search.results).toEqual([]);
  });

  it('ranks a command hit above a document hit', () => {
    const state = interactionReducer(initialState(context), {
      type: 'searchResultsProvided',
      query: 'list',
      results: searchResults,
      at: AT,
    });
    expect(state.search.results[0]?.kind).toBe('command');
  });
});

describe('transcript', () => {
  it('clears on request', () => {
    const busy = executionEvents.reduce(
      (state, event) => interactionReducer(state, { type: 'executionEventReceived', event, at: AT }),
      initialState(context),
    );
    expect(busy.blocks.blocks.length).toBeGreaterThan(0);
    expect(interactionReducer(busy, { type: 'transcriptCleared', at: AT }).blocks.blocks).toEqual([]);
  });

  it('records a local notice', () => {
    const state = interactionReducer(initialState(context), {
      type: 'noticeRaised',
      level: 'warning',
      message: 'Nothing to copy',
      at: AT,
    });
    expect(state.blocks.blocks).toHaveLength(1);
    expect(state.blocks.blocks[0]).toMatchObject({ kind: 'notice', message: 'Nothing to copy' });
  });

  it('does not let a local notice collide with a real execution failure', () => {
    // Both route through the same block builder, so their identities must differ
    // or one would de-duplicate the other away.
    const notified = interactionReducer(initialState(context), {
      type: 'noticeRaised',
      level: 'error',
      message: 'boom',
      at: AT,
    });
    const failed = interactionReducer(initialState(context), {
      type: 'executionEventReceived',
      event: { kind: 'executionFailed', message: 'boom', at: AT },
      at: AT,
    });
    expect(notified.blocks.blocks[0]?.id).not.toBe(failed.blocks.blocks[0]?.id);
  });
});

describe('typedText', () => {
  it.each([
    ['no draft', null, ''],
    ['an executable only', { executable: 'ls', arguments: [] }, 'ls'],
    [
      'an executable and arguments',
      { executable: 'git', arguments: [{ value: 'status' }, { value: '--short' }] },
      'git status --short',
    ],
    ['a draft with no arguments and a trailing space', { executable: 'ls ', arguments: [] }, 'ls '],
  ] satisfies readonly (readonly [string, CommandDraft | null, string])[])(
    'reads %s',
    (_name, input, expected) => {
      expect(typedText(input)).toBe(expected);
    },
  );
});

describe('purity', () => {
  it('never mutates the state it is given', () => {
    const before = initialState(context);
    const snapshot = structuredClone(before);
    for (const [, action] of actions) {
      interactionReducer(before, action);
    }
    expect(before).toEqual(snapshot);
  });

  it('returns a new object for every action that changes something', () => {
    const start = initialState(context);
    for (const [, action] of actions) {
      const next = interactionReducer(start, action);
      // `executionEventReceived` of a fresh event and `draftConflictResolved`
      // against no conflict are legitimately no-ops; everything else must move.
      const isNoOp =
        (action.type === 'executionEventReceived' && start.blocks.blocks.length > 0) ||
        (action.type === 'draftConflictResolved' && start.draftConflict == null);
      if (!isNoOp) {
        expect(next, action.type).not.toBe(start);
      }
    }
  });

  it('is deterministic for the same input', () => {
    for (const [, action] of actions) {
      expect(interactionReducer(initialState(context), action)).toEqual(
        interactionReducer(initialState(context), action),
      );
    }
  });
});
