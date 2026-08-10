import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, Skeleton, ErrorState, EmptyState } from '@towing/ui';
import { CheckCheck, CircleX, Clock, LogOut, RefreshCw, ShieldCheck } from '@/icons';
import { BackButton } from '@/components/BackButton';
import { Pressable } from '@/motion';
import { useKycStatus } from '@/features/kyc/api/kyc.queries';
import { useLogout } from '@/features/auth/api/auth.queries';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Shown for every non-`incomplete` `kycStatus` (`incomplete` goes straight to
 * the wizard instead — see `RootNavigator`). Reachable as the forced KYC-gate
 * screen and, once approved, as a normal pushed screen from Profile → KYC.
 * Pull-to-refresh re-fetches `useKycStatus()` — the manual half of "unlocks
 * on refetch" (the other half is the AppState foreground bridge in
 * `lib/network/onlineManager.ts`).
 */
export function KycStatusScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useLogout();
  const { data, isPending, isError, isRefetching, refetch } = useKycStatus();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const goToWizard = useCallback(() => navigation.navigate('KycWizard'), [navigation]);

  const renderBody = () => {
    if (isError) {
      return <ErrorState title="Couldn't load your status" onRetry={() => refetch()} icon={RefreshCw} />;
    }
    if (isPending || !data) {
      return <Skeleton width="100%" height={220} radius={16} />;
    }

    switch (data.kycStatus) {
      case 'approved':
        return (
          <EmptyState
            icon={CheckCheck}
            title="You're verified"
            body="You're approved to accept tow jobs. Head back to your dashboard to go online."
            actionLabel="Go to dashboard"
            onAction={() => navigation.navigate('Tabs', { screen: 'Home' })}
          />
        );
      case 'pending':
        return (
          <EmptyState
            icon={Clock}
            title="Verification in progress"
            body="We're reviewing your documents. This usually takes 24–48 hours — pull to refresh for updates."
          />
        );
      case 'incomplete':
        // Reachable via Profile -> KYC even mid-wizard; RootNavigator's own
        // gate never routes an incomplete driver here directly.
        return (
          <EmptyState
            icon={ShieldCheck}
            title="Finish your verification"
            body="A few documents are still missing."
            actionLabel="Continue"
            onAction={goToWizard}
          />
        );
      case 'rejected':
      case 'suspended':
        return (
          <EmptyState
            icon={CircleX}
            title={data.kycStatus === 'suspended' ? 'Account suspended' : 'Verification rejected'}
            body={data.rejectionReason ?? 'Please review and re-upload the flagged documents.'}
            actionLabel="Fix documents"
            onAction={goToWizard}
          />
        );
    }
  };

  return (
    <Screen
      scroll
      edges={['top']}
      refreshing={isRefetching}
      onRefresh={onRefresh}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, flexGrow: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {navigation.canGoBack() ? <BackButton onPress={() => navigation.goBack()} /> : <View style={{ width: 44 }} />}
        <Text weight="semibold" style={{ fontSize: 18 }}>
          Verification Status
        </Text>
        {navigation.canGoBack() ? (
          <View style={{ width: 44 }} />
        ) : (
          <Pressable
            onPress={() => logout.mutate(refreshToken ?? '')}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            hitSlop={10}
          >
            <LogOut size={22} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>{renderBody()}</View>
    </Screen>
  );
}
