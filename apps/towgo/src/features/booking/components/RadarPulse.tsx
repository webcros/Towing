import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@towing/theme';
import { Truck } from '@/icons';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SIZE = 300;
const CENTER = SIZE / 2;

// Fixed polar positions (deg, radius) for scattered driver markers.
const MARKERS: { angle: number; r: number }[] = [
  { angle: -60, r: 104 },
  { angle: 24, r: 122 },
  { angle: 156, r: 96 },
  { angle: 96, r: 136 },
  { angle: -132, r: 116 },
  { angle: 214, r: 82 },
];

const toXY = (angle: number, r: number) => ({
  x: CENTER + r * Math.cos((angle * Math.PI) / 180),
  y: CENTER + r * Math.sin((angle * Math.PI) / 180),
});

function DriverMarker({ x, y, reduced }: { x: number; y: number; reduced: boolean }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [opacity, reduced]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - 19,
        top: y - 19,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: theme.colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        ...theme.shadows.card,
      }}
    >
      <Truck size={18} color={theme.colors.textPrimary} strokeWidth={2} />
    </Animated.View>
  );
}

export function RadarPulse({
  expanded = false,
  driversContacted = 0,
}: {
  expanded?: boolean;
  driversContacted?: number;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const breathe = useRef(new Animated.Value(0)).current;
  const expand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [breathe, reduced]);

  useEffect(() => {
    Animated.timing(expand, {
      toValue: expanded ? 1 : 0,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded, expand]);

  const centerScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const containerScale = expand.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const visibleMarkers = reduced ? MARKERS.length : Math.min(driversContacted + 2, MARKERS.length);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ scale: containerScale }] }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="radarGlow" cx={CENTER} cy={CENTER} r={92} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={theme.colors.brand} stopOpacity={0.34} />
              <Stop offset="1" stopColor={theme.colors.brand} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={CENTER} cy={CENTER} r={92} fill="url(#radarGlow)" />
          {[58, 98, 138].map((r) => (
            <Circle
              key={r}
              cx={CENTER}
              cy={CENTER}
              r={r}
              stroke={theme.colors.brand}
              strokeWidth={1.5}
              strokeDasharray="2 6"
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </Svg>

        {MARKERS.slice(0, visibleMarkers).map((m, i) => {
          const { x, y } = toXY(m.angle, m.r);
          return <DriverMarker key={i} x={x} y={y} reduced={reduced} />;
        })}

        {/* Center tow-truck */}
        <Animated.View
          style={{
            position: 'absolute',
            left: CENTER - 45,
            top: CENTER - 45,
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: reduced ? 1 : centerScale }],
            ...theme.shadows.fab,
          }}
        >
          <Truck size={38} color={theme.colors.textPrimary} strokeWidth={2} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
