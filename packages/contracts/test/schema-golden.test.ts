import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';

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

describe('Interaction schema', () => {
  const validate = ajv.compile(interactionSchema);

  it('validates a minimal valid interaction state', () => {
    const validState = {
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

    expect(validate(validState)).toBe(true);
  });

  it('rejects interaction state with missing required fields', () => {
    const invalidState = {
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
      },
      draft: null,
      suggestions: { items: [], rankedAt: '2026-10-12T12:00:00.000Z' },
      search: { query: '', results: [] },
      actions: { items: [] },
      blocks: { blocks: [] },
      draftConflict: null,
    };

    expect(validate(invalidState)).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  it('rejects draft with shell metacharacters in executable', () => {
    const stateWithShell = {
      context: {
        experienceId: '0192f0c1-2345-7123-abcd-ef0123456789',
        experienceVersion: 1,
        documentId: 'getting-started',
        sessionId: '0192f0c1-2345-7123-abcd-ef012345678a',
        workingDirectory: '/workspace',
        taskId: 'init-repo',
      },
      draft: {
        executable: 'git; rm -rf /',
        arguments: [],
        sourceCommandId: null,
        modified: false,
      },
      suggestions: { items: [], rankedAt: '2026-10-12T12:00:00.000Z' },
      search: { query: '', results: [] },
      actions: { items: [] },
      blocks: { blocks: [] },
      draftConflict: null,
    };

    expect(validate(stateWithShell)).toBe(false);
  });

  it('rejects colorRole with invalid value', () => {
    const stateWithInvalidColor = {
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
      suggestions: { items: [], rankedAt: '2026-10-12T12:00:00.000Z' },
      search: { query: '', results: [] },
      actions: { items: [] },
      blocks: {
        blocks: [
          {
            kind: 'output',
            id: '0192f0c1-2345-7123-abcd-ef012345678c',
            executionId: '0192f0c1-2345-7123-abcd-ef012345678d',
            sequence: 0,
            output: {
              spans: [
                {
                  text: 'hello',
                  style: { color: 'invalid-color', bold: false },
                  stream: 'stdout',
                },
              ],
              truncated: false,
              byteCount: 5,
            },
            at: '2026-10-12T12:00:00.000Z',
          },
        ],
      },
      draftConflict: null,
    };

    expect(validate(stateWithInvalidColor)).toBe(false);
  });

  it('validates structuredOutput with all kinds', () => {
    const stateWithStructuredOutput = {
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
      blocks: {
        blocks: [
          {
            kind: 'output',
            id: '0192f0c1-2345-7123-abcd-ef012345678c',
            executionId: '0192f0c1-2345-7123-abcd-ef012345678d',
            sequence: 0,
            output: {
              spans: [],
              truncated: false,
              byteCount: 0,
              structured: {
                kind: 'data',
                raw: '{"key":"value"}',
                data: { key: 'value' },
                dataType: 'application/json',
              },
            },
            at: '2026-10-12T12:00:00.000Z',
          },
        ],
      },
      draftConflict: null,
    };

    expect(validate(stateWithStructuredOutput)).toBe(true);
  });

  it('rejects structuredOutput without raw field', () => {
    const stateWithoutRaw = {
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
      blocks: {
        blocks: [
          {
            kind: 'output',
            id: '0192f0c1-2345-7123-abcd-ef012345678c',
            executionId: '0192f0c1-2345-7123-abcd-ef012345678d',
            sequence: 0,
            output: {
              spans: [],
              truncated: false,
              byteCount: 0,
              structured: {
                kind: 'data',
                data: { key: 'value' },
                dataType: 'application/json',
              },
            },
            at: '2026-10-12T12:00:00.000Z',
          },
        ],
      },
      draftConflict: null,
    };

    expect(validate(stateWithoutRaw)).toBe(false);
  });

  it('validates all transcript block kinds', () => {
    const allBlockKinds = [
      {
        kind: 'command',
        id: '0192f0c1-2345-7123-abcd-ef012345678c',
        executionId: '0192f0c1-2345-7123-abcd-ef012345678d',
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
        id: '0192f0c1-2345-7123-abcd-ef012345678e',
        executionId: '0192f0c1-2345-7123-abcd-ef012345678d',
        exitCode: 0,
        durationMs: 150,
        at: '2026-10-12T12:00:01.000Z',
      },
      {
        kind: 'notice',
        id: '0192f0c1-2345-7123-abcd-ef012345678f',
        level: 'info',
        message: 'Session started',
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'policyDenied',
        id: '0192f0c1-2345-7123-abcd-ef0123456790',
        executionId: '0192f0c1-2345-7123-abcd-ef0123456791',
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
        id: '0192f0c1-2345-7123-abcd-ef0123456792',
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

    for (const block of allBlockKinds) {
      const state = {
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

      expect(validate(state)).toBe(true);
    }
  });
});

describe('Session schema', () => {
  const validate = ajv.compile(sessionSchema);

  it('validates a minimal valid session descriptor', () => {
    const validSession = {
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

    expect(validate(validSession)).toBe(true);
  });

  it('rejects session with missing tenantId', () => {
    const invalidSession = {
      descriptor: {
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
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
      ticket: null,
      hubUrl: '/api/signalr/hubs/session',
    };

    expect(validate(invalidSession)).toBe(false);
  });

  it('rejects session with invalid image digest', () => {
    const invalidImage = {
      descriptor: {
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        tenantId: '0192f0c1-2345-7123-abcd-ef012345678a',
        experienceId: '0192f0c1-2345-7123-abcd-ef012345678b',
        experienceVersion: 1,
        state: 'ready',
        createdAt: '2026-10-12T12:00:00.000Z',
        expiresAt: '2026-10-12T13:00:00.000Z',
        endedAt: null,
        environmentImage: 'docker.io/library/git:latest',
        failureCode: null,
      },
      limits: {
        maxDurationSeconds: 3600,
        maxExecutions: 100,
        maxConcurrent: 4,
        remainingExecutions: 95,
      },
      ticket: null,
      hubUrl: '/api/signalr/hubs/session',
    };

    expect(validate(invalidImage)).toBe(false);
  });

  it('rejects session with invalid hubUrl (absolute)', () => {
    const invalidHubUrl = {
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
      ticket: null,
      hubUrl: 'https://example.com/api/signalr/hubs/session',
    };

    expect(validate(invalidHubUrl)).toBe(false);
  });

  it('validates all session states', () => {
    const states = ['starting', 'ready', 'ended', 'expired', 'failed'];

    for (const state of states) {
      const session = {
        descriptor: {
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
        },
        limits: {
          maxDurationSeconds: 3600,
          maxExecutions: 100,
          maxConcurrent: 4,
          remainingExecutions: 95,
        },
        ticket: null,
        hubUrl: '/api/signalr/hubs/session',
      };

      expect(validate(session)).toBe(true);
    }
  });

  it('validates session events', () => {
    const events = [
      {
        kind: 'sessionStateChanged',
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        state: 'ready',
        failureCode: null,
        at: '2026-10-12T12:00:00.000Z',
      },
      {
        kind: 'sessionClosing',
        sessionId: '0192f0c1-2345-7123-abcd-ef0123456789',
        reason: 'User ended session',
        at: '2026-10-12T12:30:00.000Z',
      },
    ];

    for (const event of events) {
      expect(validate(event)).toBe(false); // Events are separate from session descriptor
    }
  });
});

describe('Schema negative fixtures', () => {
  it('rejects privileged runtime fields that must never be expressible', () => {
    const privilegedFields = [
      { field: 'privileged', value: true },
      { field: 'hostNetwork', value: true },
      { field: 'hostPid', value: true },
      { field: 'hostIpc', value: true },
      { field: 'capAdd', value: ['ALL'] },
      { field: 'devices', value: ['/dev/kvm'] },
      { field: 'volumes', value: ['/var/run/docker.sock:/var/run/docker.sock'] },
    ];

    for (const { field } of privilegedFields) {
      // These fields should not exist in either schema
      const interactionHasField = JSON.stringify(interactionSchema).includes(field);
      const sessionHasField = JSON.stringify(sessionSchema).includes(field);
      expect(interactionHasField).toBe(false);
      expect(sessionHasField).toBe(false);
    }
  });

  it('rejects experience schema with privileged fields', () => {
    const experienceSchema = JSON.parse(
      readFileSync(join(packageRoot, '../spec/lazarus.schema.json'), 'utf8'),
    ) as Record<string, unknown>;
    const privilegedFields = new Set([
      'privileged',
      'hostNetwork',
      'hostPid',
      'hostIpc',
      'capAdd',
      'devices',
      'docker.sock',
    ]);

    const collectPropertyNames = (node: unknown, found: Set<string>): void => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) collectPropertyNames(item, found);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'properties' && value !== null && typeof value === 'object') {
          for (const propName of Object.keys(value)) found.add(propName);
        }
        collectPropertyNames(value, found);
      }
    };

    const propertyNames = new Set<string>();
    collectPropertyNames(experienceSchema, propertyNames);

    for (const field of privilegedFields) {
      expect(propertyNames).not.toContain(field);
    }
  });
});
