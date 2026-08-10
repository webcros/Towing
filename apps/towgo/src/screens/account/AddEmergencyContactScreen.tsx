import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@towing/ui';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import { useCreateEmergencyContact } from '@/features/account/api/emergencyContacts.queries';

export function AddEmergencyContactScreen() {
  const navigation = useNavigation();
  const createContact = useCreateEmergencyContact();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');

  const canSave = name.trim().length > 0 && phone.trim().length > 0;
  const save = () => {
    // Backend `mobileSchema` wants strict E.164 (+91XXXXXXXXXX, no spaces) — this
    // screen does no format validation of its own, only whitespace stripping.
    createContact.mutate(
      {
        name: name.trim(),
        phone: phone.trim().replace(/\s+/g, ''),
        relation: relation.trim() ? relation.trim() : undefined,
      },
      { onSuccess: () => navigation.goBack() },
    );
  };

  return (
    <SubScreen
      title="Add Contact"
      footer={
        <Button label="Save Contact" fullWidth disabled={!canSave} loading={createContact.isPending} onPress={save} />
      }
    >
      <TextField label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" autoCapitalize="words" />
      <TextField
        label="Phone Number"
        value={phone}
        onChangeText={setPhone}
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
      />
      <TextField label="Relation" value={relation} onChangeText={setRelation} placeholder="e.g. Spouse (optional)" autoCapitalize="words" />
    </SubScreen>
  );
}
