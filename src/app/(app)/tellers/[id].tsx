import { TellerDetail } from '@/screens/teller-detail';
import { useLocalSearchParams } from 'expo-router';

export default function TellerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TellerDetail tellerId={id} />;
}
