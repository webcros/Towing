import React, { useEffect, useState } from 'react';
import { Modal, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';

/**
 * §9.1.5's note editor and its "booking for someone else" contact capture.
 *
 * Both controls existed and did nothing: the "Add Note" row's `onPress` was the
 * shared `notReady` no-op (`store.setNote` was never called from anywhere), and
 * the "For someone else" pill flipped a label whose value reached no request.
 * Phase 15 gives the backend `bookings.note`, `contact_name` and
 * `contact_mobile` to put them in.
 */

function SheetShell({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
        <View
          style={{
            backgroundColor: theme.colors.surface0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: theme.spacing.xxl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.xxl),
            paddingHorizontal: theme.spacing.xxl,
            gap: theme.spacing.lg,
          }}
        >
          <Text weight="semibold" style={{ fontSize: 18 }}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function fieldStyle(theme: ReturnType<typeof useTheme>) {
  return {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    fontSize: 15,
  } as const;
}

export function NoteEditorSheet({
  visible,
  note,
  onSave,
  onClose,
}: {
  visible: boolean;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(note);

  // Re-seed each time it opens, so cancelling really discards.
  useEffect(() => {
    if (visible) setDraft(note);
  }, [visible, note]);

  return (
    <SheetShell visible={visible} title="Add a note for the driver" onClose={onClose}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Blue hatchback, basement parking…"
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        // The server caps this at 500; stopping at the boundary is friendlier
        // than a 422 after the customer has typed a paragraph.
        maxLength={500}
        accessibilityLabel="Note for the driver"
        style={[fieldStyle(theme), { minHeight: 96, textAlignVertical: 'top' }]}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancel" variant="secondary" onPress={onClose} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Save"
            onPress={() => {
              onSave(draft.trim());
              onClose();
            }}
            fullWidth
          />
        </View>
      </View>
    </SheetShell>
  );
}

export function ContactSheet({
  visible,
  contact,
  onSave,
  onClose,
}: {
  visible: boolean;
  contact: { name: string; mobile: string } | null;
  onSave: (contact: { name: string; mobile: string } | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(contact?.name ?? '');
  const [mobile, setMobile] = useState(contact?.mobile ?? '');

  useEffect(() => {
    if (!visible) return;
    setName(contact?.name ?? '');
    setMobile(contact?.mobile ?? '');
  }, [visible, contact]);

  // Mirrors the contract's own rule, so the customer is corrected here rather
  // than by a 422 after tapping Confirm.
  const valid = name.trim().length > 0 && /^\+?[0-9]{10,15}$/.test(mobile.trim());

  return (
    <SheetShell visible={visible} title="Who is the tow for?" onClose={onClose}>
      <Text color="secondary" style={{ fontSize: 13, lineHeight: 19 }}>
        The driver will call this person on arrival.
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Their name"
        placeholderTextColor={theme.colors.textTertiary}
        maxLength={120}
        accessibilityLabel="Contact name"
        style={fieldStyle(theme)}
      />
      <TextInput
        value={mobile}
        onChangeText={setMobile}
        placeholder="Their mobile number"
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType="phone-pad"
        accessibilityLabel="Contact mobile number"
        style={fieldStyle(theme)}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            label="It's for me"
            variant="secondary"
            onPress={() => {
              onSave(null);
              onClose();
            }}
            fullWidth
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Save"
            disabled={!valid}
            onPress={() => {
              onSave({ name: name.trim(), mobile: mobile.trim() });
              onClose();
            }}
            fullWidth
          />
        </View>
      </View>
    </SheetShell>
  );
}
