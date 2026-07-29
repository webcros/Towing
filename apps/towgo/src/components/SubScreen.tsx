import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { ScreenHeader } from './ScreenHeader';

/** Consistent shell for account sub-screens: fixed header + scroll body + optional footer. */
export function SubScreen({
  title,
  onBack,
  right,
  footer,
  gap = 16,
  children,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  gap?: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const navigation = useNavigation();
  const back = onBack ?? (() => navigation.goBack());

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScreenHeader title={title} onBack={back} right={right} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: 16,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface0,
            }}
          >
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
