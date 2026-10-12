/**
 * `@lazarus/spec` — the experience contract.
 *
 * `lazarus.schema.json` is authoritative. The types re-exported here are
 * generated from it and are never hand-edited (`AGENTS.md` §4.7).
 */

export type {
  Command,
  Document,
  Environment,
  ImageDigest,
  LazarusExperience,
  PolicyTightening,
  PortNumber,
  Resources,
  SecretRef,
  Task,
} from './generated/experience.js';
