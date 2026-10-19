import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import type {
  LazarusExperience,
  Command,
  Document,
  Task,
  SecretRef,
  PolicyTightening,
  Environment,
  Resources,
} from '../src/generated/experience.js';
import type { FormatsPlugin } from 'ajv-formats';

/**
 * The single justified interop boundary in this package: `ajv-formats` is a
 * CommonJS module whose callable plugin is reachable as `.default`. This casts a
 * type rather than widening to `any`, so the plugin stays typed.
 */
const addFormats = formatsModule.default as FormatsPlugin;

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const experienceSchema: {
  properties?: Record<string, unknown>;
  required?: string[];
  $defs?: Record<string, unknown>;
} = JSON.parse(readFileSync(join(packageRoot, 'lazarus.schema.json'), 'utf8'));

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

describe('Generated types match schema', () => {
  const validate = ajv.compile(experienceSchema);

  it('accepts a valid LazarusExperience matching generated types', () => {
    const experience: LazarusExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      description: 'Learn the fundamentals of Git version control',
      tags: ['git', 'version-control'],
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        workdir: 'workspace',
        env: {
          GIT_AUTHOR_NAME: 'Learner',
        },
        resources: {
          memoryMb: 512,
          cpus: 1,
          pids: 128,
          timeoutSeconds: 300,
        },
        network: {
          egress: ['github.com'],
          dns: ['1.1.1.1'],
        },
      },
      documentation: [
        {
          id: 'intro',
          title: 'Introduction to Git',
          summary: 'What is Git and why use it',
          mdx: '# Introduction to Git',
        },
      ],
      commands: [
        {
          id: 'git-init',
          executable: 'git',
          args: ['init'],
          summary: 'Initialize a new Git repository',
          documentId: 'intro',
          expectsOutput: true,
        },
      ],
      tasks: [
        {
          id: 'init-repo',
          title: 'Initialize a repository',
          steps: ['git-init'],
          documentId: 'intro',
        },
      ],
      secrets: [
        {
          name: 'github-token',
          envVar: 'GITHUB_TOKEN',
          required: true,
        },
      ],
      policies: [
        {
          id: 'deny-rm',
          effect: 'deny',
          reason: 'Prevent destructive commands',
          match: {
            kind: 'executable',
            value: 'rm',
          },
        },
      ],
    };

    expect(validate(experience)).toBe(true);
  });

  it('Command type matches schema', () => {
    const command: Command = {
      id: 'git-status',
      executable: 'git',
      args: ['status'],
      summary: 'Show working tree status',
      description: 'Displays which files have changes',
      documentId: 'basic-commands',
      expectsOutput: true,
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      commands: [command],
    };

    expect(validate(experience)).toBe(true);
  });

  it('Document type matches schema', () => {
    const document: Document = {
      id: 'getting-started',
      title: 'Getting Started',
      summary: 'Welcome to Git',
      mdx: '# Getting Started\n\nGit is...',
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      documentation: [document],
    };

    expect(validate(experience)).toBe(true);
  });

  it('Task type matches schema', () => {
    const task: Task = {
      id: 'first-commit',
      title: 'Make your first commit',
      summary: 'Initialize and commit',
      steps: ['git-init', 'git-add', 'git-commit'],
      documentId: 'basic-commands',
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      tasks: [task],
    };

    expect(validate(experience)).toBe(true);
  });

  it('SecretRef type matches schema (no value field)', () => {
    const secret: SecretRef = {
      name: 'github-token',
      envVar: 'GITHUB_TOKEN',
      required: true,
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      secrets: [secret],
    };

    expect(validate(experience)).toBe(true);
  });

  it('PolicyTightening type only allows deny effect', () => {
    const policy: PolicyTightening = {
      id: 'deny-network',
      effect: 'deny',
      reason: 'Restrict network',
      match: {
        kind: 'networkDestination',
        value: 'internal.example.com',
      },
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      policies: [policy],
    };

    expect(validate(experience)).toBe(true);
  });

  it('Environment type requires image digest', () => {
    const environment: Environment = {
      image:
        'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      workdir: 'workspace',
      resources: {
        memoryMb: 512,
        cpus: 1,
        pids: 128,
      },
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment,
    };

    expect(validate(experience)).toBe(true);
  });

  it('Resources type requires all bounds when present', () => {
    const resources: Resources = {
      memoryMb: 512,
      cpus: 1,
      pids: 128,
      timeoutSeconds: 300,
    };

    const environment: Environment = {
      image:
        'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      resources,
    };

    const experience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Test',
      environment,
    };

    expect(validate(experience)).toBe(true);
  });

  it('rejects generated types with invalid data', () => {
    const invalidExperience = {
      apiVersion: 'invalid',
      title: 'Test',
      environment: {
        image: 'docker.io/library/git:latest', // tag not digest
      },
    } as unknown as LazarusExperience;

    expect(validate(invalidExperience)).toBe(false);
  });
});

describe('Schema drift detection', () => {
  it('detects if schema has fields not in generated types', () => {
    const schemaKeys = new Set(Object.keys(experienceSchema.properties || {}));
    const requiredKeys = new Set(experienceSchema.required || []);

    // These are the known top-level fields in the schema
    const expectedKeys = new Set([
      'apiVersion',
      'title',
      'description',
      'tags',
      'environment',
      'documentation',
      'commands',
      'tasks',
      'secrets',
      'policies',
    ]);

    expect(schemaKeys).toEqual(expectedKeys);
    expect(requiredKeys).toEqual(new Set(['apiVersion', 'title', 'environment']));
  });

  it('detects if schema $defs has unexpected entries', () => {
    const defs = experienceSchema.$defs || {};
    const expectedDefs = new Set([
      'imageDigest',
      'portNumber',
      'environment',
      'resources',
      'document',
      'command',
      'task',
      'secretRef',
      'policyTightening',
    ]);

    const actualDefs = new Set(Object.keys(defs));
    expect(actualDefs).toEqual(expectedDefs);
  });

  it('detects if privileged fields are added to schema', () => {
    const privilegedFields = new Set([
      'privileged',
      'hostNetwork',
      'hostPid',
      'hostIpc',
      'capAdd',
      'devices',
      'volumes',
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
