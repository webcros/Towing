import React from 'react';
import { Image, View } from 'react-native';
import type { ServiceCatalogItem } from '@towing/api-contracts';
import { useTheme } from '@towing/theme';
import { Card, Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { artworkFor } from '../data/serviceArtwork';

// Figma 21:11 — card p17 r20 border #f3f4f6, icon tile 68, gap 16,
// title 17 Medium, desc 11/18.9, chevron 20 with 4px side margins.
export function ServiceCard({
  service,
  onPress,
}: {
  /** A row of `GET /v1/services` — the server owns the copy, this owns the art. */
  service: ServiceCatalogItem;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { icon: Icon, image } = artworkFor(service.slug);

  return (
    <Card
      radius="sheet"
      padding={17}
      onPress={onPress}
      accessibilityLabel={service.name}
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
          borderRadius: 16,
          backgroundColor: theme.colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {image ? (
          <Image source={image} resizeMode="contain" style={{ width: 40, height: 40 }} />
        ) : Icon ? (
          <Icon size={30} color={theme.colors.brand} />
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 17, lineHeight: 25 }}>
          {service.name}
        </Text>
        <Text color="secondary" style={{ fontSize: 11, lineHeight: 18.9 }}>
          {service.description}
        </Text>
      </View>

      <ChevronRight size={20} color={theme.colors.textTertiary} style={{ marginHorizontal: 4 }} />
    </Card>
  );
}
