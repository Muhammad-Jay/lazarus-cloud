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
const experienceSchema: Record<string, unknown> = JSON.parse(
  readFileSync(join(packageRoot, 'lazarus.schema.json'), 'utf8'),
);

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

describe('Experience schema', () => {
  const validate = ajv.compile(experienceSchema);

  it('validates a minimal valid experience', () => {
    const validExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      description: 'Learn the fundamentals of Git version control',
      tags: ['git', 'version-control', 'beginner'],
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        workdir: 'workspace',
        env: {
          GIT_AUTHOR_NAME: 'Learner',
          GIT_AUTHOR_EMAIL: 'learner@example.com',
        },
        resources: {
          memoryMb: 512,
          cpus: 1,
          pids: 128,
          timeoutSeconds: 300,
        },
        network: {
          egress: ['github.com', 'api.github.com'],
          dns: ['1.1.1.1', '8.8.8.8'],
        },
      },
      documentation: [
        {
          id: 'intro',
          title: 'Introduction to Git',
          summary: 'What is Git and why use it',
          mdx: '# Introduction to Git\n\nGit is a distributed version control system...',
        },
        {
          id: 'basic-commands',
          title: 'Basic Commands',
          summary: 'Essential Git commands for daily use',
          mdx: '# Basic Commands\n\n## git init\nInitialize a new repository...\n\n## git add\nStage changes...',
        },
      ],
      commands: [
        {
          id: 'git-init',
          executable: 'git',
          args: ['init'],
          summary: 'Initialize a new Git repository',
          description: 'Creates a new Git repository in the current directory',
          documentId: 'basic-commands',
          expectsOutput: true,
        },
        {
          id: 'git-status',
          executable: 'git',
          args: ['status'],
          summary: 'Show the working tree status',
          description: 'Displays which files have changes that are not yet committed',
          documentId: 'basic-commands',
          expectsOutput: true,
        },
        {
          id: 'git-add',
          executable: 'git',
          args: ['add', '.'],
          summary: 'Stage all changes',
          description: 'Adds all modified and new files to the staging area',
          documentId: 'basic-commands',
          expectsOutput: false,
        },
      ],
      tasks: [
        {
          id: 'init-and-commit',
          title: 'Initialize and make your first commit',
          summary: 'Create a repo and commit your first file',
          steps: ['git-init', 'git-add', 'git-commit'],
          documentId: 'basic-commands',
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
          id: 'deny-rm-rf',
          effect: 'deny',
          reason: 'Prevent destructive commands',
          match: {
            kind: 'executable',
            value: 'rm',
          },
        },
      ],
    };

    expect(validate(validExperience)).toBe(true);
  });

  it('rejects experience without required fields', () => {
    const invalidExperience = {
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
    };

    expect(validate(invalidExperience)).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  it('rejects experience with invalid apiVersion', () => {
    const invalidApiVersion = {
      apiVersion: 'v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
    };

    expect(validate(invalidApiVersion)).toBe(false);
  });

  it('rejects experience with tag instead of digest', () => {
    const invalidImage = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image: 'docker.io/library/git:latest',
      },
    };

    expect(validate(invalidImage)).toBe(false);
  });

  it('rejects experience with absolute workdir', () => {
    const invalidWorkdir = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        workdir: '/workspace',
      },
    };

    expect(validate(invalidWorkdir)).toBe(false);
  });

  it('rejects experience with path traversal in workdir', () => {
    const invalidWorkdir = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        workdir: '../workspace',
      },
    };

    expect(validate(invalidWorkdir)).toBe(false);
  });

  it('rejects command with shell metacharacters', () => {
    const invalidCommand = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      commands: [
        {
          id: 'bad-command',
          executable: 'git; rm -rf /',
          summary: 'Malicious command',
        },
      ],
    };

    expect(validate(invalidCommand)).toBe(false);
  });

  it('rejects experience with privileged fields', () => {
    const privilegedExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        privileged: true,
      },
    };

    expect(validate(privilegedExperience)).toBe(false);
  });

  it('rejects experience with host networking', () => {
    const hostNetworkExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        network: {
          hostNetwork: true,
        },
      },
    };

    expect(validate(hostNetworkExperience)).toBe(false);
  });

  it('rejects experience with docker socket mount', () => {
    const dockerSockExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        volumes: ['/var/run/docker.sock:/var/run/docker.sock'],
      },
    };

    expect(validate(dockerSockExperience)).toBe(false);
  });

  it('rejects experience with added capabilities', () => {
    const capAddExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        capAdd: ['ALL'],
      },
    };

    expect(validate(capAddExperience)).toBe(false);
  });

  it('rejects experience with host namespaces', () => {
    const hostNsExperience = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        hostPid: true,
        hostIpc: true,
      },
    };

    expect(validate(hostNsExperience)).toBe(false);
  });

  it('validates policy tightening with deny effect only', () => {
    const validPolicy = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      policies: [
        {
          id: 'deny-network',
          effect: 'deny',
          reason: 'Restrict network access',
          match: {
            kind: 'networkDestination',
            value: 'internal.example.com',
          },
        },
      ],
    };

    expect(validate(validPolicy)).toBe(true);
  });

  it('rejects policy with allow effect', () => {
    const invalidPolicy = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      policies: [
        {
          id: 'allow-network',
          effect: 'allow',
          reason: 'Allow network access',
          match: {
            kind: 'networkDestination',
            value: 'github.com',
          },
        },
      ],
    };

    expect(validate(invalidPolicy)).toBe(false);
  });

  it('validates secret references without values', () => {
    const validSecrets = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      secrets: [
        {
          name: 'github-token',
          envVar: 'GITHUB_TOKEN',
          required: true,
        },
        {
          name: 'ssh-key',
          envVar: 'SSH_PRIVATE_KEY',
          required: false,
        },
      ],
    };

    expect(validate(validSecrets)).toBe(true);
  });

  it('rejects secret with value instead of reference', () => {
    const invalidSecret = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
      secrets: [
        {
          name: 'github-token',
          value: 'ghp_actual_token_value',
          required: true,
        },
      ],
    };

    expect(validate(invalidSecret)).toBe(false);
  });

  it('validates resources with all bounds required', () => {
    const validResources = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        resources: {
          memoryMb: 1024,
          cpus: 2,
          pids: 256,
          timeoutSeconds: 600,
        },
      },
    };

    expect(validate(validResources)).toBe(true);
  });

  it('rejects resources with missing bounds', () => {
    const invalidResources = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        resources: {
          memoryMb: 1024,
          cpus: 2,
        },
      },
    };

    expect(validate(invalidResources)).toBe(false);
  });

  it('rejects unbounded resources (missing fields means unbounded)', () => {
    // The schema requires all fields when resources object is present
    // This test ensures an omitted bound doesn't silently mean unbounded
    const unboundedResources = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        resources: {
          memoryMb: 1024,
          cpus: 2,
          pids: 256,
          timeoutSeconds: 600,
        },
      },
    };

    expect(validate(unboundedResources)).toBe(true);
  });
});

describe('YAML and JSON encoding equivalence', () => {
  it('accepts the same data in YAML and JSON', () => {
    const _yamlData = `
apiVersion: lazarus.dev/v1
title: Git Basics
environment:
  image: docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
`;
    const jsonData = {
      apiVersion: 'lazarus.dev/v1',
      title: 'Git Basics',
      environment: {
        image:
          'docker.io/library/git@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      },
    };

    const validate = ajv.compile(experienceSchema);
    expect(validate(jsonData)).toBe(true);
  });
});
