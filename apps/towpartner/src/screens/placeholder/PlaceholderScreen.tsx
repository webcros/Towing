import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { EmptyState } from '@towing/ui';
import { Wrench } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';

/**
 * Generic shell for routes the driver Figma doesn't design yet (Account
 * sub-screens, job details, active job). Keeps navigation fully browsable.
 */
export function PlaceholderScreen({ title }: { title: string }) {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <DriverHeader
          leading="back"
          title={title}
          titleSize={22}
          showBell={false}
          onLeading={() => navigation.goBack()}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <EmptyState
            icon={Wrench}
            title="Coming soon"
            body={`The ${title} screen isn't designed yet.`}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
