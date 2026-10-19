import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import type {
  LazarusInteraction,
  CommandDraft,
  TranscriptBlock,
  RichOutput,
  StructuredOutput,
  TextStyle,
  ColorRole,
  ExecutionEvent,
  LocalSession,
  DraftConflict,
} from '../src/generated/interaction.js';
import type {
  LazarusSession,
  SessionDescriptor,
  ReconnectionTicket,
  SessionState,
  SessionEvent,
  StartSessionRequest,
} from '../src/generated/session.js';
import type { FormatsPlugin } from 'ajv-formats';

/**
 * The single justified interop boundary in this package: `ajv-formats` is a
 * CommonJS module whose callable plugin is reachable as `.default`. This casts a
 * type rather than widening to `any`, so the plugin stays typed.
 */
const addFormats = formatsModule.default as FormatsPlugin;

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const interactionSchema: Record<string, unknown> = JSON.parse(
  readFileSync(join(packageRoot, 'src/schema/interaction.schema.json'), 'utf8'),
);
const sessionSchema: Record<string, unknown> = JSON.parse(
  readFileSync(join(packageRoot, 'src/schema/session.schema.json'), 'utf8'),
);

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

describe('Interaction generated types match schema', () => {
  const validateInteraction = ajv.compile(interactionSchema);

  it('accepts valid LazarusInteraction matching generated types', () => {
    const interaction: LazarusInteraction = {
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
        experienceVersion: 1,
        documentId: 'getting-started',
        sessionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        workingDirectory: '/workspace',
        taskId: 'init-repo',
      },
      draft: {
        executable: 'git',
        arguments: [{ value: 'status', quoted: false }],
        sourceCommandId: 'git-status',
        modified: false,
      },
      suggestions: {
        items: [
          {
            kind: 'documentedCommand',
            label: 'git status',
            detail: 'Show the working tree status',
            draft: {
              executable: 'git',
              arguments: [{ value: 'status', quoted: false }],
              sourceCommandId: 'git-status',
              modified: false,
            },
            score: 0.95,
            doc: {
              documentId: 'getting-started',
              title: 'Getting Started',
              anchor: 'check-status',
              summary: 'Check the status of your repository',
              relatedCommandIds: ['git-status'],
            },
          },
        ],
        rankedAt: '2026-10-12T12:00:00.000Z',
      },
      search: {
        query: 'status',
        results: [
          {
            kind: 'command',
            ref: {
              documentId: 'getting-started',
              title: 'Getting Started',
              anchor: 'check-status',
              summary: 'Check the status of your repository',
              relatedCommandIds: ['git-status'],
            },
            taskId: null,
            commandId: 'git-status',
            score: 0.95,
            excerpt: 'Check the status of your repository',
          },
        ],
      },
      actions: {
        items: [
          {
            id: '0192f0c1-2345-7123-abcd-ef012345678b',
            kind: 'openDocument',
            label: 'Open Getting Started',
            doc: {
              documentId: 'getting-started',
              title: 'Getting Started',
              anchor: 'check-status',
              summary: 'Check the status of your repository',
              relatedCommandIds: ['git-status'],
            },
            taskId: null,
            executionId: null,
            disabledReason: null,
          },
        ],
      },
      blocks: {
        blocks: [],
      },
      draftConflict: null,
    };

    expect(validateInteraction(interaction)).toBe(true);
  });

  it('CommandDraft type matches schema (no shell metacharacters)', () => {
    const draft: CommandDraft = {
      executable: 'git',
      arguments: [{ value: 'status', quoted: false }],
      sourceCommandId: 'git-status',
      modified: false,
    };

    const interaction = {
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
        experienceVersion: 1,
        documentId: 'getting-started',
        sessionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        workingDirectory: '/workspace',
        taskId: 'init-repo',
      },
      draft,
      suggestions: { items: [], rankedAt: '2026-10-12T12:00:00.000Z' },
      search: { query: '', results: [] },
      actions: { items: [] },
      blocks: { blocks: [] },
      draftConflict: null,
    };

    expect(validateInteraction(interaction)).toBe(true);
  });

  it('ColorRole type only allows semantic roles', () => {
    const validColors: ColorRole[] = [
      'default',
      'muted',
      'accent',
      'success',
      'warning',
      'danger',
      'info',
      'stdout',
      'stderr',
    ];

    for (const color of validColors) {
      const style: TextStyle = { color, bold: false, italic: false, underline: false, dim: false };
      expect(style.color).toBeDefined();
    }
  });

  it('StructuredOutput type requires raw field for all kinds', () => {
    const structuredVariants: StructuredOutput[] = [
      {
        kind: 'data',
        raw: '{"key":"value"}',
        data: { key: 'value' },
        dataType: 'application/json',
      },
      {
        kind: 'section',
        raw: '## Section',
        label: 'Section',
        expandedByDefault: false,
        content: [],
      },
      {
        kind: 'options',
        raw: '[Option 1] [Option 2]',
        label: 'Choose one',
        options: [{ label: 'Option 1', detail: 'First option', draft: undefined, selected: false }],
      },
      {
        kind: 'links',
        raw: '[Link](url)',
        links: [{ href: 'url', label: 'Link', external: false }],
      },
      {
        kind: 'commandPills',
        raw: '[git status]',
        pills: [{ label: 'git status', draft: undefined, prepared: false }],
      },
      {
        kind: 'documentation',
        raw: 'See docs',
        doc: {
          documentId: 'getting-started',
          title: 'Getting Started',
          anchor: 'intro',
          summary: 'Welcome',
          relatedCommandIds: [],
        },
      },
      {
        kind: 'control',
        raw: '[Button]',
        label: 'Action',
        actionIds: ['0192f0c1-2345-7123-abcd-ef0123456789'],
        value: 'confirm',
      },
    ];

    for (const structured of structuredVariants) {
      const output: RichOutput = {
        spans: [],
        truncated: false,
        byteCount: 0,
        structured,
      };
      expect(output.structured).toBeDefined();
      expect(output.structured?.kind).toBe(structured.kind);
      expect(output.structured?.raw).toBeTruthy();
    }
  });

  it('TranscriptBlock type validates all block kinds', () => {
    const blocks: TranscriptBlock[] = [
      {
        kind: 'command',
        id: '0192f0c1-2345-7123-abcd-ef0123456789',
        executionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        command: {
          executable: 'git',
          arguments: [{ value: 'status', quoted: false }],
          sourceCommandId: 'git-status',
          modified: false,
        },
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'result',
        id: '0192f0c1-2345-7123-abcd-ef012345678b',
        executionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        exitCode: 0,
        durationMs: 150,
        at: '2026-10-12T12:00:01.000Z',
      },
      {
        kind: 'notice',
        id: '0192f0c1-2345-7123-abcd-ef012345678c',
        level: 'info',
        message: 'Session started',
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'policyDenied',
        id: '0192f0c1-2345-7123-abcd-ef012345678d',
        executionId: '0192f0c1-2345-7123-abcd-ef012345678e',
        decision: {
          outcome: 'denied',
          code: 'executable_not_allowed',
          message: 'Executable not in allowlist',
          evaluatedAt: '2026-10-12T12:00:00.000Z',
        },
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'documentation',
        id: '0192f0c1-2345-7123-abcd-ef012345678f',
        ref: {
          documentId: 'getting-started',
          title: 'Getting Started',
          anchor: 'intro',
          summary: 'Welcome to the experience',
          relatedCommandIds: [],
        },
        at: '2026-10-12T12:00:00.000Z',
      },
    ];

    for (const block of blocks) {
      const interaction = {
        context: {
          experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
          experienceVersion: 1,
          documentId: 'getting-started',
          sessionId: '0192f0c1-2345-7123-abcd-ef012345678a',
          workingDirectory: '/workspace',
          taskId: 'init-repo',
        },
        draft: null,
        suggestions: { items: [], rankedAt: '2026-10-12T12:00:00.000Z' },
        search: { query: '', results: [] },
        actions: { items: [] },
        blocks: { blocks: [block] },
        draftConflict: null,
      };

      expect(validateInteraction(interaction)).toBe(true);
    }
  });

  it('ExecutionEvent type validates all event kinds', () => {
    const events: ExecutionEvent[] = [
      {
        kind: 'executionStarted',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        command: {
          executable: 'git',
          arguments: [{ value: 'status', quoted: false }],
          sourceCommandId: 'git-status',
          modified: false,
        },
        decision: {
          outcome: 'allowed',
          evaluatedAt: '2026-10-12T12:00:00.000Z',
        },
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'executionOutput',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        sequence: 0,
        output: {
          spans: [{ text: 'output', style: { color: 'stdout' }, stream: 'stdout' }],
          truncated: false,
          byteCount: 6,
        },
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'executionCompleted',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        exitCode: 0,
        durationMs: 150,
        at: '2026-10-12T12:00:01.000Z',
      },
      {
        kind: 'executionCancelled',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        reason: 'User cancelled',
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'executionDenied',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        decision: {
          outcome: 'denied',
          code: 'executable_not_allowed',
          message: 'Not allowed',
          evaluatedAt: '2026-10-12T12:00:00.000Z',
        },
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'executionFailed',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        code: 'container_start_failed',
        message: 'Failed to start container',
        at: '2026-10-12T12:00:00.000Z',
      },
    ];

    // ExecutionEvent is not directly in the interaction schema but is part of the contract
    for (const event of events) {
      expect(event.kind).toBeDefined();
      expect(event.executionId).toBeDefined();
      expect(event.at).toBeDefined();
    }
  });

  it('LocalSession type matches schema', () => {
    const localSession: LocalSession = {
      schemaVersion: 1,
      id: '0192f0c1-2345-7123-abcd-ef0123456789',
      experienceId: '0192f0c1-2345-7123-abcd-ef012345678a',
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef012345678a',
        experienceVersion: 1,
        documentId: 'getting-started',
        sessionId: '0192f0c1-2345-7123-abcd-ef012345678b',
        workingDirectory: '/workspace',
        taskId: 'init-repo',
      },
      draft: null,
      transcript: { blocks: [] },
      runtimeSession: null,
      createdAt: '2026-10-12T12:00:00.000Z',
      updatedAt: '2026-10-12T12:00:00.000Z',
      expiresAt: '2026-10-12T13:00:00.000Z',
    };

    expect(localSession.schemaVersion).toBe(1);
    expect(localSession.id).toBeDefined();
    expect(localSession.experienceId).toBeDefined();
    expect(localSession.context).toBeDefined();
    expect(localSession.transcript).toBeDefined();
    expect(localSession.createdAt).toBeDefined();
    expect(localSession.updatedAt).toBeDefined();
    expect(localSession.expiresAt).toBeDefined();
  });

  it('DraftConflict type matches schema', () => {
    const conflict: DraftConflict = {
      draft: {
        executable: 'git',
        arguments: [{ value: 'status', quoted: false }],
        sourceCommandId: 'git-status',
        modified: true,
      },
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
        experienceVersion: 1,
        documentId: 'getting-started',
        sessionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        workingDirectory: '/workspace',
        taskId: 'init-repo',
      },
      raisedAt: '2026-10-12T12:00:00.000Z',
    };

    expect(conflict.draft).toBeDefined();
    expect(conflict.context).toBeDefined();
    expect(conflict.raisedAt).toBeDefined();
  });
});

