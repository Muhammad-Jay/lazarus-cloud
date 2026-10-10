import { describe, expect, it } from 'vitest';

import { syntheticId } from '../src/ids.js';

/**
 * Block ids are derived, not generated, so that replayed events are recognisable
 * (§8.4). These cases pin the properties that depends on.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Strip the dashes so a test can index the hex digits directly. */
const hexDigits = (id: string): string => id.replaceAll('-', '');

describe('syntheticId', () => {
  it('is stable for the same scope and key', () => {
    expect(syntheticId('block', 'output:abc:1')).toBe(syntheticId('block', 'output:abc:1'));
  });

  it('matches the contract uuid pattern', () => {
    expect(syntheticId('block', 'anything')).toMatch(UUID);
  });

  it('sets the custom version nibble, so it is never mistaken for a random UUID', () => {
    // RFC 9562 reserves versions 8-15 for custom layouts; an RFC 4122 v4 random id
    // carries `4`. Read from the hex digits, since dashes are added afterwards —
    // character 12 of the finished string is a dash.
    expect(hexDigits(syntheticId('block', 'anything'))[12]).toBe('8');
  });

  it('sets a conforming variant', () => {
    expect(['8', '9', 'a', 'b']).toContain(hexDigits(syntheticId('block', 'anything'))[16]);
  });

  it('would be distinguishable from a v4 random id', () => {
    // The property the version nibble exists for: nothing here can be mistaken
    // for an id a server minted.
    expect(syntheticId('block', 'anything')[14]).not.toBe('4');
  });

  it('differs by scope', () => {
    expect(syntheticId('one', 'key')).not.toBe(syntheticId('two', 'key'));
  });

  it('differs by key', () => {
    expect(syntheticId('block', 'a')).not.toBe(syntheticId('block', 'b'));
  });

  it('does not let a scope and key run together ambiguously', () => {
    // Without a separator, ('ab','c') and ('a','bc') would hash identically and
    // two different events would collapse into one transcript block.
    expect(syntheticId('ab', 'c')).not.toBe(syntheticId('a', 'bc'));
  });

  it('distinguishes keys that differ only in a numeric suffix', () => {
    // `output:abc:1` and `output:abc:2` must not collide, or one output event
    // would replace another in the transcript.
    expect(syntheticId('block', 'output:abc:1')).not.toBe(
      syntheticId('block', 'output:abc:2'),
    );
  });

  it('handles an empty scope and key', () => {
    expect(syntheticId('', '')).toMatch(UUID);
  });

  it('handles non-ASCII keys deterministically', () => {
    const first = syntheticId('block', '命令');
    expect(first).toBe(syntheticId('block', '命令'));
    expect(first).toMatch(UUID);
  });

  it('spreads distinct keys across distinct values', () => {
    // Not a collision-resistance claim; a smoke test that the two 64-bit halves
    // are not correlated, which would halve the digest.
    const ids = new Set(
      Array.from({ length: 500 }, (_, i) => syntheticId('block', `key-${i}`)),
    );
    expect(ids.size).toBe(500);
  });
});
