import { describe, expect, it } from 'vitest';

import { interpretOutput } from '../src/ansi.js';
import { appendEvent, blockForEvent, eventIdentity } from '../src/transcript.js';

import type { CommandDraft, ExecutionEvent, TranscriptBlock } from '@lazarus/contracts';

/**
 * Normalisation is the single point where an event becomes a block (§4.8).
 *
 * Table-driven across every event kind, because a new kind added to the schema
 * without a case here would silently drop from the transcript.
 */

const EXECUTION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const AT = '2026-01-01T00:00:00.000Z';

const draft: CommandDraft = { executable: 'ls', arguments: [{ value: '-la' }] };
const output = interpretOutput('hello', { stream: 'stdout' });

const events: readonly ExecutionEvent[] = [
  { kind: 'executionStarted', executionId: EXECUTION_ID, command: draft, at: AT },
  { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 1, output, at: AT },
  { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, durationMs: 12, at: AT },
  { kind: 'executionCancelled', executionId: EXECUTION_ID, reason: 'reader cancelled', at: AT },
  { kind: 'executionCancelled', executionId: EXECUTION_ID, at: AT },
  {
    kind: 'executionDenied',
    executionId: EXECUTION_ID,
    decision: { outcome: 'denied', code: 'image_not_allowed' },
    at: AT,
  },
  {
    kind: 'executionFailed',
    executionId: EXECUTION_ID,
    code: 'ENOENT',
    message: 'no such file',
    at: AT,
  },
  { kind: 'executionFailed', at: AT },
] as const;

describe('eventIdentity', () => {
  it('gives every event kind a distinct key shape', () => {
    const keys = events.map(eventIdentity);
    expect(new Set(keys).size).toBeGreaterThan(1);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes output events by sequence', () => {
    const first = eventIdentity({
      kind: 'executionOutput',
      executionId: EXECUTION_ID,
      sequence: 1,
      output,
    });
    const second = eventIdentity({
      kind: 'executionOutput',
      executionId: EXECUTION_ID,
      sequence: 2,
      output,
    });
    expect(first).not.toBe(second);
  });

  it('distinguishes executions', () => {
    const first = eventIdentity({
      kind: 'executionCompleted',
      executionId: EXECUTION_ID,
      exitCode: 0,
      at: AT,
    });
    const second = eventIdentity({
      kind: 'executionCompleted',
      executionId: OTHER_ID,
      exitCode: 0,
      at: AT,
    });
    expect(first).not.toBe(second);
  });

  it('keeps two execution-less failures distinct', () => {
    // Collapsing these would silently drop one failure from the record.
    const first = eventIdentity({
      kind: 'executionFailed',
      at: '2026-01-01T00:00:00.000Z',
      message: 'a',
    });
    const second = eventIdentity({
      kind: 'executionFailed',
      at: '2026-01-01T00:00:01.000Z',
      message: 'b',
    });
    expect(first).not.toBe(second);
  });

  it('is stable for a repeated event', () => {
    const event = events[1] as ExecutionEvent;
    expect(eventIdentity(event)).toBe(eventIdentity(event));
  });
});

