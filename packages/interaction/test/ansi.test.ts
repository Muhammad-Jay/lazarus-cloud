import { describe, expect, it } from 'vitest';

import { containsAnsi, interpretOutput, MAX_SPANS } from '../src/ansi.js';

/**
 * ANSI interpretation is a filter, not an emulator (ADR-0013, §4.3).
 *
 * Escape sequences are written as `\x1b` rather than as literal bytes so the intent
 * is legible in a diff and so no editor can quietly normalise them away.
 *
 * The two properties that matter: semantic roles in, literal colours out; and
 * nothing that could reach a terminal screen model surviving the trip.
 */

const ESC = '\x1b';
const BEL = '\x07';
const ST = '\x1b\\';

const stdout = { stream: 'stdout' } as const;

const textOf = (raw: string, options = stdout): string =>
  interpretOutput(raw, options).spans.map((span) => span.text).join('');

describe('interpretOutput', () => {
  it('leaves plain text in a single span', () => {
    expect(interpretOutput('hello world', stdout)).toEqual({
      spans: [{ text: 'hello world', style: { color: 'default' }, stream: 'stdout' }],
      byteCount: 11,
    });
  });

  it('reports the byte count of what was printed, not of what survived', () => {
    // `\x1b[32m` is 5 bytes, `\x1b[0m` is 4, and the text is 6.
    const raw = `${ESC}[32mabcdef${ESC}[0m`;
    expect(interpretOutput(raw, stdout).byteCount).toBe(15);
    expect(textOf(raw)).toBe('abcdef');
  });

  it('counts UTF-8 bytes rather than code units', () => {
    expect(interpretOutput('é', stdout).byteCount).toBe(2);
    expect(interpretOutput('€', stdout).byteCount).toBe(3);
    expect(interpretOutput('🙂', stdout).byteCount).toBe(4);
  });

  describe('colour', () => {
    it('maps each ANSI colour to a semantic role, never a literal', () => {
      const cases = [
        [30, 'muted'],
        [31, 'danger'],
        [32, 'success'],
        [33, 'warning'],
        [34, 'info'],
        [35, 'accent'],
        [36, 'info'],
        [37, 'default'],
      ] as const;

      for (const [code, role] of cases) {
        expect(interpretOutput(`${ESC}[${code}mred${ESC}[0m`, stdout).spans[0]?.style?.color).toBe(role);
      }
    });

    it('maps bright colours to the same roles', () => {
      for (const [code, role] of [
        [90, 'muted'],
        [91, 'danger'],
        [92, 'success'],
      ] as const) {
        expect(interpretOutput(`${ESC}[${code}mx${ESC}[0m`, stdout).spans[0]?.style?.color).toBe(role);
      }
    });

    it('drops extended colour because there is no token for it', () => {
      // 256-colour and truecolour fall back to `default` rather than inventing a
      // colour the design system has no name for (ADR-0018).
      expect(interpretOutput(`${ESC}[38;5;214mx${ESC}[0m`, stdout).spans[0]?.style?.color).toBe('default');
      expect(interpretOutput(`${ESC}[38;2;255;0;0mx${ESC}[0m`, stdout).spans[0]?.style?.color).toBe('default');
    });

    it('drops background colour too', () => {
      expect(interpretOutput(`${ESC}[41mx${ESC}[0m`, stdout).spans[0]?.style?.color).toBe('default');
    });

    it('never emits a literal colour', () => {
      const serialised = JSON.stringify(
        interpretOutput(`${ESC}[31m${ESC}[1m${ESC}[4mred${ESC}[0m${ESC}[38;5;9morange${ESC}[0m`, stdout),
      );
      expect(serialised).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(serialised).not.toMatch(/rgb|hsl|oklch/i);
    });
  });

  describe('attributes', () => {
    it('reads bold, dim, italic and underline', () => {
      const style = interpretOutput(`${ESC}[1m${ESC}[2m${ESC}[3m${ESC}[4mx`, stdout).spans[0]?.style;
      expect(style).toEqual({
        color: 'default',
        bold: true,
        dim: true,
        italic: true,
        underline: true,
      });
    });

    it('honours the individual resets', () => {
      const style = interpretOutput(`${ESC}[1m${ESC}[3ma${ESC}[22m${ESC}[23mb`, stdout).spans[1]?.style;
      expect(style?.bold).toBeUndefined();
      expect(style?.italic).toBeUndefined();
    });

    it('does not emit false-valued attributes', () => {
      const style = interpretOutput(`${ESC}[1mx`, stdout).spans[0]?.style;
      expect(style).not.toHaveProperty('italic', false);
      expect(style).not.toHaveProperty('dim', false);
    });

    it('resets everything on code 0', () => {
      const style = interpretOutput(`${ESC}[1m${ESC}[31ma${ESC}[0mb`, stdout).spans[1]?.style;
      expect(style).toEqual({ color: 'default' });
    });

    it('merges adjacent spans that carry the same style', () => {
      const output = interpretOutput(`a${ESC}[1mb${ESC}[1mc`, stdout);
      expect(output.spans).toHaveLength(2);
      expect(output.spans[1]?.text).toBe('bc');
    });
  });

  describe('stripping rather than emulating', () => {
    it('strips cursor movement', () => {
      for (const sequence of [
        `${ESC}[2A`,
        `${ESC}[10B`,
        `${ESC}[5C`,
        `${ESC}[3D`,
        `${ESC}[H`,
        `${ESC}[5;10H`,
        `${ESC}[10;20f`,
        `${ESC}[?25l`,
      ]) {
        expect(textOf(`before${sequence}after`), sequence).toBe('beforeafter');
      }
    });

    it('strips erase sequences', () => {
      expect(textOf(`keep${ESC}[2J`)).toBe('keep');
      expect(textOf(`keep${ESC}[K`)).toBe('keep');
      expect(textOf(`keep${ESC}[2K`)).toBe('keep');
    });

    it('strips OSC sequences that would reach the terminal', () => {
      // Window title and clipboard are the two that matter: a program's output has
      // no business setting either.
      expect(textOf(`a${ESC}]0;pwned${BEL}b`)).toBe('ab');
      expect(textOf(`a${ESC}]52;c;cHduCg==${ST}b`)).toBe('ab');
    });

    it('strips DCS, SOS and PM string sequences', () => {
      expect(textOf(`a${ESC}Pq#0;2;0;0;0${ST}b`)).toBe('ab');
      expect(textOf(`a${ESC}Xsecret${ST}b`)).toBe('ab');
      expect(textOf(`a${ESC}^secret${ST}b`)).toBe('ab');
    });

    it('strips carriage returns instead of honouring them', () => {
      // The program wrote both fragments. Collapsing them would invent a line it
      // never printed.
      expect(textOf('50%\r75%')).toBe('50%75%');
    });

    it('strips other control characters but keeps newlines and tabs', () => {
      expect(textOf(`a${BEL}b\x08c\x00d`)).toBe('abcd');
      expect(textOf('a\nb\tc')).toBe('a\nb\tc');
    });

    it('survives a truncated escape sequence at the end of input', () => {
      expect(textOf(`text${ESC}[`)).toBe('text');
      expect(textOf(`text${ESC}]0;abc`)).toBe('text');
    });

    it('strips two-byte and three-byte escape forms', () => {
      expect(textOf(`a${ESC}(B${ESC}=b`)).toBe('ab');
      expect(textOf(`a${ESC}7b`)).toBe('ab');
    });

    it('consumes the final byte of a truncated two-byte escape', () => {
      // `ESC` with nothing after it is dropped rather than leaking a lone byte.
      expect(textOf(`a${ESC}`)).toBe('a');
      expect(textOf(`a${ESC}(`)).toBe('a');
    });

    it('keeps hostile text as literal text, with no markup surface', () => {
      const output = interpretOutput(`<script>alert(1)</script>${ESC}[31mred${ESC}[0m`, stdout);
      // Preserved verbatim as text. There is no field in `RichOutput` that could
      // carry markup, so nothing here can reach an HTML sink (§4.9).
      expect(textOf(`<script>alert(1)</script>`)).toBe('<script>alert(1)</script>');
      expect(Object.keys(output).sort()).toEqual(['byteCount', 'spans']);
    });
  });

  describe('streams', () => {
    it('preserves which stream the text arrived on', () => {
      expect(interpretOutput('out', { stream: 'stderr' }).spans[0]?.stream).toBe('stderr');
    });

    it('keeps stdout and stderr distinguishable', () => {
      // §4.3: interleaving is part of what the program printed.
      expect(interpretOutput('a', stdout).spans[0]?.stream).toBe('stdout');
      expect(interpretOutput('b', { stream: 'stderr' }).spans[0]?.stream).toBe('stderr');
    });
  });

  describe('bounds', () => {
    it('folds the tail into the last span and discloses truncation', () => {
      const raw = `${'x'.repeat(10)}${ESC}[31m${'y'.repeat(10)}${ESC}[32m${'z'.repeat(10)}`;
      const output = interpretOutput(raw, { ...stdout, maxSpans: 1 });
      expect(output.truncated).toBe(true);
      expect(output.spans).toHaveLength(1);
      expect(output.spans[0]?.text).toBe(`${'x'.repeat(10)}${'y'.repeat(10)}${'z'.repeat(10)}`);
    });

    it('never exceeds the contract cap by default', () => {
      const raw = Array.from(
        { length: MAX_SPANS + 100 },
        (_, i) => `${ESC}[${31 + (i % 7)}mx`,
      ).join('');
      const output = interpretOutput(raw, stdout);
      expect(output.spans.length).toBeLessThanOrEqual(MAX_SPANS);
      expect(output.truncated).toBe(true);
    });

    it('handles empty input', () => {
      expect(interpretOutput('', stdout)).toEqual({ spans: [], byteCount: 0 });
    });
  });

  describe('purity', () => {
    it('is deterministic', () => {
      const raw = `${ESC}[32mok${ESC}[0m${ESC}[1mbold${ESC}[0m`;
      expect(interpretOutput(raw, stdout)).toEqual(interpretOutput(raw, stdout));
    });

    it('does not mutate its input', () => {
      const raw = `${ESC}[31mx${ESC}[0m`;
      interpretOutput(raw, stdout);
      expect(raw).toBe(`${ESC}[31mx${ESC}[0m`);
    });
  });
});

describe('containsAnsi', () => {
  it('detects an escape character', () => {
    expect(containsAnsi(`${ESC}[31mx`)).toBe(true);
  });

  it('is false for plain text', () => {
    expect(containsAnsi('plain')).toBe(false);
  });
});
