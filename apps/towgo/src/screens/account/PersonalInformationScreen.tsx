import React, { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { Button, StatusBadge, Skeleton, ErrorState } from '@towing/ui';
import { Camera, RefreshCw } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import { useProfile, useUpdateProfile } from '@/features/account/api/profile.queries';
import { Pressable } from '@/motion';

const avatar = require('@/assets/illustrations/avatar-placeholder.png');

export function PersonalInformationScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { data: profile, isPending, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Seeds once — after that the fields are the user's own edits, not the server's.
  useEffect(() => {
    if (profile && !seeded) {
      setName(profile.name ?? '');
      setEmail(profile.email ?? '');
      setSeeded(true);
    }
  }, [profile, seeded]);

  // No photo-upload flow exists yet for the profile avatar (only the vehicle RC upload does).
  const notReady = useCallback(() => {}, []);
  const save = () => {
    updateProfile.mutate(
      { name: name.trim(), email: email.trim() ? email.trim() : null },
      { onSuccess: () => navigation.goBack() },
    );
  };

  if (isError) {
    return (
      <SubScreen title="Personal Information">
        <ErrorState title="Couldn't load your profile" onRetry={() => refetch()} icon={RefreshCw} />
      </SubScreen>
    );
  }

  if (isPending || !profile) {
    return (
      <SubScreen title="Personal Information">
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Skeleton width={92} height={92} radius={46} />
        </View>
        <Skeleton width="100%" height={64} radius={12} />
        <Skeleton width="100%" height={64} radius={12} />
        <Skeleton width="100%" height={64} radius={12} />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title="Personal Information"
      footer={
        <Button
          label="Save Changes"
          fullWidth
          loading={updateProfile.isPending}
          onPress={save}
          disabled={!name.trim()}
        />
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <View>
          <Image source={avatar} style={{ width: 92, height: 92, borderRadius: 46 }} />
          <Pressable
            onPress={notReady}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.surface0,
            }}
          >
            <Camera size={16} color={theme.colors.onBrand} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <TextField label="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <TextField
        label="Phone Number"
        value={profile.mobile}
        onChangeText={() => {}}
        editable={false}
        keyboardType="phone-pad"
        rightSlot={<StatusBadge label="Verified" tone="success" />}
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@example.com"
      />
    </SubScreen>
  );
}
