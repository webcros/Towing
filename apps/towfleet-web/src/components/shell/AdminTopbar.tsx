'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@towing/web-ui';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AdminTopbar() {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/admin-session', { method: 'DELETE' });
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <span className="font-display text-lg font-bold text-brand">Towing Admin</span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
