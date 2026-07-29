import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Headphones, ChevronRight } from '@/icons';

// Figma 21:171 — 91px amber banner, headset 41, compact text, small white
// bordered "Contact Support" button on the right.
export function SupportBanner({ onContact }: { onContact: () => void }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.brandTint,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingLeft: 11,
        paddingRight: 16,
        paddingVertical: 16,
        minHeight: 91,
      }}
    >
      <Headphones size={38} color={theme.colors.textPrimary} strokeWidth={1.6} />

      <View style={{ flex: 1 }}>
        <Text weight="medium" style={{ fontSize: 11, lineHeight: 14 }}>
          Need help choosing a Service?
        </Text>
        <Text color="secondary" style={{ fontSize: 9.5, lineHeight: 12, marginTop: 1.5 }}>
          Our team is here to assist you 24/7.
        </Text>
      </View>

      <Pressable
        onPress={onContact}
        accessibilityRole="button"
        accessibilityLabel="Contact support"
        style={({ pressed }) => ({
          backgroundColor: theme.colors.card,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: theme.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 9,
          paddingVertical: 7,
          opacity: pressed ? 0.8 : 1,
          ...theme.shadows.card,
        })}
      >
        <Text style={{ fontSize: 10.5, lineHeight: 15 }}>Contact Support</Text>
        <ChevronRight size={11} color={theme.colors.textPrimary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
