import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@towing/theme';
import { useCollapsingHeader, useHairlineStyle, useHairlineToken } from '@/motion';
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

  // No title handoff here: the header title is always visible on these screens,
  // so there is nothing to hand over. They get the hairline only, which is what
  // tells you content has passed under the bar.
  const { scrollY, screenProps } = useCollapsingHeader();
  const { ScrollComponent, scrollProps } = screenProps;
  const hairlineStyle = useHairlineStyle(scrollY);
  const hairlineToken = useHairlineToken();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScreenHeader title={title} onBack={back} right={right} />
        <Animated.View pointerEvents="none" style={[hairlineToken, hairlineStyle]} />
        <ScrollComponent
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollComponent>
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
