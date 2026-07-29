import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Search, ChevronDown, Headphones } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { faqs } from '@/features/account/data/faqs.data';
import type { RootStackParamList } from '@/navigation/types';

export function HelpCenterScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }, [query]);

  return (
    <SubScreen title="Help Center">
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search help topics"
        autoCapitalize="none"
        rightSlot={<Search size={18} color={theme.colors.textTertiary} />}
      />

      <View style={{ gap: 10 }}>
        {filtered.map((f) => {
          const expanded = openId === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setOpenId(expanded ? null : f.id)}
              accessibilityRole="button"
              accessibilityLabel={f.question}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 16,
                gap: expanded ? 10 : 0,
                ...theme.shadows.card,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text weight="medium" style={{ flex: 1, fontSize: 14.5, lineHeight: 20 }}>
                  {f.question}
                </Text>
                <ChevronDown
                  size={18}
                  color={theme.colors.textTertiary}
                  style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                />
              </View>
              {expanded ? (
                <Text color="secondary" style={{ fontSize: 13.5, lineHeight: 20 }}>
                  {f.answer}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <SettingsList>
        <SettingsRow
          icon={Headphones}
          title="Still need help?"
          subtitle="Reach our support team"
          trailing="chevron"
          onPress={() => navigation.navigate('ContactUs')}
        />
      </SettingsList>
    </SubScreen>
  );
}
