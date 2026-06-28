import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Body, Icon } from '@/components/ui';
import { tapMedium, usePressScale } from '@/theme/motion';

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tapMedium();
        onPress();
      }}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
    >
      <Animated.View
        style={style}
        className={`rounded-lg px-6 py-4 flex-row items-center justify-center gap-2 ${
          disabled ? 'bg-gray-300' : 'bg-primary'
        }`}
      >
        <Body weight="bold" className={disabled ? 'text-gray-500' : 'text-white'}>
          {title}
        </Body>
        <Icon name="ArrowRight" size={20} color={disabled ? 'gray-500' : 'white'} />
      </Animated.View>
    </Pressable>
  );
}
