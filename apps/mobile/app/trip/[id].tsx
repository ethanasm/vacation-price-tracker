import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScreenStub } from '@/components/screen-stub';

export default function TripDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub title="Trip detail" subtitle={`trip ${id ?? ''} — built in P3`} />;
}
