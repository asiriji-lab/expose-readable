import { Text, View } from 'react-native';

export function NavHeader({ step, label }: { step: 1 | 2 | 3 | 4 | 5; label: string }) {
  return (
    <View className="px-4 pt-4 pb-2">
      <Text className="text-gray-500 text-xs">
        ขั้นตอน {step} / 5 · {label}
      </Text>
    </View>
  );
}
