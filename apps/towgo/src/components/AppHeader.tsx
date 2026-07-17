import React from 'react';
import { AppBar, IconButton } from '@towing/ui';
import { Menu, Bell } from '@/icons';
import { Logo } from './Logo';

export type AppHeaderProps = {
  onMenu?: () => void;
  onNotifications?: () => void;
};

const noop = () => {};

/** Shared top bar (menu · TowGo logo · bell) used across primary tabs. */
export function AppHeader({ onMenu = noop, onNotifications = noop }: AppHeaderProps) {
  return (
    <AppBar
      left={<IconButton icon={Menu} label="Open menu" onPress={onMenu} />}
      center={<Logo />}
      right={
        <IconButton
          icon={Bell}
          label="Notifications"
          variant="surface"
          size={17}
          onPress={onNotifications}
          style={{ width: 40, height: 40, borderRadius: 13 }}
        />
      }
    />
  );
}
