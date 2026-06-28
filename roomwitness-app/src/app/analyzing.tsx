import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Body, Icon, Screen } from '@/components/ui';
import { checkPop, tapSuccess, tapWarn, useAnalyzingProgress, useSpin } from '@/theme/motion';
import { analyze } from '@/lib/api';
import { useStore } from '@/lib/store';

const STEPS = [
  { label: 'เปรียบเทียบภาพถ่าย · CV Analysis', desc: 'Agent 1' },
  { label: 'ตรวจสอบหลักฐาน · Evidence', desc: 'Agent 2' },
  { label: 'วิเคราะห์กฎหมาย · Legal RAG', desc: 'Agent 3' },
  { label: 'สรุปผล · Done', desc: 'Agent 4' },
];

export default function AnalyzingScreen() {
  const form = useStore((s) => s.form);
  const setResult = useStore((s) => s.setResult);
  const [error, setError] = useState<string | null>(null);
  const spin = useSpin();
  const { width, step, complete } = useAnalyzingProgress(STEPS.length);

  useEffect(() => {
    if (!form) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    analyze(form)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        tapSuccess(); // §2.5 — success on done
        complete(() => {
          if (!cancelled) router.replace('/results');
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || 'เกิดข้อผิดพลาด / Something went wrong');
        tapWarn(); // §2.5 — warn on error
      });
    return () => {
      cancelled = true;
    };
  }, []); // ponytail: run once on mount

  if (error) {
    return (
      <Screen step={2} label="วิเคราะห์ · Analyzing" scroll={false} bg="white">
        <View className="flex-1 items-center justify-center">
          <View className="bg-unlawful-soft border border-unlawful rounded-lg p-4 w-full mb-6">
            <Body weight="semibold" className="text-unlawful text-center">
              เกิดข้อผิดพลาด · Error
            </Body>
            <Body size="sm" className="text-unlawful text-center mt-1">
              {error}
            </Body>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-gray-100 rounded-lg px-6 py-3 flex-row items-center gap-1"
            activeOpacity={0.7}
          >
            <Icon name="ArrowLeft" size={18} color="gray-600" />
            <Body weight="semibold" tone="label">
              กลับ · Back
            </Body>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen step={2} label="วิเคราะห์ · Analyzing" scroll={false} bg="white">
      <View className="flex-1 items-center justify-center">
        <View className="mb-6 items-center">
          <Animated.View style={spin}>
            <Icon name="Loader" size={40} color="primary" />
          </Animated.View>
        </View>
        <Body weight="bold" className="font-display text-xl text-gray-900 text-center mb-1">
          กำลังวิเคราะห์...
        </Body>
        <Body tone="caption" size="sm" className="text-center mb-6">
          Analyzing your evidence
        </Body>

        {/* Estimated progress bar (honest — see useAnalyzingProgress) */}
        <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-8">
          <Animated.View style={width} className="h-2 bg-primary rounded-full" />
        </View>

        <View className="w-full gap-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <View
                key={i}
                className={`flex-row items-center gap-3 p-3 rounded-lg border ${
                  done
                    ? 'bg-lawful-soft border-lawful'
                    : active
                    ? 'bg-primary-soft border-primary'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {done ? (
                  <Animated.View entering={checkPop}>
                    <Icon name="Check" size={20} color="lawful" />
                  </Animated.View>
                ) : (
                  <Icon
                    name={active ? 'CircleDot' : 'Circle'}
                    size={20}
                    color={active ? 'primary' : 'gray-400'}
                  />
                )}
                <View className="flex-1">
                  <Body
                    weight="semibold"
                    size="sm"
                    className={done ? 'text-lawful' : active ? 'text-primary' : 'text-gray-400'}
                  >
                    {s.label}
                  </Body>
                  <Body tone="muted" size="sm" className="text-xs">
                    {s.desc}
                  </Body>
                </View>
                {done && (
                  <Body weight="bold" size="sm" className="text-lawful">
                    เสร็จแล้ว
                  </Body>
                )}
                {active && (
                  <Body weight="bold" size="sm" className="text-primary">
                    กำลังทำ...
                  </Body>
                )}
              </View>
            );
          })}
        </View>

        <Body tone="muted" size="sm" className="text-xs text-center mt-8">
          มักใช้เวลา 1–2 นาที · usually 1–2 min
        </Body>
      </View>
    </Screen>
  );
}
