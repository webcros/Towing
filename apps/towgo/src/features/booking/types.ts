import type { ImageSourcePropType } from 'react-native';

export type TowTypeId = 'light' | 'medium' | 'heavy' | 'euro';

export type TowType = {
  id: TowTypeId;
  name: string;
  categories: string;
  price: number;
  comparePrice?: number;
  image: ImageSourcePropType;
  /** Rendered dimmed and unselectable (e.g. not yet available). */
  disabled?: boolean;
};
