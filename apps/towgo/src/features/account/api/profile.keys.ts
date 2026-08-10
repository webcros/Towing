export const profileKeys = {
  all: ['profile'] as const,
  detail: () => ['profile', 'detail'] as const,
};
