import React from 'react';
import { Text } from '@towing/ui';

/** Bold heading above a card group. `title` is the 18/24 step (Figma 78:930 / 20:658). */
export function SectionHeading({ title }: { title: string }) {
  return (
    <Text variant="title" weight="bold">
      {title}
    </Text>
  );
}
