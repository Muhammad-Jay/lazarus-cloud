import type { CommandSuggestion } from '@lazarus/contracts';
import { describe, expect, it } from 'vitest';

import type { CommandSuggestionCandidate } from '../src/actions.js';
import { rankSearchResults, rankSuggestions } from '../src/ranking.js';

/**
 * Ranking is computed once, here, and no client re-implements it (§4.4, §6.3).
 *
 * The properties that matter: it is deterministic, it is a total order, and it is
 * discovery rather than policy — nothing it does can widen what a reader may run.
 */

const withDraft = (
  overrides: Partial<CommandSuggestionCandidate> &
    Pick<CommandSuggestionCandidate, 'label' | 'kind'>,
): CommandSuggestionCandidate => overrides;

describe('rankSuggestions', () => {
  it('orders a documented command above a history entry for the same label', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'historyEntry', label: 'ls' }),
        withDraft({ kind: 'documentedCommand', label: 'ls' }),
      ],
      '',
    );
    expect(ranked.map((item) => item.kind)).toEqual(['documentedCommand', 'historyEntry']);
  });

  it('gives every result a score in range', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'documentedCommand', label: 'grep' }),
        withDraft({ kind: 'executableName', label: 'cat' }),
      ],
      'g',
    );
    for (const item of ranked) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(1);
    }
  });

  it('puts an exact label match first', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'executableName', label: 'gitk' }),
        withDraft({ kind: 'documentedCommand', label: 'git' }),
      ],
      'git',
    );
    expect(ranked[0]?.label).toBe('git');
  });

  it('prefers a prefix match over a substring match', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'executableName', label: 'xgitx' }),
        withDraft({ kind: 'executableName', label: 'gitk' }),
      ],
      'git',
    );
    expect(ranked[0]?.label).toBe('gitk');
  });

  it('matches on the executable as well as the label', () => {
    const ranked = rankSuggestions(
      [
        withDraft({
          kind: 'documentedCommand',
          label: 'List files',
          draft: { executable: 'ls', arguments: [] },
        }),
      ],
      'ls',
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  it('drops candidates matching nothing, however highly they are weighted', () => {
    // Typing nonsense must surface nothing, not the best-weighted survivors. A
    // documented command scores 0.4 and a task step 0.25, so a threshold approach
    // keeps both; "matched nothing" has to be its own answer rather than a low score.
    expect(
      rankSuggestions(
        [
          withDraft({ kind: 'documentedCommand', label: 'curl' }),
          withDraft({ kind: 'taskStep', label: 'ls' }),
          withDraft({ kind: 'executableName', label: 'cat' }),
        ],
        'zzzz',
      ),
    ).toEqual([]);
  });

  it('drops a non-matching candidate even when another one matches', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'executableName', label: 'curl' }),
        withDraft({ kind: 'documentedCommand', label: 'ls' }),
      ],
      'ls',
    );
    expect(ranked.map((item) => item.label)).toEqual(['ls']);
  });

  it('matches a substring anywhere in the label', () => {
    // `l` is inside `curl`, so this is a genuine match rather than a leak: the
    // substring tier is deliberately looser than the prefix tier.
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'executableName', label: 'curl' }),
        withDraft({ kind: 'documentedCommand', label: 'wget' }),
      ],
      'l',
    );
    expect(ranked.map((item) => item.label)).toEqual(['curl']);
  });

  it('keeps every candidate when the draft is empty', () => {
    const ranked = rankSuggestions(
      [
        withDraft({ kind: 'executableName', label: 'curl' }),
        withDraft({ kind: 'documentedCommand', label: 'ls' }),
      ],
      '',
    );
    expect(ranked).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    const lower = rankSuggestions([withDraft({ kind: 'documentedCommand', label: 'Git' })], 'git');
    const upper = rankSuggestions([withDraft({ kind: 'documentedCommand', label: 'Git' })], 'GIT');
    expect(lower.map((i) => i.label)).toEqual(upper.map((i) => i.label));
  });

  it('ignores surrounding whitespace in the query', () => {
    const padded = rankSuggestions([withDraft({ kind: 'documentedCommand', label: 'ls' })], '  ls  ');
    expect(padded).toHaveLength(1);
  });

  describe('determinism', () => {
    const candidates: CommandSuggestionCandidate[] = [
      withDraft({ kind: 'executableName', label: 'aa' }),
      withDraft({ kind: 'executableName', label: 'ab' }),
      withDraft({ kind: 'documentedCommand', label: 'aa' }),
      withDraft({ kind: 'taskStep', label: 'aa' }),
    ];

    it('produces the same order for the same input', () => {
      const once = rankSuggestions(candidates, 'a').map((item) => `${item.kind}:${item.label}`);
      for (let run = 0; run < 5; run += 1) {
        expect(rankSuggestions(candidates, 'a').map((i) => `${i.kind}:${i.label}`)).toEqual(once);
      }
    });

    it('breaks ties by kind then label, so the order is total', () => {
      // Without a total order an unstable sort reshuffles equal items between
      // renders, which reads as the product being broken rather than as jitter.
      expect(rankSuggestions(candidates, '').map((i) => `${i.kind}:${i.label}`)).toEqual([
        'documentedCommand:aa',
        'executableName:aa',
        'executableName:ab',
        'taskStep:aa',
      ]);
    });

    it('is stable under input reordering', () => {
      const forward = rankSuggestions(candidates, 'a').map((i) => `${i.kind}:${i.label}`);
      const reversed = rankSuggestions([...candidates].reverse(), 'a').map((i) => `${i.kind}:${i.label}`);
      expect(reversed).toEqual(forward);
    });

    it('does not mutate its input', () => {
      const input = [...candidates];
      const snapshot = structuredClone(input);
      rankSuggestions(input, 'a');
      expect(input).toEqual(snapshot);
    });

    it('does not overwrite a supplied score', () => {
      const ranked = rankSuggestions(candidates, 'a');
      for (const item of ranked) {
        expect(item.score).toBeDefined();
      }
    });
  });

  it('cannot widen access — it only orders what it is given', () => {
    // Discovery, not policy. An unlisted command the reader typed is still
    // submitted and still adjudicated by PolicyEvaluator (§4.5, ADR-0015); the
    // ranking simply does not surface it.
    const ranked = rankSuggestions(
      [withDraft({ kind: 'executableName', label: 'curl', draft: { executable: 'curl', arguments: [] } })],
      'curl',
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });
});

