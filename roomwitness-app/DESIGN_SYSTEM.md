# RoomWitness — Design System

Reference spec for the Expo app (`roomwitness-app`). Tokens, motion, primitives, and the
per-screen flow. Built so KP / Beam / Tuey share one vocabulary and screens stop repeating
ad-hoc classes.

**Stack:** Expo SDK 54 · React Native 0.81 · expo-router 6 · NativeWind 4 (Tailwind 3) ·
Reanimated 4 · zustand. Bilingual Thai-primary / English-secondary.

**Source of truth:** colors, radius, and fonts already live in `tailwind.config.js`. This
doc documents and extends them — it does **not** introduce a second color system.

**Status:** §1 Tokens ✅ · §2 Motion ✅ · §3 Primitives ✅ · §4 Flow + fixes ✅

---

## 1. Tokens

All values below are the live values in `tailwind.config.js` unless marked **(add)**.
Usage column = when to reach for it.

### 1.1 Color

One primary (blue) + three semantic verdict colors, each with a `-soft` background tint.
Every verdict color has meaning — never decorative.

| Token | Hex | Tailwind class | Usage |
|---|---|---|---|
| `primary` | `#0062FF` | `bg-primary` `text-primary` | Primary buttons, active states, links, focus |
| `primary-soft` | `#E6F0FF` | `bg-primary-soft` | Tinted chips/banners on white, info callouts |
| `primary-dark` | `#0047B3` | `text-primary-dark` | Text on `primary-soft`, pressed primary |
| `lawful` | `#16A34A` | `text-lawful` `border-lawful` | LAWFUL verdict, money-recoverable, success |
| `lawful-soft` | `#DCFCE7` | `bg-lawful-soft` | LAWFUL badge/banner bg |
| `disputed` | `#D97706` | `text-disputed` | DISPUTED verdict, warning |
| `disputed-soft` | `#FEF3C7` | `bg-disputed-soft` | DISPUTED badge/banner bg |
| `unlawful` | `#DC2626` | `text-unlawful` | UNLAWFUL verdict, error, destructive |
| `unlawful-soft` | `#FEE2E2` | `bg-unlawful-soft` | UNLAWFUL badge/banner bg, error box |
| `surface-navy` | `#0B1F3A` | `bg-surface-navy` | Dark info panel (Thai legal summary on ClaimCard) |

**Verdict mapping (canonical, do not deviate):** `LAWFUL → lawful (green)`,
`DISPUTED → disputed (amber)`, `UNLAWFUL → unlawful (red)`. Defined once in
`ClassificationBadge.tsx`; reuse it, never re-hardcode.

**Neutrals:** use Tailwind's default gray ramp. Fixed roles so screens stay consistent:

| Class | Role |
|---|---|
| `bg-white` | Card surface, input bg |
| `bg-gray-50` | Screen background, inset/secondary tiles |
| `border-gray-200` | All hairline borders (cards, inputs) |
| `text-gray-900` | Primary heading / value text |
| `text-gray-800` | Section labels, body emphasis |
| `text-gray-600` | Field labels, secondary body |
| `text-gray-500` | Captions, English secondary line, meta |
| `text-gray-400` | Disclaimers, placeholders, disabled hint |
| `text-gray-300` / `bg-gray-300` | Disabled button bg |

> **Avoid raw one-offs.** `bg-yellow-100`/`text-yellow-700` (Results "estimate" chip) is a
> stray — replace with `disputed-soft`/`disputed` so the estimate reads as the same "caution"
> family used elsewhere. **(fix, see §4)**

### 1.2 Spacing

Tailwind default 4px scale (`1`=4px, `2`=8px, `3`=12px, `4`=16px, `6`=24px, `8`=32px).
Rules (from the UI field guide — "let it breathe"):

| Intent | Value | Class |
|---|---|---|
| Screen horizontal padding | 16px | `px-4` |
| Gap between related items (within a group) | 8–12px | `gap-2` / `gap-3` |
| Card inner padding | 16px | `p-4` |
| Gap **between** groups / sections | 24–32px | `mb-6` / `mb-8` |
| Card-to-card in a list | 12px | `mb-3` (currently `mb-2` in places — **(fix)** bump to `mb-3`) |

Stick to multiples of 4; prefer 8 for anything structural. "You need more space than you
think, especially on mobile."

### 1.3 Radius