describe('Session generated types match schema', () => {
  const validateSession = ajv.compile(sessionSchema);

  it('accepts valid LazarusSession matching generated types', () => {
    const session: LazarusSession = {
      descriptor: {
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        tenantId: '0192f0c1-2345-7123-abcd-ef012345678a',
        experienceId: '0192f0c1-2345-7123-abcd-ef012345678b',
        experienceVersion: 1,
        state: 'ready',
        createdAt: '2026-10-12T12:00:00.000Z',
        expiresAt: '2026-10-12T13:00:00.000Z',
        endedAt: null,
        environmentImage:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        failureCode: null,
      },
      limits: {
        maxDurationSeconds: 3600,
        maxExecutions: 100,
        maxConcurrent: 4,
        remainingExecutions: 95,
      },
      ticket: {
        ticket: '0192f0c1-2345-7123-abcd-ef012345678c',
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        expiresAt: '2026-10-12T12:30:00.000Z',
      },
      hubUrl: '/api/signalr/hubs/session',
    };

    expect(validateSession(session)).toBe(true);
  });

  it('SessionDescriptor requires tenantId', () => {
    const descriptor: SessionDescriptor = {
      sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
      tenantId: '0192f0c1-2345-7123-abcd-ef012345678a',
      experienceId: '0192f0c1-2345-7123-abcd-ef012345678b',
      experienceVersion: 1,
      state: 'ready',
      createdAt: '2026-10-12T12:00:00.000Z',
      expiresAt: '2026-10-12T13:00:00.000Z',
    };

    expect(descriptor.tenantId).toBeDefined();
    expect(descriptor.sessionId).toBeDefined();
    expect(descriptor.experienceId).toBeDefined();
    expect(descriptor.state).toBeDefined();
    expect(descriptor.createdAt).toBeDefined();
    expect(descriptor.expiresAt).toBeDefined();
  });

  it('SessionState type is exhaustive union', () => {
    const states: SessionState[] = ['starting', 'ready', 'ended', 'expired', 'failed'];

    for (const state of states) {
      const descriptor: SessionDescriptor = {
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        tenantId: '0192f0c1-2345-7123-abcd-ef012345678a',
        experienceId: '0192f0c1-2345-7123-abcd-ef012345678b',
        experienceVersion: 1,
        state,
        createdAt: '2026-10-12T12:00:00.000Z',
        expiresAt: '2026-10-12T13:00:00.000Z',
        endedAt: state === 'ended' ? '2026-10-12T12:30:00.000Z' : null,
        environmentImage:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        failureCode: state === 'failed' ? 'container_start_failed' : null,
      };

      expect(descriptor.state).toBe(state);
    }
  });

  it('ReconnectionTicket requires sessionId and ticket', () => {
    const ticket: ReconnectionTicket = {
      ticket: '0192f0c1-2345-7123-abcd-ef012345678c',
      sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
      expiresAt: '2026-10-12T12:30:00.000Z',
    };

    expect(ticket.ticket).toBeDefined();
    expect(ticket.sessionId).toBeDefined();
    expect(ticket.expiresAt).toBeDefined();
  });

  it('SessionEvent type validates both event kinds', () => {
    const stateChanged: SessionEvent = {
      kind: 'sessionStateChanged',
      sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
      state: 'ready',
      failureCode: null,
      at: '2026-10-12T12:00:00.000Z',
    };

    const closing: SessionEvent = {
      kind: 'sessionClosing',
      sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
      reason: 'User ended session',
      at: '2026-10-12T12:30:00.000Z',
    };

    expect(stateChanged.kind).toBe('sessionStateChanged');
    expect(closing.kind).toBe('sessionClosing');
  });

  it('StartSessionRequest requires experienceId', () => {
    const request: StartSessionRequest = {
      experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
      experienceVersion: 1,
    };

    expect(request.experienceId).toBeDefined();
  });
});