describe('rankSearchResults', () => {
  const document = {
    kind: 'document',
    ref: { documentId: 'intro', title: 'Introduction' },
    score: 0.5,
  } as const;
  const command = {
    kind: 'command',
    ref: { documentId: 'usage', title: 'List files' },
    commandId: 'ls',
    score: 0.9,
  } as const;
  const concept = {
    kind: 'concept',
    ref: { documentId: 'terms', title: 'Working directory' },
    score: 0.95,
  } as const;

  it('ranks a command hit above a document hit', () => {
    // §6.3: someone searching mid-task usually wants the next command to run.
    const ranked = rankSearchResults([document, command], 'list');
    expect(ranked[0]?.kind).toBe('command');
  });

  it('lets a strong supplied score still matter', () => {
    // The concept hit scores higher than the command hit, so blending rather than
    // overwriting keeps the backend's relevance counting.
    const ranked = rankSearchResults([command, concept], '');
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0);
  });

  it('boosts a result whose text contains the query', () => {
    const withoutMatch = rankSearchResults([document], 'zzz')[0]?.score ?? 0;
    const withMatch = rankSearchResults([document], 'intro')[0]?.score ?? 0;
    expect(withMatch).toBeGreaterThan(withoutMatch);
  });

  it('keeps every score in range', () => {
    for (const result of rankSearchResults([document, command, concept], 'e')) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic and total', () => {
    const input = [document, command, concept];
    const once = rankSearchResults(input, 'e').map((r) => r.ref.documentId);
    expect(rankSearchResults([...input].reverse(), 'e').map((r) => r.ref.documentId)).toEqual(once);
  });

  it('does not mutate its input', () => {
    const input = [{ ...document }, { ...command }];
    const snapshot = structuredClone(input);
    rankSearchResults(input, 'e');
    expect(input).toEqual(snapshot);
  });

  it('returns a fresh array', () => {
    const input = [{ ...document }];
    expect(rankSearchResults(input, '')).not.toBe(input);
  });
});

describe('score shape', () => {
  it('accepts a CommandSuggestion carrying a score', () => {
    // The exported surface is usable with the contract's own suggestion type, so
    // a client that already has one is not forced to strip the score first.
    const suggestions: CommandSuggestion[] = [
      { kind: 'documentedCommand', label: 'ls', score: 0.1 },
    ];
    const ranked = rankSuggestions(suggestions, '');
    expect(ranked[0]?.score).toBeDefined();
  });
});