> ⚠️ **Footgun:** `tailwind.config.js` **overrides** Tailwind's radius scale. Here
> `rounded-sm` = **8px** (not the stock 2px). Internalize these three values:

| Token | Value | Tailwind class | Usage |
|---|---|---|---|
| `sm` | `8px` | `rounded-sm` | Pills, chips, badges, small tiles |
| `md` | `12px` | `rounded-md` | Inputs, inner panels (Thai summary), buttons |
| `lg` | `16px` | `rounded-lg` | Cards, image tiles, primary CTA |

For true pills (evidence chips, route selectors) consider `rounded-full` instead of `sm`
so they read as pills, not soft rectangles. **(optional polish, §4)**

### 1.4 Shadow **(add)**

Cards are currently flat (border only). Add exactly **one** soft shadow token — depth, not
drama. "If the shadow is the first thing you notice, it's wrong."

```ts
// src/theme/tokens.ts
export const cardShadow = {
  shadowColor: '#0B1F3A',      // surface-navy tint, not pure black
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,                // Android
} as const;
```

Applied via the `Card` primitive (§3), not sprinkled per-screen. Keep the `border-gray-200`
hairline too — shadow + hairline together read crisp on both iOS and Android.

### 1.5 Typography

Four fonts are **loaded** in `_layout.tsx` and **mapped** in `tailwind.config.js`, but only
`font-mono` is ever applied — Thai currently renders in the system font. Wiring these is the
single highest-value fix (§4).

| Family token | Font | Class | Usage |
|---|---|---|---|
| `display` | `BaiJamjuree_600SemiBold` | `font-display` | Hero headings, big numbers (recoverable ฿) |
| `thai` | `NotoSansThai_400Regular` | `font-thai` | **Default body** — all Thai-primary text |
| `body` | `Inter_400Regular` | `font-body` | English/Latin-only runs, numerals |
| `mono` | `IBMPlexMono_500Medium` | `font-mono` | Legal citations (§section · source) |

NotoSansThai is the safe default because it renders Thai *and* Latin acceptably; Inter
mangles Thai. Default everything to `font-thai` (via the `Body` primitive / a global
`Text` default), promote to `font-display` only on heroes and headline numbers.

**Type scale** (sizes in use + the field-guide treatment for large text — tighten tracking,
loosen leading 110–120%):

| Role | Size | Class | Tracking | Leading |
|---|---|---|---|---|
| Hero heading | 24px | `text-2xl` | `tracking-tight` **(add)** | `leading-tight` |
| Screen title (TH) | 20px | `text-xl` | `tracking-tight` **(add)** | tight |
| Headline number (฿) | 24–30px | `text-2xl`/`text-3xl` | `tracking-tight` | — |
| Body / value | 16px | `text-base` | normal | normal |
| Secondary / label | 14px | `text-sm` | normal | `leading-5` |
| Caption / EN line / meta | 12px | `text-xs` | normal | normal |

Keep to these six steps. Large text (≥20px) gets `tracking-tight`; small text never does.

---

## 2. Motion

Ambition: **"demo wow"** — the recoverable ฿ counts up, claim cards stagger in, the
Analyzing bar feels alive, success buzzes. The trick is making it feel premium without
scattering animation logic everywhere.

**Where animation lives:** one module, `src/theme/motion.ts`. Every preset, duration, and
haptic helper is exported from there. Screens import named presets — they never define
durations or call `expo-haptics` directly. Screen-to-screen transitions live in
`_layout.tsx` Stack options. That's the whole surface.

```
src/theme/
  tokens.ts   ← §1 (cardShadow) + the constants below
  motion.ts   ← presets, useCountUp, haptics      ← THE animation home
src/app/_layout.tsx  ← Stack screenOptions.animation (screen transitions)
```

New dependency required: **`expo-haptics`** (`npx expo install expo-haptics`). Reanimated 4
+ worklets are already installed and auto-configured by `babel-preset-expo` on SDK 54 — no
babel plugin to add.

### 2.1 Constants (in `tokens.ts`)

```ts
export const DUR = { fast: 150, base: 250, slow: 400 } as const; // ms
export const STAGGER = 60;   // ms between list items
export const COUNT_UP = 900; // ms for the ฿ count-up
```

Easing comes from Reanimated's `Easing`:
- **Entrances / exits:** `Easing.out(Easing.cubic)` — fast in, gentle settle.
- **Progress bar / count-up:** `Easing.inOut(Easing.quad)` — smooth both ends.
- **Press scale:** `Easing.out(Easing.quad)`.

