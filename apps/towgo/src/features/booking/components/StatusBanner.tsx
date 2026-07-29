import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';

export type StatusTone = 'brand' | 'success' | 'error';

export function StatusBanner({
  icon: Icon,
  title,
  subtitle,
  tone = 'brand',
}: {
  icon: IconComponent;
  title: string;
  subtitle: string;
  tone?: StatusTone;
}) {
  const theme = useTheme();
  const bg =
    tone === 'success'
      ? theme.colors.successSoftBg
      : tone === 'error'
        ? theme.colors.errorSoftBg
        : theme.colors.brandTint;
  const iconColor =
    tone === 'success' ? theme.colors.success : tone === 'error' ? theme.colors.error : theme.colors.brand;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
      }}
    >
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Text>
        <Text color="secondary" style={{ fontSize: 13, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
