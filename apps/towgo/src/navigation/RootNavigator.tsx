import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { BottomTabs } from './BottomTabs';
import { navLightTheme, navDarkTheme } from './navTheme';

export function RootNavigator() {
  const theme = useTheme();
  return (
    <NavigationContainer theme={theme.isDark ? navDarkTheme : navLightTheme}>
      <BottomTabs />
    </NavigationContainer>
  );
}
