import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';
import { Phone, Mail, MessageCircle, Clock } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';

const SUPPORT_PHONE = '+911800123456';
const SUPPORT_PHONE_DISPLAY = '+91 1800 123 456';
const SUPPORT_EMAIL = 'support@towgo.in';
const SUPPORT_WHATSAPP = '911800123456';

export function ContactUsScreen() {
  const theme = useTheme();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  // No message-send backend exists yet — only the tel/mailto/WhatsApp rows below are real.
  const notReady = useCallback(() => {}, []);
  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  const callUs = useCallback(() => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {});
  }, []);
  const emailUs = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  }, []);
  const whatsAppUs = useCallback(() => {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() => {});
  }, []);

  return (
    <SubScreen title="Contact Us" gap={18}>
      <SettingsList>
        <SettingsRow
          icon={Phone}
          iconColor={theme.colors.success}
          title="Call us"
          subtitle={SUPPORT_PHONE_DISPLAY}
          trailing="chevron"
          onPress={callUs}
        />
        <SettingsRow
          icon={Mail}
          iconColor={theme.colors.info}
          title="Email us"
          subtitle={SUPPORT_EMAIL}
          trailing="chevron"
          onPress={emailUs}
        />
        <SettingsRow
          icon={MessageCircle}
          iconColor={theme.colors.brand}
          title="WhatsApp"
          subtitle="Chat with our support team"
          trailing="chevron"
          onPress={whatsAppUs}
        />
      </SettingsList>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
        <Clock size={14} color={theme.colors.textTertiary} />
        <Text color="secondary" style={{ fontSize: 13, lineHeight: 18 }}>
          Support available 24/7
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 2 }}>
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 22 }}>
          Send us a message
        </Text>
        <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="What's it about?" />
        <TextField label="Message" value={message} onChangeText={setMessage} placeholder="Describe your issue…" multiline />
        <Button label="Send Message" fullWidth disabled={!canSend} onPress={notReady} />
      </View>
    </SubScreen>
  );
}