### 2.2 Presets (in `motion.ts`)

```ts
import { FadeInDown, FadeOut, LinearTransition, Easing } from 'react-native-reanimated';
import { DUR, STAGGER } from './tokens';

// Staggered list entrance — pass the item index.
export const cardEnter = (i: number) =>
  FadeInDown.delay(i * STAGGER).duration(DUR.base).easing(Easing.out(Easing.cubic));

export const fadeOut = FadeOut.duration(DUR.fast);

// Animate height/position on add, remove, expand, collapse.
export const layout = LinearTransition.duration(DUR.base).easing(Easing.out(Easing.cubic));
```

Usage: `<Animated.View entering={cardEnter(i)} exiting={fadeOut} layout={layout}>`.

### 2.3 Count-up (in `motion.ts`)

The recoverable ฿ animates 0 → value. The API returns one number, so this is a pure display
animation — a small rAF JS loop, no Reanimated text plumbing.

```ts
import { useEffect, useRef, useState } from 'react';
import { COUNT_UP } from './tokens';
import { Easing } from 'react-native-reanimated'; // factory is sync, fine to call in JS

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function useCountUp(target: number, ms = COUNT_UP): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      setValue(Math.round(target * easeInOutQuad(p)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return value;
}
// ponytail: rAF count-up. Swap to Reanimated ReText only if it stutters on a real device.
```

Self-check (the only non-trivial math here — ship one runnable assert, no framework):
```ts
// motion.check.ts — node -r ts-node/register, or fold into a __tests__ file
import assert from 'node:assert';
assert.strictEqual(easeInOutQuad(0), 0);
assert.strictEqual(easeInOutQuad(1), 1);
assert.ok(easeInOutQuad(0.4) < easeInOutQuad(0.6)); // monotonic increasing
```

### 2.4 Haptics (in `motion.ts`)

Thin wrappers so screens never import `expo-haptics` directly; no-op on web.

```ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
const ok = Platform.OS !== 'web';

export const tapLight   = () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const tapMedium  = () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const tapSuccess = () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const tapWarn    = () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
```

"Vary haptic strength by frequency" — light for routine taps, success/warn reserved for
moments (results landing, errors). Don't buzz on every keystroke.

### 2.5 Animation catalog

The full inventory — each effect's trigger, duration, easing, haptic. Screen wiring detail
is in §4; this is the contract.

| Effect | Trigger | Duration | Easing | Haptic |
|---|---|---|---|---|
| Screen transition | route push/replace | `base` 250 | router default (`slide_from_right`) | — |
| Claim/doc card enter | list mount | `base` + `cardEnter(i)` stagger 60 | `out(cubic)` | — |
| Claim row add/remove | Upload +/✕ | `base` via `layout` | `out(cubic)` | `tapLight` |
| Card expand/collapse | "Why" toggle | `base` via `layout` | `out(cubic)` | `tapLight` |
| Chevron rotate | "Why" toggle | `fast` 150 | `out(quad)` | (shared w/ above) |
| Recoverable ฿ count-up | Results mount | `COUNT_UP` 900 | `inOut(quad)` | — |
| Recoverable fill bar | Results mount | `slow` 400 | `inOut(quad)` | — |
| Verdict banner enter | Results mount | `base` 250 fade+scale | `out(cubic)` | `tapSuccess` if recoverable>0 |
| Analyzing progress bar | screen active | eased to ~90%, completes on resolve | `inOut(quad)` | `tapSuccess` on done |
| Analyzing step check-off | bar passes threshold | `fast` 150 | `out(cubic)` | — |
| Spinner (lucide `Loader`) | while loading | 1000 loop | `linear` | — |
| Error state enter | catch | `fast` fade | `out(quad)` | `tapWarn` |
| Primary button press | press in/out | `fast` scale → 0.97 | `out(quad)` | `tapMedium` on confirm |
| Route chip select | Details tap | `fast` 150 | `out(cubic)` | `tapLight` |
| Skeleton shimmer | Documents generating | 1200 loop | `inOut(quad)` | — |

> **Analyzing bar is estimated, not real.** `analyze(form)` is a single promise with no
> per-phase callback, so the bar eases toward ~90% over the expected duration and snaps to
> 100% when the response lands. Honest by design. **Upgrade path:** when the backend streams
> phase events, drive the bar + step check-offs from those instead. Documented so nobody
> mistakes it for true progress.

