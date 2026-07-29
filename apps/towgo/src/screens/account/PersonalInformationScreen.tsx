import React, { useCallback, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { Button, StatusBadge } from '@towing/ui';
import { Camera } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import { useProfileStore } from '@/features/account/store/profileStore';

const avatar = require('@/assets/illustrations/avatar-placeholder.png');

export function PersonalInformationScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const setProfile = useProfileStore((s) => s.setProfile);

  const [name, setName] = useState(() => useProfileStore.getState().name);
  const [phone, setPhone] = useState(() => useProfileStore.getState().phone);
  const [email, setEmail] = useState(() => useProfileStore.getState().email);

  const notReady = useCallback(() => {}, []);
  const save = () => {
    setProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    navigation.goBack();
  };

  return (
    <SubScreen
      title="Personal Information"
      footer={<Button label="Save Changes" fullWidth onPress={save} disabled={!name.trim()} />}
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
        value={phone}
        onChangeText={setPhone}
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
