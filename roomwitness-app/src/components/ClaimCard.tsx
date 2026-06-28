import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ClassificationBadge } from './ClassificationBadge';
import { Body, Icon } from '@/components/ui';
import { cardEnter, fadeOut, layout, tapLight, useChevronRotate } from '@/theme/motion';
import type { ClaimResult } from '@/lib/types';

const CV_LABEL: Record<string, string> = {
  YES: 'รองรับ (YES)',
  NO: 'ไม่รองรับ (NO)',
  PARTIAL: 'บางส่วน (PARTIAL)',
};

const DIMS = [
  { key: 'pre_existence',      label: 'ก่อนเข้าอยู่ · Pre-existence' },
  { key: 'wear_and_tear',      label: 'สึกหรอ · Wear & tear' },
  { key: 'proportionality',    label: 'สัดส่วน · Proportionality' },
  { key: 'contractual_clarity',label: 'สัญญา · Contract' },
] as const;

export function ClaimCard({ item }: { item: ClaimResult }) {
  const [open, setOpen] = useState(false);
  const { claim, cv, legal } = item;
  const chevron = useChevronRotate(open);

  function toggle() {
    tapLight();
    setOpen((v) => !v);
  }

  return (
    // layout animates the card's height as the "Why" section expands/collapses (§2.5).
    <Animated.View
      layout={layout}
      className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2 gap-2 flex-wrap">
        <View className="flex-1">
          <Body weight="bold">{claim.item}</Body>
          <Body tone="caption" size="sm" className="text-xs">
            {claim.description}
          </Body>
        </View>
        <View className="items-end gap-1">
          <Body weight="bold">฿{claim.amount_thb.toLocaleString()}</Body>
          <ClassificationBadge classification={legal.classification} />
        </View>
      </View>

      {/* Thai summary */}
      <View className="bg-surface-navy mx-4 mb-3 p-3 rounded-md">
        <Body size="sm" className="text-white leading-5">
          {legal.summary_th}
        </Body>
      </View>

      {/* Citations */}
      <View className="px-4 mb-2 flex-row flex-wrap gap-2">
        {legal.legal_basis.map((b, i) => (
          <View key={i} className="bg-gray-100 px-2 py-1 rounded-sm">
            <Body tone="label" className="text-xs font-mono">
              §{b.section} · {b.source}
            </Body>
          </View>
        ))}
      </View>

      {/* CV verdict — cv is null/empty when no photos were provided for this claim */}
      {cv?.supports_landlord_claim && (
        <View className="px-4 mb-3">
          <Body tone="caption" size="sm" className="text-xs">
            ภาพถ่าย:{' '}
            <Body tone="label" size="sm" weight="semibold" className="text-xs">
              {CV_LABEL[cv.supports_landlord_claim] ?? '—'}
            </Body>
          </Body>
        </View>
      )}

      {/* Why toggle */}
      <TouchableOpacity
        onPress={toggle}
        className="px-4 pb-3 flex-row items-center gap-1"
        activeOpacity={0.7}
      >
        <Animated.View style={chevron}>
          <Icon name="ChevronDown" size={18} color="primary" />
        </Animated.View>
        <Body weight="semibold" size="sm" className="text-primary">
          {open ? 'ซ่อนรายละเอียด' : 'เหตุผล · Why'}
        </Body>
      </TouchableOpacity>

      {open && (
        <Animated.View entering={cardEnter(0)} exiting={fadeOut} className="px-4 pb-4 gap-2">
          {DIMS.map(({ key, label }) => (
            <View key={key} className="bg-gray-50 rounded-md p-3">
              <Body tone="caption" size="sm" weight="semibold" className="text-xs mb-1">
                {label}
              </Body>
              <Body size="sm" className="leading-5">
                {legal.dimensions[key]}
              </Body>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}
