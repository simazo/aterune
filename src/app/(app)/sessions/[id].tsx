import { SessionDetail } from '@/screens/session-detail';
import { useLocalSearchParams } from 'expo-router';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetail sessionId={id} />;
}
