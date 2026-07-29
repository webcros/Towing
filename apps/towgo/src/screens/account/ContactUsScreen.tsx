import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';
import { Phone, Mail, MessageCircle, Clock } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';

export function ContactUsScreen() {
  const theme = useTheme();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const notReady = useCallback(() => {}, []);
  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <SubScreen title="Contact Us" gap={18}>
      <SettingsList>
        <SettingsRow
          icon={Phone}
          iconColor={theme.colors.success}
          title="Call us"
          subtitle="+91 1800 123 4567"
          trailing="chevron"
          onPress={notReady}
        />
        <SettingsRow
          icon={Mail}
          iconColor={theme.colors.info}
          title="Email us"
          subtitle="support@moveyo.in"
          trailing="chevron"
          onPress={notReady}
        />
        <SettingsRow
          icon={MessageCircle}
          iconColor={theme.colors.brand}
          title="WhatsApp"
          subtitle="Chat with our support team"
          trailing="chevron"
          onPress={notReady}
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
