import type { ColorRole, RichOutput, TextStyle } from '@lazarus/contracts';

/**
 * ANSI interpretation: a filter, not an emulator.
 *
 * `LAZARUS_MODEL.md` §4.3 and ADR-0013 are both explicit that a transcript is a
 * record rather than a screen. So this module answers one question — "which
 * semantic role does each piece of this text carry?" — and deliberately does not
 * answer "what would this look like on a terminal".
 *
 * Everything a terminal would need in order to be a terminal is discarded:
 *
 * - **Cursor movement and erase** (`CSI A`-`G`, `H`, `f`, `J`, `K`, `d`, and the
 *   rest of the family) are stripped. Emulating them would mean deciding what
 *   overwrote what, which is a screen model, and would let a program delete text
 *   it had already printed. Output that redraws a progress bar in place arrives as
 *   the sequence of fragments it printed, not as the final line.
 * - **`CR` is stripped**, not honoured. A program that writes `50%\r` then `75%`
 *   produced both strings; a filter that collapsed them would be inventing a
 *   line the program never wrote.
 * - **OSC sequences are stripped** (`ESC ] … BEL` / `ESC \`). These set window
 *   titles, and in some terminals, clipboard contents. A document or a program's
 *   output has no business reaching them, and this is the boundary that stops it.
 * - **Charset and keypad selection** (`ESC ( B`, `ESC =`, …) are stripped.
 *
 * Colours become **semantic roles only**, never literal values, per ADR-0018.
 * Extended colour (`38;5;n` and `38;2;r;g;b`) is therefore *dropped to
 * `default`*: there is no token for "colour 214", so inventing one would be
 * exactly the literal-colour leak the design system forbids.
 *
 * ## Why this cannot become an injection vector
 *
 * The output of this function is text plus a closed set of roles. There is no
 * string that reaches a sink as markup, because no field here can hold markup and
 * nothing here produces HTML. §4.9's "escape, never `innerHTML`" is satisfied by
 * not producing an HTML surface in the first place; the renderer is still
 * required to render these spans as text.
 */

/** Contract cap on spans in one `RichOutput`. */
export const MAX_SPANS = 4096;

/** Text beyond this is folded into a final span and `truncated` is set. Never dropped silently. */
const DEFAULT_MAX_SPANS = 4096;

/**
 * ANSI SGR foreground codes mapped to semantic roles.
 *
 * The mapping is deliberately coarse: `magenta` and `cyan` have no tokens of their
 * own, so they borrow `accent` and `info`. An operator who cares which was which
 * has lost a distinction — deliberately, because the alternative is a per-program
 * palette that no design system could style.
 */
const FOREGROUND_ROLES: Readonly<Record<number, ColorRole>> = {
  30: 'muted',
  31: 'danger',
  32: 'success',
  33: 'warning',
  34: 'info',
  35: 'accent',
  36: 'info',
  37: 'default',
};

/** Bright variants reuse the same roles. */
const BRIGHT_FOREGROUND_ROLES: Readonly<Record<number, ColorRole>> = {
  90: 'muted',
  91: 'danger',
  92: 'success',
  93: 'warning',
  94: 'info',
  95: 'accent',
  96: 'info',
  97: 'default',
};

/** The role a reset and an unstyled span carry. Explicit rather than absent, so a role is always present. */
const DEFAULT_COLOR: ColorRole = 'default';

export interface InterpretOptions {
  /** Which stream this text arrived on. Preserved, because interleaving is part of what was printed. */
  stream: 'stdout' | 'stderr';
  /** Span budget before the tail is folded and `truncated` set. */
  maxSpans?: number;
}

