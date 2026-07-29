import React from 'react';
import { Text } from '@towing/ui';

/** Bold heading above a card group (17/23 — the type scale has no 18 step). */
export function SectionHeading({ title }: { title: string }) {
  return (
    <Text weight="bold" style={{ fontSize: 17, lineHeight: 23 }}>
      {title}
    </Text>
  );
}
