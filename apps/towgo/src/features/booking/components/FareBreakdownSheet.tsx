import React from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PricingEstimateResponse } from '@towing/api-contracts';
import { useTheme } from '@towing/theme';
import { Button, StatusBadge, Text } from '@towing/ui';
import { DetailRow, RowDivider } from '@/components/DetailRow';
import { TrendingUp } from '@/icons';
import { formatPaise } from '@/utils/format';
import { FareBreakdownSkeleton } from './FareBreakdownSkeleton';

/**
 * §9.1.5 step 3 — "transparent breakdown (base, night, highway, accident,
 * surge, est. total) + ETA".
 *
 * A REACT-NATIVE `Modal`, NOT THE APP'S OWN `BottomSheet`. `@/motion`'s sheet
 * says in its own header that it is hand-rolled precisely because "both sheets
 * in this app are non-modal, always visible and in-screen: no backdrop, no
 * portal". This one is the opposite of all three — it sits above the booking
 * sheet, dims what is behind it and is dismissed. Reusing the in-screen sheet
 * would have meant adding a backdrop and a portal to a component whose whole
 * justification is not having them. `PushPrimingSheet` set this pattern.
 *
 * ROWS ONLY EXIST WHEN THEY ARE NON-ZERO. A breakdown listing "Night charge ₹0"
 * and "Highway ₹0" reads as a list of things we might yet charge for. §7.6's
 * promise is transparency about what the customer IS paying.
 */
export function FareBreakdownSheet({
  visible,
  onClose,
  estimate,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  estimate: PricingEstimateResponse | undefined;
  loading: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
        <View
          style={{
            backgroundColor: theme.colors.surface0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: theme.spacing.xxl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.xxl),
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.xxl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Text weight="semibold" style={{ fontSize: 18, flex: 1 }}>
              Fare breakdown
            </Text>
            {estimate?.surgeActive ? (
              <StatusBadge label="Surge" tone="warning" pill icon={TrendingUp} />
            ) : null}
          </View>

          <ScrollView
            style={{ marginTop: theme.spacing.lg }}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.xxl }}
          >
            {loading || !estimate ? (
              <FareBreakdownSkeleton />
            ) : (
              <>
                <DetailRow label="Base fare" value={formatPaise(estimate.breakdown.basePaise)} tabular />
                {estimate.breakdown.nightPaise > 0 ? (
                  <>
                    <RowDivider />
                    <DetailRow
                      label="Night charge"
                      description="Tows between 10 pm and 6 am"
                      value={formatPaise(estimate.breakdown.nightPaise)}
                      tabular
                    />
                  </>
                ) : null}
                {estimate.breakdown.highwayPaise > 0 ? (
                  <>
                    <RowDivider />
                    <DetailRow
                      label="Highway pickup"
                      description={estimate.zone.name}
                      value={formatPaise(estimate.breakdown.highwayPaise)}
                      tabular
                    />
                  </>
                ) : null}
                {estimate.breakdown.accidentPaise > 0 ? (
                  <>
                    <RowDivider />
                    <DetailRow
                      label="Accident recovery"
                      description="Specialist equipment and handling"
                      value={formatPaise(estimate.breakdown.accidentPaise)}
                      tabular
                    />
                  </>
                ) : null}
                {estimate.breakdown.surgePaise > 0 ? (
                  <>
                    <RowDivider />
                    <DetailRow
                      label="Surge"
                      description="High demand in this area right now"
                      value={formatPaise(estimate.breakdown.surgePaise)}
                      tabular
                    />
                  </>
                ) : null}
                {estimate.breakdown.discountPaise > 0 ? (
                  <>
                    <RowDivider />
                    <DetailRow
                      label="Discount"
                      value={`-${formatPaise(estimate.breakdown.discountPaise)}`}
                      tabular
                    />
                  </>
                ) : null}

                <RowDivider />
                <DetailRow
                  label="Total estimate"
                  value={formatPaise(estimate.breakdown.totalPaise)}
                  strong
                  tabular
                />

                <View style={{ marginTop: theme.spacing.lg, gap: 4 }}>
                  {estimate.distanceKm > 0 ? (
                    <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
                      {estimate.distanceKm.toFixed(1)} km
                      {estimate.etaMinutes !== null ? ` · about ${estimate.etaMinutes} min` : ''}
                      {/* §19.2 made visible. A straight-line number quoted as a
                          routed one is the dishonest version of this fallback. */}
                      {estimate.distanceSource === 'haversine' ? ' · estimated distance' : ''}
                    </Text>
                  ) : null}
                  <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
                    Fare locks when you confirm; it may change with demand until then.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: theme.spacing.xxl, marginTop: theme.spacing.xl }}>
            <Button label="Got it" onPress={onClose} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
