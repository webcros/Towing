import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Headphones, ChevronRight } from '@/icons';
import { Pressable } from '@/motion';

// Figma 21:171 — 91px amber banner, headset 41, small white bordered "Contact
// Support" button on the right.
//
// Deliberate deviation: the Figma types this banner at 8.957 / 7.763 / 10.052,
// the smallest text anywhere in the file and well under the 10dp legibility
// floor. Everything here is held at 10+ instead.
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
        <Text color="secondary" style={{ fontSize: 10, lineHeight: 14, marginTop: 2 }}>
          Our team is here to assist you 24/7.
        </Text>
      </View>

      <Pressable
        onPress={onContact}
        accessibilityRole="button"
        accessibilityLabel="Contact support"
        style={() => ({
          backgroundColor: theme.colors.card,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: theme.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 9,
          paddingVertical: 7,
          ...theme.shadows.card,
        })}
      >
        <Text style={{ fontSize: 11, lineHeight: 15 }}>Contact Support</Text>
        <ChevronRight size={11} color={theme.colors.textPrimary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
