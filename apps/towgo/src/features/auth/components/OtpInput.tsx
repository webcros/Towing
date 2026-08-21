import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';

const LENGTH = 6;
const DIGITS_ONLY = /\D/g;

export type OtpInputHandle = {
  /**
   * Imperative because of the login screen's step animation: the OTP pane is
   * mounted from first render (both panes must exist to crossfade), so
   * `autoFocus` would rip the keyboard open while the PHONE step is showing.
   * The screen calls this only once the transition to the OTP step starts.
   */
  focus: () => void;
};

export type OtpInputProps = {
  value: string;
  onChange: (digits: string) => void;
  /** Paints every box border with the error colour until the next keystroke. */
  error?: boolean;
  autoFocus?: boolean;
};

/**
 * Six visible digit boxes over ONE invisible `TextInput` — deliberately not six
 * inputs with focus-hopping. A single input is what keeps the two flows that
 * matter intact: pasting a code fills all six boxes at once, and the OS
 * SMS-autofill suggestion (`textContentType="oneTimeCode"` on iOS,
 * `autoComplete="sms-otp"` on Android) lands as a single insertion. Six inputs
 * break both, and their focus choreography is where OTP screens usually bug out.
 *
 * The hidden input carries `accessibilityLabel="One-time code"`: it is the
 * screen-reader target AND the Maestro handle (`customer-login.yaml` taps it by
 * that label — no testID convention exists in this repo).
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { value, onChange, error = false, autoFocus = false },
  ref,
) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = useCallback(
    (raw: string) => onChange(raw.replace(DIGITS_ONLY, '').slice(0, LENGTH)),
    [onChange],
  );

  const focus = useCallback(() => inputRef.current?.focus(), []);
  useImperativeHandle(ref, () => ({ focus }), [focus]);

  // The box the next digit lands in; when full, the last box stays active.
  const activeIndex = Math.min(value.length, LENGTH - 1);

  return (
    <Pressable onPress={focus} accessible={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const digit = value[i] ?? '';
          const active = focused && i === activeIndex;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 52,
                height: 56,
                borderRadius: 12,
                borderWidth: active ? 2 : 1,
                borderColor: error
                  ? theme.colors.error
                  : active
                    ? theme.colors.brand
                    : theme.colors.border,
                backgroundColor: theme.colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text weight="semibold" style={{ fontSize: 22, lineHeight: 28 }} tabular>
                {digit}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        maxLength={LENGTH}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        accessibilityLabel="One-time code"
        // Invisible but full-size over the boxes, so any tap lands on it and
        // the keyboard's accessory bar attaches to a real focused input.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.02,
          color: 'transparent',
        }}
      />
    </Pressable>
  );
});
