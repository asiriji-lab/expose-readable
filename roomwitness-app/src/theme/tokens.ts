// Design-system constants. Pure (no native imports) so it's safe to import anywhere,
// including a plain-node self-check. See DESIGN_SYSTEM.md §1–§2.

import type { ViewStyle } from 'react-native';

// §1.4 — the one soft card shadow. Depth, not drama.
export const cardShadow: ViewStyle = {
  shadowColor: '#0B1F3A', // surface-navy tint, not pure black
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2, // Android
};

// §2.1 — motion timing.
export const DUR = { fast: 150, base: 250, slow: 400 } as const; // ms
export const STAGGER = 60; // ms between list items
export const COUNT_UP = 900; // ms for the recoverable-฿ count-up

// Easing for the count-up (kept here, pure, so it's unit-testable without Reanimated).
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
