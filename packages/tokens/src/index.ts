import {
  colorRoles,
  motion,
  palette,
  radius,
  semantic,
  shadow,
  spacing,
  zIndex,
} from './generated/tokens.js';

import type { ColorRole } from './generated/tokens.js';

export type { ColorRole } from './generated/tokens.js';

export function colorRoleVar(role: ColorRole): string {
  return `var(--color-role-${role})`;
}

export { colorRoles, motion, palette, radius, semantic, shadow, spacing, zIndex };