---

## 3. Primitives

Six small components in `src/components/ui/`. They exist to kill repetition — every screen
currently re-types `SafeAreaView + ScrollView`, `bg-white rounded-lg border border-gray-200
p-4`, and verbose `Text` className stacks. Primitives bake the tokens (§1) and motion (§2)
in so screens read as intent, not styling.

```
src/components/ui/
  Screen.tsx    Heading.tsx   Section.tsx
  Card.tsx      Body.tsx      Icon.tsx
```

Rule: a primitive owns its tokens; callers pass content + intent, not raw colors/sizes.
All accept `className` for one-off overrides (NativeWind merges last-wins).

### 3.1 `Screen`

Page chrome: SafeArea + NavHeader + keyboard avoidance + optional scroll. Replaces the
`SafeAreaView/KeyboardAvoidingView/ScrollView` boilerplate in all 5 screens.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `step` | `1..5` | — | Passed to `NavHeader` (progress) |
| `label` | `string` | — | NavHeader label, e.g. `'อัปโหลด · Upload'` |
| `scroll` | `boolean` | `true` | `false` for centered states (Analyzing) |
| `bg` | `'white' \| 'gray'` | `'gray'` | `gray` = `bg-gray-50`, the default page bg |
| `children` | `ReactNode` | — | |

```tsx
<Screen step={3} label="ผลลัพธ์ · Results">
  …content…
</Screen>
```
Internals: wraps children in `KeyboardAvoidingView` (`behavior` per platform) and, when
`scroll`, a `ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled"`.

### 3.2 `Card`

White surface with the §1.4 `cardShadow` + hairline. Replaces `bg-white rounded-lg border
border-gray-200 p-4`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `padded` | `boolean` | `true` | `p-4`; `false` when children manage own padding (ClaimCard) |
| `className` | `string` | — | Override / extend |
| `children` | `ReactNode` | — | |

