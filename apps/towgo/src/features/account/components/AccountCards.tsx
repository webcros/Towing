import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { Pressable } from '@/motion';

/** Tone for a status badge. Maps onto the theme's soft pairs. */
export type StatusTone = 'brand' | 'success' | 'warning' | 'neutral';

function useCardStyle() {
  const theme = useTheme();
  return {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadows.card,
  } as const;
}

/**
 * One of the two shortcut tiles: centred icon over a label.
 *
 * `flex: 1` so a row of them splits the width evenly; the caller supplies the
 * gap.
 */
export function QuickTile({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const card = useCardStyle();

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.card}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        ...card,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
      }}
    >
      <Icon size={theme.sizes.icon.xl} color={theme.colors.textPrimary} strokeWidth={1.8} />
      <Text variant="bodyMedium" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A standalone card row carrying a status badge — the pattern the reference
 * uses for "App update available" and "32% completed".
 *
 * Each one is its own card rather than a row in a group, which is what makes it
 * read as a notice rather than a menu item.
 */
export function StatusCard({
  icon: Icon,
  label,
  badge,
  tone = 'neutral',
  onPress,
}: {
  icon: IconComponent;
  label: string;
  badge: string;
  tone?: StatusTone;
  onPress: () => void;
}) {
  const theme = useTheme();
  const card = useCardStyle();

  const badgeColors: Record<StatusTone, { bg: string; fg: string }> = {
    brand: { bg: theme.colors.brandTint, fg: theme.colors.warningSoftFg },
    success: { bg: theme.colors.successSoftBg, fg: theme.colors.successSoftFg },
    warning: { bg: theme.colors.warningSoftBg, fg: theme.colors.warningSoftFg },
    neutral: { bg: theme.colors.surface1, fg: theme.colors.textSecondary },
  };
  const badgeColor = badgeColors[tone];

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.card}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${badge}`}
      style={{
        ...card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Icon size={theme.sizes.icon.lg} color={theme.colors.textSecondary} strokeWidth={1.8} />

      <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </Text>

      <View
        style={{
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 3,
          backgroundColor: badgeColor.bg,
        }}
      >
        <Text variant="label" numberOfLines={1} style={{ color: badgeColor.fg }}>
          {badge}
        </Text>
      </View>

      <ChevronRight
        size={theme.sizes.icon.md}
        color={theme.colors.textTertiary}
        strokeWidth={2}
      />
    </Pressable>
  );
}

/**
 * Grouped card with an accent-bar heading, then its rows.
 *
 * The bar is what makes the heading read as a section title rather than a first
 * row — it is the reference's device and it works because it is the only
 * vertical rule on the screen.
 */
export function MenuGroup({
  title,
  children,
}: {
  /** Omit for a bare card of rows — a lone destructive action needs no heading. */
  title?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const card = useCardStyle();
  const rows = React.Children.toArray(children);

  return (
    <View style={{ ...card, overflow: 'hidden' }}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <View
            style={{
              width: 3,
              height: 18,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.brand,
            }}
          />
          <Text variant="subtitle">{title}</Text>
        </View>
      ) : null}

      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? (
            <View
              style={{
                height: 1,
                marginLeft: theme.spacing.lg + theme.sizes.icon.lg + theme.spacing.md,
                backgroundColor: theme.colors.divider,
              }}
            />
          ) : null}
          {row}
        </View>
      ))}
    </View>
  );
}

/** A row inside a MenuGroup. Also usable standalone for a destructive action. */
export function MenuRow({
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = danger ? theme.colors.error : theme.colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.row}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Icon size={theme.sizes.icon.lg} color={tint} strokeWidth={1.8} />

      <Text
        variant="bodyMedium"
        color={danger ? 'error' : 'primary'}
        numberOfLines={1}
        style={{ flex: 1, minWidth: 0 }}
      >
        {label}
      </Text>

      {/* A destructive action goes nowhere, so it gets no chevron. */}
      {danger ? null : (
        <ChevronRight
          size={theme.sizes.icon.md}
          color={theme.colors.textTertiary}
          strokeWidth={2}
        />
      )}
    </Pressable>
  );
}
