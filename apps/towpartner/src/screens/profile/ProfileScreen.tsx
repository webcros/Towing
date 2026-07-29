import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Skeleton, ErrorState, OfflineBanner } from '@towing/ui';
import {
  ClipboardList,
  Star,
  Calendar,
  ShieldCheck,
  Shield,
  User,
  CarFront,
  FileText,
  Wallet,
  Headphones,
  LogOut,
  RefreshCw,
} from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { SectionHeading } from '@/components/SectionHeading';
import { StatRowCard } from '@/components/StatRowCard';
import { MenuCard } from '@/components/MenuCard';
import { MenuRow } from '@/components/MenuRow';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/DriverTabBar';
import { useDriverProfile } from '@/features/profile/api/profile.queries';
import { ProfileHeaderCard } from '@/features/profile/components/ProfileHeaderCard';
import type { RootStackParamList } from '@/navigation/types';

export function ProfileScreen() {
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarSpace = useTabBarSpace();
  const { data, isPending, isError, refetch } = useDriverProfile();

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
    >
      <DriverHeader title="Profile" bellBadge onBell={() => navigation.navigate('Notifications')} />

      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        {isError ? (
          <ErrorState title="Couldn't load your profile" onRetry={() => refetch()} icon={RefreshCw} />
        ) : isPending || !data ? (
          <>
            <Skeleton width="100%" height={200} radius={16} />
            <Skeleton width="100%" height={120} radius={16} />
          </>
        ) : (
          <>
            <ProfileHeaderCard
              profile={data}
              onPress={() => navigation.navigate('PersonalInformation')}
            />

            <StatRowCard
              chipSize={44}
              valueSize={17}
              labelSize={10}
              items={[
                {
                  icon: ClipboardList,
                  tone: 'orange',
                  value: String(data.stats.jobsCompleted),
                  label: 'Jobs Completed',
                  tabular: true,
                },
                {
                  icon: Star,
                  tone: 'green',
                  value: data.stats.rating.toFixed(1),
                  label: 'Rating',
                  tabular: true,
                },
                {
                  icon: Calendar,
                  tone: 'blue',
                  value: data.stats.experienceLabel,
                  label: 'Experience',
                },
                {
                  icon: ShieldCheck,
                  tone: 'purple',
                  value: `${data.stats.completionPercent}%`,
                  label: 'Completion',
                  tabular: true,
                },
              ]}
            />
          </>
        )}

        {/* Account */}
        <View style={{ gap: 12 }}>
          <SectionHeading title="Account" size={18} />
          <MenuCard>
            <MenuRow
              icon={User}
              tone="orange"
              title="Personal Information"
              subtitle="Update your personal details"
              onPress={() => navigation.navigate('PersonalInformation')}
            />
            <MenuRow
              icon={CarFront}
              tone="green"
              title="My Vehicles"
              subtitle="Manage your registered vehicles"
              onPress={() => navigation.navigate('MyVehicles')}
            />
            <MenuRow
              icon={FileText}
              tone="blue"
              title="Documents"
              subtitle="View and update your documents"
              onPress={() => navigation.navigate('Documents')}
            />
            <MenuRow
              icon={Wallet}
              tone="purple"
              title="Bank Details"
              subtitle="Manage your bank account"
              onPress={() => navigation.navigate('BankDetails')}
            />
            <MenuRow
              icon={ShieldCheck}
              tone="orange"
              title="Insurance"
              subtitle="View your insurance details"
              onPress={() => navigation.navigate('Insurance')}
            />
          </MenuCard>
        </View>

        {/* Support */}
        <View style={{ gap: 12 }}>
          <SectionHeading title="Support" size={18} />
          <MenuCard>
            <MenuRow
              icon={Headphones}
              tone="green"
              title="Help & Support"
              subtitle="Get help and contact support"
              onPress={() => navigation.navigate('HelpSupport')}
            />
            <MenuRow
              icon={FileText}
              tone="blue"
              title="Terms & Conditions"
              subtitle="Read our terms and conditions"
              onPress={() => navigation.navigate('Terms')}
            />
            <MenuRow
              icon={Shield}
              tone="purple"
              title="Privacy Policy"
              subtitle="Read our privacy policy"
              onPress={() => navigation.navigate('Privacy')}
            />
            <MenuRow
              icon={LogOut}
              title="Logout"
              danger
              center
              trailing="none"
              onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
            />
          </MenuCard>
        </View>
      </View>
    </Screen>
  );
}
