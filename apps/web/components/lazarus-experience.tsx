'use client';

import { initialState, interactionReducer } from '@lazarus/interaction';
import { useReducer } from 'react';

import type { RichOutput, TranscriptBlock, WorkspaceContext } from '@lazarus/contracts';
import type { ReactElement } from 'react';

function renderRichOutput(output: RichOutput): string {
  const parts: string[] = [];
  for (const span of output.spans) {
    parts.push(span.text);
  }
  return parts.join('');
}

function Block({ block }: { block: TranscriptBlock }): ReactElement | null {
  if (block.kind === 'command') {
    const exe = block.command?.executable ?? '';
    return (
      <div
        style={{
          padding: '0.5rem',
          background: 'var(--color-surface-section)',
          borderRadius: 'var(--radius-2)',
        }}
      >
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>$ {exe}</div>
      </div>
    );
  }
  if (block.kind === 'output') {
    return (
      <pre
        style={{
          margin: 0,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          color: 'var(--color-text-primary)',
        }}
      >
        {renderRichOutput(block.output)}
      </pre>
    );
  }
  if (block.kind === 'result') {
    return (
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        exit: {block.exitCode}
        {block.durationMs !== undefined ? ` (${block.durationMs}ms)` : ''}
      </div>
    );
  }
  if (block.kind === 'notice') {
    return (
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{block.message}</div>
    );
  }
  if (block.kind === 'policyDenied') {
    return <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>denied</div>;
  }
  if (block.kind === 'documentation') {
    return (
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        doc: {block.ref.documentId}
      </div>
    );
  }
  return null;
}

const DEFAULT_CONTEXT: WorkspaceContext = {
  experienceId: '00000000-0000-0000-0000-000000000001',
  experienceVersion: 1,
  documentId: null,
  sessionId: null,
  workingDirectory: null,
  taskId: null,
};

export function LazarusExperience(): ReactElement {
  const [state] = useReducer(interactionReducer, initialState(DEFAULT_CONTEXT));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
      <h1 style={{ margin: 0 }}>Lazarus</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {state.blocks.blocks.map((b: TranscriptBlock) => (
          <Block block={b} key={b.id} />
        ))}
      </div>
    </div>
  );
}
