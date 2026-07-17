import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import type { Theme } from './types';

/** Read the active semantic theme. */
export const useTheme = (): Theme => useContext(ThemeContext);
