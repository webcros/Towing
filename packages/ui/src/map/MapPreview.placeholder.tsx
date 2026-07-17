import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '../Text';
import type { MapPreviewProps } from './types';

/**
 * Styled stand-in for the live map while Google Maps keys are pending. Same
 * props as the future react-native-maps implementation, so swapping it in
 * (MapPreview.maps) touches nothing that consumes <MapPreview />.
 */
export function MapPreviewPlaceholder({
  height = 181,
  showRecenter = true,
  onRecenter,
  recenterDisabled = false,
  recenterIcon: RecenterIcon,
  label = 'MAP',
  style,
}: MapPreviewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          height,
          backgroundColor: theme.colors.mapBg,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* Faint grid to imply a map surface */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, bottom: 0, left: '33%', width: 1, backgroundColor: theme.colors.border }}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, bottom: 0, left: '66%', width: 1, backgroundColor: theme.colors.border }}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: theme.colors.border }}
      />

      <Text
        variant="display"
        weight="bold"
        color="tertiary"
        style={{ fontSize: 45, letterSpacing: 4, opacity: 0.32 }}
      >
        {label}
      </Text>

      {showRecenter ? (
        <Pressable
          onPress={onRecenter}
          disabled={recenterDisabled}
          accessibilityRole="button"
          accessibilityLabel="Re-center map"
          accessibilityState={{ disabled: recenterDisabled }}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.fabBg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: recenterDisabled ? 0.5 : 1,
            ...theme.shadows.fab,
          }}
        >
          {RecenterIcon ? <RecenterIcon size={18} color={theme.colors.textSecondary} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
