// ---------------------------------------------------------------------------
// GENERATED. DO NOT EDIT.
//
// Source of truth: packages/spec/lazarus.schema.json
// Regenerate with `just codegen`. Fix the schema, not this file.
// ---------------------------------------------------------------------------

export interface Command {
  /**
   * Stable identifier. Unique within the experience.
   */
  id: string;
  /**
   * The program to run. An absolute path or a bare name resolved against the image's PATH by the runtime.
   */
  executable: string;
  /**
   * Default arguments. A reader may change them; these are the values that populate the draft.
   *
   * @maxItems 128
   */
  args?: string[];
  /**
   * One line saying what the command does. Shown on hover.
   */
  summary: string;
  /**
   * Longer explanation, as plain text.
   */
  description?: string;
  /**
   * The document this command is explained in, if any.
   */
  documentId?: string;
  /**
   * Whether the command is expected to print to stdout. Used for documentation quality, never for policy.
   */
  expectsOutput?: boolean;
}
/**
 * One document in the reading order.
 */

export interface Document {
  /**
   * Stable identifier referenced by commands and tasks. Unique within the experience.
   */
  id: string;
  title: string;
  summary?: string;
  /**
   * The document body, authored as a restricted MDX subset: prose, headings, code, and allow-listed components with typed string and number props. Creator import, export, expressions, and arbitrary JSX are not supported, so there is no path from a document to eval (ADR-0017). Validated at publish time; a document that fails is never published.
   */
  mdx?: string;
}
/**
 * The prepared software environment a session runs against.
 */

export interface Environment {
  image: ImageDigest;
  /**
   * Working directory inside the session layer. Relative paths only; '..' and absolute paths are rejected at validation, so a path containment check cannot be skipped by a manifest.
   */
  workdir?: string;
  /**
   * Non-secret environment variables. Secret values are never expressible here; use secrets[] by reference.
   */
  env?: {
    [k: string]: string;
  };
  resources?: Resources;
  /**
   * Egress policy. A session has no ingress route at all (ADR-0012), so only egress is expressible.
   */
  network?: {
    /**
     * Permitted outbound destinations. Absent means deny all outbound.
     *
     * @maxItems 50
     */
    egress?: string[];
    /**
     * Permitted DNS resolvers. Absent means the platform default.
     *
     * @maxItems 4
     */
    dns?: [] | [string] | [string, string] | [string, string, string] | [string, string, string, string];
  };
}
/**
 * Upper bounds for a session's container. Every field is required when the object is present, because an omitted bound would silently mean 'unbounded' and deny-by-default has no way to tell that apart from an intent.
 */

export type ImageDigest = string;
/**
 * A TCP port, 1-65535. A value object rather than a bare integer, because the range is an invariant.
 */

export interface LazarusExperience {
  /**
   * Schema version this experience was written against. Breaking schema changes require a new value here.
   */
  apiVersion: string;
  /**
   * Short human title for the experience. Shown in the header and in a list of experiences.
   */
  title: string;
  /**
   * One or two sentences describing what a reader will learn. Plain text; no markup.
   */
  description?: string;
  /**
   * Free-form topical labels. Discovery only, never used for authorisation or policy.
   *
   * @maxItems 16
   */
  tags?:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
  environment: Environment;
  /**
   * The documents a reader works through, in order. Each is validated at publish time against the component allow-list (ADR-0017).
   *
   * @minItems 1
   * @maxItems 200
   */
  documentation?: [Document, ...Document[]];
  /**
   * Commands this experience documents. Declaring a command makes it discoverable and gives it a narrower policy evaluation. It never grants permission to run it: policy adjudicates every command at runtime, declared or not (ADR-0015).
   *
   * @maxItems 500
   */
  commands?: Command[];
  /**
   * Multi-step exercises. A task lists command references rather than raw command text, so the environment and docs stay the single source of truth.
   *
   * @maxItems 200
   */
  tasks?: Task[];
  /**
   * Secrets this experience needs. An experience names a secret; it never carries one. Values are supplied out of band by an operator, encrypted at rest, redacted in every log and error, and never returned by any API.
   *
   * @maxItems 50
   */
  secrets?: SecretRef[];
  /**
   * Tightening only. A policy entry can narrow what an experience may do; it can never widen it, and it cannot grant a capability policy would otherwise deny (ADR-0015).
   *
   * @maxItems 50
   */
  policies?: PolicyTightening[];
}
/**
 * The prepared software environment a session runs against.
 */

export interface PolicyTightening {
  id: string;
  /**
   * The restriction this entry applies. Deny is the only permitted value: an allow here would be a capability grant.
   */
  effect: "deny";
  reason?: string;
  /**
   * What the restriction applies to.
   */
  match?: {
    /**
     * A discriminated union rather than an optional flag, so a reader cannot be unsure which shape applies.
     */
    kind: "executable" | "networkDestination" | "filesystemPath";
    /**
     * The literal to match, interpreted according to kind. A leading '*' matches a prefix.
     */
    value?: string;
  };
}
/**
 * A reference to a secret by name. Never a value.
 */

export type PortNumber = number;

export interface Resources {
  memoryMb: number;
  cpus: number;
  pids: number;
  timeoutSeconds?: number;
}
/**
 * A restriction an experience may impose on itself. Tightening only. There is deliberately no field here that widens a capability, because a creator-supplied widening would be an untrusted input granting privilege.
 */

export interface SecretRef {
  /**
   * Logical name, unique within the experience.
   */
  name: string;
  /**
   * Environment variable the value is exposed as inside the session.
   */
  envVar: string;
  /**
   * Whether the session fails to start when the value is absent.
   */
  required?: boolean;
}
/**
 * An ordered set of steps accomplishing one goal.
 */

export interface Task {
  id: string;
  title: string;
  summary?: string;
  /**
   * Command ids in order. Each must resolve to a command in this experience.
   *
   * @minItems 1
   * @maxItems 50
   */
  steps: [string, ...string[]];
  documentId?: string;
}
