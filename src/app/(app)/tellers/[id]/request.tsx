import { SessionRequest } from '@/screens/session-request';
import { useLocalSearchParams } from 'expo-router';

export default function SessionRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionRequest tellerId={id} />;
}
