import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, Button, Card, Skeleton, ErrorState } from '@towing/ui';
import { BackButton } from '@/components/BackButton';
import { LogOut, RefreshCw, ShieldCheck } from '@/icons';
import { Pressable } from '@/motion';
import { useKycStatus, useSubmitKyc } from '@/features/kyc/api/kyc.queries';
import { REQUIRED_KYC_DOC_TYPES } from '@/features/kyc/types';
import { DocUploadRow } from '@/features/kyc/components/DocUploadRow';
import { KycProgressSteps } from '@/features/kyc/components/KycProgressSteps';
import { useLogout } from '@/features/auth/api/auth.queries';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { RootStackParamList } from '@/navigation/types';

/**
 * The §3.1 layer-1 gate's app side. Reachable two ways: as the forced root
 * screen while `kycStatus !== 'approved'` (`RootNavigator`, no back target —
 * shows a logout affordance instead) and as a normal pushed screen from
 * Profile → KYC once approved (has a back target, no logout button needed).
 */
export function KycWizardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useLogout();
  const { data, isPending, isError, refetch } = useKycStatus();
  const submit = useSubmitKyc();

  const documents = useMemo(() => data?.documents ?? [], [data]);
  // Resume support: a rejected doc gets the highlighted border treatment so
  // it reads as "fix this" among the 5 rows without a separate empty state.
  const rejectedTypes = useMemo(
    () => new Set(documents.filter((d) => d.status === 'rejected').map((d) => d.docType)),
    [documents],
  );

  const canSubmit =
    documents.length === REQUIRED_KYC_DOC_TYPES.length && documents.every((d) => d.status !== 'rejected');

  const onSubmit = async () => {
    try {
      await submit.mutateAsync();
      // submit() flips incomplete -> pending server-side; move the driver on
      // to the status screen instead of leaving them on a now-stale wizard.
      navigation.navigate('KycStatus');
    } catch {
      // Surfaced inline below via submit.error.
    }
  };

  return (
    <Screen scroll edges={['top']} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
        }}
      >
        {navigation.canGoBack() ? <BackButton onPress={() => navigation.goBack()} /> : <View style={{ width: 44 }} />}
        <Text weight="semibold" style={{ fontSize: 18 }}>
          Verify your account
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

      <Card style={{ backgroundColor: theme.colors.brandTint }} bordered={false} elevated={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ShieldCheck size={18} color={theme.colors.brand} />
          <Text weight="semibold" style={{ fontSize: 14 }}>
            Free to join — you keep 90–95%
          </Text>
        </View>
        <Text color="secondary" style={{ fontSize: 12, lineHeight: 17 }}>
          Upload these 5 documents to get verified. Most drivers hear back within 24–48 hours.
        </Text>
      </Card>

      {isError ? (
        <ErrorState title="Couldn't load your documents" onRetry={() => refetch()} icon={RefreshCw} />
      ) : isPending ? (
        <Skeleton width="100%" height={320} radius={16} />
      ) : (
        <>
          <KycProgressSteps documents={documents} />

          <View style={{ gap: 10 }}>
            {REQUIRED_KYC_DOC_TYPES.map((docType) => (
              <DocUploadRow
                key={docType}
                docType={docType}
                document={documents.find((d) => d.docType === docType)}
                highlighted={rejectedTypes.has(docType)}
              />
            ))}
          </View>

          {data?.rejectionReason ? (
            <Text color="error" style={{ fontSize: 13 }}>
              {data.rejectionReason}
            </Text>
          ) : null}
          {submit.isError ? (
            <Text color="error" style={{ fontSize: 13 }}>
              {submit.error instanceof Error ? submit.error.message : 'Could not submit — try again.'}
            </Text>
          ) : null}

          <Button
            label="Submit for review"
            fullWidth
            disabled={!canSubmit || submit.isPending}
            loading={submit.isPending}
            onPress={onSubmit}
          />
        </>
      )}
    </Screen>
  );
}
