import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Skeleton, type IconComponent } from '@towing/ui';
import { MapPin, Wallet, Truck, Route, Clock, Car, MessageCircle } from '@/icons';
import { Pill } from '@/components/Pill';
import { driverColors } from '@/theme/driverColors';
import { formatINR } from '@/utils/format';
import type { JobOffer } from '../types';

const carImage = require('@/assets/illustrations/offer-car.png');

const HAIRLINE = '#E5E7EB';
const INK_SOFT = '#4B5563';

/** 44px rounded-square gray chip (Vehicle Details / Customer Note rows). */
function SquareChip({ icon: Icon }: { icon: IconComponent }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 11,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={15} color={INK_SOFT} strokeWidth={2} />
    </View>
  );
}

function MetaCol({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
      <Icon size={18} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text color="secondary" style={{ fontSize: 13, lineHeight: 18, marginTop: 4 }}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: valueColor }}>
        {value}
      </Text>
    </View>
  );
}

function Separator() {
  return <View style={{ height: 1, backgroundColor: HAIRLINE }} />;
}

/** The incoming tow request card on the New Job screen (Figma 78:234). */
export function OfferCard({
  offer,
  expiresLabel,
  onAccept,
  onDecline,
}: {
  offer: JobOffer;
  expiresLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const theme = useTheme();

  return (
    <Card
      padding={19}
      style={{ paddingTop: 30, borderRadius: 22, borderColor: HAIRLINE, gap: 12 }}
    >
      {/* Time-to-pickup + fare */}
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <Pill
          label={`${offer.minutesAway} min away`}
          bg={theme.colors.card}
          fg={driverColors.amber}
          borderColor={HAIRLINE}
          radius={7}
          textSize={13}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <Text weight="medium" tabular style={{ fontSize: 22, lineHeight: 29 }}>
            {formatINR(offer.fare)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, lineHeight: 22, color: driverColors.online }}>
              {offer.payment === 'cash' ? 'Cash' : 'Online'}
            </Text>
            <Wallet size={14} color={driverColors.online} strokeWidth={2} />
          </View>
        </View>
      </View>

      {/* Vehicle + route */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 4 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: driverColors.noticeBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={carImage} resizeMode="contain" style={{ width: 40, height: 30 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="medium" numberOfLines={1} style={{ fontSize: 20, lineHeight: 27 }}>
            {offer.vehicleName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7 }}>
            <View
              style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: driverColors.online }}
            />
            <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 25, flex: 1 }}>
              {offer.pickup}
            </Text>
          </View>
          <View
            style={{
              height: 14,
              width: 1,
              marginLeft: 5,
              borderLeftWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#9CA3AF',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <MapPin size={14} color={theme.colors.error} strokeWidth={2.4} />
            <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 25, flex: 1 }}>
              {offer.drop}
            </Text>
          </View>
        </View>
      </View>

      <Separator />

      {/* Tow type · distance · expiry countdown */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', paddingVertical: 4 }}>
        <MetaCol icon={Truck} label="Tow Type" value={offer.towTypeLabel} />
        <View style={{ width: 1, backgroundColor: HAIRLINE }} />
        <MetaCol icon={Route} label="Distance" value={`${offer.distanceKm} km`} />
        <View style={{ width: 1, backgroundColor: HAIRLINE }} />
        <MetaCol icon={Clock} label="Expires In" value={expiresLabel} valueColor={driverColors.amber} />
      </View>

      <Separator />

      {/* Vehicle details */}
      <View style={{ flexDirection: 'row', gap: 11, paddingVertical: 4 }}>
        <SquareChip icon={Car} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>Vehicle Details</Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, lineHeight: 22, color: INK_SOFT, paddingBottom: 7 }}
          >
            {`${offer.vehicleName} • ${offer.vehicleColor}`}
          </Text>
          <Pill label={offer.vehiclePlate} bg="#F3F4F6" fg="#374151" radius={7} textSize={14} />
        </View>
      </View>

      <Separator />

      {/* Customer note */}
      <View style={{ flexDirection: 'row', gap: 11, paddingTop: 4, paddingBottom: 7 }}>
        <SquareChip icon={MessageCircle} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>Customer Note</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: INK_SOFT }}>{offer.customerNote}</Text>
        </View>
      </View>

      {/* Actions */}
      <Pressable
        onPress={onAccept}
        accessibilityRole="button"
        accessibilityLabel="Accept job"
        style={({ pressed }) => ({
          backgroundColor: driverColors.amber,
          borderRadius: 11,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text weight="medium" style={{ fontSize: 16, lineHeight: 25, color: '#111827' }}>
          Accept Job
        </Text>
      </Pressable>
      <Pressable
        onPress={onDecline}
        accessibilityRole="button"
        accessibilityLabel="Decline job"
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: '#D1D5DB',
          borderRadius: 11,
          paddingVertical: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.colors.surface1 : theme.colors.card,
        })}
      >
        <Text weight="medium" style={{ fontSize: 16, lineHeight: 25, color: theme.colors.error }}>
          Decline
        </Text>
      </Pressable>
    </Card>
  );
}

export function OfferCardSkeleton() {
  return (
    <Card padding={19} style={{ paddingTop: 30, borderRadius: 22, borderColor: HAIRLINE, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width={92} height={28} radius={7} />
        <Skeleton width={70} height={28} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Skeleton width={72} height={72} radius={36} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="70%" height={14} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: HAIRLINE }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width="30%" height={54} />
        <Skeleton width="30%" height={54} />
        <Skeleton width="30%" height={54} />
      </View>
      <Skeleton width="100%" height={52} radius={11} />
      <Skeleton width="100%" height={52} radius={11} />
    </Card>
  );
}
