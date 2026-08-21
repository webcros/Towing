import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { PlacePrediction } from '@towing/api-contracts';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { MapPin, Search } from '@/icons';
import { Pressable } from '@/motion';

/**
 * §9.1.5's suggestion list — what replaced the seven hardcoded presets.
 *
 * IT RENDERS FOUR STATES, and the empty one is the reason this is a component
 * rather than a `.map()` in the screen. "No matches" and "start typing" look
 * identical if you only branch on `predictions.length`, and a customer who has
 * typed a real address and been given nothing needs to be told that the search
 * came back empty — not left staring at a list that looks like it has not
 * started yet.
 */
export function PlaceSuggestionsList({
  predictions,
  isLoading,
  isError,
  hasQuery,
  onSelect,
  /**
   * True when address search is being served by the local gazetteer rather than
   * a real Places account (SETUP-CHECKLIST item 7). Surfaced to the customer,
   * because "we only know twenty places" and "your address does not exist" are
   * very different messages and only one of them is their problem.
   */
  limitedCoverage = false,
}: {
  predictions: PlacePrediction[];
  isLoading: boolean;
  isError: boolean;
  hasQuery: boolean;
  onSelect: (prediction: PlacePrediction) => void;
  limitedCoverage?: boolean;
}) {
  const theme = useTheme();

  if (!hasQuery) return null;

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.brand} />
      </View>
    );
  }

  if (isError) {
    return (
      <Message
        icon={Search}
        title="Couldn’t search addresses"
        body="Check your connection, or pick a spot on the map instead."
      />
    );
  }

  if (predictions.length === 0) {
    return (
      <Message
        icon={Search}
        title="No matches"
        body={
          limitedCoverage
            ? 'Address search is limited right now. Try a nearby landmark, or drop a pin on the map.'
            : 'Try a different spelling, or drop a pin on the map.'
        }
      />
    );
  }

  return (
    <View>
      {predictions.map((prediction) => (
        <Pressable
          key={prediction.placeId}
          onPress={() => onSelect(prediction)}
          accessibilityRole="button"
          accessibilityLabel={`${prediction.primary}, ${prediction.secondary}`}
          style={() => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          })}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: theme.colors.surface1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={17} color={theme.colors.textSecondary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
              {prediction.primary}
            </Text>
            {prediction.secondary ? (
              <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17 }}>
                {prediction.secondary}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Message({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof MapPin;
  title: string;
  body: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
      <Icon size={22} color={theme.colors.textTertiary} />
      <Text weight="medium" style={{ fontSize: 15, lineHeight: 20 }}>
        {title}
      </Text>
      <Text color="secondary" align="center" style={{ fontSize: 13, lineHeight: 18, maxWidth: 260 }}>
        {body}
      </Text>
    </View>
  );
}
