import { DefaultTheme, DarkTheme, type Theme as NavTheme } from '@react-navigation/native';
import { lightTheme, darkTheme } from '@towing/theme';

export const navLightTheme: NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightTheme.colors.brand,
    background: lightTheme.colors.surface0,
    card: lightTheme.colors.card,
    text: lightTheme.colors.textPrimary,
    border: lightTheme.colors.border,
    notification: lightTheme.colors.brand,
  },
};

export const navDarkTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkTheme.colors.brand,
    background: darkTheme.colors.surface0,
    card: darkTheme.colors.card,
    text: darkTheme.colors.textPrimary,
    border: darkTheme.colors.border,
    notification: darkTheme.colors.brand,
  },
};
