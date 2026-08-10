import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { REQUIRED_KYC_DOC_TYPES, type DriverKycDocumentStatus } from '../types';

/** 5-segment progress bar — one segment per required doc, coloured by that doc's live review status. */
export function KycProgressSteps({ documents }: { documents: DriverKycDocumentStatus[] }) {
  const theme = useTheme();
  const total = REQUIRED_KYC_DOC_TYPES.length;
  const uploaded = documents.filter((d) => d.status !== 'rejected').length;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text weight="medium" style={{ fontSize: 13 }}>
          Documents
        </Text>
        <Text color="secondary" style={{ fontSize: 13 }}>
          {uploaded} of {total}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {REQUIRED_KYC_DOC_TYPES.map((docType) => {
          const doc = documents.find((d) => d.docType === docType);
          const color =
            doc?.status === 'approved'
              ? theme.colors.success
              : doc?.status === 'rejected'
                ? theme.colors.error
                : doc?.status === 'pending'
                  ? theme.colors.warning
                  : theme.colors.border;
          return (
            <View
              key={docType}
              style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: color }}
            />
          );
        })}
      </View>
    </View>
  );
}
