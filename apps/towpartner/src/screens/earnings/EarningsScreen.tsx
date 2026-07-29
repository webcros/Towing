import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Skeleton, ErrorState, OfflineBanner } from '@towing/ui';
import { Wallet, FileText, IndianRupee, Gift, CalendarDays, RefreshCw } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { SectionHeading } from '@/components/SectionHeading';
import { StatRowCard } from '@/components/StatRowCard';
import { DividedCard } from '@/components/DividedCard';
import { FilterTabs, type FilterTabOption } from '@/components/FilterTabs';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/DriverTabBar';
import { useEarnings } from '@/features/earnings/api/earnings.queries';
import { TotalEarningsCard } from '@/features/earnings/components/TotalEarningsCard';
import { EarningsTrendChart } from '@/features/earnings/components/EarningsTrendChart';
import { TransactionRow } from '@/features/earnings/components/TransactionRow';
import type { EarningsPeriod } from '@/features/earnings/types';
import { formatINR, pad2 } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

const PERIODS: FilterTabOption<EarningsPeriod>[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom', icon: CalendarDays },
];

export function EarningsScreen() {
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const tabBarSpace = useTabBarSpace();
  const { data, isPending, isError, refetch } = useEarnings(period);

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
    >
      <DriverHeader title="Earnings" bellBadge onBell={() => navigation.navigate('Notifications')} />

      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        {isError ? (
          <ErrorState title="Couldn't load your earnings" onRetry={() => refetch()} icon={RefreshCw} />
        ) : (
          <>
            {isPending || !data ? (
              <Skeleton width="100%" height={150} radius={24} />
            ) : (
              <TotalEarningsCard summary={data.summary} />
            )}

            <FilterTabs options={PERIODS} value={period} onChange={setPeriod} />

            {/* Earnings Summary */}
            <View style={{ gap: 12 }}>
              <SectionHeading title="Earnings Summary" />
              {isPending || !data ? (
                <Skeleton width="100%" height={120} radius={16} />
              ) : (
                <StatRowCard
                  chipSize={44}
                  valueSize={15}
                  dividers={false}
                  items={[
                    {
                      icon: Wallet,
                      tone: 'gold',
                      value: formatINR(data.summary.total),
                      label: 'Total Earnings',
                      tabular: true,
                    },
                    {
                      icon: FileText,
                      tone: 'green',
                      value: pad2(data.summary.jobsCompleted),
                      label: 'Jobs Completed',
                      tabular: true,
                    },
                    {
                      icon: IndianRupee,
                      tone: 'blue',
                      value: formatINR(data.summary.avgPerJob),
                      label: 'Avg Per Job',
                      tabular: true,
                    },
                    {
                      icon: Gift,
                      tone: 'purple',
                      value: formatINR(data.summary.bonus),
                      label: 'Bonus',
                      tabular: true,
                    },
                  ]}
                />
              )}
            </View>

            {/* Earnings Trend */}
            <View style={{ gap: 12 }}>
              <SectionHeading title="Earnings Trend" actionLabel="View Report ›" />
              {isPending || !data ? (
                <Skeleton width="100%" height={190} radius={16} />
              ) : (
                <EarningsTrendChart points={data.trend} />
              )}
            </View>

            {/* Recent Transactions */}
            <View style={{ gap: 12 }}>
              <SectionHeading title="Recent Transactions" actionLabel="View All" />
              {isPending || !data ? (
                <Skeleton width="100%" height={240} radius={16} />
              ) : (
                <DividedCard>
                  {data.transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </DividedCard>
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
