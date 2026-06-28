// The animation home. Every preset, count-up, and haptic lives here; screens import from
// this module and never touch durations or expo-haptics directly. See DESIGN_SYSTEM.md §2.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, type DimensionValue } from 'react-native';
import {
  Easing,
  FadeInDown,
  FadeOut,
  Keyframe,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COUNT_UP, DUR, STAGGER, easeInOutQuad } from './tokens';

// ── Entering / layout presets (§2.2) ────────────────────────────────
// Staggered list entrance — pass the item index.
export const cardEnter = (i: number) =>
  FadeInDown.delay(i * STAGGER).duration(DUR.base).easing(Easing.out(Easing.cubic));

export const fadeOut = FadeOut.duration(DUR.fast);

// Animate height/position on add, remove, expand, collapse.
export const layout = LinearTransition.duration(DUR.base).easing(Easing.out(Easing.cubic));

// Verdict banner — fade + subtle scale on mount (§2.5). Keyframe lets us combine opacity +
// transform in one entering animation; screens just pass it to `entering={bannerEnter}`.
export const bannerEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(DUR.base);

// ── Fill bar (§2.5) ─────────────────────────────────────────────────
// Animates a bar's width 0 → ratio (0..1) as a width %. Used by the Results recoverable bar.
// Duration/easing live here so screens never spell out timings.
export function useFillBar(ratio: number, ms: number = DUR.slow) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: ms, easing: Easing.inOut(Easing.quad) });
  }, [pct, ms, w]);
  return useAnimatedStyle(() => ({ width: `${w.value * 100}%` as DimensionValue }));
}

// ── Continuous / toggle transforms (§2.5) ───────────────────────────
// Spinner: Loader icon rotates 360° on a linear loop (default 1000ms).
export function useSpin(ms = 1000) {
  const deg = useSharedValue(0);
  useEffect(() => {
    deg.value = withRepeat(withTiming(360, { duration: ms, easing: Easing.linear }), -1, false);
  }, [ms, deg]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
}

// Chevron rotates 0 ↔ 180 on toggle — fast, out(quad).
export function useChevronRotate(open: boolean) {
  const deg = useSharedValue(0);
  useEffect(() => {
    deg.value = withTiming(open ? 180 : 0, {
      duration: DUR.fast,
      easing: Easing.out(Easing.quad),
    });
  }, [open, deg]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
}

// Press scale for buttons/chips — scale to `to` on press-in, back to 1 on release. Fast,
// out(quad). Returns the animated style + the two handlers to spread onto a Pressable.
export function usePressScale(to = 0.97) {
  const s = useSharedValue(1);
  const animate = (v: number) =>
    (s.value = withTiming(v, { duration: DUR.fast, easing: Easing.out(Easing.quad) }));
  return {
    style: useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })),
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  };
}

// Skeleton shimmer — opacity pulses 0.4 ↔ 1 on a 1200ms loop (600ms each way), inOut(quad).
export function useShimmer() {
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  return useAnimatedStyle(() => ({ opacity: o.value }));
}

// Step check-off pop — the Check icon scales + fades in when a step completes. Fast, out(cubic).
export const checkPop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(DUR.fast);

// ── Analyzing progress (§2.5) ───────────────────────────────────────
// HONEST estimated bar: `analyze()` is a single promise with no per-phase callback, so the bar
// eases toward 90% over an expected duration and HOLDS there until the response lands, then
// `complete()` sweeps it to 100%. Steps check off as the bar crosses index thresholds.
// `estMs` is tuned to the mock-demo timing (~2.5s); in real mode the bar parks at 90% until the
// pipeline (usually 1–2 min) resolves. Upgrade path: drive this from streamed phase events.
export function useAnalyzingProgress(stepCount: number, estMs = 4000) {
  const progress = useSharedValue(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    progress.value = withTiming(0.9, { duration: estMs, easing: Easing.inOut(Easing.quad) });
  }, [estMs, progress]);

  // Reflect the (UI-thread) progress into JS step state only when the floored step changes.
  useAnimatedReaction(
    () => progress.value,
    (p, prev) => {
      const cur = Math.min(stepCount, Math.floor(p * stepCount));
      const before = prev == null ? -1 : Math.min(stepCount, Math.floor(prev * stepCount));
      if (cur !== before) runOnJS(setStep)(cur);
    },
    [stepCount]
  );

  const width = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as DimensionValue }));

  // Snap to 100% over `slow` and fire onDone once the fill finishes.
  const complete = (onDone?: () => void) => {
    progress.value = withTiming(
      1,
      { duration: DUR.slow, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      }
    );
  };

  return { width, step, complete };
}

// ── Count-up (§2.3) ─────────────────────────────────────────────────
// The recoverable ฿ animates 0 → target. Pure display animation; rAF JS loop.
// ponytail: rAF count-up. Swap to Reanimated ReText only if it stutters on a real device.
export function useCountUp(target: number, ms = COUNT_UP): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      setValue(Math.round(target * easeInOutQuad(p)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);
  return value;
}

// ── Haptics (§2.4) ──────────────────────────────────────────────────
// Thin wrappers; no-op on web. Light for routine taps, success/warn for moments.
const ok = Platform.OS !== 'web';
export const tapLight = () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const tapMedium = () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const tapSuccess = () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const tapWarn = () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
