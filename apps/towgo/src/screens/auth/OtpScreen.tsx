import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { Text, Button } from '@towing/ui';
import { BackButton } from '@/components/BackButton';
import { TextField } from '@/components/TextField';
import { useSendOtp, useVerifyOtp } from '@/features/auth/api/auth.queries';
import type { RootStackParamList } from '@/navigation/types';

const DIGITS_ONLY = /\D/g;

export function OtpScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Otp'>>();
  const { challengeId: initialChallengeId, mobile, resendAfterSeconds } = route.params;

  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(resendAfterSeconds);
  const verifyOtp = useVerifyOtp();
  const sendOtp = useSendOtp();
  const submittedRef = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const submit = useCallback(
    async (otp: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        await verifyOtp.mutateAsync({ challengeId, otp });
        // Root navigator re-renders into the authenticated stack once
        // authStore.status flips — nothing to navigate to here.
      } catch {
        submittedRef.current = false;
      }
    },
    [challengeId, verifyOtp],
  );

  const onChangeCode = useCallback(
    (value: string) => {
      const digits = value.replace(DIGITS_ONLY, '').slice(0, 6);
      setCode(digits);
      if (digits.length === 6) {
        submit(digits);
      }
    },
    [submit],
  );

  const resend = useCallback(async () => {
    if (secondsLeft > 0 || sendOtp.isPending) return;
    submittedRef.current = false;
    setCode('');
    const res = await sendOtp.mutateAsync(mobile);
    setChallengeId(res.challengeId);
    setSecondsLeft(res.resendAfterSeconds);
  }, [mobile, secondsLeft, sendOtp]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: theme.spacing.xl }}>
        <BackButton onPress={goBack} />

        <View style={{ gap: 8 }}>
          <Text weight="bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.5 }}>
            Enter the code
          </Text>
          <Text color="secondary" style={{ fontSize: 15, lineHeight: 21 }}>
            We sent a 6-digit code to {mobile}.
          </Text>
        </View>

        <TextField
          label="One-time code"
          value={code}
          onChangeText={onChangeCode}
          keyboardType="number-pad"
          placeholder="••••••"
        />

        {verifyOtp.isError ? (
          <Text color="error" style={{ fontSize: 13 }}>
            {verifyOtp.error instanceof Error ? verifyOtp.error.message : 'That code was not accepted.'}
          </Text>
        ) : null}

        <Button
          label="Verify"
          fullWidth
          disabled={code.length !== 6 || verifyOtp.isPending}
          loading={verifyOtp.isPending}
          onPress={() => submit(code)}
        />

        <Button
          label={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          variant="ghost"
          fullWidth
          disabled={secondsLeft > 0 || sendOtp.isPending}
          loading={sendOtp.isPending}
          onPress={resend}
        />
      </View>
    </View>
  );
}
