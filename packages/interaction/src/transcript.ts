import type { ExecutionEvent, IsoTimestamp, TranscriptBlock } from '@lazarus/contracts';

import { syntheticId } from './ids.js';

/**
 * Normalisation: the single point where an `ExecutionEvent` becomes a
 * `TranscriptBlock`.
 *
 * §4.3 and §4.8 are strict about this. Execution arrives as a structured event
 * stream, the transcript is a record, and presentation consumes blocks without
 * ever parsing raw output or reordering it. That only holds if there is exactly
 * one function that performs the translation — which is this one. A second
 * implementation in a component is a bug, because the two would drift and only
 * one of them would get fixed.
 *
 * Every event produces at most one block. Nothing is dropped: an execution that
 * was cancelled or denied still appears in the record, because a transcript that
 * silently omits a refusal would misrepresent what happened.
 *
 * ## Idempotency is the reason block ids are derived
 *
 * Reconnection replays events the client already has (§8.4). Re-applying
 * `executionOutput` must not append a second copy. Block ids come from the event's
 * identity, so the caller can recognise a block it has already recorded and drop
 * it. See `src/ids.ts` for why the id is a digest rather than a random UUID.
 */

/** Scope for derived block ids. Versioned so a future key scheme cannot collide with this one. */
const BLOCK_SCOPE = 'transcriptBlock.v1';

/**
 * The identity of an event, used both for the block id and for de-duplication.
 *
 * Output keys on `executionId` plus `sequence` because one execution legitimately
 * produces many output events; the sequence is what distinguishes them. Lifecycle
 * events key on `executionId` alone, since each occurs at most once per execution.
 *
 * `executionFailed` has an optional `executionId`, so it also folds in the
 * timestamp and message. Two failures with no execution id are genuinely two
 * events, and collapsing them would lose one.
 */
export function eventIdentity(event: ExecutionEvent): string {
  switch (event.kind) {
    case 'executionStarted':
      return `started:${event.executionId}`;
    case 'executionOutput':
      return `output:${event.executionId}:${event.sequence}`;
    case 'executionCompleted':
      return `completed:${event.executionId}`;
    case 'executionCancelled':
      return `cancelled:${event.executionId}`;
    case 'executionDenied':
      return `denied:${event.executionId}`;
    case 'executionFailed':
      return `failed:${event.executionId ?? 'none'}:${event.at}:${event.code ?? ''}:${event.message ?? ''}`;
  }
}

/**
 * The block an event produces, or `null` when the event yields none.
 *
 * Returning `null` rather than omitting the key keeps the return type honest for
 * the caller: there is exactly one block or there is not.
 *
 * @param event the event to record
 * @param receivedAt when the client received it, used for `executionOutput` —
 *   the only event whose `at` is optional, because a stream's final chunk often
 *   carries no timestamp of its own. Every block requires an `at` and the schema
 *   validates it as a real `IsoTimestamp`, so there is no honest fallback value
 *   to invent here; the caller already knows the time because it dispatched the
 *   action, and requiring it makes that explicit rather than a silent `''`.
 */
export function blockForEvent(event: ExecutionEvent, receivedAt: IsoTimestamp): TranscriptBlock | null {
  const id = syntheticId(BLOCK_SCOPE, eventIdentity(event));

  switch (event.kind) {
    case 'executionStarted':
      return { kind: 'command', id, executionId: event.executionId, command: event.command, at: event.at };
    case 'executionOutput':
      return { kind: 'output', id, executionId: event.executionId, sequence: event.sequence, output: event.output, at: event.at ?? receivedAt };
    case 'executionCompleted':
      return {
        kind: 'result',
        id,
        executionId: event.executionId,
        exitCode: event.exitCode,
        ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
        at: event.at,
      };
    case 'executionCancelled':
      return {
        kind: 'notice',
        id,
        level: 'warning',
        // A cancellation with no stated reason still belongs in the record. The
        // text is the absence of a reason, not a fabrication about it.
        message: event.reason ?? 'Execution cancelled.',
        at: event.at,
      };
    case 'executionDenied':
      return { kind: 'policyDenied', id, executionId: event.executionId, decision: event.decision, at: event.at };
    case 'executionFailed':
      return {
        kind: 'notice',
        id,
        level: 'error',
        message: event.message ?? event.code ?? 'Execution failed.',
        at: event.at,
      };
  }
}

/**
 * Append an event's block to a transcript, ignoring one already present.
 *
 * @param blocks the transcript so far
 * @param event the event to record
 * @param receivedAt forwarded to `blockForEvent`; see its note on `executionOutput`
 * @returns the same array reference when the event was already recorded, so callers
 *   can use identity to skip a re-render
 */
export function appendEvent(
  blocks: readonly TranscriptBlock[],
  event: ExecutionEvent,
  receivedAt: IsoTimestamp,
): readonly TranscriptBlock[] {
  const block = blockForEvent(event, receivedAt);
  if (block === null) {
    return blocks;
  }
  if (blocks.some((existing) => existing.id === block.id)) {
    return blocks;
  }
  return [...blocks, block];
}
