import React, { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';

export type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Rendered before the input — e.g. the login screen's phone icon + "+91" + divider. */
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

/** Labeled text input with consistent styling (focus → brand border). */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
  multiline = false,
  autoCapitalize,
  leftSlot,
  rightSlot,
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <Text weight="medium" style={{ fontSize: 13, lineHeight: 17, color: theme.colors.textSecondary }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 8,
          backgroundColor: editable ? theme.colors.card : theme.colors.surface1,
          borderWidth: 1,
          borderColor: focused ? theme.colors.brand : theme.colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          minHeight: 50,
        }}
      >
        {leftSlot}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          editable={editable}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontFamily: theme.fonts.medium,
            fontSize: 15,
            color: editable ? theme.colors.textPrimary : theme.colors.textSecondary,
            padding: 0,
            includeFontPadding: false,
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 76 : 48,
          }}
        />
        {rightSlot}
      </View>
    </View>
  );
}
