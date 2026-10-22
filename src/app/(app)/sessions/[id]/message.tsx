import { SessionMessage } from '@/screens/session-message';
import { useLocalSearchParams } from 'expo-router';

export default function SessionMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionMessage sessionId={id} />;
}
