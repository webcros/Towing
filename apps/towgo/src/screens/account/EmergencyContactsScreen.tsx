import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Button, EmptyState, Skeleton, ErrorState } from '@towing/ui';
import { LifeBuoy, Plus, RefreshCw, Trash2 } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useEmergencyContacts, useDeleteEmergencyContact } from '@/features/account/api/emergencyContacts.queries';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

export function EmergencyContactsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: contacts, isPending, isError, refetch } = useEmergencyContacts();
  const deleteContact = useDeleteEmergencyContact();

  const confirmDelete = useCallback(
    (contactId: string, name: string) => {
      Alert.alert('Remove contact?', `${name} will no longer be notified during SOS.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteContact.mutate(contactId) },
      ]);
    },
    [deleteContact],
  );

  return (
    <SubScreen
      title="Emergency Contacts"
      footer={
        <Button
          label="Add Contact"
          leftIcon={Plus}
          fullWidth
          onPress={() => navigation.navigate('AddEmergencyContact')}
        />
      }
    >
      {isError ? (
        <ErrorState title="Couldn't load your emergency contacts" onRetry={() => refetch()} icon={RefreshCw} />
      ) : isPending || !contacts ? (
        <>
          <Skeleton width="100%" height={72} radius={12} />
          <Skeleton width="100%" height={72} radius={12} />
        </>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No emergency contacts"
          body="Add someone we can reach if you trigger SOS during a tow."
        />
      ) : (
        <SettingsList>
          {contacts.map((c) => (
            <SettingsRow
              key={c.id}
              icon={LifeBuoy}
              title={c.name}
              subtitle={[c.phone, c.relation].filter(Boolean).join(' · ')}
              trailing={
                <Pressable
                  onPress={() => confirmDelete(c.id, c.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${c.name}`}
                  hitSlop={8}
                >
                  <Trash2 size={18} color={theme.colors.error} />
                </Pressable>
              }
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}
