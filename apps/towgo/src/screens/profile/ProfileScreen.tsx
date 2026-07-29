import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, OfflineBanner } from '@towing/ui';
import { AppHeader } from '@/components/AppHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProfileStore } from '@/features/account/store/profileStore';
import { accountItems, supportItems } from '@/features/account/data/accountMenu.data';
import { ProfileHeader } from '@/features/account/components/ProfileHeader';
import { AccountMenuCard } from '@/features/account/components/AccountMenuCard';
import { LogoutButton } from '@/features/account/components/LogoutButton';
import type { AccountMenuItemId } from '@/features/account/types';
import type { RootStackParamList } from '@/navigation/types';

const routeFor: Record<
  AccountMenuItemId,
  | 'PersonalInformation'
  | 'MyVehicles'
  | 'SavedLocations'
  | 'PaymentMethods'
  | 'NotificationsSettings'
  | 'HelpCenter'
  | 'ContactUs'
  | 'Settings'
> = {
  personal_info: 'PersonalInformation',
  vehicles: 'MyVehicles',
  saved_locations: 'SavedLocations',
  payment_methods: 'PaymentMethods',
  notifications: 'NotificationsSettings',
  help_center: 'HelpCenter',
  contact_us: 'ContactUs',
  settings: 'Settings',
};

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
      <Text weight="medium" color="secondary" style={{ fontSize: 17, lineHeight: 25.5 }}>
        {title}
      </Text>
    </View>
  );
}

export function ProfileScreen() {
  const theme = useTheme();
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const name = useProfileStore((s) => s.name);
  const phone = useProfileStore((s) => s.phone);
  const email = useProfileStore((s) => s.email);

  const openItem = useCallback(
    (id: AccountMenuItemId) => navigation.navigate(routeFor[id]),
    [navigation],
  );
  const editProfile = useCallback(() => navigation.navigate('PersonalInformation'), [navigation]);
  const logout = useCallback(() => {}, []);

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
    >
      <AppHeader />

      <ProfileHeader profile={{ name, phone, email }} onEdit={editProfile} />

      {/* Figma rhythm: Account pt23 · heading→card 12 · Support pt27 · pb32 */}
      <View style={{ paddingTop: 12 }}>
        <SectionHeading title="Account" />
        <View style={{ paddingHorizontal: 20 }}>
          <AccountMenuCard items={accountItems} onItemPress={openItem} />
        </View>
      </View>

      <View style={{ paddingTop: 27 }}>
        <SectionHeading title="Support & More" />
        <View style={{ paddingHorizontal: 20 }}>
          <AccountMenuCard items={supportItems} onItemPress={openItem} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 32 }}>
        <LogoutButton onPress={logout} />
      </View>
    </Screen>
  );
}