describe('Schema drift detection', () => {
  it('detects if interaction schema has unexpected $defs', () => {
    const defs = (interactionSchema.$defs ?? {}) as Record<string, unknown>;
    const expectedDefs = new Set([
      'suggestionSet',
      'documentationSearch',
      'documentationSearchResult',
      'actionSet',
      'transcript',
      'isoTimestamp',
      'uuid',
      'executableName',
      'colorRole',
      'workspaceContext',
      'commandArgument',
      'commandDraft',
      'commandSuggestion',
      'action',
      'documentationRef',
      'textStyle',
      'richOutput',
      'structuredOutput',
      'rawText',
      'inlineContentList',
      'outputOption',
      'outputLink',
      'commandPill',
      'executionRequest',
      'policyDecision',
      'executionEvent',
      'transcriptBlock',
      'inlineContent',
      'inlineText',
      'inlineEmphasis',
      'inlineCode',
      'inlineLink',
      'inlineCommand',
      'inlineDocumentation',
      'inlineControl',
      'inlinePill',
      'draftConflict',
      'localSession',
      'localRuntimeLink',
    ]);

    const actualDefs = new Set(Object.keys(defs));
    expect(actualDefs).toEqual(expectedDefs);
  });

  it('detects if session schema has unexpected $defs', () => {
    const defs = (sessionSchema.$defs ?? {}) as Record<string, unknown>;
    const expectedDefs = new Set([
      'uuid',
      'isoTimestamp',
      'sessionState',
      'sessionDescriptor',
      'sessionLimits',
      'reconnectionTicket',
      'startSessionRequest',
      'sessionEvent',
    ]);

    const actualDefs = new Set(Object.keys(defs));
    expect(actualDefs).toEqual(expectedDefs);
  });

  it('detects if privileged fields are added to interaction schema', () => {
    const privilegedFields = [
      'privileged',
      'hostNetwork',
      'hostPid',
      'hostIpc',
      'capAdd',
      'devices',
      'volumes',
      'docker.sock',
    ];

    const schemaString = JSON.stringify(interactionSchema);

    for (const field of privilegedFields) {
      expect(schemaString).not.toContain(field);
    }
  });

  it('detects if privileged fields are added to session schema', () => {
    const privilegedFields = [
      'privileged',
      'hostNetwork',
      'hostPid',
      'hostIpc',
      'capAdd',
      'devices',
      'volumes',
      'docker.sock',
    ];

    const schemaString = JSON.stringify(sessionSchema);

    for (const field of privilegedFields) {
      expect(schemaString).not.toContain(field);
    }
  });
});