describe('blockForEvent', () => {
  it.each(events)('produces exactly one block for $kind', (event) => {
    const block = blockForEvent(event, AT);
    expect(block).not.toBeNull();
    expect(block?.id).toMatch(/^[0-9a-f]{8}-/);
  });

  it.each(events)('derives a stable id for $kind', (event) => {
    expect(blockForEvent(event, AT)?.id).toBe(blockForEvent(event, AT)?.id);
  });

  it('records the command on a started block', () => {
    const block = blockForEvent(
      { kind: 'executionStarted', executionId: EXECUTION_ID, command: draft, at: AT },
      AT,
    );
    expect(block).toMatchObject({ kind: 'command', executionId: EXECUTION_ID, command: draft });
  });

  it('carries output through unchanged, never re-reading it', () => {
    const block = blockForEvent(
      { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 3, output, at: AT },
      AT,
    );
    expect(block).toMatchObject({ kind: 'output', sequence: 3, output });
    // Identity, not equality: presentation must render what the server sent.
    if (block?.kind === 'output') {
      expect(block.output).toBe(output);
    }
  });

  it('records the exit code on a completed block', () => {
    expect(
      blockForEvent(
        {
          kind: 'executionCompleted',
          executionId: EXECUTION_ID,
          exitCode: 127,
          durationMs: 5,
          at: AT,
        },
        AT,
      ),
    ).toMatchObject({
      kind: 'result',
      exitCode: 127,
      durationMs: 5,
    });
  });

  it('omits durationMs rather than emitting undefined', () => {
    // An explicit `undefined` property would fail the contract's
    // `additionalProperties: false` validation, so absence matters.
    const block = blockForEvent(
      { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, at: AT },
      AT,
    );
    expect(block).not.toHaveProperty('durationMs');
  });

  it('records a denial as its own block kind', () => {
    const block = blockForEvent(
      {
        kind: 'executionDenied',
        executionId: EXECUTION_ID,
        decision: { outcome: 'denied', code: 'no_network' },
        at: AT,
      },
      AT,
    );
    expect(block).toMatchObject({ kind: 'policyDenied' });
  });

  it('records a cancellation as a warning notice with the stated reason', () => {
    expect(
      blockForEvent(
        {
          kind: 'executionCancelled',
          executionId: EXECUTION_ID,
          reason: 'reader cancelled',
          at: AT,
        },
        AT,
      ),
    ).toMatchObject({
      kind: 'notice',
      level: 'warning',
      message: 'reader cancelled',
    });
  });

  it('records a cancellation with no reason as the absence of one', () => {
    // Not an invented explanation: the text says there was no reason given.
    expect(
      blockForEvent({ kind: 'executionCancelled', executionId: EXECUTION_ID, at: AT }, AT),
    ).toMatchObject({
      kind: 'notice',
      message: 'Execution cancelled.',
    });
  });

  it('records a failure as an error notice', () => {
    expect(
      blockForEvent({ kind: 'executionFailed', message: 'no such file', at: AT }, AT),
    ).toMatchObject({
      kind: 'notice',
      level: 'error',
      message: 'no such file',
    });
  });

  it('falls back through message then code for a failure with neither', () => {
    expect(blockForEvent({ kind: 'executionFailed', code: 'ENOENT', at: AT }, AT)).toMatchObject({
      message: 'ENOENT',
    });
    expect(blockForEvent({ kind: 'executionFailed', at: AT }, AT)).toMatchObject({
      message: 'Execution failed.',
    });
  });

  it('never drops an event', () => {
    // A transcript that silently omitted a refusal would misrepresent what ran.
    for (const event of events) {
      expect(blockForEvent(event, AT), event.kind).not.toBeNull();
    }
  });
});

describe('appendEvent', () => {
  it('appends in event order and never reorders', () => {
    const sequence = [
      { kind: 'executionStarted', executionId: EXECUTION_ID, command: draft, at: AT },
      { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 1, output, at: AT },
      { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, at: AT },
    ] as const satisfies readonly ExecutionEvent[];

    const blocks = sequence.reduce<TranscriptBlock[]>(
      (acc, event) => appendEvent(acc, event, AT) as TranscriptBlock[],
      [],
    );
    expect(blocks.map((block) => block.kind)).toEqual(['command', 'output', 'result']);
  });

  it('is idempotent for a replayed event', () => {
    const event = events[1] as ExecutionEvent;
    const first = appendEvent([], event, AT);
    const second = appendEvent(first, event, AT);
    expect(second).toBe(first);
    expect(second).toHaveLength(1);
  });

  it('returns the same reference when nothing was appended', () => {
    const event = events[1] as ExecutionEvent;
    const once = appendEvent([], event, AT);
    expect(appendEvent(once, event, AT)).toBe(once);
  });

  it('appends a second output event for the same execution', () => {
    const first = appendEvent(
      [],
      { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 1, output, at: AT },
      AT,
    );
    const second = appendEvent(
      first,
      { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 2, output, at: AT },
      AT,
    );
    expect(second).toHaveLength(2);
  });

  it('does not mutate the array it was given', () => {
    const event = events[1] as ExecutionEvent;
    const original = appendEvent([], event, AT);
    const snapshot = [...original];
    appendEvent(
      original,
      { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, at: AT },
      AT,
    );
    expect(original).toEqual(snapshot);
  });

  it('survives a full reconnect replay without duplicating', () => {
    const stream = [
      { kind: 'executionStarted', executionId: EXECUTION_ID, command: draft, at: AT },
      { kind: 'executionOutput', executionId: EXECUTION_ID, sequence: 1, output, at: AT },
      { kind: 'executionCompleted', executionId: EXECUTION_ID, exitCode: 0, at: AT },
    ] as const satisfies readonly ExecutionEvent[];

    const once = stream.reduce<TranscriptBlock[]>(
      (blocks, event) => appendEvent(blocks, event, AT) as TranscriptBlock[],
      [],
    );
    const twice = stream.reduce<TranscriptBlock[]>(
      (blocks, event) => appendEvent(blocks, event, AT) as TranscriptBlock[],
      once,
    );

    expect(twice).toHaveLength(3);
    expect(twice).toBe(once);
  });
});
