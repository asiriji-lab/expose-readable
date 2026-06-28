import { router } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { ClaimCard } from '@/components/ClaimCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Body, Card, Icon, Screen } from '@/components/ui';
import { bannerEnter, cardEnter, tapSuccess, useCountUp, useFillBar } from '@/theme/motion';
import { useStore } from '@/lib/store';

export default function ResultsScreen() {
  const result = useStore((s) => s.result);

  // Client-side recoverable estimate — UNLAWFUL + DISPUTED amounts only (see CLAUDE.md note).
  const recoverableTotal =
    result?.claims
      .filter((c) => c.legal.classification !== 'LAWFUL')
      .reduce((sum, c) => sum + c.claim.amount_thb, 0) ?? 0;
  const totalCharged = result?.claims.reduce((sum, c) => sum + c.claim.amount_thb, 0) ?? 0;

  // §2.5 — recoverable ฿ count-up + fill bar; banner success buzz when there's money to claim.
  const recovered = useCountUp(recoverableTotal);
  const fillStyle = useFillBar(totalCharged > 0 ? recoverableTotal / totalCharged : 0);
  useEffect(() => {
    if (recoverableTotal > 0) tapSuccess();
  }, [recoverableTotal]);

  if (!result) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Body tone="caption" className="text-center">
          ไม่พบผลลัพธ์ · No results
        </Body>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="mt-4 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Icon name="ArrowLeft" size={16} color="primary" />
          <Body className="text-primary" weight="semibold">
            กลับหน้าแรก
          </Body>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const unlawfulCount = result.claims.filter((c) => c.legal.classification === 'UNLAWFUL').length;
  const disputedCount = result.claims.filter((c) => c.legal.classification === 'DISPUTED').length;

  const bannerClass =
    unlawfulCount > 0
      ? 'bg-unlawful-soft border-unlawful'
      : disputedCount > 0
      ? 'bg-disputed-soft border-disputed'
      : 'bg-lawful-soft border-lawful';
  const bannerTextClass =
    unlawfulCount > 0 ? 'text-unlawful' : disputedCount > 0 ? 'text-disputed' : 'text-lawful';
  const bannerLabel =
    unlawfulCount > 0
      ? `${unlawfulCount} รายการผิดกฎหมาย · Unlawful`
      : disputedCount > 0
      ? `${disputedCount} รายการโต้แย้งได้ · Disputed`
      : 'ทุกรายการถูกกฎหมาย · All lawful';

  return (
    <Screen step={3} label="ผลลัพธ์ · Results">
      {/* Verdict banner — fade + scale in */}
      <Animated.View
        entering={bannerEnter}
        className={`rounded-lg border p-4 mb-4 ${bannerClass}`}
      >
        <Body weight="bold" className={bannerTextClass}>
          ผลการวิเคราะห์
        </Body>
        <Body size="sm" className={bannerTextClass}>
          {bannerLabel}
        </Body>
      </Animated.View>

      {/* Recoverable estimate — the pitch moment: big green count-up + fill bar */}
      <Card className="mb-4">
        <View className="flex-row items-center justify-between mb-1">
          <Body tone="label" weight="semibold">
            ยอดที่อาจคืนได้
          </Body>
          <View className="bg-disputed-soft px-2 py-0.5 rounded-sm">
            <Body tone="default" size="sm" weight="semibold" className="text-disputed text-xs">
              ประมาณการ / estimate
            </Body>
          </View>
        </View>
        <Body className="font-display text-3xl text-lawful">
          ฿{recovered.toLocaleString()}{' '}
          <Body className="font-body text-base text-gray-400">
            / ฿{totalCharged.toLocaleString()}
          </Body>
        </Body>
        {/* Fill bar: recoverable / totalCharged, animated to width over 400ms */}
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
          <Animated.View style={fillStyle} className="h-2 bg-lawful rounded-full" />
        </View>
        <Body tone="muted" size="sm" className="text-xs mt-2">
          * คำนวณจากรายการ UNLAWFUL + DISPUTED เท่านั้น ไม่ใช่ตัวเลขจากระบบ
        </Body>
      </Card>

      {/* Evidence pills */}
      {result.evidence_summary && (
        <View className="mb-4">
          <Body tone="label" weight="semibold" className="mb-2">
            หลักฐานที่พบ · Evidence found
          </Body>
          <View className="flex-row flex-wrap gap-2">
            {result.evidence_summary.platforms.map((p, i) => (
              <View key={i} className="bg-primary-soft rounded-sm px-2 py-1">
                <Body className="text-primary text-xs" weight="semibold">
                  {p}
                </Body>
              </View>
            ))}
            {result.evidence_summary.landlord_promises.map((p, i) => (
              <View key={`lp${i}`} className="bg-gray-100 rounded-sm px-2 py-1 max-w-[200px]">
                <Body tone="label" className="text-xs" numberOfLines={1}>
                  {p}
                </Body>
              </View>
            ))}
            {result.evidence_summary.deposit_mentions.map((d, i) => (
              <View key={`dm${i}`} className="bg-disputed-soft rounded-sm px-2 py-1 max-w-[200px]">
                <Body className="text-disputed text-xs" numberOfLines={1}>
                  {d}
                </Body>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Claim cards — stagger in */}
      <Body tone="label" weight="semibold" className="mb-3">
        รายการทั้งหมด · All claims
      </Body>
      {result.claims.map((item, i) => (
        <Animated.View key={i} entering={cardEnter(i)}>
          <ClaimCard item={item} />
        </Animated.View>
      ))}

      <View className="pb-8 mt-2">
        <PrimaryButton title="เอกสาร / Documents" onPress={() => router.push('/details')} />
      </View>
    </Screen>
  );
}
