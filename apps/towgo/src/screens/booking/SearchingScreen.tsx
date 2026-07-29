import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Text, Button, MapPreview } from '@towing/ui';
import { Clock, Check, RefreshCw, Headphones, Truck } from '@/icons';
import { BackButton } from '@/components/BackButton';
import { useSearchSimulation } from '@/features/booking/hooks/useSearchSimulation';
import { RadarPulse } from '@/features/booking/components/RadarPulse';
import { StatusBanner } from '@/features/booking/components/StatusBanner';
import { RequestDetailsCard } from '@/features/booking/components/RequestDetailsCard';
import { TrustBanner } from '@/features/booking/components/TrustBanner';
import type { RootStackParamList } from '@/navigation/types';

const HEADINGS = {
  searching: { title: 'Searching for Tow', subtitle: "We're finding the best driver for you.\nThis may take a few moments." },
  widening: { title: 'Searching for Tow', subtitle: 'Expanding your search to reach more drivers…' },
  matched: { title: 'Driver found!', subtitle: 'Connecting you to your driver…' },
  no_drivers: { title: 'No drivers found', subtitle: "We couldn't find a driver nearby right now." },
} as const;

export function SearchingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { phase, driversContacted, retry } = useSearchSimulation();

  const goHome = useCallback(() => navigation.popToTop(), [navigation]);
  const notReady = useCallback(() => {}, []);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  // On match: brief celebration, then hand off to the tracking screen.
  const advanced = useRef(false);
  useEffect(() => {
    if (phase !== 'matched' || advanced.current) return;
    advanced.current = true;
    const t = setTimeout(() => {
      navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Tracking' }] });
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, navigation]);

  const heading = HEADINGS[phase];
  const isSearching = phase === 'searching' || phase === 'widening';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ gap: 12 }}>
            <BackButton onPress={goBack} />

            <View style={{ gap: 6 }}>
              <Text weight="bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.5 }}>
                {heading.title}
              </Text>
              <Text color="secondary" style={{ fontSize: 15, lineHeight: 21 }}>
                {heading.subtitle}
              </Text>
            </View>
          </View>

          {/* Hero region */}
          {isSearching ? (
            <View
              style={{ height: 316, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.32 }]}>
                <MapPreview style={StyleSheet.absoluteFill} showRecenter={false} />
              </View>
              <RadarPulse expanded={phase === 'widening'} driversContacted={driversContacted} />
            </View>
          ) : null}

          {phase === 'matched' ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: theme.colors.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.shadows.raised,
                }}
              >
                <Check size={48} color={theme.colors.textInverse} strokeWidth={3} />
              </View>
            </View>
          ) : null}

          {phase === 'no_drivers' ? (
            <>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: theme.colors.surface1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Truck size={44} color={theme.colors.textTertiary} strokeWidth={1.8} />
                </View>
              </View>
              <StatusBanner
                icon={RefreshCw}
                tone="error"
                title="No drivers available"
                subtitle="Please try again in a moment."
              />
              <View style={{ gap: 10 }}>
                <Button label="Try again" fullWidth leftIcon={RefreshCw} onPress={retry} />
                <Button label="Get help" variant="ghost" fullWidth leftIcon={Headphones} onPress={notReady} />
              </View>
              <TrustBanner />
            </>
          ) : null}

          {isSearching ? (
            <>
              <StatusBanner
                icon={Clock}
                title="Hang tight!"
                subtitle={
                  phase === 'widening'
                    ? 'Expanding your search — reaching more drivers nearby.'
                    : "We'll notify you as soon as a driver accepts your request."
                }
              />
              <RequestDetailsCard onCancel={goHome} />
              <TrustBanner />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