```tsx
<Card><Heading variant="title">เอกสารของคุณ</Heading></Card>
```
Implementation note: shadow is a `style={cardShadow}` object (RN shadows aren't Tailwind),
plus `className="bg-white rounded-lg border border-gray-200"`.

### 3.3 `Heading`

`font-display` + `tracking-tight`, with the optional English secondary line. Encodes the
§1.5 type rules so heroes are consistent.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'hero' \| 'title'` | `'title'` | hero = `text-2xl`, title = `text-xl` |
| `sub` | `string` | — | English secondary line, `text-base text-gray-600 font-body` |
| `className` | `string` | — | |
| `children` | `ReactNode` | — | Thai-primary heading text |

```tsx
<Heading variant="hero" sub="Reclaim your deposit">ทวงเงินประกันคืน</Heading>
```

### 3.4 `Body`

Default text. **This is the font fix** — sets `font-thai` so Thai stops falling back to the
system font. Use everywhere instead of bare `<Text>`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `'default' \| 'label' \| 'caption' \| 'muted'` | `'default'` | maps to gray-800 / gray-600 / gray-500 / gray-400 |
| `size` | `'sm' \| 'base'` | `'base'` | `text-sm` / `text-base` |
| `weight` | `'normal' \| 'semibold' \| 'bold'` | `'normal'` | |
| `className` | `string` | — | |

```tsx
<Body tone="caption" size="sm">ใช้เวลาประมาณ 1–2 นาที</Body>
```
> Optional global belt-and-suspenders: set `Text.defaultProps.style = { fontFamily:
> 'NotoSansThai_400Regular' }` once in `_layout.tsx` so even stray `<Text>` get Thai. `Body`
> stays the documented path.

### 3.5 `Section`

A titled block: TH·EN label + consistent `mb-6` spacing below. Standardizes the repeated
`<Text className="text-gray-800 font-semibold mb-2">…</Text>` group headers.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | — | Thai-primary label |
| `sub` | `string` | — | English / hint, inline `text-xs text-gray-500` |
| `required` | `boolean` | `false` | shows nothing special; `false` may render `(ไม่บังคับ)` hint |
| `children` | `ReactNode` | — | |

```tsx
<Section title="รายการ" sub="What is the landlord deducting for?" required>
  {claims.map(…)}
</Section>
```

### 3.6 `Icon` + emoji→lucide map

`lucide-react-native` is already installed but unused — the app draws icons with emoji
(inconsistent per device) and text glyphs. `Icon` is a thin wrapper fixing **size + weight
+ color** in one place: default `size={22}`, `strokeWidth={2}`, color via prop mapped to
§1 tokens.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | lucide name | — | re-export only the icons below |
| `size` | `number` | `22` | sized to line-height |
| `color` | token key | `'gray-500'` | `primary`/`lawful`/… resolved to hex |

Replacement map (current → lucide):

| Where | Current | lucide |
|---|---|---|
| ImagePickerTile | `📷` | `Camera` |
| Analyzing spinner | `⚙️` (rotating) | `Loader` (rotate via §2) |
| Analyzing step done / active / pending | `✓` / `◉` / `○` | `Check` / `CircleDot` / `Circle` |
| Claim "Why" toggle | `▼` / `▲` | `ChevronDown` (rotate 180°) |
| Claim remove | `✕` | `X` |
| Add item | `+` | `Plus` |
| Primary button arrow | `→` | `ArrowRight` |
| Start over / back | `←` | `ArrowLeft` |
| Documents — OCPB complaint | `📋` | `ClipboardList` |
| Documents — deposit demand | `📄` | `FileText` |
| Documents — evidence summary | `🗂️` | `FolderOpen` |
| Download | (text) | `Download` |

One library, one weight (`strokeWidth={2}`), sized to text. Filled variant (`CircleDot`)
marks the active/selected state — matches the field-guide rule.

---

## 4. Flow + animation map + fixes

### 4.1 Flow (unchanged)

Five-step linear flow; state handed forward through `useStore` (zustand). No routing or
data-contract changes — only chrome, motion, and the fixes below.

```
 ① index        ② analyzing      ③ results        ④ details        ⑤ documents
 Upload    ──►   Analyzing   ──►  Results    ──►   Your details ──►  Documents
 claims+        pipeline         verdicts +       tenant/lease     3 Thai docs
 evidence       (CV→Ev→Legal)    recoverable ฿    PII for docs     download
   │ setForm        │ setResult       │                │ setDocsDetails   │ setDocsResult
   └───────────────►└────────────────►└───────────────►└─────────────────►┘
                              useStore (zustand)
```

NavHeader shows `step / 5` (already consistent). Add Stack `screenOptions={{ animation:
'slide_from_right' }}` in `_layout.tsx` for the only global transition.

### 4.2 Per-screen map

Each screen: primitives it adopts + the animations from the §2.5 catalog.

**① Upload (`index.tsx`)**
- Primitives: `Screen`, `Section`, `Body`, `Icon` (Camera/Plus/X/ArrowRight).
- Claim rows in `Animated.View` with `layout` — add/remove animate height; `tapLight` on
  both. Submit → `tapMedium`. `ImagePickerTile` press feedback already present.

**② Analyzing (`analyzing.tsx`)**
- Primitives: `Screen scroll={false}`, `Body`, `Icon` (Loader/Check/CircleDot/Circle).
- **Replace fake 700ms timers** with the estimated eased progress bar; steps check off as
  the bar crosses thresholds; `Loader` rotates (§2). `tapSuccess` on completion, `tapWarn`
  on error. Fix the "3–5 นาที" copy to match real timing.

**③ Results (`results.tsx`)** — the pitch moment
- Primitives: `Screen`, `Card`, `Heading`, `Body`.
- Recoverable ฿ via `useCountUp`, colored `text-lawful`, with a fill bar
  (recoverable/totalCharged). Verdict banner fade+scale in. Claim cards stagger via
  `cardEnter(i)`. `tapSuccess` on mount when recoverable > 0.

**ClaimCard (`components/ClaimCard.tsx`)**
- Expand/collapse via `layout` (animated height), `ChevronDown` rotates 180°, `tapLight`
  on toggle. Keep the `surface-navy` Thai summary panel.

**④ Details (`details.tsx`)**
- Primitives: `Screen`, `Section`, `Body`. Route chips spring on select + `tapLight`.

**⑤ Documents (`documents.tsx`)**
- Primitives: `Screen`, `Card`, `Heading`, `Body`, `Icon` (ClipboardList/FileText/FolderOpen/Download).
- Skeleton shimmer card while `loading` (replaces bare `ActivityIndicator`); doc cards
  stagger in; `tapLight` on Download. **Hide the "coming soon" fallback cards when `error`.**

### 4.3 Target screens (ASCII)

**Results** — hero number is the anchor: big, green, top, animated.
```
┌──────────────────────────────────────┐
│ ขั้นตอน 3 / 5 · ผลลัพธ์ · Results          │
├──────────────────────────────────────┤
│ ┌────────────────────────────────┐   │  verdict banner
│ │ ผลการวิเคราะห์                    │   │  fade+scale in,
│ │ 2 รายการผิดกฎหมาย · Unlawful      │   │  tapSuccess
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │  Card + cardShadow
│ │ ยอดที่อาจคืนได้      [ประมาณการ]   │   │
│ │  ฿0 → ฿12,500  ⬆ count-up       │   │  text-lawful, font-display
│ │  ▓▓▓▓▓▓▓▓▓░░░░  of ฿18,000      │   │  fill bar, 400ms
│ └────────────────────────────────┘   │
│ หลักฐานที่พบ · Evidence  [LINE][promise]│  chips
│ รายการทั้งหมด · All claims              │
│ ┌────────────────────────────────┐   │  ClaimCard #1  ─┐ stagger
│ │ สีผนัง          ฿8,000 [UNLAWFUL] │   │               │ 60ms each
│ │ [navy: Thai legal summary…]      │   │               │ cardEnter(i)
│ │ §537·CCC  ▼ เหตุผล · Why          │   │ ◄─────────────┘
│ └────────────────────────────────┘   │
│              [ เอกสาร / Documents → ] │
└──────────────────────────────────────┘
```

**Analyzing** — honest progress, not four lying timers.
```
┌──────────────────────────────────────┐
│ ขั้นตอน 2 / 5 · วิเคราะห์ · Analyzing       │
├──────────────────────────────────────┤
│                                        │
│              ◜ Loader ◞                 │  lucide, rotate 1s loop
│           กำลังวิเคราะห์...               │  font-display
│        Analyzing your evidence         │
│                                        │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  ~70%           │  estimated eased bar
│                                        │
│   ✓ CV Analysis            เสร็จแล้ว     │  Check, lawful
│   ✓ Evidence               เสร็จแล้ว     │
│   ◉ Legal RAG              กำลังทำ...    │  CircleDot, primary
│   ○ Done                                │  Circle, gray
│                                        │
│   มักใช้เวลา 1–2 นาที · usually 1–2 min   │  (corrected copy)
└──────────────────────────────────────┘
```

### 4.4 Fix checklist (from the UI review)

**High**
- [ ] Wire fonts — adopt `Body`/`Heading`; optional global `Text` default. Thai → NotoSansThai.
- [ ] Emoji → lucide via `Icon` (the 12-swap map, §3.6).
- [ ] Analyzing: honest estimated bar + step check-off; fix timing copy.

**Medium**
- [ ] Recoverable ฿: `useCountUp` + `text-lawful` + fill bar (`results.tsx:55–69`).
- [ ] Press feedback + haptics on all interactive elements (route through `motion.ts`).
- [ ] Card depth via `Card` + `cardShadow`.

**Low**
- [ ] `tracking-tight` on heroes (baked into `Heading`).
- [ ] Claim spacing `mb-2 → mb-3`.
- [ ] Documents: suppress fallback placeholders when `error`.
- [ ] `ImagePickerTile`: handle permission / cancel.
- [ ] Estimate chip `yellow` → `disputed-soft`/`disputed` (§1.1).
- [ ] Pills (evidence chips, route selectors) → `rounded-full` (§1.3).

### 4.5 Build order (when we move to code — separate task)

1. `npx expo install expo-haptics`.
2. `tokens.ts` + `motion.ts` (no UI yet) — run the §2.3 easing self-check.
3. Primitives `ui/*` — migrate **Results first** (proves them + lands the pitch moment),
   then the other screens.
4. Emoji → lucide.
5. Per-screen animation (Results count-up → Analyzing bar → the rest).
6. Low-priority polish.

**Verify:** `npm start` on a real device (haptics need hardware). Walk all 5 screens — Thai
renders in NotoSansThai, no emoji left, ฿ counts up in green, Analyzing bar completes on
data with no stuck step, cards stagger + expand smoothly, error path shows warn haptic and
no ghost doc cards.

---

*Design system complete (§1–§4). Implementation is a separate, later task — see §4.5.*
