import React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { StatusBadge, Text, type StatusTone } from '@towing/ui';
import { Camera } from '@/icons';
import { IconChip } from '@/components/IconChip';
import type { ChipTone } from '@/theme/driverColors';
import { Pressable } from '@/motion';
import { DOC_TYPE_HINTS, DOC_TYPE_LABELS, type DriverDocType, type DriverKycDocumentStatus } from '../types';
import { DocPickCancelled, useUploadDocument } from '../api/kyc.queries';

function statusMeta(status: DriverKycDocumentStatus['status'] | undefined): {
  label: string;
  tone: StatusTone;
  chipTone: ChipTone;
} {
  switch (status) {
    case 'approved':
      return { label: 'Approved', tone: 'success', chipTone: 'green' };
    case 'rejected':
      return { label: 'Rejected', tone: 'error', chipTone: 'red' };
    case 'pending':
      return { label: 'In review', tone: 'warning', chipTone: 'gold' };
    default:
      return { label: 'Upload', tone: 'neutral', chipTone: 'slate' };
  }
}

/**
 * One of the wizard's 5 slots. Owns its own upload pipeline
 * (`useUploadDocument`) so each row uploads independently; live status comes
 * from the caller's `useKycStatus()` — a doc absent from `documents[]` reads
 * as "not yet uploaded", which is exactly how the backend represents it too.
 */
export function DocUploadRow({
  docType,
  document,
  highlighted = false,
}: {
  docType: DriverDocType;
  document?: DriverKycDocumentStatus;
  /** Rejected docs the wizard scrolls/highlights to on entry get this treatment too. */
  highlighted?: boolean;
}) {
  const theme = useTheme();
  const upload = useUploadDocument();
  const status = document?.status;
  const meta = statusMeta(status);

  // Resume support: approved/pending docs are never re-prompted, only a
  // rejected or never-uploaded slot is tappable.
  const editable = status === undefined || status === 'rejected';

  const onPress = async () => {
    if (!editable) return;
    try {
      await upload.mutateAsync(docType);
    } catch (error) {
      if (error instanceof DocPickCancelled) return;
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Something went wrong.');
    }
  };

  const flagged = highlighted || status === 'rejected';

  return (
    <Pressable
      onPress={onPress}
      disabled={!editable || upload.isPending}
      accessibilityRole="button"
      accessibilityLabel={`${DOC_TYPE_LABELS[docType]} — ${meta.label}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: pressed && editable ? theme.colors.surface1 : theme.colors.card,
        borderWidth: flagged ? 1 : 0,
        borderColor: theme.colors.error,
      })}
    >
      <IconChip icon={Camera} tone={meta.chipTone} size={40} iconSize={16} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {DOC_TYPE_LABELS[docType]}
        </Text>
        <Text color="secondary" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>
          {status === 'rejected' && document?.rejectionReason ? document.rejectionReason : DOC_TYPE_HINTS[docType]}
        </Text>
      </View>
      {upload.isPending ? (
        <ActivityIndicator color={theme.colors.brand} />
      ) : (
        <StatusBadge label={meta.label} tone={meta.tone} />
      )}
    </Pressable>
  );
}
