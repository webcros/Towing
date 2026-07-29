import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import type { UserProfile } from '../types';

const avatar = require('@/assets/illustrations/avatar-placeholder.png');

// Figma 21:285 — p24, gap 16, avatar 76, name 22/27.5, contact 14/20.
export function ProfileHeader({ profile, onEdit }: { profile: UserProfile; onEdit: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 24, gap: 16 }}>
      <Image
        source={avatar}
        style={{ width: 76, height: 76, borderRadius: 38 }}
        accessibilityLabel={`${profile.name}'s profile photo`}
      />

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 22, lineHeight: 27.5 }} numberOfLines={1}>
          {profile.name}
        </Text>
        <Text color="secondary" style={{ fontSize: 14, lineHeight: 20, marginTop: 4 }}>
          {profile.phone}
        </Text>
        <Text color="secondary" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
          {profile.email}
        </Text>
      </View>

      <Pressable
        onPress={onEdit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ChevronRight size={16} color={theme.colors.textPrimary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
