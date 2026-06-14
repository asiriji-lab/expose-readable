/**
 * Maps subject variant keys (first char of subject_id, or '_activity')
 * to Tailwind CSS class strings for every usage site.
 *
 * All class strings must be complete (no template literals) so Tailwind's
 * content scanner can detect them at build time.
 */

export interface VariantPalette {
    /** Palette card border + hover (PaletteSidebar ClassItemCard) */
    cardBorder: string;
    /** Left accent strip + small dot */
    accent: string;
    /** Dot for SubjectGroupAccordion header */
    dot: string;
    /** Cell background in individual view (UnifiedScheduleCell) */
    cellBg: string;
    /** Cell left border in individual view */
    cellBorderL: string;
    /** Drag ghost band classes (ScheduleDndProvider) */
    ghostClasses: string;
}

const PALETTES: Record<string, VariantPalette> = {
    'ท': {
        cardBorder:   'border-orange-200 hover:border-orange-400',
        accent:       'bg-orange-400',
        dot:          'bg-orange-500',
        cellBg:       'bg-orange-50',
        cellBorderL:  'border-l-[3px] border-l-orange-400',
        ghostClasses: 'bg-orange-50 border-l-orange-400 text-orange-900',
    },
    'ว': {
        cardBorder:   'border-blue-200 hover:border-blue-400',
        accent:       'bg-blue-400',
        dot:          'bg-blue-500',
        cellBg:       'bg-blue-50',
        cellBorderL:  'border-l-[3px] border-l-blue-400',
        ghostClasses: 'bg-blue-50 border-l-blue-400 text-blue-900',
    },
    'ส': {
        cardBorder:   'border-yellow-200 hover:border-yellow-400',
        accent:       'bg-yellow-400',
        dot:          'bg-yellow-500',
        cellBg:       'bg-yellow-50',
        cellBorderL:  'border-l-[3px] border-l-yellow-400',
        ghostClasses: 'bg-yellow-50 border-l-yellow-400 text-yellow-900',
    },
    'พ': {
        cardBorder:   'border-green-200 hover:border-green-400',
        accent:       'bg-green-400',
        dot:          'bg-green-500',
        cellBg:       'bg-green-50',
        cellBorderL:  'border-l-[3px] border-l-green-400',
        ghostClasses: 'bg-green-50 border-l-green-400 text-green-900',
    },
    'ศ': {
        cardBorder:   'border-purple-200 hover:border-purple-400',
        accent:       'bg-purple-400',
        dot:          'bg-purple-500',
        cellBg:       'bg-purple-50',
        cellBorderL:  'border-l-[3px] border-l-purple-400',
        ghostClasses: 'bg-purple-50 border-l-purple-400 text-purple-900',
    },
    'อ': {
        cardBorder:   'border-cyan-200 hover:border-cyan-400',
        accent:       'bg-cyan-400',
        dot:          'bg-cyan-500',
        cellBg:       'bg-cyan-50',
        cellBorderL:  'border-l-[3px] border-l-cyan-400',
        ghostClasses: 'bg-cyan-50 border-l-cyan-400 text-cyan-900',
    },
    'ค': {
        cardBorder:   'border-red-200 hover:border-red-400',
        accent:       'bg-red-400',
        dot:          'bg-red-500',
        cellBg:       'bg-pink-50',
        cellBorderL:  'border-l-[3px] border-l-pink-400',
        ghostClasses: 'bg-rose-50 border-l-rose-400 text-rose-900',
    },
    'ง': {
        cardBorder:   'border-amber-200 hover:border-amber-400',
        accent:       'bg-amber-400',
        dot:          'bg-amber-500',
        cellBg:       'bg-amber-50',
        cellBorderL:  'border-l-[3px] border-l-amber-400',
        ghostClasses: 'bg-amber-50 border-l-amber-400 text-amber-900',
    },
    '_activity': {
        cardBorder:   'border-slate-200 hover:border-slate-400',
        accent:       'bg-slate-400',
        dot:          'bg-slate-500',
        cellBg:       'bg-slate-50',
        cellBorderL:  'border-l-[3px] border-l-slate-400',
        ghostClasses: 'bg-slate-50 border-l-slate-400 text-slate-900',
    },
};

const DEFAULT_PALETTE: VariantPalette = {
    cardBorder:   'border-emerald-200 hover:border-emerald-400',
    accent:       'bg-emerald-400',
    dot:          'bg-emerald-500',
    cellBg:       'bg-emerald-50',
    cellBorderL:  'border-l-[3px] border-l-emerald-400',
    ghostClasses: 'bg-emerald-50 border-l-emerald-400 text-emerald-900',
};

export function variantPalette(variant: string): VariantPalette {
    return PALETTES[variant] ?? DEFAULT_PALETTE;
}
