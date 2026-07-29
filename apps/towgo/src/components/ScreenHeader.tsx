import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { ArrowLeft } from '@/icons';

/** Consistent back + title header for sub-screens (optional right slot). */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 10,
        minHeight: 48,
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <ArrowLeft size={24} color={theme.colors.textPrimary} />
      </Pressable>
      <Text weight="bold" numberOfLines={1} style={{ flex: 1, fontSize: 20, lineHeight: 26 }}>
        {title}
      </Text>
      {right}
    </View>
  );
}
