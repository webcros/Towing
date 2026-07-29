import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@towing/ui';
import { Bell, Globe, Palette, FileText, Info } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import type { RootStackParamList } from '@/navigation/types';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label" color="tertiary" style={{ paddingHorizontal: 4 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const notReady = useCallback(() => {}, []);

  return (
    <SubScreen title="Settings" gap={20}>
      <Section label="Preferences">
        <SettingsList>
          <SettingsRow
            icon={Bell}
            title="Notifications"
            trailing="chevron"
            onPress={() => navigation.navigate('NotificationsSettings')}
          />
          <SettingsRow icon={Globe} title="Language" value="English" trailing="chevron" onPress={notReady} />
          <SettingsRow icon={Palette} title="Appearance" value="Light" trailing="chevron" onPress={notReady} />
        </SettingsList>
      </Section>

      <Section label="Legal">
        <SettingsList>
          <SettingsRow icon={FileText} title="Privacy Policy" trailing="chevron" onPress={notReady} />
          <SettingsRow icon={FileText} title="Terms of Service" trailing="chevron" onPress={notReady} />
        </SettingsList>
      </Section>

      <Section label="About">
        <SettingsList>
          <SettingsRow icon={Info} title="App Version" value="1.0.0" />
        </SettingsList>
      </Section>
    </SubScreen>
  );
}
