import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { Pressable } from '@/motion';

/** Width of the leading icon column. Every row on the screen shares it, which is
 *  what gives the flat list its vertical spine — nothing is indented ad hoc. */
export const ROW_GUTTER = 24;
/** Gap between the icon column and the text. Dividers inset by gutter + gap. */
export const ROW_GAP = 16;
export const ROW_INSET = ROW_GUTTER + ROW_GAP;

export type DetailRowProps = {
  /** Omit for a row that aligns with the others but draws its own marker. */
  icon?: IconComponent;
  /** Replaces the icon entirely — used by the route markers. */
  leading?: React.ReactNode;
  label: string;
  /** Second line under the label. Rows with one grow from 48dp to ~68dp. */
  description?: string;
  /** Right-aligned value. Mutually exclusive with `chevron`. */
  value?: string;
  /** Emphasise the value — for the total. */
  strong?: boolean;
  tabular?: boolean;
  chevron?: boolean;
  onPress?: () => void;
};

/**
 * One line of the flat detail list: fixed icon column, label (+ description),
 * right-aligned value or chevron.
 *
 * Deliberately card-less. Stacking bordered cards inside a bordered card is what
 * made this screen read as cluttered — a hairline between rows carries the same
 * grouping at a fraction of the visual weight.
 */
export function DetailRow({
  icon: Icon,
  leading,
  label,
  description,
  value,
  strong,
  tabular,
  chevron,
  onPress,
}: DetailRowProps) {
  const theme = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: description ? 'flex-start' : 'center',
        gap: ROW_GAP,
        paddingVertical: description ? theme.spacing.md : 14,
      }}
    >
      <View style={{ width: ROW_GUTTER, alignItems: 'center', paddingTop: description ? 2 : 0 }}>
        {leading ??
          (Icon ? (
            <Icon
              size={theme.sizes.icon.lg}
              color={theme.colors.textSecondary}
              strokeWidth={1.8}
            />
          ) : null)}
      </View>

      <View style={{ flex: 1, gap: description ? 3 : 0 }}>
        <Text
          variant="body"
          weight={description ? 'medium' : 'regular'}
          numberOfLines={2}
        >
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text
          variant="body"
          weight={strong ? 'bold' : 'medium'}
          tabular={tabular}
          align="right"
          numberOfLines={1}
          style={{ maxWidth: '46%' }}
        >
          {value}
        </Text>
      ) : null}

      {chevron ? (
        <ChevronRight size={theme.sizes.icon.lg} color={theme.colors.textTertiary} strokeWidth={2} />
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.row}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
    >
      {body}
    </Pressable>
  );
}

/** Hairline between rows, inset to start at the text — not under the icon column. */
export function RowDivider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        marginLeft: ROW_INSET,
        backgroundColor: theme.colors.divider,
      }}
    />
  );
}