/** Mutable cursor state while walking the string. */
interface StyleState {
  color: ColorRole;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

const initialStyle = (): StyleState => ({
  color: DEFAULT_COLOR,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
});

const toTextStyle = (state: StyleState): TextStyle => {
  const style: TextStyle = { color: state.color };
  if (state.bold) {
    style.bold = true;
  }
  if (state.dim) {
    style.dim = true;
  }
  if (state.italic) {
    style.italic = true;
  }
  if (state.underline) {
    style.underline = true;
  }
  return style;
};

const sameStyle = (left: TextStyle, right: TextStyle): boolean =>
  left.color === right.color &&
  Boolean(left.bold) === Boolean(right.bold) &&
  Boolean(left.dim) === Boolean(right.dim) &&
  Boolean(left.italic) === Boolean(right.italic) &&
  Boolean(left.underline) === Boolean(right.underline);

/**
 * UTF-8 byte length, counted by hand.
 *
 * `TextEncoder` would do this, but it is a global from the web platform and this
 * package's whole claim is that it reaches for none of them. Counting code points
 * here is six lines and keeps the claim honest.
 */
function utf8Length(input: string): number {
  let bytes = 0;
  for (const character of input) {
    const point = character.codePointAt(0) as number;
    if (point < 0x80) {
      bytes += 1;
    } else if (point < 0x800) {
      bytes += 2;
    } else if (point < 0x1_0000) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

/** `CSI` parameter bytes: digits, `;`, and the private/intermediate markers. */
const isParameterByte = (code: number): boolean =>
  (code >= 0x30 && code <= 0x3f) || (code >= 0x20 && code <= 0x2f);

/** Final byte of a `CSI` sequence. */
const isFinalByte = (code: number): boolean => code >= 0x40 && code <= 0x7e;

/** Intermediate byte: sits between an `ESC` introducer and its final byte. */
const isIntermediateByte = (code: number): boolean => code >= 0x20 && code <= 0x2f;

/**
 * Apply one SGR (`m`) parameter list.
 *
 * @param parameters numeric parameters, already split on `;`
 * @param state mutated in place
 * @param cursor index of the next unread parameter; advanced past any consumed by `38`
 */
function applySgr(parameters: number[], state: StyleState, cursor: { at: number }): void {
  while (cursor.at < parameters.length) {
    // `noUncheckedIndexedAccess` widens the read even though the loop condition
    // guarantees it, so narrow explicitly rather than asserting.
    const code = parameters[cursor.at] ?? 0;
    cursor.at += 1;

    switch (code) {
      case 0:
        state.color = DEFAULT_COLOR;
        state.bold = false;
        state.dim = false;
        state.italic = false;
        state.underline = false;
        break;
      case 1:
        state.bold = true;
        break;
      case 2:
        state.dim = true;
        break;
      case 3:
        state.italic = true;
        break;
      case 4:
        state.underline = true;
        break;
      case 22:
        state.bold = false;
        state.dim = false;
        break;
      case 23:
        state.italic = false;
        break;
      case 24:
        state.underline = false;
        break;
      case 39:
        state.color = DEFAULT_COLOR;
        break;
      case 38:
      case 48: {
        // Extended colour: `38;5;n` (256-colour) or `38;2;r;g;b` (truecolour).
        // Background is also dropped. Either way there is no token to render it,
        // so the colour falls back to `default` rather than reaching a literal.
        const mode = parameters[cursor.at] ?? 0;
        cursor.at += 1;
        if (mode === 5) {
          cursor.at += 1;
        } else if (mode === 2) {
          cursor.at += 3;
        }
        state.color = DEFAULT_COLOR;
        break;
      }
      default: {
        const role = FOREGROUND_ROLES[code] ?? BRIGHT_FOREGROUND_ROLES[code];
        if (role !== undefined) {
          state.color = role;
        }
        break;
        break;
      }
    }
  }
}

interface MutableSpan {
  text: string;
  style: TextStyle;
}

const pushSpan = (spans: MutableSpan[], span: MutableSpan): void => {
  const last = spans[spans.length - 1];
  if (last !== undefined && sameStyle(last.style, span.style)) {
    last.text += span.text;
    return;
  }
  if (span.text.length > 0) {
    spans.push(span);
  }
};

/**
 * Interpret raw program output into a `RichOutput`.
 *
 * @param raw exactly what the program printed, undecoded
 * @param options the stream it arrived on and the span budget
 * @returns spans of plain text carrying semantic roles
 */
export function interpretOutput(raw: string, options: InterpretOptions): RichOutput {
  const maxSpans = options.maxSpans ?? DEFAULT_MAX_SPANS;
  const state = initialStyle();
  const spans: MutableSpan[] = [];
  let truncated = false;

  let buffer = '';
  const flush = (): void => {
    pushSpan(spans, { text: buffer, style: toTextStyle(state) });
    buffer = '';
  };

  let index = 0;
  while (index < raw.length) {
    const code = raw.charCodeAt(index);

    if (code === 0x1b) {
      const next = raw.charCodeAt(index + 1);

      if (next === 0x5b) {
        // `CSI` — scan to the final byte, then dispatch on it.
        let cursor = index + 2;
        while (cursor < raw.length && !isFinalByte(raw.charCodeAt(cursor))) {
          if (!isParameterByte(raw.charCodeAt(cursor))) {
            break;
          }
          cursor += 1;
        }
        const final = raw[cursor];
        if (final === 'm') {
          const body = raw.slice(index + 2, cursor);
          const parameters = body
            .split(';')
            .map((part) => (part.length === 0 ? 0 : Number.parseInt(part, 10)))
            .map((value) => (Number.isNaN(value) ? 0 : value));
          flush();
          applySgr(parameters, state, { at: 0 });
        }
        // Any other final byte is cursor movement, erase, or mode setting: stripped.
        index = cursor + 1;
        continue;
      }

      if (next === 0x5d) {
        // `OSC` — runs to BEL or ST (`ESC \`). Stripped in full.
        let cursor = index + 2;
        while (cursor < raw.length) {
          const inner = raw.charCodeAt(cursor);
          if (inner === 0x07) {
            // BEL terminator: one byte.
            cursor += 1;
            break;
          }
          if (inner === 0x1b && raw.charCodeAt(cursor + 1) === 0x5c) {
            // `ST` is two bytes. Advancing only one leaks the backslash into the
            // transcript as visible text.
            cursor += 2;
            break;
          }
          cursor += 1;
        }
        // An unterminated sequence runs to the end of the input, so this always
        // advances and the outer loop terminates.
        index = cursor;
        continue;
      }

      if (next === 0x50 || next === 0x58 || next === 0x5e || next === 0x5f) {
        // `DCS` (`P`), `SOS` (`X`), `PM` (`^`) and `APC` (`_`) — string sequences
        // terminated by `ST`. Stripped in full.
        let cursor = index + 2;
        while (
          cursor < raw.length &&
          !(raw.charCodeAt(cursor) === 0x1b && raw.charCodeAt(cursor + 1) === 0x5c)
        ) {
          cursor += 1;
        }
        index = Math.min(cursor + 2, raw.length);
        continue;
      }

      // Any other `ESC` introduces a short sequence. Intermediate bytes
      // (0x20-0x2f) may sit between the introducer and the final byte — charset
      // selection is `ESC ( B`, three bytes — so skip them before the final byte
      // or its character survives into the transcript.
      flush();
      let cursor = index + 1;
      while (cursor < raw.length && isIntermediateByte(raw.charCodeAt(cursor))) {
        cursor += 1;
      }
      index = cursor < raw.length ? cursor + 1 : raw.length;
      continue;
    }

    if (code === 0x0d) {
      // Carriage return: stripped, never honoured. See the module comment.
      buffer += '';
      index += 1;
      continue;
    }

    const isC0 = code === 0x09 || (code <= 0x1f && code !== 0x0a) || code === 0x7f;
    if (isC0) {
      buffer += code === 0x09 ? '\t' : '';
      index += 1;
      continue;
    }

    buffer += raw[index];
    index += 1;
  }

  flush();

  let finalSpans = spans;
  if (finalSpans.length > maxSpans) {
    truncated = true;
    const kept = finalSpans.slice(0, maxSpans);
    const tail = finalSpans
      .slice(maxSpans)
      .map((span) => span.text)
      .join('');
    const lastKept = kept[kept.length - 1];
    if (lastKept !== undefined) {
      lastKept.text += tail;
    }
    finalSpans = kept;
  }

  const output: RichOutput = {
    spans: finalSpans.map((span) => {
      const mapped: RichOutput['spans'][number] = {
        text: span.text,
        style: span.style,
        stream: options.stream,
      };
      return mapped;
    }),
    byteCount: utf8Length(raw),
  };
  if (truncated) {
    output.truncated = true;
  }
  return output;
}

/** Does this text contain anything an ANSI filter would have to interpret? */
export const containsAnsi = (raw: string): boolean => raw.includes('');
