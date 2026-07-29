export const offersKeys = {
  all: ['offers'] as const,
  current: () => ['offers', 'current'] as const,
};
