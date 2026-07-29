import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import type { Service } from '../data/services.data';

// Figma 21:11 — card p17 r20 border #f3f4f6, icon tile 68, gap 16,
// title 17 Medium, desc 11/18.9, chevron 20 with 4px side margins.
export function ServiceCard({ service, onPress }: { service: Service; onPress: () => void }) {
  const theme = useTheme();
  const Icon = service.icon;

  return (
    <Card
      radius="sheet"
      padding={17}
      onPress={onPress}
      accessibilityLabel={service.title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {service.image ? (
          <Image source={service.image} resizeMode="contain" style={{ width: 46, height: 32 }} />
        ) : Icon ? (
          <Icon size={30} color={theme.colors.textPrimary} strokeWidth={1.8} />
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 6, paddingRight: 8 }}>
        <Text weight="medium" style={{ fontSize: 17, lineHeight: 21 }}>
          {service.title}
        </Text>
        <Text color="secondary" numberOfLines={2} style={{ fontSize: 11, lineHeight: 18.9 }}>
          {service.description}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 4 }}>
        <ChevronRight size={20} color={theme.colors.textPrimary} strokeWidth={2} />
      </View>
    </Card>
  );
}
