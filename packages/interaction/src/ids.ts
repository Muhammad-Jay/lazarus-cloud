import type { Uuid } from '@lazarus/contracts';

/**
 * Deterministic identifiers for transcript blocks.
 *
 * A block's id is derived from the event that produced it rather than generated,
 * and that is a requirement rather than a stylistic choice.
 *
 * The reducer must be pure, so it cannot call `crypto.randomUUID()`. More
 * importantly, reconnection replays events the client has already seen, and the
 * model requires a reconnected client to end up with the same transcript
 * (§8.4). If ids were random, a replayed event would append a duplicate block
 * under a fresh id and the transcript would grow every time the network blinked.
 * Deriving the id from the event makes normalisation idempotent: the same event
 * always yields the same block id, so the duplicate is recognisable and dropped.
 *
 * ## Not a UUID you can trust as an identity
 *
 * The value is shaped like a UUID because the contract's `uuid` format demands
 * it, but it is **not** an RFC 4122 version 4 random id and **not** a version 5
 * name-based id: those commit to collision properties this hash does not have. It
 * is a 128-bit FNV-1a digest of a namespace and a key.
 *
 * The version nibble is therefore set to `8` and the variant to `10xx`, which RFC
 * 9562 reserves for custom layouts. A block id from this module is therefore
 * distinguishable from a random id on sight, and nobody can mistake one for the
 * other. FNV-1a is not cryptographic; these ids are for correlation inside one
 * transcript, never for anything a security decision depends on.
 */

/** FNV-1a 64-bit offset basis and prime. */
const FNV_OFFSET_BASIS = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;
const MASK_64 = 0xffff_ffff_ffff_ffffn;

/** Distinct seeds so the two 64-bit halves are not correlated. */
const HIGH_SEED = FNV_OFFSET_BASIS;
const LOW_SEED = 0x8422_2325_cbf2_9ce4n;

/** Separates the namespace from the key so `("ab", "c")` cannot hash as `("a", "bc")`. */
const SEPARATOR = '\u0000';

/**
 * FNV-1a over UTF-16 code units.
 *
 * Code units rather than UTF-8 bytes because a hand-rolled encoder would be a
 * second implementation of something the platform already guarantees. Iterating
 * code units is pure JavaScript, so the digest is identical on every engine —
 * which is the only property this module needs.
 */
function fnv1a64(input: string, seed: bigint): bigint {
  let hash = seed;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * Format two 64-bit halves as a UUID, stamping the custom version and variant.
 *
 * Layout is `8-4-4-4-12`. Indexed against the *hex digits* rather than the final
 * string: the dashes are inserted afterwards, so counting characters of the output
 * would put the version and variant nibbles in the wrong places.
 */
function formatUuid(high: bigint, low: bigint): Uuid {
  const digits = `${high.toString(16).padStart(16, '0')}${low
    .toString(16)
    .padStart(16, '0')}`.split('');

  digits[12] = '8';
  digits[16] = 'a';

  const hex = digits.join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-') as Uuid;
}

/**
 * Derive a stable id from a scope and a key.
 *
 * @param scope what kind of thing this identifies, e.g. `transcriptBlock`
 * @param key the discriminating value, unique within the scope
 * @returns the same id for the same inputs, always
 */
export function syntheticId(scope: string, key: string): Uuid {
  const material = `${scope}${SEPARATOR}${key}`;
  return formatUuid(fnv1a64(material, HIGH_SEED), fnv1a64(material, LOW_SEED));
}
