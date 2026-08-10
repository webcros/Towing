import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, Button } from '@towing/ui';
import { TextField } from '@/components/TextField';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/features/auth/store/authStore';

/**
 * Pushed once, right after OTP verify, only when `identity.isNew === true`.
 * A first name is the one field worth blocking on here — everything else
 * (email, photo, vehicles, addresses) lives in the full Profile/`/me` screens
 * and is never required to start booking.
 */
export function ProfileSetupScreen() {
  const theme = useTheme();
  const identity = useAuthStore((s) => s.identity);
  const updateIdentity = useAuthStore((s) => s.updateIdentity);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!identity) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('me', { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
      // isNew flips to false locally — the root switch re-renders past this
      // screen. `updateIdentity` reads the current tokens from the store
      // itself rather than ones closed over before the PUT above — those
      // could be stale if apiFetch silently rotated them on a 401 refresh.
      updateIdentity({ name: name.trim(), isNew: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  }, [identity, name, updateIdentity]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 96, gap: theme.spacing.xl }}>
        <View style={{ gap: 8 }}>
          <Text weight="bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.5 }}>
            What should we call you?
          </Text>
          <Text color="secondary" style={{ fontSize: 15, lineHeight: 21 }}>
            Your driver will see this name.
          </Text>
        </View>

        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Rahul Sharma"
        />

        {error ? (
          <Text color="error" style={{ fontSize: 13 }}>
            {error}
          </Text>
        ) : null}

        <Button label="Continue" fullWidth disabled={!name.trim() || saving} loading={saving} onPress={save} />
      </View>
    </View>
  );
}
