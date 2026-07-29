import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Skeleton, type IconComponent } from '@towing/ui';
import { Check, X, MapPin, CreditCard, Truck, Route, Calendar } from '@/icons';
import { IconChip } from '@/components/IconChip';
import { driverColors, type ChipTone } from '@/theme/driverColors';
import { formatINR } from '@/utils/format';
import type { Job, JobStatus } from '../types';

/**
 * The leading chip alone carries the status (green check / red cross / blue
 * truck) — no extra status pill, so the card stays calm.
 */
const STATUS_CHIP: Record<JobStatus, { icon: IconComponent; tone: ChipTone }> = {
  completed: { icon: Check, tone: 'green' },
  cancelled: { icon: X, tone: 'red' },
  assigned: { icon: Truck, tone: 'blue' },
};

function MetaItem({
  icon: Icon,
  label,
  shrink = 1,
}: {
  icon: IconComponent;
  label: string;
  shrink?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: shrink }}>
      <Icon size={13} color={theme.colors.textTertiary} strokeWidth={2} />
      <Text color="secondary" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  );
}

/** A job history card on the Jobs screen (status chip · route · fare · meta). */
export function JobCard({ job, onPress }: { job: Job; onPress?: () => void }) {
  const theme = useTheme();
  const chip = STATUS_CHIP[job.status];

  return (
    <Card radius="card" padding={16} onPress={onPress} style={{ gap: 13 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <IconChip icon={chip.icon} tone={chip.tone} size={44} iconSize={18} />

        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>
            {job.vehicleName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: driverColors.onlineDot }}
            />
            <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, flex: 1 }}>
              {job.pickup}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={11} color={theme.colors.error} strokeWidth={2.4} />
            <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, flex: 1 }}>
              {job.drop}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text weight="semibold" tabular style={{ fontSize: 16, lineHeight: 21 }}>
            {formatINR(job.fare)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {job.payment === 'cash' ? 'Cash' : 'Online'}
            </Text>
            <CreditCard size={13} color={theme.colors.textTertiary} strokeWidth={2} />
          </View>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <MetaItem icon={Truck} label={job.towTypeLabel} />
        <MetaItem icon={Route} label={`${job.distanceKm} km`} />
        <MetaItem icon={Calendar} label={job.dateTimeLabel} shrink={0} />
      </View>
    </Card>
  );
}

export function JobCardSkeleton() {
  const theme = useTheme();
  return (
    <Card radius="card" padding={16} style={{ gap: 13 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="60%" height={12} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Skeleton width={50} height={16} />
          <Skeleton width={44} height={12} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="26%" height={12} />
        <Skeleton width="22%" height={12} />
        <Skeleton width="34%" height={12} />
      </View>
    </Card>
  );
}
